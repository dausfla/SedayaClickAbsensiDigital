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
  reports: [],
  selectedDivisionId: '',
  searchKeyword: '',
  activeTab: 'pending',
  pollingInterval: null
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initEventListeners();
  
  const ok = await checkAuth();
  if (!ok) return;

  await Promise.all([
    loadDivisions(),
    loadEmployees()
  ]);

  await refreshAllData();

  // Start polling every 4 seconds for live data sync
  state.pollingInterval = setInterval(refreshAllData, 4000);
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

  // Search Input
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    state.searchKeyword = e.target.value.toLowerCase().trim();
    renderTables();
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

  // Desktop SubTabs Switch
  document.getElementById('tab-btn-pending')?.addEventListener('click', () => switchTab('pending'));
  document.getElementById('tab-btn-overtime')?.addEventListener('click', () => switchTab('overtime'));
  document.getElementById('tab-btn-history')?.addEventListener('click', () => switchTab('history'));
  document.getElementById('tab-btn-overtime-history')?.addEventListener('click', () => switchTab('overtime-history'));
  document.getElementById('tab-btn-reports')?.addEventListener('click', () => switchTab('reports'));

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

  // Reports Filter Period Change
  document.getElementById('report-filter-period')?.addEventListener('change', (e) => {
    const isCustom = e.target.value === 'custom';
    const customWrapper = document.getElementById('wrapper-custom-dates');
    if (customWrapper) {
      if (isCustom) {
        customWrapper.classList.remove('hidden');
      } else {
        customWrapper.classList.add('hidden');
      }
    }
  });

  // Reports Apply Filter Button
  document.getElementById('btn-load-reports')?.addEventListener('click', loadReports);

  // Reports Export Excel & CSV
  document.getElementById('btn-export-excel')?.addEventListener('click', () => exportReport('xlsx'));
  document.getElementById('btn-export-csv')?.addEventListener('click', () => exportReport('csv'));

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

// Switch Tabs & Sync with Floating iOS Dock
function switchTab(tab) {
  state.activeTab = tab;

  const btnPending = document.getElementById('tab-btn-pending');
  const btnOvertime = document.getElementById('tab-btn-overtime');
  const btnHistory = document.getElementById('tab-btn-history');
  const btnOvertimeHistory = document.getElementById('tab-btn-overtime-history');
  const btnReports = document.getElementById('tab-btn-reports');

  const panelPending = document.getElementById('panel-pending');
  const panelOvertime = document.getElementById('panel-overtime');
  const panelHistory = document.getElementById('panel-history');
  const panelOvertimeHistory = document.getElementById('panel-overtime-history');
  const panelReports = document.getElementById('panel-reports');

  const tabs = [
    { name: 'pending', btn: btnPending, panel: panelPending },
    { name: 'overtime', btn: btnOvertime, panel: panelOvertime },
    { name: 'history', btn: btnHistory, panel: panelHistory },
    { name: 'overtime-history', btn: btnOvertimeHistory, panel: panelOvertimeHistory },
    { name: 'reports', btn: btnReports, panel: panelReports }
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

  // Jika tab laporan aktif dan data belum ada, muat laporan
  if (tab === 'reports' && (!state.reports || state.reports.length === 0)) {
    loadReports();
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

      const reportFilterSelect = document.getElementById('report-filter-division');
      if (reportFilterSelect) {
        reportFilterSelect.innerHTML = '<option value="">Semua Divisi</option>' +
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

// Refresh All Data
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
    renderTables();

    // Auto-sync master data (employees & divisions) every 4 cycles (~16s)
    if (syncCycleCount % 4 === 0) {
      loadEmployees();
      loadDivisions();
    }

    // Auto-refresh reports if currently on reports tab
    if (state.activeTab === 'reports') {
      loadReports(true);
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

  document.getElementById('stat-pending').textContent = totalPending;
  document.getElementById('stat-approved').textContent = approvedSubCount + approvedOtCount;
  document.getElementById('stat-rejected').textContent = rejectedSubCount + rejectedOtCount;

  document.getElementById('badge-pending-count').textContent = pendingSubCount;
  document.getElementById('badge-overtime-pending-count').textContent = pendingOtCount;
  document.getElementById('badge-history-count').textContent = state.historySubmissions.length;
  document.getElementById('badge-overtime-history-count').textContent = state.historyOvertimes.length;

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

// Render All Tables & Mobile Cards
function renderTables() {
  renderPendingTable();
  renderPendingCards();
  renderOvertimePendingTable();
  renderOvertimePendingCards();
  renderHistoryTable();
  renderHistoryCards();
  renderOvertimeHistoryTable();
  renderOvertimeHistoryCards();
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
        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          Pending
        </span>
      </td>
      <td class="px-4 py-3.5 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1.5">
          <button onclick="openDecisionModal(${item.id}, 'approved')" class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer">
            Setujui
          </button>
          <button onclick="openDecisionModal(${item.id}, 'rejected')" class="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer">
            Tolak
          </button>
          <button onclick="editSubmission(${item.id}, 'pending')" class="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-bold text-[11px] transition-colors cursor-pointer">
            Edit
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

      <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <button onclick="openDecisionModal(${item.id}, 'approved')" class="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors text-center cursor-pointer">
          Setujui
        </button>
        <button onclick="openDecisionModal(${item.id}, 'rejected')" class="flex-1 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200 transition-colors text-center cursor-pointer">
          Tolak
        </button>
        <button onclick="editSubmission(${item.id}, 'pending')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer">
          Edit
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
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
          Belum ada riwayat pengajuan yang diproses.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => `
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
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'}">
            ${item.status === 'approved' ? 'Disetujui' : 'Ditolak'}
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
    </tr>
  `).join('');
}

// Render History Submissions Cards (Mobile View)
function renderHistoryCards() {
  const container = document.getElementById('cards-history');
  if (!container) return;

  let list = (state.historySubmissions || []).filter(s => s.type !== 'lembur');
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-6 text-center text-slate-400 text-xs">
        Belum ada riwayat pengajuan yang diproses.
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
        <div class="flex items-center gap-1.5">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${getTypeBadgeStyle(item.type)}">${escapeHtml(item.type)}</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'}">
            ${item.status === 'approved' ? 'Disetujui' : 'Ditolak'}
          </span>
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
    </div>
  `).join('');
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
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Pending
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

        <div>
          <button onclick="openOvertimeDetailModal(${item.id})" class="w-full py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
            <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            <span>Verifikasi Foto & Titik GPS</span>
          </button>
        </div>

        <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <button onclick="openOvertimeDecisionModal(${item.id}, 'approved')" class="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors text-center cursor-pointer">
            Setujui
          </button>
          <button onclick="openOvertimeDecisionModal(${item.id}, 'rejected')" class="flex-1 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200 transition-colors text-center cursor-pointer">
            Tolak
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
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-6 text-center text-slate-400 text-xs">
        Belum ada riwayat presensi lembur yang diproses.
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
      <div class="glass-card rounded-2xl p-4 space-y-3 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-black text-slate-900 dark:text-white text-sm">${escapeHtml(item.full_name)}</h4>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">${escapeHtml(item.division_name || '-')}</span>
            </div>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.overtime_status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'}">
            ${item.overtime_status === 'approved' ? 'Disetujui' : 'Ditolak'}
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

        <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
          <button onclick="openOvertimeDetailModal(${item.id})" class="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold text-center cursor-pointer transition-colors">
            Detail Foto & GPS
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
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <button onclick="openOvertimeDetailModal(${item.id})" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-[11px] font-bold shadow-xs cursor-pointer">
            <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            <span>Foto & Lokasi GPS</span>
          </button>
        </td>
        <td class="px-4 py-3.5 text-center">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Pending
          </span>
        </td>
        <td class="px-4 py-3.5 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="openOvertimeDecisionModal(${item.id}, 'approved')" class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer">
              Setujui
            </button>
            <button onclick="openOvertimeDecisionModal(${item.id}, 'rejected')" class="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer">
              Tolak
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
  if (state.searchKeyword) {
    list = list.filter(s => s.full_name && s.full_name.toLowerCase().includes(state.searchKeyword));
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
          Belum ada riwayat presensi lembur yang diproses.
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
          ${escapeHtml(item.overtime_task_reason || '-')}
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 max-w-xs">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.overtime_status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'}">
              ${item.overtime_status === 'approved' ? 'Disetujui' : 'Ditolak'}
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
          <button onclick="openOvertimeDetailModal(${item.id})" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer">
            Detail Foto
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Load Attendance Reports
async function loadReports(silent = false) {
  const tbody = document.getElementById('tbody-reports');
  const cards = document.getElementById('cards-reports');
  if (!silent) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-12 text-center text-slate-400">Memuat data laporan absensi...</td></tr>`;
    if (cards) cards.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-slate-400 text-xs">Memuat data laporan absensi...</div>`;
  }

  try {
    const period = document.getElementById('report-filter-period')?.value || 'today';
    const startDate = document.getElementById('report-start-date')?.value || '';
    const endDate = document.getElementById('report-end-date')?.value || '';
    const divId = document.getElementById('report-filter-division')?.value || '';

    let url = `/api/reports/attendance?period=${period}`;
    if (divId) url += `&division_id=${divId}`;
    if (period === 'custom' && startDate && endDate) {
      url += `&start_date=${startDate}&end_date=${endDate}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      state.reports = data.rows || [];
      renderReportsTable();
    } else {
      if (!silent) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-8 text-center text-rose-500">${data.message || 'Gagal memuat laporan.'}</td></tr>`;
        if (cards) cards.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-rose-500 text-xs">${data.message || 'Gagal memuat laporan.'}</div>`;
      }
    }
  } catch (err) {
    console.error('Error load reports:', err);
    if (!silent) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-8 text-center text-rose-500">Terjadi kesalahan jaringan saat memuat laporan.</td></tr>`;
      if (cards) cards.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-rose-500 text-xs">Terjadi kesalahan jaringan saat memuat laporan.</div>`;
    }
  }
}

// Render Attendance Report Table
function renderReportsTable() {
  const tbody = document.getElementById('tbody-reports');
  if (tbody) {
    if (!state.reports || state.reports.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-12 text-center text-slate-400">Tidak ada data absensi pada periode atau filter yang dipilih.</td></tr>`;
    } else {
      tbody.innerHTML = state.reports.map(item => {
        const inTime = item.clock_in_time ? new Date(item.clock_in_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
        const outTime = item.clock_out_time ? new Date(item.clock_out_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
        
        const workSec = item.work_duration_seconds || 0;
        const is9hTarget = workSec >= 32400; // 9 jam
        const workHms = item.work_duration_hms || (workSec > 0 ? `${Math.floor(workSec / 3600)}j ${Math.floor((workSec % 3600) / 60)}m` : '-');

        const lateSec = item.late_duration_seconds || 0;
        const lateHms = lateSec > 0 ? `${Math.floor(lateSec / 60)}m` : '-';

        const otSec = item.overtime_seconds || 0;
        const otHms = otSec > 0 ? `${Math.floor(otSec / 3600)}j ${Math.floor((otSec % 3600) / 60)}m` : '-';

        let statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Belum Selesai</span>';
        if (item.status === 'on_time') {
          statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Hadir Lengkap</span>';
        } else if (item.status === 'late') {
          statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Terlambat</span>';
        } else if (item.status === 'early_leave') {
          statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">Pulang Awal</span>';
        }

        return `
          <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
            <td class="px-4 py-3 font-bold text-slate-900 dark:text-white">
              ${escapeHtml(item.full_name)}
              <div class="text-[10px] font-normal text-slate-400">${escapeHtml(item.position_name || '-')}</div>
            </td>
            <td class="px-4 py-3 text-slate-600 dark:text-slate-300">
              <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
                ${escapeHtml(item.division_name || '-')}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
              ${formatDate(item.attendance_date)}
            </td>
            <td class="px-4 py-3 text-slate-700 dark:text-slate-200 font-mono font-bold text-xs">
              ${inTime}
            </td>
            <td class="px-4 py-3 text-slate-700 dark:text-slate-200 font-mono font-bold text-xs">
              ${outTime}
            </td>
            <td class="px-4 py-3 text-slate-800 dark:text-slate-100 font-mono font-bold text-xs">
              ${workHms}
              ${is9hTarget ? '<span class="ml-1 text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 font-extrabold">9 Jam ✔</span>' : ''}
            </td>
            <td class="px-4 py-3 text-slate-500 font-mono text-xs">
              ${lateHms}
            </td>
            <td class="px-4 py-3 text-slate-500 font-mono text-xs">
              ${otHms}
            </td>
            <td class="px-4 py-3 text-center">
              ${statusBadge}
            </td>
            <td class="px-4 py-3 text-right">
              ${item.clock_in_photo || item.clock_in_lat ? `
                <button onclick="viewAttendanceReportDetail(${item.id})" class="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-bold text-[11px] transition-colors cursor-pointer">
                  Foto/GPS
                </button>
              ` : '<span class="text-[11px] text-slate-400 italic">-</span>'}
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  renderReportsCards();
}

// Render Attendance Reports Cards (Mobile View)
function renderReportsCards() {
  const container = document.getElementById('cards-reports');
  if (!container) return;

  if (!state.reports || state.reports.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-6 text-center text-slate-400 text-xs">
        Tidak ada data absensi pada periode atau filter yang dipilih.
      </div>`;
    return;
  }

  container.innerHTML = state.reports.map(item => {
    const inTime = item.clock_in_time ? new Date(item.clock_in_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
    const outTime = item.clock_out_time ? new Date(item.clock_out_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
    
    const workSec = item.work_duration_seconds || 0;
    const is9hTarget = workSec >= 32400; // 9 jam
    const workHms = item.work_duration_hms || (workSec > 0 ? `${Math.floor(workSec / 3600)}j ${Math.floor((workSec % 3600) / 60)}m` : '-');

    const lateSec = item.late_duration_seconds || 0;
    const lateHms = lateSec > 0 ? `${Math.floor(lateSec / 60)}m` : '-';

    const otSec = item.overtime_seconds || 0;
    const otHms = otSec > 0 ? `${Math.floor(otSec / 3600)}j ${Math.floor((otSec % 3600) / 60)}m` : '-';

    let statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Belum Selesai</span>';
    if (item.status === 'on_time') {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Hadir Lengkap</span>';
    } else if (item.status === 'late') {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Terlambat</span>';
    } else if (item.status === 'early_leave') {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">Pulang Awal</span>';
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
          <div>${statusBadge}</div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
            <span class="text-[10px] text-slate-400 uppercase font-bold block">Tanggal</span>
            <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${formatDate(item.attendance_date)}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
            <span class="text-[10px] text-slate-400 uppercase font-bold block">Durasi Kerja</span>
            <div class="flex items-center gap-1">
              <span class="font-mono font-bold text-slate-800 dark:text-slate-100">${workHms}</span>
              ${is9hTarget ? '<span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-600 font-extrabold">9j ✔</span>' : ''}
            </div>
          </div>
        </div>

        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs flex items-center justify-between font-mono">
          <div>In: <strong class="text-slate-800 dark:text-slate-200">${inTime}</strong> | Out: <strong class="text-slate-800 dark:text-slate-200">${outTime}</strong></div>
          <div class="text-[11px] text-slate-500">Late: <strong>${lateHms}</strong> | OT: <strong>${otHms}</strong></div>
        </div>

        ${item.clock_in_photo || item.clock_in_lat ? `
          <div class="pt-1">
            <button onclick="viewAttendanceReportDetail(${item.id})" class="w-full py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-bold text-xs transition-colors cursor-pointer text-center">
              Lihat Foto & Lokasi GPS
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Export Report Handler
function exportReport(format = 'xlsx') {
  const period = document.getElementById('report-filter-period')?.value || 'today';
  const startDate = document.getElementById('report-start-date')?.value || '';
  const endDate = document.getElementById('report-end-date')?.value || '';
  const divId = document.getElementById('report-filter-division')?.value || '';

  let url = `/api/reports/attendance/export?format=${format}&period=${period}`;
  if (divId) url += `&division_id=${divId}`;
  if (period === 'custom' && startDate && endDate) {
    url += `&start_date=${startDate}&end_date=${endDate}`;
  }

  window.open(url, '_blank');
}

// View Attendance Detail Modal
async function viewAttendanceReportDetail(attendanceId) {
  try {
    const res = await fetch(`/api/reports/attendance/${attendanceId}`);
    const data = await res.json();
    if (!data.success || !data.attendance) {
      alert('Data detail absensi tidak ditemukan.');
      return;
    }
    const item = data.attendance;
    const content = document.getElementById('ot-detail-content');
    if (!content) return;

    const inPhoto = item.clock_in_photo ? item.clock_in_photo.replace('/uploads/', '/secure-uploads/') : null;
    const outPhoto = item.clock_out_photo ? item.clock_out_photo.replace('/uploads/', '/secure-uploads/') : null;

    content.innerHTML = `
      <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
        <div class="font-bold text-slate-900 dark:text-white text-sm">${escapeHtml(item.full_name)} (${escapeHtml(item.division_name || '-')})</div>
        <div class="text-slate-500 font-mono">Tanggal Absensi: ${formatDate(item.attendance_date)}</div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <span class="text-xs font-bold text-emerald-600 uppercase">Clock In</span>
          ${inPhoto ? `<img src="${inPhoto}" class="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200 shadow-sm" alt="Foto Clock In"/>` : '<div class="w-full aspect-[4/3] bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-400">Tidak ada foto</div>'}
          ${item.clock_in_lat ? `
            <a href="https://www.google.com/maps?q=${item.clock_in_lat},${item.clock_in_lng}" target="_blank" class="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-200/60">
              Lihat di Google Maps
            </a>
          ` : '<span class="text-xs text-slate-400 block">Koordinat tidak tersedia</span>'}
        </div>

        <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <span class="text-xs font-bold text-rose-600 uppercase">Clock Out</span>
          ${outPhoto ? `<img src="${outPhoto}" class="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200 shadow-sm" alt="Foto Clock Out"/>` : '<div class="w-full aspect-[4/3] bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-400">Tidak ada foto</div>'}
          ${item.clock_out_lat ? `
            <a href="https://www.google.com/maps?q=${item.clock_out_lat},${item.clock_out_lng}" target="_blank" class="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-200/60">
              Lihat di Google Maps
            </a>
          ` : '<span class="text-xs text-slate-400 block">Koordinat tidak tersedia</span>'}
        </div>
      </div>
    `;

    const modal = document.getElementById('modal-overtime-detail');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  } catch (err) {
    alert('Gagal mengambil rincian absensi: ' + err.message);
  }
}

// Modal Decision Handling
let currentDecisionContext = { type: 'submission', id: null, decision: null };

function openDecisionModal(submissionId, decision) {
  currentDecisionContext = { type: 'submission', id: submissionId, decision: decision };
  const modal = document.getElementById('modal-decision');
  const title = document.getElementById('modal-decision-title');
  const note = document.getElementById('decision-review-note');
  
  if (title) title.textContent = decision === 'approved' ? 'Persetujuan Pengajuan' : 'Penolakan Pengajuan';
  if (note) {
    note.value = decision === 'approved' ? 'Disetujui' : '';
    note.placeholder = decision === 'approved' ? 'Catatan persetujuan...' : 'Alasan penolakan wajib diisi...';
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

  if (title) title.textContent = decision === 'approved' ? 'Persetujuan Lembur' : 'Penolakan Lembur';
  if (note) {
    note.value = decision === 'approved' ? 'Disetujui' : '';
    note.placeholder = decision === 'approved' ? 'Catatan lembur...' : 'Alasan penolakan lembur...';
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
    if (currentDecisionContext.type === 'submission') {
      url = `/api/admin/submissions/${currentDecisionContext.id}/decision`;
      body = { decision: currentDecisionContext.decision, review_note: note || 'Disetujui' };
    } else {
      url = `/api/admin/overtime/${currentDecisionContext.id}/decision`;
      body = { decision: currentDecisionContext.decision, review_note: note || 'Disetujui' };
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
window.viewAttendanceReportDetail = viewAttendanceReportDetail;
window.exportReport = exportReport;
window.switchTab = switchTab;
window.refreshAllData = refreshAllData;
