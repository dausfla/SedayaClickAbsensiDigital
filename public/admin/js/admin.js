// public/admin/js/admin.js
// Dashboard Middle Management (Aditia & Mas Naufal) - Focused Operational Supervision & Approvals

let state = {
  user: null,
  divisions: [],
  employees: [],
  pendingSubmissions: [],
  historySubmissions: [],
  pendingOvertimes: [],
  historyOvertimes: [],
  selectedDivisionId: '',
  searchKeyword: '',
  activeTab: 'pending',
  historyStatusFilter: 'all',
  overtimeHistoryStatusFilter: 'all',
  pollingInterval: null,
  roster: {
    month: '',
    divisionId: '',
    scope: 'roster',
    days: [],
    employees: [],
    schedules: {},
    shiftCodes: {},
    searchKeyword: '',
    loaded: false
  }
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initEventListeners();
  
  const ok = await checkAuth();
  if (!ok) return;

  // Initial load: divisions & employees, then initial data
  await Promise.all([
    loadDivisions(),
    loadEmployees()
  ]);

  await refreshAllData();

  // Smart polling every 6 seconds: only polls lightweight pending queues for maximum speed and smoothness
  state.pollingInterval = setInterval(pollPendingData, 6000);
});

// Theme Initialization
function renderThemeToggleBtn(isDark) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  if (isDark) {
    btn.className = 'relative inline-flex items-center justify-between p-1.5 sm:w-[130px] sm:h-8 px-1 sm:px-1.5 rounded-full bg-slate-900 border border-slate-700 cursor-pointer select-none transition-all shadow-xs hover:scale-105 shrink-0';
    btn.innerHTML = `
      <div class="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center shrink-0 border border-slate-700">
        <svg class="w-3.5 h-3.5 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.3 2a10 10 0 0 0 9.7 12.8 10 10 0 1 1-9.7-12.8z"/>
          <path d="M18 3.5l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4z"/>
        </svg>
      </div>
      <span class="text-[9px] font-black tracking-wider text-white pr-2 uppercase select-none font-mono hidden sm:inline">NIGHT MODE</span>
    `;
  } else {
    btn.className = 'relative inline-flex items-center justify-between p-1.5 sm:w-[130px] sm:h-8 px-1 sm:px-1.5 rounded-full bg-slate-200/90 border border-slate-300 cursor-pointer select-none transition-all shadow-xs hover:scale-105 shrink-0';
    btn.innerHTML = `
      <span class="text-[9px] font-black tracking-wider text-slate-900 pl-2 uppercase select-none font-mono hidden sm:inline">DAY MODE</span>
      <div class="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center shrink-0 border border-slate-200">
        <svg class="w-3.5 h-3.5 text-slate-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4.5"></circle>
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m14.14-14.14l-1.41 1.41"/>
        </svg>
      </div>
    `;
  }
}

function initTheme() {
  const isDark = localStorage.getItem('theme') === 'dark' || 
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  renderThemeToggleBtn(isDark);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  renderThemeToggleBtn(isDark);
}

// Authentication Check
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/session');
    const data = await res.json();
    if (!data.success || !data.loggedIn || !data.user || !['admin_manager', 'super_admin'].includes(data.user.role)) {
      window.location.href = '/login.html';
      return false;
    }
    state.user = data.user;
    
    // Update Header & Welcome Banner secara Dinamis sesuai nama yang terdaftar di database
    const nameEl = document.getElementById('user-fullname');
    const welcomeEl = document.getElementById('welcome-username');
    const emailEl = document.getElementById('user-email');
    const registeredName = data.user.full_name || 'Middle Management';

    if (nameEl) nameEl.textContent = registeredName;
    if (welcomeEl) welcomeEl.textContent = registeredName;
    if (emailEl) emailEl.textContent = data.user.email || 'admin@sedayaclick.com';

    // Format Tanggal Hari Ini di Banner
    const bannerDate = document.getElementById('banner-date-badge');
    if (bannerDate) {
      const now = new Date();
      bannerDate.textContent = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    return true;
  } catch (err) {
    console.error('Auth Check Error:', err);
    window.location.href = '/login.html';
    return false;
  }
}

// Initialize Event Listeners
function initEventListeners() {
  // Theme Toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    }
  });

  // Division Filter Change (Global)
  document.getElementById('filter-division')?.addEventListener('change', async (e) => {
    state.selectedDivisionId = e.target.value;
    await loadEmployees();
    await refreshAllData();
  });

  // Search Input (Debounced to eliminate input lag and stutter)
  let searchDebounceTimer = null;
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      state.searchKeyword = e.target.value.toLowerCase().trim();
      renderTables();
    }, 200);
  });

  // Terapkan Filter Button
  document.getElementById('btn-apply-filter')?.addEventListener('click', async () => {
    const divSelect = document.getElementById('filter-division');
    const searchInp = document.getElementById('search-input');
    if (divSelect) state.selectedDivisionId = divSelect.value;
    if (searchInp) state.searchKeyword = searchInp.value.toLowerCase().trim();
    await loadEmployees();
    await refreshAllData();
    showToast('Filter berhasil diterapkan', 'info');
  });

  // Refresh Button
  document.getElementById('btn-refresh')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh');
    btn.classList.add('animate-spin');
    await refreshAllData();
    setTimeout(() => btn.classList.remove('animate-spin'), 600);
    showToast('Data berhasil disinkronkan', 'success');
  });

  // Desktop SubTabs Switch (Paired Nomenclature)
  document.getElementById('tab-btn-pending')?.addEventListener('click', () => switchTab('pending'));
  document.getElementById('tab-btn-overtime')?.addEventListener('click', () => switchTab('overtime'));
  document.getElementById('tab-btn-history')?.addEventListener('click', () => switchTab('history'));
  document.getElementById('tab-btn-overtime-history')?.addEventListener('click', () => switchTab('overtime-history'));
  document.getElementById('tab-btn-roster')?.addEventListener('click', () => switchTab('roster'));

  // Status Action Filter Pills (Riwayat Izin & Cuti)
  document.querySelectorAll('.history-status-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.historyStatusFilter = btn.getAttribute('data-status') || 'all';
      updateHistoryStatusPills();
      renderHistoryTable();
      renderHistoryCards();
    });
  });

  // Status Action Filter Pills (Riwayat Presensi Lembur)
  document.querySelectorAll('.ot-history-status-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.overtimeHistoryStatusFilter = btn.getAttribute('data-status') || 'all';
      updateOtHistoryStatusPills();
      renderOvertimeHistoryTable();
      renderOvertimeHistoryCards();
    });
  });

  // Roster Toolbar & Event Listeners
  document.getElementById('roster-month-input')?.addEventListener('change', (e) => {
    if (!state.roster) state.roster = {};
    state.roster.month = e.target.value;
    loadRosterMatrix();
  });
  document.getElementById('roster-division-filter')?.addEventListener('change', (e) => {
    if (!state.roster) state.roster = {};
    state.roster.divisionId = e.target.value;
    loadRosterMatrix();
  });
  document.getElementById('roster-scope-filter')?.addEventListener('change', (e) => {
    if (!state.roster) state.roster = {};
    state.roster.scope = e.target.value;
    loadRosterMatrix();
  });
  document.getElementById('roster-search-input')?.addEventListener('input', (e) => {
    if (!state.roster) state.roster = {};
    state.roster.searchKeyword = e.target.value.toLowerCase().trim();
    renderRosterMatrix();
  });
  document.getElementById('btn-roster-download-template')?.addEventListener('click', downloadRosterTemplate);
  document.getElementById('btn-roster-export-matrix')?.addEventListener('click', exportRosterMatrix);
  document.getElementById('btn-open-roster-import')?.addEventListener('click', openRosterImportModal);
  document.getElementById('btn-close-import-modal')?.addEventListener('click', closeRosterImportModal);
  document.getElementById('btn-cancel-import')?.addEventListener('click', closeRosterImportModal);
  document.getElementById('form-import-roster')?.addEventListener('submit', handleRosterImport);

  // iOS Floating Dock Buttons Switch
  document.querySelectorAll('.dock-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-dock');
      if (target) switchTab(target);
    });
  });

  // Modal Submission Open/Close
  document.getElementById('btn-open-create-modal')?.addEventListener('click', () => openSubmissionModal());
  document.getElementById('btn-close-modal')?.addEventListener('click', closeSubmissionModal);
  document.getElementById('btn-cancel-modal')?.addEventListener('click', closeSubmissionModal);

  // Form Submit
  document.getElementById('form-submission')?.addEventListener('submit', handleFormSubmit);

  // Modal Decision Open/Close
  document.getElementById('btn-close-decision-modal')?.addEventListener('click', closeDecisionModal);
  document.getElementById('btn-cancel-decision')?.addEventListener('click', closeDecisionModal);
  document.getElementById('btn-confirm-decision')?.addEventListener('click', handleDecisionSubmit);

  // Modal Overtime Detail Close
  document.getElementById('btn-close-ot-detail')?.addEventListener('click', closeOvertimeDetailModal);
  document.getElementById('btn-done-ot-detail')?.addEventListener('click', closeOvertimeDetailModal);

  // Attachment modal close
  document.getElementById('btn-close-attachment-modal')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-attachment-viewer');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    document.body.style.overflow = '';
  });
}

// Switch Tabs & Sync with Floating iOS Dock (Paired Nomenclature)
function switchTab(tab) {
  state.activeTab = tab;

  const btnPending = document.getElementById('tab-btn-pending');
  const btnOvertime = document.getElementById('tab-btn-overtime');
  const btnHistory = document.getElementById('tab-btn-history');
  const btnOvertimeHistory = document.getElementById('tab-btn-overtime-history');
  const btnRoster = document.getElementById('tab-btn-roster');

  const panelPending = document.getElementById('panel-pending');
  const panelOvertime = document.getElementById('panel-overtime');
  const panelHistory = document.getElementById('panel-history');
  const panelOvertimeHistory = document.getElementById('panel-overtime-history');
  const panelRoster = document.getElementById('panel-roster');

  const tabs = [
    { name: 'pending', btn: btnPending, panel: panelPending },
    { name: 'overtime', btn: btnOvertime, panel: panelOvertime },
    { name: 'history', btn: btnHistory, panel: panelHistory },
    { name: 'overtime-history', btn: btnOvertimeHistory, panel: panelOvertimeHistory },
    { name: 'roster', btn: btnRoster, panel: panelRoster }
  ];

  tabs.forEach(t => {
    if (!t.btn || !t.panel) return;
    if (t.name === tab) {
      t.btn.classList.add('border-indigo-600', 'text-indigo-600', 'dark:border-indigo-500', 'dark:text-indigo-400');
      t.btn.classList.remove('border-transparent', 'text-slate-500', 'dark:text-slate-400');
      t.panel.classList.remove('hidden');
    } else {
      t.btn.classList.remove('border-indigo-600', 'text-indigo-600', 'dark:border-indigo-500', 'dark:text-indigo-400');
      t.btn.classList.add('border-transparent', 'text-slate-500', 'dark:text-slate-400');
      t.panel.classList.add('hidden');
    }
  });

  // Sync Floating Dock Active Status
  document.querySelectorAll('.dock-item').forEach(dBtn => {
    const dTarget = dBtn.getAttribute('data-dock');
    if (dTarget === tab) {
      dBtn.classList.add('active');
    } else {
      dBtn.classList.remove('active');
    }
  });

  // Render immediately for the newly active tab
  renderTables();

  // Jika tab roster aktif, selalu reload matriks agar sinkron dengan Super Admin
  if (tab === 'roster') {
    loadRosterMatrix();
  }
}

// Load Divisions
async function loadDivisions() {
  try {
    const res = await fetch('/api/admin/divisions');
    const data = await res.json();
    if (data.success) {
      state.divisions = data.divisions || [];
      
      const filterSelect = document.getElementById('filter-division');
      if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Semua Divisi (Seluruh Karyawan)</option>' +
          state.divisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
      }

      const rosterDivSelect = document.getElementById('roster-division-filter');
      if (rosterDivSelect) {
        rosterDivSelect.innerHTML = '<option value="">Semua Divisi</option>' +
          state.divisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
      }
    }
  } catch (err) {
    console.error('Gagal memuat divisi:', err);
  }
}

// Load Employees Dropdown
async function loadEmployees() {
  try {
    const url = state.selectedDivisionId 
      ? `/api/admin/employees?division_id=${state.selectedDivisionId}`
      : '/api/admin/employees';
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      state.employees = data.employees || [];
      const select = document.getElementById('form-user-id');
      if (select) {
        select.innerHTML = '<option value="">-- Pilih Karyawan --</option>' +
          state.employees.map(e => `<option value="${e.id}">${escapeHtml(e.full_name)} (${escapeHtml(e.division_name || '-')})</option>`).join('');
      }
    }
  } catch (err) {
    console.error('Gagal memuat karyawan:', err);
  }
}

let syncCycleCount = 0;
let isRefreshing = false;

// Polling Ringan & Cepat (Hanya antrean pending untuk notifikasi real-time & hemat bandwidth/CPU)
async function pollPendingData() {
  if (isRefreshing) return;
  try {
    const divisionParam = state.selectedDivisionId ? `?division_id=${state.selectedDivisionId}` : '';
    const [resPending, resOvertimePending] = await Promise.all([
      fetch(`/api/admin/submissions/pending${divisionParam}`),
      fetch(`/api/admin/overtime/pending${divisionParam}`)
    ]);

    const [dataPending, dataOtPending] = await Promise.all([
      resPending.json(),
      resOvertimePending.json()
    ]);

    if (dataPending.success) state.pendingSubmissions = dataPending.submissions || [];
    if (dataOtPending.success) state.pendingOvertimes = dataOtPending.overtimes || [];

    updateStats();
    if (state.activeTab === 'pending' || state.activeTab === 'overtime') {
      renderTables();
    }
  } catch (err) {
    console.warn('[Polling Pending Warning]:', err.message);
  }
}

// Refresh All Data (Termasuk riwayat & audit trail)
async function refreshAllData() {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    syncCycleCount++;
    const divisionParam = state.selectedDivisionId ? `?division_id=${state.selectedDivisionId}` : '';
    const [resPending, resHistory, resOvertimePending, resOvertimeHistory] = await Promise.all([
      fetch(`/api/admin/submissions/pending${divisionParam}`),
      fetch(`/api/admin/submissions/history${divisionParam}`),
      fetch(`/api/admin/overtime/pending${divisionParam}`),
      fetch(`/api/admin/overtime/history${divisionParam}`)
    ]);

    const [dataPending, dataHistory, dataOtPending, dataOtHistory] = await Promise.all([
      resPending.json(),
      resHistory.json(),
      resOvertimePending.json(),
      resOvertimeHistory.json()
    ]);

    if (dataPending.success) state.pendingSubmissions = dataPending.submissions || [];
    if (dataHistory.success) state.historySubmissions = dataHistory.submissions || [];
    if (dataOtPending.success) state.pendingOvertimes = dataOtPending.overtimes || [];
    if (dataOtHistory.success) state.historyOvertimes = dataOtHistory.overtimes || [];

    updateStats();
    updateHistoryStatusPills();
    updateOtHistoryStatusPills();
    renderTables();

    if (state.activeTab === 'roster') {
      loadRosterMatrix(true);
    }
  } catch (err) {
    console.error('Error saat sinkronisasi data:', err);
  } finally {
    isRefreshing = false;
  }
}

// Update Stats & Badges
function updateStats() {
  const pendingSubCount = (state.pendingSubmissions || []).filter(s => s.type !== 'lembur').length;
  const pendingOtCount = (state.pendingOvertimes || []).length;
  const totalPending = pendingSubCount + pendingOtCount;

  const approvedSubCount = (state.historySubmissions || []).filter(s => s.status === 'approved').length;
  const rejectedSubCount = (state.historySubmissions || []).filter(s => s.status === 'rejected').length;

  const approvedOtCount = (state.historyOvertimes || []).filter(s => s.overtime_status === 'approved').length;
  const rejectedOtCount = (state.historyOvertimes || []).filter(s => s.overtime_status === 'rejected').length;

  const statPending = document.getElementById('stat-pending');
  if (statPending) statPending.textContent = totalPending;
  const statApproved = document.getElementById('stat-approved');
  if (statApproved) statApproved.textContent = approvedSubCount + approvedOtCount;
  const statRejected = document.getElementById('stat-rejected');
  if (statRejected) statRejected.textContent = rejectedSubCount + rejectedOtCount;

  const bPending = document.getElementById('badge-pending-count');
  if (bPending) bPending.textContent = pendingSubCount;
  const bOtPending = document.getElementById('badge-overtime-pending-count');
  if (bOtPending) bOtPending.textContent = pendingOtCount;
  const bHistory = document.getElementById('badge-history-count');
  if (bHistory) bHistory.textContent = state.historySubmissions.length;
  const bOtHistory = document.getElementById('badge-overtime-history-count');
  if (bOtHistory) bOtHistory.textContent = state.historyOvertimes.length;

  // Dock badges
  const dockBadgePending = document.getElementById('dock-badge-pending');
  if (dockBadgePending) {
    dockBadgePending.textContent = pendingSubCount;
    if (pendingSubCount > 0) {
      dockBadgePending.classList.remove('hidden');
      dockBadgePending.style.display = 'inline-flex';
    } else {
      dockBadgePending.classList.add('hidden');
      dockBadgePending.style.display = 'none';
    }
  }

  const dockBadgeOvertime = document.getElementById('dock-badge-overtime');
  if (dockBadgeOvertime) {
    dockBadgeOvertime.textContent = pendingOtCount;
    if (pendingOtCount > 0) {
      dockBadgeOvertime.classList.remove('hidden');
      dockBadgeOvertime.style.display = 'inline-flex';
    } else {
      dockBadgeOvertime.classList.add('hidden');
      dockBadgeOvertime.style.display = 'none';
    }
  }
}

// Update Filter Pill Badges & Active Styles (Riwayat Izin/Cuti)
function updateHistoryStatusPills() {
  const allList = (state.historySubmissions || []).filter(s => s.type !== 'lembur');
  const countAll = allList.length;
  const countApproved = allList.filter(s => s.status === 'approved').length;
  const countRejected = allList.filter(s => s.status === 'rejected').length;
  const countReview = allList.filter(s => s.status === 'under_review').length;

  const elAll = document.getElementById('pill-count-history-all');
  if (elAll) elAll.textContent = countAll;
  const elApp = document.getElementById('pill-count-history-approved');
  if (elApp) elApp.textContent = countApproved;
  const elRej = document.getElementById('pill-count-history-rejected');
  if (elRej) elRej.textContent = countRejected;
  const elRev = document.getElementById('pill-count-history-review');
  if (elRev) elRev.textContent = countReview;

  document.querySelectorAll('.history-status-pill').forEach(btn => {
    const st = btn.getAttribute('data-status');
    if (st === state.historyStatusFilter) {
      btn.className = 'history-status-pill active px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs';
    } else {
      if (st === 'approved') btn.className = 'history-status-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50';
      else if (st === 'rejected') btn.className = 'history-status-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50';
      else if (st === 'under_review') btn.className = 'history-status-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50';
      else btn.className = 'history-status-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700';
    }
  });
}

// Update Filter Pill Badges & Active Styles (Riwayat Lembur)
function updateOtHistoryStatusPills() {
  const allList = state.historyOvertimes || [];
  const countAll = allList.length;
  const countApproved = allList.filter(s => s.overtime_status === 'approved').length;
  const countRejected = allList.filter(s => s.overtime_status === 'rejected').length;
  const countReview = allList.filter(s => s.overtime_status === 'under_review').length;

  const elAll = document.getElementById('pill-count-ot-history-all');
  if (elAll) elAll.textContent = countAll;
  const elApp = document.getElementById('pill-count-ot-history-approved');
  if (elApp) elApp.textContent = countApproved;
  const elRej = document.getElementById('pill-count-ot-history-rejected');
  if (elRej) elRej.textContent = countRejected;
  const elRev = document.getElementById('pill-count-ot-history-review');
  if (elRev) elRev.textContent = countReview;

  document.querySelectorAll('.ot-history-status-pill').forEach(btn => {
    const st = btn.getAttribute('data-status');
    if (st === state.overtimeHistoryStatusFilter) {
      btn.className = 'ot-history-status-pill active px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs';
    } else {
      if (st === 'approved') btn.className = 'ot-history-status-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50';
      else if (st === 'rejected') btn.className = 'ot-history-status-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50';
      else if (st === 'under_review') btn.className = 'ot-history-status-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50';
      else btn.className = 'ot-history-status-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700';
    }
  });
}

// Render Table Pintar (Hanya render DOM tab yang sedang aktif untuk menghilangkan LAG)
function renderTables(forceAll = false) {
  if (forceAll || state.activeTab === 'pending') {
    renderPendingTable();
    renderPendingCards();
  }
  if (forceAll || state.activeTab === 'overtime') {
    renderOvertimePendingTable();
    renderOvertimePendingCards();
  }
  if (forceAll || state.activeTab === 'history') {
    renderHistoryTable();
    renderHistoryCards();
    updateHistoryStatusPills();
  }
  if (forceAll || state.activeTab === 'overtime-history') {
    renderOvertimeHistoryTable();
    renderOvertimeHistoryCards();
    updateOtHistoryStatusPills();
  }
}

// Render Pending Submissions Table
function renderPendingTable() {
  const tbody = document.getElementById('tbody-pending');
  if (!tbody) return;

  let list = (state.pendingSubmissions || []).filter(s => s.type !== 'lembur');
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
          Tidak ada pengajuan yang membutuhkan persetujuan saat ini.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => `
    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
      <td class="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
        ${escapeHtml(item.full_name)}
        <div class="text-[11px] font-normal text-slate-400">${escapeHtml(item.position_name || '-')}</div>
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300">
        <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
          ${escapeHtml(item.division_name || '-')}
        </span>
      </td>
      <td class="px-4 py-3.5">
        <span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase ${getTypeBadgeStyle(item.type)}">
          ${escapeHtml(item.type)}
        </span>
      </td>
      <td class="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[11px]">
        <div class="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
          <svg class="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>${formatDateTime(item.created_at)}</span>
        </div>
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium text-xs">
        ${formatDate(item.start_date)} ${item.start_date !== item.end_date ? `- ${formatDate(item.end_date)}` : ''}
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 max-w-xs" title="${escapeHtml(item.reason)}">
        <div class="font-medium text-slate-800 dark:text-slate-200 leading-snug">${escapeHtml(item.reason || '-')}</div>
        ${item.type === 'cuti' && (item.handover_plan || item.handover_to_name) ? `
          <div class="mt-1.5 p-2 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40 text-[11px] space-y-0.5 text-slate-700 dark:text-slate-300">
            <div class="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 stroke-[2] text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Serah Terima:</span>
            </div>
            ${item.handover_plan ? `<div class="italic text-slate-600 dark:text-slate-400">${escapeHtml(item.handover_plan)}</div>` : ''}
            ${item.handover_to_name ? `<div>Diserahkan ke: <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(item.handover_to_name)}</span> ${item.handover_to_position ? `<span class="text-slate-500">(${escapeHtml(item.handover_to_position)})</span>` : ''}</div>` : ''}
          </div>
        ` : ''}
        ${item.attachment ? `
          <div class="mt-1.5">
            <button type="button" class="btn-view-admin-attachment inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md cursor-pointer" data-url="${item.attachment.replace('/uploads/', '/secure-uploads/')}" data-title="Lampiran Pengajuan ${escapeHtml(item.full_name || '')}">
              <svg class="w-3 h-3 stroke-[2] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.373L8.559 18.32a1.5 1.5 0 11-2.122-2.122l7.693-7.693"/></svg>
              <span>Lihat Surat / Bukti Lampiran</span>
            </button>
          </div>
        ` : ''}
      </td>
      <td class="px-4 py-3.5 text-center">
        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${item.status === 'under_review' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}">
          ${item.status === 'under_review' ? 'Sedang Ditinjau' : 'Pending'}
        </span>
      </td>
      <td class="px-4 py-3.5 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1.5">
          <button onclick="openDecisionModal(${item.id}, 'approved')" class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer">
            Setujui
          </button>
          <button onclick="openDecisionModal(${item.id}, 'under_review')" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer">
            Tinjau
          </button>
          <button onclick="openDecisionModal(${item.id}, 'rejected')" class="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer">
            Tolak
          </button>
          <button onclick="editSubmission(${item.id}, 'pending')" class="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-bold text-[11px] transition-colors cursor-pointer">
            Edit
          </button>
          <button onclick="deleteSubmission(${item.id})" class="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-[11px] transition-colors cursor-pointer">
            Hapus
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Render Pending Submissions Cards (Mobile View)
function renderPendingCards() {
  const container = document.getElementById('cards-pending');
  if (!container) return;

  let list = (state.pendingSubmissions || []).filter(s => s.type !== 'lembur');
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-6 text-center text-slate-400 text-xs">
        Tidak ada pengajuan yang membutuhkan persetujuan saat ini.
      </div>`;
    return;
  }

  container.innerHTML = list.map(item => `
    <div class="glass-card rounded-2xl p-4 space-y-3 border border-slate-200/80 dark:border-slate-800 shadow-xs">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="font-black text-slate-900 dark:text-white text-sm">${escapeHtml(item.full_name)}</h4>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">${escapeHtml(item.division_name || '-')}</span>
            <span class="text-[10px] text-slate-400 font-medium">${escapeHtml(item.position_name || '-')}</span>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${getTypeBadgeStyle(item.type)}">${escapeHtml(item.type)}</span>
      </div>

      <div class="flex items-center gap-1.5 text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 p-2 rounded-xl">
        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span>Submit: <strong>${formatDateTime(item.created_at)}</strong></span>
      </div>

      <div class="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl flex items-center gap-2">
        <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <span>Tanggal: <strong>${formatDate(item.start_date)} ${item.start_date !== item.end_date ? `- ${formatDate(item.end_date)}` : ''}</strong></span>
      </div>

      <div class="text-xs text-slate-700 dark:text-slate-300 space-y-1">
        <p class="font-bold text-[11px] text-slate-400 uppercase tracking-wider">Keterangan / Alasan:</p>
        <p class="leading-relaxed">${escapeHtml(item.reason || '-')}</p>
      </div>

      ${item.type === 'cuti' && (item.handover_plan || item.handover_to_name) ? `
        <div class="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40 text-[11px] space-y-1 text-slate-700 dark:text-slate-300">
          <div class="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span>Serah Terima Pekerjaan:</span>
          </div>
          ${item.handover_plan ? `<div class="italic text-slate-600 dark:text-slate-400">${escapeHtml(item.handover_plan)}</div>` : ''}
          ${item.handover_to_name ? `<div>Dialihkan ke: <strong>${escapeHtml(item.handover_to_name)}</strong> ${item.handover_to_position ? `(${escapeHtml(item.handover_to_position)})` : ''}</div>` : ''}
        </div>
      ` : ''}

      ${item.attachment ? `
        <div>
          <button type="button" class="btn-view-admin-attachment inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-xl cursor-pointer" data-url="${item.attachment.replace('/uploads/', '/secure-uploads/')}" data-title="Lampiran ${escapeHtml(item.full_name || '')}">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
            <span>Lihat Bukti / Surat Lampiran</span>
          </button>
        </div>
      ` : ''}

      <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
        <button onclick="openDecisionModal(${item.id}, 'approved')" class="flex-1 min-w-[70px] py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors text-center cursor-pointer">
          Setujui
        </button>
        <button onclick="openDecisionModal(${item.id}, 'under_review')" class="flex-1 min-w-[70px] py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-colors text-center cursor-pointer">
          Tinjau
        </button>
        <button onclick="openDecisionModal(${item.id}, 'rejected')" class="flex-1 min-w-[70px] py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200 transition-colors text-center cursor-pointer">
          Tolak
        </button>
        <button onclick="editSubmission(${item.id}, 'pending')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer">
          Edit
        </button>
        <button onclick="deleteSubmission(${item.id})" class="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer">
          Hapus
        </button>
      </div>
    </div>
  `).join('');
}

// Render History Submissions Table (With Reviewer Audit Trail)
function renderHistoryTable() {
  const tbody = document.getElementById('tbody-history');
  if (!tbody) return;

  let list = (state.historySubmissions || []).filter(s => s.type !== 'lembur');
  if (state.historyStatusFilter && state.historyStatusFilter !== 'all') {
    list = list.filter(s => s.status === state.historyStatusFilter);
  }
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
          Tidak ada riwayat pengajuan dengan filter status ini.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    let stBadgeStyle = 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    let stLabel = 'Ditolak';
    if (item.status === 'approved') {
      stBadgeStyle = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      stLabel = 'Disetujui';
    } else if (item.status === 'under_review') {
      stBadgeStyle = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      stLabel = 'Ditinjau';
    }

    return `
    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
      <td class="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
        ${escapeHtml(item.full_name)}
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300">
        <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
          ${escapeHtml(item.division_name || '-')}
        </span>
      </td>
      <td class="px-4 py-3.5">
        <span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase ${getTypeBadgeStyle(item.type)}">
          ${escapeHtml(item.type)}
        </span>
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono text-[11px]">
        ${formatDateTime(item.created_at)}
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium text-xs">
        ${formatDate(item.start_date)} ${item.start_date !== item.end_date ? `- ${formatDate(item.end_date)}` : ''}
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 max-w-xs">
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${stBadgeStyle}">
            ${stLabel}
          </span>
          <span class="text-xs text-slate-500 truncate" title="${escapeHtml(item.review_note)}">
            ${escapeHtml(item.review_note || '-')}
          </span>
        </div>
      </td>
      <td class="px-4 py-3.5 text-slate-700 dark:text-slate-200 text-xs">
        ${item.reviewed_by_name ? `
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(item.reviewed_by_name)}</span>
              ${item.reviewed_by_role === 'super_admin' || item.reviewed_by_role === 'superadmin'
                ? '<span class="px-2 py-0.5 rounded-md text-[9px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Super Admin</span>'
                : '<span class="px-2 py-0.5 rounded-md text-[9px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">Middle Management</span>'}
            </div>
            <span class="text-[10px] text-slate-400 font-mono">${formatDateTime(item.reviewed_at)}</span>
          </div>
        ` : '<span class="text-slate-400 text-[11px] italic">Admin Sistem</span>'}
      </td>
      <td class="px-4 py-3.5 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1.5">
          <button onclick="editSubmission(${item.id}, 'history')" class="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-bold text-[11px] transition-colors cursor-pointer">
            Edit
          </button>
          <button onclick="deleteSubmission(${item.id})" class="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-[11px] transition-colors cursor-pointer">
            Hapus
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// Render History Submissions Cards (Mobile View)
function renderHistoryCards() {
  const container = document.getElementById('cards-history');
  if (!container) return;

  let list = (state.historySubmissions || []).filter(s => s.type !== 'lembur');
  if (state.historyStatusFilter && state.historyStatusFilter !== 'all') {
    list = list.filter(s => s.status === state.historyStatusFilter);
  }
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-6 text-center text-slate-400 text-xs">
        Tidak ada riwayat pengajuan dengan filter status ini.
      </div>`;
    return;
  }

  container.innerHTML = list.map(item => {
    let stBadgeStyle = 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    let stLabel = 'Ditolak';
    if (item.status === 'approved') {
      stBadgeStyle = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      stLabel = 'Disetujui';
    } else if (item.status === 'under_review') {
      stBadgeStyle = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      stLabel = 'Ditinjau';
    }

    return `
    <div class="glass-card rounded-2xl p-4 space-y-3 border border-slate-200/80 dark:border-slate-800 shadow-xs">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="font-black text-slate-900 dark:text-white text-sm">${escapeHtml(item.full_name)}</h4>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">${escapeHtml(item.division_name || '-')}</span>
            <span class="text-[10px] text-slate-400 font-medium">${escapeHtml(item.position_name || '-')}</span>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${getTypeBadgeStyle(item.type)}">${escapeHtml(item.type)}</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${stBadgeStyle}">${stLabel}</span>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
        <div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span>Tanggal: <strong>${formatDate(item.start_date)} ${item.start_date !== item.end_date ? `- ${formatDate(item.end_date)}` : ''}</strong></span>
        </div>
        <span class="text-[10px] text-slate-400 font-mono">${formatDateTime(item.created_at)}</span>
      </div>

      <div class="text-xs text-slate-700 dark:text-slate-300 space-y-1">
        <p class="font-bold text-[11px] text-slate-400 uppercase tracking-wider">Keterangan / Alasan:</p>
        <p class="leading-relaxed">${escapeHtml(item.reason || '-')}</p>
      </div>

      ${item.review_note ? `
        <div class="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 text-xs space-y-0.5">
          <p class="font-bold text-[10px] text-slate-400 uppercase">Catatan Peninjau:</p>
          <p class="text-slate-700 dark:text-slate-200">${escapeHtml(item.review_note)}</p>
        </div>
      ` : ''}

      <div class="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] flex flex-wrap items-center justify-between gap-1.5">
        <div class="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 flex-wrap">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          <span>Ditinjau: <strong>${escapeHtml(item.reviewed_by_name || 'Admin Sistem')}</strong></span>
          ${item.reviewed_by_role === 'super_admin' || item.reviewed_by_role === 'superadmin'
            ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200">Super Admin</span>'
            : '<span class="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200">Middle Management</span>'}
        </div>
        <span class="text-[10px] text-slate-400 font-mono">${formatDateTime(item.reviewed_at)}</span>
      </div>

      ${item.attachment ? `
        <div>
          <button type="button" class="btn-view-admin-attachment inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-xl cursor-pointer" data-url="${item.attachment.replace('/uploads/', '/secure-uploads/')}" data-title="Lampiran ${escapeHtml(item.full_name || '')}">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
            <span>Lihat Bukti Lampiran</span>
          </button>
        </div>
      ` : ''}

      <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
        <button onclick="editSubmission(${item.id}, 'history')" class="flex-1 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition-colors text-center cursor-pointer">
          Edit
        </button>
        <button onclick="deleteSubmission(${item.id})" class="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer">
          Hapus
        </button>
      </div>
    </div>`;
  }).join('');
}

// Render Pending Overtime Cards (Mobile View)
function renderOvertimePendingCards() {
  const container = document.getElementById('cards-overtime');
  if (!container) return;

  let list = state.pendingOvertimes || [];
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-6 text-center text-slate-400 text-xs">
        Tidak ada presensi lembur yang membutuhkan persetujuan saat ini.
      </div>`;
    return;
  }

  container.innerHTML = list.map(item => {
    const inTime = item.overtime_clock_in_time ? new Date(item.overtime_clock_in_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
    const outTime = item.overtime_clock_out_time ? new Date(item.overtime_clock_out_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
    const sec = item.overtime_duration_seconds || 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const durStr = sec > 0 ? `${h}j ${m}m` : '-';

    return `
      <div class="glass-card rounded-2xl p-4 space-y-3 border border-amber-200/60 dark:border-amber-900/40 shadow-xs">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-black text-slate-900 dark:text-white text-sm">${escapeHtml(item.full_name)}</h4>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="px-2 py-0.5 rounded-md bg-amber-100/70 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold">${escapeHtml(item.division_name || '-')}</span>
              <span class="text-[10px] text-slate-400 font-medium">${escapeHtml(item.position_name || '-')}</span>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${item.overtime_status === 'under_review' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}">
            ${item.overtime_status === 'under_review' ? 'Sedang Ditinjau' : 'Pending'}
          </span>
        </div>

        <div class="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/30 text-xs space-y-1">
          <div class="flex items-center justify-between font-mono">
            <span class="text-slate-500">Tanggal: <strong>${formatDate(item.attendance_date)}</strong></span>
            <span class="font-bold text-amber-700 dark:text-amber-400">${durStr}</span>
          </div>
          <div class="text-slate-700 dark:text-slate-200 font-mono text-[11px]">
            Masuk: <strong>${inTime}</strong> — Pulang: <strong>${outTime}</strong>
          </div>
        </div>

        <div class="text-xs text-slate-700 dark:text-slate-300 space-y-1">
          <p class="font-bold text-[11px] text-slate-400 uppercase tracking-wider">Tugas Lembur:</p>
          <p class="leading-relaxed">${escapeHtml(item.overtime_task_reason || '-')}</p>
        </div>

        ${item.overtime_work_attachment ? `
          <div>
            <a href="${item.overtime_work_attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="w-full py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Lihat Berkas Hasil Kerja</span>
            </a>
          </div>
        ` : ''}

        <div>
          <button onclick="openOvertimeDetailModal(${item.id})" class="w-full py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
            <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            <span>Verifikasi Foto & Titik GPS</span>
          </button>
        </div>

        <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <button onclick="openOvertimeDecisionModal(${item.id}, 'approved')" class="flex-1 min-w-[70px] py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors text-center cursor-pointer">
            Setujui
          </button>
          <button onclick="openOvertimeDecisionModal(${item.id}, 'under_review')" class="flex-1 min-w-[70px] py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-colors text-center cursor-pointer">
            Tinjau
          </button>
          <button onclick="openOvertimeDecisionModal(${item.id}, 'rejected')" class="flex-1 min-w-[70px] py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200 transition-colors text-center cursor-pointer">
            Tolak
          </button>
          <button onclick="deleteOvertime(${item.id})" class="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer">
            Hapus
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Render Overtime History Cards (Mobile View)
function renderOvertimeHistoryCards() {
  const container = document.getElementById('cards-overtime-history');
  if (!container) return;

  let list = state.historyOvertimes || [];
  if (state.overtimeHistoryStatusFilter && state.overtimeHistoryStatusFilter !== 'all') {
    list = list.filter(s => s.overtime_status === state.overtimeHistoryStatusFilter);
  }
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-6 text-center text-slate-400 text-xs">
        Tidak ada riwayat presensi lembur dengan filter status ini.
      </div>`;
    return;
  }

  container.innerHTML = list.map(item => {
    const inTime = item.overtime_clock_in_time ? new Date(item.overtime_clock_in_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
    const outTime = item.overtime_clock_out_time ? new Date(item.overtime_clock_out_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
    const sec = item.overtime_duration_seconds || 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const durStr = sec > 0 ? `${h}j ${m}m` : '-';

    let otBadgeStyle = 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    let otLabel = 'Ditolak';
    if (item.overtime_status === 'approved') {
      otBadgeStyle = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      otLabel = 'Disetujui';
    } else if (item.overtime_status === 'under_review') {
      otBadgeStyle = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      otLabel = 'Ditinjau';
    }

    return `
      <div class="glass-card rounded-2xl p-4 space-y-3 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-black text-slate-900 dark:text-white text-sm">${escapeHtml(item.full_name)}</h4>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">${escapeHtml(item.division_name || '-')}</span>
            </div>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${otBadgeStyle}">
            ${otLabel}
          </span>
        </div>

        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1">
          <div class="flex items-center justify-between font-mono">
            <span class="text-slate-500">Tanggal: <strong>${formatDate(item.attendance_date)}</strong></span>
            <span class="font-bold text-indigo-600 dark:text-indigo-400">${durStr}</span>
          </div>
          <div class="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
            ${inTime} — ${outTime}
          </div>
        </div>

        <div class="text-xs text-slate-700 dark:text-slate-300 space-y-1">
          <p class="font-bold text-[11px] text-slate-400 uppercase tracking-wider">Tugas Lembur:</p>
          <p class="leading-relaxed">${escapeHtml(item.overtime_task_reason || '-')}</p>
        </div>

        ${item.overtime_review_note ? `
          <div class="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 text-xs space-y-0.5">
            <p class="font-bold text-[10px] text-slate-400 uppercase">Catatan Peninjau:</p>
            <p class="text-slate-700 dark:text-slate-200">${escapeHtml(item.overtime_review_note)}</p>
          </div>
        ` : ''}

        <div class="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] flex flex-wrap items-center justify-between gap-1.5">
          <div class="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 flex-wrap">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            <span>Ditinjau: <strong>${escapeHtml(item.reviewed_by_name || 'Admin Sistem')}</strong></span>
            ${item.reviewed_by_role === 'super_admin' || item.reviewed_by_role === 'superadmin'
              ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200">Super Admin</span>'
              : '<span class="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200">Middle Management</span>'}
          </div>
          <span class="text-[10px] text-slate-400 font-mono">${formatDateTime(item.overtime_reviewed_at)}</span>
        </div>

        ${item.overtime_work_attachment ? `
          <div>
            <a href="${item.overtime_work_attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="w-full py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Lihat Berkas Hasil Kerja</span>
            </a>
          </div>
        ` : ''}

        <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <button onclick="openOvertimeDetailModal(${item.id})" class="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold text-center cursor-pointer transition-colors">
            Detail Foto & GPS
          </button>
          <button onclick="deleteOvertime(${item.id})" class="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold transition-colors cursor-pointer">
            Hapus
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Render Pending Overtime Attendance Table
function renderOvertimePendingTable() {
  const tbody = document.getElementById('tbody-overtime');
  if (!tbody) return;

  let list = state.pendingOvertimes || [];
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
          Tidak ada presensi lembur yang membutuhkan persetujuan saat ini.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const inTime = item.overtime_clock_in_time ? new Date(item.overtime_clock_in_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
    const outTime = item.overtime_clock_out_time ? new Date(item.overtime_clock_out_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
    const sec = item.overtime_duration_seconds || 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const durStr = sec > 0 ? `${h}j ${m}m` : '-';

    return `
      <tr class="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors">
        <td class="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
          ${escapeHtml(item.full_name)}
          <div class="text-[11px] font-normal text-slate-400">${escapeHtml(item.position_name || '-')}</div>
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300">
          <span class="px-2 py-0.5 rounded-lg bg-amber-100/70 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] font-semibold">
            ${escapeHtml(item.division_name || '-')}
          </span>
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
          ${formatDate(item.attendance_date)}
        </td>
        <td class="px-4 py-3.5 whitespace-nowrap font-mono text-xs">
          <div class="font-bold text-amber-700 dark:text-amber-400">${inTime} — ${outTime}</div>
          <div class="text-[11px] text-slate-400 font-normal mt-0.5">Durasi: <strong>${durStr}</strong></div>
        </td>
        <td class="px-4 py-3.5 text-slate-700 dark:text-slate-300 max-w-xs text-xs">
          <div class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(item.overtime_task_reason || '-')}</div>
          ${item.overtime_work_attachment ? `
            <div class="mt-1.5">
              <a href="${item.overtime_work_attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-lg shadow-2xs">
                <svg class="w-3.5 h-3.5 stroke-[2] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <span>Lihat Berkas Kerja</span>
              </a>
            </div>
          ` : ''}
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <button onclick="openOvertimeDetailModal(${item.id})" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-[11px] font-bold shadow-xs cursor-pointer">
            <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            <span>Foto & Lokasi GPS</span>
          </button>
        </td>
        <td class="px-4 py-3.5 text-center">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${item.overtime_status === 'under_review' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}">
            ${item.overtime_status === 'under_review' ? 'Sedang Ditinjau' : 'Pending'}
          </span>
        </td>
        <td class="px-4 py-3.5 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="openOvertimeDecisionModal(${item.id}, 'approved')" class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer">
              Setujui
            </button>
            <button onclick="openOvertimeDecisionModal(${item.id}, 'under_review')" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer">
              Tinjau
            </button>
            <button onclick="openOvertimeDecisionModal(${item.id}, 'rejected')" class="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer">
              Tolak
            </button>
            <button onclick="deleteOvertime(${item.id})" class="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-[11px] transition-colors cursor-pointer">
              Hapus
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Overtime History Table (With Reviewer Audit Trail)
function renderOvertimeHistoryTable() {
  const tbody = document.getElementById('tbody-overtime-history');
  if (!tbody) return;

  let list = state.historyOvertimes || [];
  if (state.overtimeHistoryStatusFilter && state.overtimeHistoryStatusFilter !== 'all') {
    list = list.filter(s => s.overtime_status === state.overtimeHistoryStatusFilter);
  }
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
          Tidak ada riwayat presensi lembur dengan filter status ini.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const inTime = item.overtime_clock_in_time ? new Date(item.overtime_clock_in_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
    const outTime = item.overtime_clock_out_time ? new Date(item.overtime_clock_out_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
    const sec = item.overtime_duration_seconds || 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const durStr = sec > 0 ? `${h}j ${m}m` : '-';

    let otBadgeStyle = 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    let otLabel = 'Ditolak';
    if (item.overtime_status === 'approved') {
      otBadgeStyle = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      otLabel = 'Disetujui';
    } else if (item.overtime_status === 'under_review') {
      otBadgeStyle = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      otLabel = 'Ditinjau';
    }

    return `
      <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
        <td class="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
          ${escapeHtml(item.full_name)}
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300">
          <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
            ${escapeHtml(item.division_name || '-')}
          </span>
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
          <div>${formatDate(item.attendance_date)}</div>
          <div class="text-[11px] text-slate-400">${inTime} — ${outTime} (${durStr})</div>
        </td>
        <td class="px-4 py-3.5 text-slate-700 dark:text-slate-300 text-xs max-w-xs">
          <div>${escapeHtml(item.overtime_task_reason || '-')}</div>
          ${item.overtime_work_attachment ? `
            <div class="mt-1.5">
              <a href="${item.overtime_work_attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-lg shadow-2xs">
                <svg class="w-3.5 h-3.5 stroke-[2] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <span>Hasil Kerja</span>
              </a>
            </div>
          ` : ''}
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 max-w-xs">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${otBadgeStyle}">
              ${otLabel}
            </span>
          </div>
          <div class="text-[11px] text-slate-500 truncate" title="${escapeHtml(item.overtime_review_note)}">
            ${escapeHtml(item.overtime_review_note || '-')}
          </div>
        </td>
        <td class="px-4 py-3.5 text-slate-700 dark:text-slate-200 text-xs">
          ${item.reviewed_by_name ? `
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(item.reviewed_by_name)}</span>
                ${item.reviewed_by_role === 'super_admin' || item.reviewed_by_role === 'superadmin'
                  ? '<span class="px-2 py-0.5 rounded-md text-[9px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Super Admin</span>'
                  : '<span class="px-2 py-0.5 rounded-md text-[9px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">Middle Management</span>'}
              </div>
              <span class="text-[10px] text-slate-400 font-mono">${formatDateTime(item.overtime_reviewed_at)}</span>
            </div>
          ` : '<span class="text-slate-400 text-[11px] italic">Admin Sistem</span>'}
        </td>
        <td class="px-4 py-3.5 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="openOvertimeDetailModal(${item.id})" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer">
              Detail Foto
            </button>
            <button onclick="deleteOvertime(${item.id})" class="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-[11px] transition-colors cursor-pointer">
              Hapus
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Modal Decision Handling
let currentDecisionContext = { type: 'submission', id: null, decision: null };

function openDecisionModal(submissionId, decision) {
  currentDecisionContext = { type: 'submission', id: submissionId, decision: decision };
  const modal = document.getElementById('modal-decision');
  const title = document.getElementById('modal-decision-title');
  const note = document.getElementById('decision-review-note');
  
  if (title) {
    if (decision === 'approved') title.textContent = 'Persetujuan Pengajuan';
    else if (decision === 'rejected') title.textContent = 'Penolakan Pengajuan';
    else if (decision === 'under_review') title.textContent = 'Tandai Pengajuan Sedang Ditinjau';
  }
  if (note) {
    if (decision === 'approved') {
      note.value = 'Disetujui';
      note.placeholder = 'Catatan persetujuan...';
    } else if (decision === 'rejected') {
      note.value = '';
      note.placeholder = 'Alasan penolakan wajib diisi...';
    } else {
      note.value = 'Pengajuan sedang ditinjau oleh manajemen';
      note.placeholder = 'Catatan peninjauan...';
    }
  }

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function openOvertimeDecisionModal(overtimeId, decision) {
  currentDecisionContext = { type: 'overtime', id: overtimeId, decision: decision };
  const modal = document.getElementById('modal-decision');
  const title = document.getElementById('modal-decision-title');
  const note = document.getElementById('decision-review-note');

  if (title) {
    if (decision === 'approved') title.textContent = 'Persetujuan Lembur';
    else if (decision === 'rejected') title.textContent = 'Penolakan Lembur';
    else if (decision === 'under_review') title.textContent = 'Tandai Lembur Sedang Ditinjau';
  }
  if (note) {
    if (decision === 'approved') {
      note.value = 'Disetujui';
      note.placeholder = 'Catatan lembur...';
    } else if (decision === 'rejected') {
      note.value = '';
      note.placeholder = 'Alasan penolakan lembur...';
    } else {
      note.value = 'Presensi lembur sedang ditinjau oleh manajemen';
      note.placeholder = 'Catatan peninjauan...';
    }
  }

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeDecisionModal() {
  const modal = document.getElementById('modal-decision');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleDecisionSubmit() {
  const note = document.getElementById('decision-review-note')?.value.trim();
  if (!note && currentDecisionContext.decision === 'rejected') {
    alert('Alasan penolakan wajib diisi.');
    return;
  }

  try {
    let url = '';
    let body = {};
    const defaultNote = currentDecisionContext.decision === 'under_review' 
      ? 'Sedang ditinjau oleh manajemen' 
      : (currentDecisionContext.decision === 'approved' ? 'Disetujui' : '');
    const reviewNote = note || defaultNote;

    if (currentDecisionContext.type === 'submission') {
      url = `/api/admin/submissions/${currentDecisionContext.id}/decision`;
      body = { decision: currentDecisionContext.decision, review_note: reviewNote };
    } else {
      url = `/api/admin/overtime/${currentDecisionContext.id}/decision`;
      body = { decision: currentDecisionContext.decision, review_note: reviewNote };
    }

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.success) {
      closeDecisionModal();
      showToast(data.message || 'Status berhasil diperbarui.', 'success');
      await refreshAllData();
    } else {
      alert(data.message || 'Gagal memproses keputusan.');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan: ' + err.message);
  }
}

// Delete Overtime Attendance Handler
async function deleteOvertime(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus data presensi lembur ini?')) return;
  try {
    const res = await fetch(`/api/admin/overtime/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Presensi lembur berhasil dihapus', 'success');
      await refreshAllData();
    } else {
      alert(data.message || 'Gagal menghapus presensi lembur.');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan: ' + err.message);
  }
}

// Open Overtime Detail Modal
function openOvertimeDetailModal(overtimeId) {
  const item = [...state.pendingOvertimes, ...state.historyOvertimes].find(o => o.id === overtimeId);
  if (!item) return;

  const content = document.getElementById('ot-detail-content');
  if (!content) return;

  const inPhoto = item.overtime_clock_in_photo ? item.overtime_clock_in_photo.replace('/uploads/', '/secure-uploads/') : null;
  const outPhoto = item.overtime_clock_out_photo ? item.overtime_clock_out_photo.replace('/uploads/', '/secure-uploads/') : null;

  const inGpsStr = item.overtime_clock_in_lat ? `${item.overtime_clock_in_lat}, ${item.overtime_clock_in_lng}` : null;
  const inGpsLink = inGpsStr ? `https://www.google.com/maps?q=${inGpsStr}` : '#';

  const outGpsStr = item.overtime_clock_out_lat ? `${item.overtime_clock_out_lat}, ${item.overtime_clock_out_lng}` : null;
  const outGpsLink = outGpsStr ? `https://www.google.com/maps?q=${outGpsStr}` : '#';

  content.innerHTML = `
    <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
      <div class="font-bold text-slate-900 dark:text-white text-sm">${escapeHtml(item.full_name)} (${escapeHtml(item.division_name || '-')})</div>
      <div class="text-slate-500 font-mono">Tanggal Lembur: ${formatDate(item.attendance_date)}</div>
      <div class="text-slate-700 dark:text-slate-300 pt-1"><strong>Tugas Lembur:</strong> ${escapeHtml(item.overtime_task_reason || '-')}</div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
        <span class="text-xs font-bold text-amber-600 uppercase">Masuk Lembur</span>
        ${inPhoto ? `<img src="${inPhoto}" class="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200 shadow-sm" alt="Foto Masuk Lembur"/>` : '<div class="w-full aspect-[4/3] bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-400">Tidak ada foto</div>'}
        ${inGpsStr ? `
          <a href="${inGpsLink}" target="_blank" class="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-200/60">
            Buka Peta GPS
          </a>
        ` : '<span class="text-xs text-slate-400 block">Koordinat tidak tersedia</span>'}
      </div>

      <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
        <span class="text-xs font-bold text-rose-600 uppercase">Pulang Lembur</span>
        ${outPhoto ? `<img src="${outPhoto}" class="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200 shadow-sm" alt="Foto Pulang Lembur"/>` : '<div class="w-full aspect-[4/3] bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-400">Tidak ada foto</div>'}
        ${outGpsStr ? `
          <a href="${outGpsLink}" target="_blank" class="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-200/60">
            Buka Peta GPS
          </a>
        ` : '<span class="text-xs text-slate-400 block">Koordinat tidak tersedia</span>'}
      </div>
    </div>

    ${item.overtime_work_attachment ? `
      <div class="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">📄</div>
          <div class="min-w-0">
            <div class="text-xs font-bold text-indigo-950 dark:text-indigo-200 truncate">Berkas Hasil Kerja Lembur</div>
            <div class="text-[11px] text-slate-500 truncate">Bukti berkas output pekerjaan yang telah diunggah</div>
          </div>
        </div>
        <a href="${item.overtime_work_attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 shrink-0 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          <span>Buka File</span>
        </a>
      </div>
    ` : '<div class="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">Tidak ada berkas bukti hasil kerja yang dilampirkan.</div>'}
  `;

  const modal = document.getElementById('modal-overtime-detail');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeOvertimeDetailModal() {
  const modal = document.getElementById('modal-overtime-detail');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// Modal Submission (Create / Edit)
function openSubmissionModal(submissionData = null) {
  const modal = document.getElementById('modal-submission');
  const title = document.getElementById('modal-submission-title');
  const form = document.getElementById('form-submission');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('submission-id').value = '';

  const handoverContainer = document.getElementById('form-handover-container');
  if (handoverContainer) handoverContainer.classList.add('hidden');

  const typeSelect = document.getElementById('form-type');
  if (typeSelect) {
    typeSelect.onchange = (e) => {
      if (e.target.value === 'cuti') {
        handoverContainer?.classList.remove('hidden');
      } else {
        handoverContainer?.classList.add('hidden');
      }
    };
  }

  if (submissionData) {
    if (title) title.textContent = 'Edit Pengajuan Karyawan';
    document.getElementById('submission-id').value = submissionData.id || '';
    document.getElementById('form-user-id').value = submissionData.user_id || '';
    document.getElementById('form-type').value = submissionData.type || 'cuti';
    document.getElementById('form-start-date').value = submissionData.start_date ? submissionData.start_date.split('T')[0] : '';
    document.getElementById('form-end-date').value = submissionData.end_date ? submissionData.end_date.split('T')[0] : '';
    document.getElementById('form-status').value = submissionData.status || 'pending';
    document.getElementById('form-review-note').value = submissionData.review_note || '';
    document.getElementById('form-reason').value = submissionData.reason || '';

    if (submissionData.type === 'cuti') {
      handoverContainer?.classList.remove('hidden');
      document.getElementById('form-handover-plan').value = submissionData.handover_plan || '';
      document.getElementById('form-handover-to-name').value = submissionData.handover_to_name || '';
      document.getElementById('form-handover-to-position').value = submissionData.handover_to_position || '';
    }
  } else {
    if (title) title.textContent = 'Buat Pengajuan Baru';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeSubmissionModal() {
  const modal = document.getElementById('modal-submission');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const subId = document.getElementById('submission-id')?.value;
  const userId = document.getElementById('form-user-id')?.value;
  const type = document.getElementById('form-type')?.value;
  const startDate = document.getElementById('form-start-date')?.value;
  const endDate = document.getElementById('form-end-date')?.value;
  const status = document.getElementById('form-status')?.value;
  const reviewNote = document.getElementById('form-review-note')?.value;
  const reason = document.getElementById('form-reason')?.value;

  const handoverPlan = document.getElementById('form-handover-plan')?.value;
  const handoverToName = document.getElementById('form-handover-to-name')?.value;
  const handoverToPos = document.getElementById('form-handover-to-position')?.value;

  const bodyData = {
    user_id: userId,
    type,
    start_date: startDate,
    end_date: endDate,
    status,
    review_note: reviewNote,
    reason,
    handover_plan: handoverPlan,
    handover_to_name: handoverToName,
    handover_to_position: handoverToPos
  };

  try {
    let url = '/api/admin/submissions';
    let method = 'POST';
    if (subId) {
      url = `/api/admin/submissions/${subId}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    const data = await res.json();
    if (data.success) {
      closeSubmissionModal();
      showToast(data.message || 'Pengajuan berhasil disimpan.', 'success');
      await refreshAllData();
    } else {
      alert(data.message || 'Gagal menyimpan pengajuan.');
    }
  } catch (err) {
    alert('Terjadi kesalahan sistem: ' + err.message);
  }
}

// Edit Submission Handler
function editSubmission(id, source = 'pending') {
  const list = source === 'pending' ? state.pendingSubmissions : state.historySubmissions;
  const item = list.find(s => s.id === id);
  if (item) {
    openSubmissionModal(item);
  }
}

// Delete Submission Handler
async function deleteSubmission(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus data pengajuan ini?')) return;
  try {
    const res = await fetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Pengajuan berhasil dihapus', 'success');
      await refreshAllData();
    } else {
      alert(data.message || 'Gagal menghapus pengajuan.');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan: ' + err.message);
  }
}

// Attachment Viewer Modal
document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-view-admin-attachment');
  if (btn) {
    const url = btn.getAttribute('data-url');
    const title = btn.getAttribute('data-title') || 'Lampiran Dokumen';
    openAdminAttachmentModal(url, title);
  }
});

function openAdminAttachmentModal(url, title = 'Lampiran Dokumen') {
  const modal = document.getElementById('modal-attachment-viewer');
  const titleEl = document.getElementById('attachment-modal-title');
  const bodyEl = document.getElementById('attachment-modal-body');
  const downloadLink = document.getElementById('attachment-modal-download');
  if (!modal || !bodyEl) return;

  if (titleEl) titleEl.textContent = title;
  if (downloadLink) downloadLink.href = url;

  const isImage = /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(url);
  const isPdf = /\.pdf($|\?)/i.test(url);

  if (isImage) {
    bodyEl.innerHTML = `
      <div class="w-full flex items-center justify-center p-2 bg-slate-900/5 dark:bg-slate-900/40 rounded-2xl">
        <img src="${url}" alt="Lampiran" class="max-h-[60vh] max-w-full rounded-xl object-contain shadow-sm" />
      </div>
    `;
  } else if (isPdf) {
    bodyEl.innerHTML = `
      <iframe src="${url}" class="w-full h-[60vh] rounded-xl border border-slate-200 dark:border-slate-800"></iframe>
    `;
  } else {
    bodyEl.innerHTML = `
      <div class="text-center py-8 space-y-3">
        <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">Berkas Dokumen Lampiran</p>
        <a href="${url}" target="_blank" download class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm transition">
          Unduh & Buka Dokumen
        </a>
      </div>
    `;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

// Utility: Format Date (DD/MM/YYYY)
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

// Utility: Format Date & Time (DD/MM/YYYY HH:mm WIB)
function formatDateTime(dtStr) {
  if (!dtStr) return '-';
  try {
    const d = new Date(dtStr);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WIB';
  } catch {
    return String(dtStr);
  }
}

// Utility: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Utility: Badge Style for Submission Type
function getTypeBadgeStyle(type) {
  switch (type) {
    case 'cuti':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60';
    case 'izin':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900/60';
    case 'sakit':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/60';
    case 'lembur':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  }
}

// Utility: Toast Notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
  };

  toast.className = `pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold transition-all transform duration-300 translate-y-3 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-3', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('translate-y-3', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// =========================================================
// SISTEM ROSTER SHIFT & LIBUR ROLLING BULANAN
// =========================================================
state.roster = {
  month: '',
  divisionId: '',
  searchKeyword: '',
  days: [],
  employees: [],
  schedules: {},
  shiftCodes: {},
  loaded: false
};

// Shift color helpers for interactive UI cells
function getShiftPillStyle(code) {
  switch (code) {
    case 'P':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-black';
    case 'S':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-black';
    case 'VK':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 font-black';
    case 'VW':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-black';
    case 'VH':
      return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800 font-black';
    case 'R':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800 font-black';
    case 'PL':
      return 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-800 font-black';
    case 'SAT':
      return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 font-black';
    case 'L':
    case 'OFF':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-black';
    default:
      return 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700';
  }
}

async function loadRosterMatrix(silent = false) {
  const container = document.getElementById('roster-matrix-container');
  const monthInput = document.getElementById('roster-month-input');

  if (!state.roster.month) {
    const now = new Date();
    state.roster.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  if (monthInput && !monthInput.value) {
    monthInput.value = state.roster.month;
  }

  const divisionSelect = document.getElementById('roster-division-filter');
  if (divisionSelect && state.roster.divisionId === undefined) {
    state.roster.divisionId = divisionSelect.value || '';
  }

  try {
    if (!silent && container) {
      container.innerHTML = '<div class="p-12 text-center text-slate-400 text-xs">Memuat matriks jadwal roster bulanan...</div>';
    }

    const params = new URLSearchParams();
    if (state.roster.month) params.append('month', state.roster.month);
    if (state.roster.divisionId) params.append('division_id', state.roster.divisionId);
    params.append('scope', state.roster.scope || 'roster');

    const res = await fetch(`/api/admin/roster/matrix?${params.toString()}`);
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || 'Gagal memuat matriks roster.');
    }

    state.roster.days = data.days || [];
    state.roster.employees = data.employees || [];
    state.roster.schedules = data.schedules || {};
    state.roster.shiftCodes = data.shiftCodes || {};
    state.roster.loaded = true;

    renderRosterMatrix();
  } catch (err) {
    console.error('Load roster error:', err);
    if (container) {
      container.innerHTML = `<div class="p-8 text-center text-rose-500 text-xs">${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderRosterMatrix() {
  const container = document.getElementById('roster-matrix-container');
  if (!container) return;

  const { days, employees, schedules } = state.roster;

  let filteredEmployees = employees || [];
  if (state.roster.searchKeyword) {
    filteredEmployees = filteredEmployees.filter(emp =>
      emp.full_name && emp.full_name.toLowerCase().includes(state.roster.searchKeyword)
    );
  }

  if (filteredEmployees.length === 0) {
    const isRosterOnly = (state.roster?.scope || 'roster') === 'roster';
    container.innerHTML = `
      <div class="p-12 text-center text-slate-500 max-w-md mx-auto space-y-3">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <div class="font-bold text-slate-800 dark:text-slate-200 text-sm">
          ${isRosterOnly ? 'Belum Ada Karyawan Shift Khusus' : 'Tidak Ada Data Karyawan'}
        </div>
        <p class="text-xs text-slate-500 leading-relaxed">
          ${isRosterOnly
            ? 'Hanya karyawan yang diatur ke <strong>"Shift Khusus (Roster)"</strong> yang masuk ke tabel jadwal ini. Silakan atur shift karyawan di menu <strong>Manajemen User</strong>, atau ubah filter di atas ke <strong>"Tampilkan Semua Karyawan"</strong>.'
            : 'Tidak ada data karyawan yang cocok dengan filter pencarian.'}
        </p>
      </div>`;
    return;
  }

  const shiftOptions = [
    { code: '', label: '- Reguler' },
    { code: 'P', label: 'P - Pagi (06:00-15:00)' },
    { code: 'S', label: 'S - Siang (13:00-22:00)' },
    { code: 'VK', label: 'VK - Kantor SSV (08:00-17:00)' },
    { code: 'VW', label: 'VW - SSV + PIC WA (08:00-17:00)' },
    { code: 'VH', label: 'VH - 1/2 Hari SSV (08:00-13:00)' },
    { code: 'R', label: 'R - Sore (14:00-23:00)' },
    { code: 'PL', label: 'PL - Lapangan' },
    { code: 'SAT', label: 'SAT - Satpam' },
    { code: 'L', label: 'L - Libur Terjadwal (OFF)' }
  ];

  let html = `
    <table class="w-full border-collapse text-xs">
      <thead>
        <!-- Header Row 1: Tanggal (1..N) -->
        <tr class="bg-slate-900 text-white font-mono sticky top-0 z-20">
          <th class="px-3 py-2.5 text-center font-bold sticky left-0 z-30 bg-slate-900 border-r border-slate-800 w-12 min-w-[48px]">No</th>
          <th class="px-4 py-2.5 text-left font-bold sticky left-12 z-30 bg-slate-900 border-r border-slate-800 min-w-[200px]">Nama Karyawan</th>
          <th class="px-3 py-2.5 text-left font-bold border-r border-slate-800 min-w-[140px]">Divisi</th>
          ${days.map(d => {
            const isWk = d.isWeekend;
            return `<th class="px-1 py-2 text-center font-black border-r border-slate-800 min-w-[56px] ${isWk ? 'bg-rose-950/80 text-rose-300' : ''}">${d.day}</th>`;
          }).join('')}
        </tr>

        <!-- Header Row 2: Nama Hari (Sen, Sel, ...) -->
        <tr class="bg-slate-800 text-slate-300 font-bold sticky top-9 z-20 text-[10px]">
          <th class="py-1 text-center sticky left-0 z-30 bg-slate-800 border-r border-slate-700"></th>
          <th class="py-1 text-center sticky left-12 z-30 bg-slate-800 border-r border-slate-700"></th>
          <th class="py-1 text-center border-r border-slate-700"></th>
          ${days.map(d => {
            const isWk = d.isWeekend;
            return `<th class="py-1 text-center border-r border-slate-700 ${isWk ? 'bg-rose-900/40 text-rose-300' : 'text-slate-400'}">${d.dayName}</th>`;
          }).join('')}
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
  `;

  filteredEmployees.forEach((emp, idx) => {
    const userSchedules = schedules[emp.id] || {};
    html += `
      <tr class="hover:bg-indigo-50/30 dark:hover:bg-slate-800/40 transition-colors">
        <td class="px-2 py-2 text-center font-mono text-slate-400 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">${idx + 1}</td>
        <td class="px-3 py-2 font-bold text-slate-900 dark:text-white sticky left-12 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 truncate" title="${escapeHtml(emp.full_name)}">
          <div>${escapeHtml(emp.full_name)}</div>
          <div class="text-[10px] text-slate-400 font-normal truncate">${escapeHtml(emp.position_name || '-')}</div>
        </td>
        <td class="px-3 py-2 text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 text-[11px] truncate" title="${escapeHtml(emp.division_name || '-')}">
          ${escapeHtml(emp.division_name || '-')}
        </td>
    `;

    days.forEach(d => {
      const sch = userSchedules[d.date];
      const curCode = sch ? sch.shift_code : '';
      const pillClass = getShiftPillStyle(curCode);
      const isWk = d.isWeekend;

      html += `
        <td class="p-1 text-center border-r border-slate-100 dark:border-slate-800 ${isWk ? 'bg-slate-50/50 dark:bg-slate-900/40' : ''}">
          <select
            onchange="updateRosterCell(${emp.id}, '${d.date}', this.value, this)"
            title="${d.date}: ${curCode || 'Reguler'}"
            class="roster-cell-select w-full text-center py-1 px-0.5 rounded-lg border text-[11px] cursor-pointer outline-none transition-all ${pillClass}"
          >
            ${shiftOptions.map(opt => `
              <option value="${opt.code}" ${opt.code === curCode ? 'selected' : ''}>
                ${opt.code || '-'}
              </option>
            `).join('')}
          </select>
        </td>
      `;
    });

    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

async function updateRosterCell(userId, dateStr, shiftCode, selectEl) {
  try {
    const res = await fetch('/api/admin/roster/cell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, schedule_date: dateStr, shift_code: shiftCode })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Gagal menyimpan jadwal.');
    }

    if (!state.roster.schedules[userId]) state.roster.schedules[userId] = {};
    if (shiftCode) {
      state.roster.schedules[userId][dateStr] = data.schedule || { shift_code: shiftCode };
    } else {
      delete state.roster.schedules[userId][dateStr];
    }

    if (selectEl) {
      selectEl.className = `roster-cell-select w-full text-center py-1 px-0.5 rounded-lg border text-[11px] cursor-pointer outline-none transition-all ${getShiftPillStyle(shiftCode)}`;
    }

    showToast(`Jadwal ${dateStr.slice(8, 10)}: ${shiftCode || 'Default'} disimpan`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function downloadRosterTemplate() {
  const month = state.roster.month || document.getElementById('roster-month-input')?.value || '';
  const divId = state.roster.divisionId || document.getElementById('roster-division-filter')?.value || '';
  const scope = state.roster.scope || document.getElementById('roster-scope-filter')?.value || 'roster';
  const params = new URLSearchParams();
  if (month) params.append('month', month);
  if (divId) params.append('division_id', divId);
  if (scope) params.append('scope', scope);

  window.location.href = `/api/admin/roster/export-template?${params.toString()}`;
}

function exportRosterMatrix() {
  const month = state.roster.month || document.getElementById('roster-month-input')?.value || '';
  const divId = state.roster.divisionId || document.getElementById('roster-division-filter')?.value || '';
  const scope = state.roster.scope || document.getElementById('roster-scope-filter')?.value || 'roster';
  const params = new URLSearchParams();
  if (month) params.append('month', month);
  if (divId) params.append('division_id', divId);
  if (scope) params.append('scope', scope);

  window.location.href = `/api/admin/roster/export-matrix?${params.toString()}`;
}

function openRosterImportModal() {
  const modal = document.getElementById('modal-import-roster');
  const monthInput = document.getElementById('import-roster-month');
  if (monthInput) {
    monthInput.value = state.roster.month || document.getElementById('roster-month-input')?.value || '';
  }
  const feedback = document.getElementById('import-roster-feedback');
  if (feedback) feedback.classList.add('hidden');
  const form = document.getElementById('form-import-roster');
  if (form) form.reset();
  if (monthInput) {
    monthInput.value = state.roster.month || document.getElementById('roster-month-input')?.value || '';
  }

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeRosterImportModal() {
  const modal = document.getElementById('modal-import-roster');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleRosterImport(e) {
  e.preventDefault();
  const fileInput = document.getElementById('import-roster-file');
  const monthInput = document.getElementById('import-roster-month');
  const feedback = document.getElementById('import-roster-feedback');
  const btnSubmit = document.getElementById('btn-submit-import');

  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('Pilih file Excel terlebih dahulu', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('month', monthInput.value);

  try {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Mengimpor...';
    if (feedback) {
      feedback.classList.remove('hidden');
      feedback.className = 'text-xs p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
      feedback.textContent = 'Sedang membaca dan memvalidasi file Excel...';
    }

    const res = await fetch('/api/admin/roster/import-excel', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || 'Gagal mengimpor file.');
    }

    if (feedback) {
      feedback.className = 'text-xs p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200';
      feedback.innerHTML = `<strong>Berhasil!</strong> ${escapeHtml(data.message)}`;
      if (data.unrecognizedNames && data.unrecognizedNames.length > 0) {
        feedback.innerHTML += `<div class="mt-1 text-[11px] text-amber-700">Nama tidak dikenali: ${data.unrecognizedNames.map(escapeHtml).join(', ')}</div>`;
      }
    }

    showToast('Import jadwal roster berhasil!', 'success');
    state.roster.month = monthInput.value;
    const mainMonthInput = document.getElementById('roster-month-input');
    if (mainMonthInput) mainMonthInput.value = monthInput.value;

    await loadRosterMatrix(true);

    setTimeout(() => {
      closeRosterImportModal();
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Unggah & Terapkan';
    }, 1800);
  } catch (err) {
    console.error('Import error:', err);
    if (feedback) {
      feedback.className = 'text-xs p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200';
      feedback.textContent = err.message;
    }
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Unggah & Terapkan';
    showToast(err.message, 'error');
  }
}

// Expose handlers globally for inline HTML onclick attributes
window.openDecisionModal = openDecisionModal;
window.closeDecisionModal = closeDecisionModal;
window.openOvertimeDecisionModal = openOvertimeDecisionModal;
window.openOvertimeDetailModal = openOvertimeDetailModal;
window.closeOvertimeDetailModal = closeOvertimeDetailModal;
window.openSubmissionModal = openSubmissionModal;
window.closeSubmissionModal = closeSubmissionModal;
window.editSubmission = editSubmission;
window.deleteSubmission = deleteSubmission;
window.deleteOvertime = deleteOvertime;
window.viewAttendanceReportDetail = viewAttendanceReportDetail;
window.exportReport = exportReport;
window.switchTab = switchTab;
window.refreshAllData = refreshAllData;
window.updateRosterCell = updateRosterCell;
window.downloadRosterTemplate = downloadRosterTemplate;
window.exportRosterMatrix = exportRosterMatrix;
window.openRosterImportModal = openRosterImportModal;
window.closeRosterImportModal = closeRosterImportModal;
