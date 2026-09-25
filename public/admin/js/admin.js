// public/admin/js/admin.js
// Dashboard Admin Manager - Focused Submissions Module

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

  // Start polling every 3 seconds for real-time synchronization
  state.pollingInterval = setInterval(refreshAllData, 3000);
});

// Theme Initialization
function renderThemeToggleBtn(isDark) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  if (isDark) {
    btn.className = 'relative inline-flex items-center justify-between w-[130px] h-8 sm:w-[140px] sm:h-9 px-1 rounded-full bg-black border border-slate-800 cursor-pointer select-none transition-all duration-300 shadow-xs hover:scale-105 shrink-0';
    btn.innerHTML = `
      <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-md flex items-center justify-center shrink-0 border border-slate-200">
        <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.3 2a10 10 0 0 0 9.7 12.8 10 10 0 1 1-9.7-12.8z"/>
          <path d="M18 3.5l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4z"/>
          <path d="M21 8.5l.3.6.6.3-.6.3-.3.6-.3-.6-.6-.3.6-.3z"/>
        </svg>
      </div>
      <span class="text-[9px] sm:text-[10px] font-black tracking-wider text-white pr-2 sm:pr-2.5 uppercase select-none">NIGHT MODE</span>
    `;
  } else {
    btn.className = 'relative inline-flex items-center justify-between w-[130px] h-8 sm:w-[140px] sm:h-9 px-1 rounded-full bg-[#EBEBEB] border border-[#D1D1D1] cursor-pointer select-none transition-all duration-300 shadow-xs hover:scale-105 shrink-0';
    btn.innerHTML = `
      <span class="text-[9px] sm:text-[10px] font-black tracking-wider text-slate-900 pl-2 sm:pl-2.5 uppercase select-none">DAY MODE</span>
      <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-md flex items-center justify-center shrink-0 border border-slate-200">
        <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-900" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4.5"></circle>
          <line x1="12" y1="2" x2="12" y2="4"></line>
          <line x1="12" y1="20" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"></line>
          <line x1="17.66" y1="17.66" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="4" y2="12"></line>
          <line x1="20" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="6.34" y2="17.66"></line>
          <line x1="17.66" y1="6.34" x2="19.07" y2="4.93"></line>
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
    
    // Update Header
    const nameEl = document.getElementById('user-fullname');
    const emailEl = document.getElementById('user-email');
    if (nameEl) nameEl.textContent = data.user.full_name || 'Manager';
    if (emailEl) emailEl.textContent = data.user.email || 'admin@sedaya.com';

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
    if (confirm('Apakah Anda yakin ingin keluar?')) {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    }
  });

  // Division Filter Change
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
    showToast('Data berhasil diperbarui', 'success');
  });

  // Tabs Switch
  document.getElementById('tab-btn-pending')?.addEventListener('click', () => switchTab('pending'));
  document.getElementById('tab-btn-overtime')?.addEventListener('click', () => switchTab('overtime'));
  document.getElementById('tab-btn-history')?.addEventListener('click', () => switchTab('history'));
  document.getElementById('tab-btn-overtime-history')?.addEventListener('click', () => switchTab('overtime-history'));

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
}

// Switch Tabs
function switchTab(tab) {
  state.activeTab = tab;
  const btnPending = document.getElementById('tab-btn-pending');
  const btnOvertime = document.getElementById('tab-btn-overtime');
  const btnHistory = document.getElementById('tab-btn-history');
  const btnOvertimeHistory = document.getElementById('tab-btn-overtime-history');

  const panelPending = document.getElementById('panel-pending');
  const panelOvertime = document.getElementById('panel-overtime');
  const panelHistory = document.getElementById('panel-history');
  const panelOvertimeHistory = document.getElementById('panel-overtime-history');

  const tabs = [
    { name: 'pending', btn: btnPending, panel: panelPending },
    { name: 'overtime', btn: btnOvertime, panel: panelOvertime },
    { name: 'history', btn: btnHistory, panel: panelHistory },
    { name: 'overtime-history', btn: btnOvertimeHistory, panel: panelOvertimeHistory }
  ];

  tabs.forEach(t => {
    if (!t.btn || !t.panel) return;
    if (t.name === tab) {
      t.btn.classList.add('border-brand-600', 'text-brand-600', 'dark:border-brand-500', 'dark:text-brand-400');
      t.btn.classList.remove('border-transparent', 'text-slate-500', 'dark:text-slate-400');
      t.panel.classList.remove('hidden');
    } else {
      t.btn.classList.remove('border-brand-600', 'text-brand-600', 'dark:border-brand-500', 'dark:text-brand-400');
      t.btn.classList.add('border-transparent', 'text-slate-500', 'dark:text-slate-400');
      t.panel.classList.add('hidden');
    }
  });
}

// Load Divisions
async function loadDivisions() {
  try {
    const res = await fetch('/api/admin/divisions');
    const data = await res.json();
    if (data.success) {
      state.divisions = data.divisions || [];
      const select = document.getElementById('filter-division');
      if (select) {
        select.innerHTML = '<option value="">Semua Divisi</option>' +
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

// Refresh All Submissions & Overtime Data
async function refreshAllData() {
  try {
    const divisionParam = state.selectedDivisionId ? `?division_id=${state.selectedDivisionId}` : '';
    
    const [resPending, resHistory, resOtPending, resOtHistory] = await Promise.all([
      fetch(`/api/admin/submissions/pending${divisionParam}`),
      fetch(`/api/admin/submissions/history${divisionParam}`),
      fetch(`/api/admin/overtime/pending${divisionParam}`),
      fetch(`/api/admin/overtime/history${divisionParam}`)
    ]);

    const dataPending = await resPending.json();
    const dataHistory = await resHistory.json();
    const dataOtPending = await resOtPending.json();
    const dataOtHistory = await resOtHistory.json();

    if (dataPending.success) state.pendingSubmissions = dataPending.submissions || [];
    if (dataHistory.success) state.historySubmissions = dataHistory.submissions || [];
    if (dataOtPending.success) state.pendingOvertimes = dataOtPending.overtimes || [];
    if (dataOtHistory.success) state.historyOvertimes = dataOtHistory.overtimes || [];

    updateCounters();
    renderTables();
  } catch (err) {
    console.error('Gagal merefresh data:', err);
  }
}

// Update Counters in Cards and Badges
function updateCounters() {
  const pendingSubCount = state.pendingSubmissions.length;
  const pendingOtCount = state.pendingOvertimes.length;
  const totalPending = pendingSubCount + pendingOtCount;

  const approvedSubCount = state.historySubmissions.filter(s => s.status === 'approved').length;
  const approvedOtCount = state.historyOvertimes.filter(s => s.overtime_status === 'approved').length;

  const rejectedSubCount = state.historySubmissions.filter(s => s.status === 'rejected').length;
  const rejectedOtCount = state.historyOvertimes.filter(s => s.overtime_status === 'rejected').length;

  document.getElementById('stat-pending').textContent = totalPending;
  document.getElementById('stat-approved').textContent = approvedSubCount + approvedOtCount;
  document.getElementById('stat-rejected').textContent = rejectedSubCount + rejectedOtCount;

  document.getElementById('badge-pending-count').textContent = pendingSubCount;
  document.getElementById('badge-overtime-pending-count').textContent = pendingOtCount;
  document.getElementById('badge-history-count').textContent = state.historySubmissions.length;
  document.getElementById('badge-overtime-history-count').textContent = state.historyOvertimes.length;
}

// Render All Tables
function renderTables() {
  renderPendingTable();
  renderOvertimePendingTable();
  renderHistoryTable();
  renderOvertimeHistoryTable();
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
        <td colspan="7" class="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
          Tidak ada pengajuan yang membutuhkan persetujuan.
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
        <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-[11px] font-semibold">
          ${escapeHtml(item.division_name || '-')}
        </span>
      </td>
      <td class="px-4 py-3.5">
        <span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase ${getTypeBadgeStyle(item.type)}">
          ${escapeHtml(item.type)}
        </span>
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
        ${formatDate(item.start_date)} ${item.start_date !== item.end_date ? `- ${formatDate(item.end_date)}` : ''}
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 max-w-xs" title="${escapeHtml(item.reason)}">
        <div class="font-medium text-slate-800 dark:text-slate-200 leading-snug">${escapeHtml(item.reason || '-')}</div>
        ${item.type === 'cuti' && (item.handover_plan || item.handover_to_name) ? `
          <div class="mt-1.5 p-2 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-[11px] space-y-0.5 text-slate-700 dark:text-slate-300">
            <div class="font-bold text-blue-900 dark:text-blue-300">📋 Serah Terima:</div>
            ${item.handover_plan ? `<div class="italic text-slate-600 dark:text-slate-400">${escapeHtml(item.handover_plan)}</div>` : ''}
            ${item.handover_to_name ? `<div>Diserahkan ke: <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(item.handover_to_name)}</span> ${item.handover_to_position ? `<span class="text-slate-500">(${escapeHtml(item.handover_to_position)})</span>` : ''}</div>` : ''}
          </div>
        ` : ''}
        ${item.attachment ? `
          <div class="mt-1.5">
            <a href="${item.attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800 px-2 py-0.5 rounded-md">
              📎 <span>Lihat Bukti File / Surat Dokter</span>
            </a>
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
          <button onclick="openDecisionModal(${item.id}, 'approved')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-sm transition-colors">
            Setujui
          </button>
          <button onclick="openDecisionModal(${item.id}, 'rejected')" class="px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] shadow-sm transition-colors">
            Tolak
          </button>
          <button onclick="editSubmission(${item.id}, 'pending')" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-bold text-[11px] transition-colors">
            Edit
          </button>
          <button onclick="deleteSubmission(${item.id})" class="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 font-bold text-[11px] transition-colors">
            Hapus
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Render History Submissions Table
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
        <td colspan="6" class="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
          Belum ada riwayat pengajuan.
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
        <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-[11px] font-semibold">
          ${escapeHtml(item.division_name || '-')}
        </span>
      </td>
      <td class="px-4 py-3.5">
        <span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase ${getTypeBadgeStyle(item.type)}">
          ${escapeHtml(item.type)}
        </span>
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
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
        ${item.type === 'cuti' && (item.handover_plan || item.handover_to_name) ? `
          <div class="p-2 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-[11px] space-y-0.5 text-slate-700 dark:text-slate-300 mt-1">
            <div class="font-bold text-blue-900 dark:text-blue-300">📋 Serah Terima:</div>
            ${item.handover_plan ? `<div class="italic text-slate-600 dark:text-slate-400">${escapeHtml(item.handover_plan)}</div>` : ''}
            ${item.handover_to_name ? `<div>Diserahkan ke: <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(item.handover_to_name)}</span> ${item.handover_to_position ? `<span class="text-slate-500">(${escapeHtml(item.handover_to_position)})</span>` : ''}</div>` : ''}
          </div>
        ` : ''}
        ${item.attachment ? `
          <div class="mt-1">
            <a href="${item.attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800 px-2 py-0.5 rounded-md">
              📎 <span>Lihat Bukti File / Surat Dokter</span>
            </a>
          </div>
        ` : ''}
      </td>
      <td class="px-4 py-3.5 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1.5">
          <button onclick="editSubmission(${item.id}, 'history')" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 font-bold text-[11px] transition-colors">
            Edit
          </button>
          <button onclick="deleteSubmission(${item.id})" class="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 font-bold text-[11px] transition-colors">
            Hapus
          </button>
        </div>
      </td>
    </tr>
  `).join('');
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
        <td colspan="8" class="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
          Tidak ada presensi lembur yang membutuhkan persetujuan.
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
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
          ${formatDate(item.attendance_date)}
        </td>
        <td class="px-4 py-3.5 text-slate-700 dark:text-slate-200 whitespace-nowrap">
          <div class="font-bold text-amber-700 dark:text-amber-400">In: ${inTime} | Out: ${outTime}</div>
          <div class="text-[11px] text-slate-500 font-medium">Durasi: <span class="font-bold">${durStr}</span></div>
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 max-w-xs truncate" title="${escapeHtml(item.overtime_task_reason)}">
          <div class="font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(item.overtime_task_reason || '-')}</div>
          ${item.overtime_clock_out_note ? `<div class="text-[11px] text-slate-500 italic">Catatan: ${escapeHtml(item.overtime_clock_out_note)}</div>` : ''}
        </td>
        <td class="px-4 py-3.5 whitespace-nowrap">
          <button onclick="openOvertimeDetailModal(${item.id})" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] hover:bg-slate-200 transition-colors flex items-center gap-1">
            <span>📸</span> <span>Lihat Foto & GPS</span>
          </button>
        </td>
        <td class="px-4 py-3.5 text-center">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Pending
          </span>
        </td>
        <td class="px-4 py-3.5 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="openOvertimeDecisionModal(${item.id}, 'approved')" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-sm transition-colors">
              Setujui
            </button>
            <button onclick="openOvertimeDecisionModal(${item.id}, 'rejected')" class="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] shadow-sm transition-colors">
              Tolak
            </button>
            <button onclick="deleteOvertime(${item.id})" class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] border border-rose-200 transition-colors">
              Hapus
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Render History Overtime Attendance Table
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
        <td colspan="6" class="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
          Belum ada riwayat presensi lembur.
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
          <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-[11px] font-semibold">
            ${escapeHtml(item.division_name || '-')}
          </span>
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
          ${formatDate(item.attendance_date)}
          <div class="text-[11px] font-bold text-amber-600 dark:text-amber-400">⏱️ ${inTime} - ${outTime} (${durStr})</div>
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 max-w-xs truncate" title="${escapeHtml(item.overtime_task_reason)}">
          ${escapeHtml(item.overtime_task_reason || '-')}
        </td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300">
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.overtime_status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'}">
              ${item.overtime_status === 'approved' ? 'Disetujui' : 'Ditolak'}
            </span>
            <span class="text-xs text-slate-500 truncate max-w-xs" title="${escapeHtml(item.overtime_review_note)}">
              ${escapeHtml(item.overtime_review_note || '-')}
            </span>
          </div>
          <button onclick="openOvertimeDetailModal(${item.id})" class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px] hover:bg-slate-200 transition-colors inline-flex items-center gap-1">
            📸 Lihat Foto & GPS
          </button>
        </td>
        <td class="px-4 py-3.5 text-right whitespace-nowrap text-slate-500 text-xs">
          <div>${escapeHtml(item.reviewed_by_name || 'Admin')}</div>
          <button onclick="deleteOvertime(${item.id})" class="mt-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] border border-rose-200 transition-colors">
            Hapus
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Global Delete Overtime Handler
window.deleteOvertime = async function(id) {
  if (confirm('Apakah Anda yakin ingin menghapus data presensi lembur ini? Data yang dihapus tidak dapat dikembalikan.')) {
    try {
      const res = await fetch(`/api/admin/overtime/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Presensi lembur berhasil dihapus.', 'success');
        refreshAllData();
      } else {
        showToast(data.message || 'Gagal menghapus presensi lembur.', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan saat menghapus data.', 'error');
    }
  }
};

function getSecureUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  let clean = url.trim();
  if (clean.startsWith('/uploads/')) return clean.replace('/uploads/', '/secure-uploads/');
  if (clean.startsWith('uploads/')) return '/' + clean.replace('uploads/', 'secure-uploads/');
  if (clean.startsWith('/secure-uploads/')) return clean;
  return '/secure-uploads/attendance/' + clean.split('/').pop();
}

// Modal Detail Presensi Lembur (Foto Selfie & GPS Map Link)
function openOvertimeDetailModal(id) {
  const item = (state.pendingOvertimes || []).find(o => String(o.id) === String(id)) || (state.historyOvertimes || []).find(o => String(o.id) === String(id));
  if (!item) return;

  const content = document.getElementById('ot-detail-content');
  if (!content) return;

  const inPhoto = getSecureUrl(item.overtime_clock_in_photo);
  const outPhoto = getSecureUrl(item.overtime_clock_out_photo);

  const inGpsStr = (item.overtime_clock_in_lat && item.overtime_clock_in_lng)
    ? `${Number(item.overtime_clock_in_lat).toFixed(6)}, ${Number(item.overtime_clock_in_lng).toFixed(6)}`
    : null;

  const outGpsStr = (item.overtime_clock_out_lat && item.overtime_clock_out_lng)
    ? `${Number(item.overtime_clock_out_lat).toFixed(6)}, ${Number(item.overtime_clock_out_lng).toFixed(6)}`
    : null;

  const inGpsLink = inGpsStr ? `https://maps.google.com/?q=${item.overtime_clock_in_lat},${item.overtime_clock_in_lng}` : null;
  const outGpsLink = outGpsStr ? `https://maps.google.com/?q=${item.overtime_clock_out_lat},${item.overtime_clock_out_lng}` : null;

  content.innerHTML = `
    <div class="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl space-y-1 text-xs border border-slate-200 dark:border-slate-800">
      <div class="font-bold text-slate-900 dark:text-white text-sm">${escapeHtml(item.full_name)} (${escapeHtml(item.division_name || '-')})</div>
      <div class="text-slate-500">Tanggal: <span class="font-semibold text-slate-800 dark:text-slate-200">${formatDate(item.attendance_date)}</span></div>
      <div class="text-slate-500">Tugas Lembur: <span class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(item.overtime_task_reason || '-')}</span></div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-2.5">
        <span class="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Absen Masuk Lembur</span>
        ${inPhoto ? `<img src="${inPhoto}" class="w-full aspect-[4/3] object-cover rounded-lg border border-slate-200 shadow-sm" alt="Foto Masuk Lembur" />` : '<div class="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400">Tidak ada foto</div>'}
        ${inGpsStr ? `
          <div class="space-y-1">
            <div class="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">📍 ${inGpsStr}</div>
            <a href="${inGpsLink}" target="_blank" class="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 px-3 py-1.5 rounded-xl border border-brand-200/60 transition-colors">
              🗺️ Buka Maps GPS Masuk
            </a>
          </div>
        ` : '<span class="text-xs text-slate-400 block pt-1">📍 GPS Masuk tak melacak</span>'}
      </div>

      <div class="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-2.5">
        <span class="text-xs font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Absen Pulang Lembur</span>
        ${outPhoto ? `<img src="${outPhoto}" class="w-full aspect-[4/3] object-cover rounded-lg border border-slate-200 shadow-sm" alt="Foto Pulang Lembur" />` : '<div class="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400">Tidak ada foto</div>'}
        ${outGpsStr ? `
          <div class="space-y-1">
            <div class="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">📍 ${outGpsStr}</div>
            <a href="${outGpsLink}" target="_blank" class="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 px-3 py-1.5 rounded-xl border border-brand-200/60 transition-colors">
              🗺️ Buka Maps GPS Pulang
            </a>
          </div>
        ` : '<span class="text-xs text-slate-400 block pt-1">📍 GPS Pulang tak melacak</span>'}
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

window.openOvertimeDetailModal = openOvertimeDetailModal;
window.closeOvertimeDetailModal = closeOvertimeDetailModal;
window.openOvertimeDecisionModal = openOvertimeDecisionModal;

document.getElementById('btn-close-ot-detail')?.addEventListener('click', closeOvertimeDetailModal);
document.getElementById('btn-done-ot-detail')?.addEventListener('click', closeOvertimeDetailModal);

// Open Decision Modal for Overtime
function openOvertimeDecisionModal(id, decision) {
  document.getElementById('decision-submission-id').value = id;
  document.getElementById('decision-action-type').value = `overtime_${decision}`;
  document.getElementById('decision-review-note').value = decision === 'approved' ? 'Lembur Disetujui' : '';
  
  const titleEl = document.getElementById('modal-decision-title');
  const confirmBtn = document.getElementById('btn-confirm-decision');
  
  if (decision === 'approved') {
    titleEl.textContent = 'Setujui Presensi Lembur';
    confirmBtn.className = 'px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors';
  } else {
    titleEl.textContent = 'Tolak Presensi Lembur';
    confirmBtn.className = 'px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors';
  }

  const modal = document.getElementById('modal-decision');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

// Badge Helpers
function getTypeBadgeStyle(type) {
  switch (type) {
    case 'cuti': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
    case 'izin': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300';
    case 'sakit': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    case 'lembur': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    default: return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
  }
}

function toggleFormTimeContainer() {
  const type = document.getElementById('form-type')?.value;
  const container = document.getElementById('form-time-container');
  if (!container) return;
  if (type === 'lembur') {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

function toggleFormHandoverContainer() {
  const type = document.getElementById('form-type')?.value;
  const container = document.getElementById('form-handover-container');
  if (!container) return;
  if (type === 'cuti') {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
    if (document.getElementById('form-handover-plan')) document.getElementById('form-handover-plan').value = '';
    if (document.getElementById('form-handover-to-name')) document.getElementById('form-handover-to-name').value = '';
    if (document.getElementById('form-handover-to-position')) document.getElementById('form-handover-to-position').value = '';
  }
}

document.getElementById('form-type')?.addEventListener('change', () => {
  toggleFormTimeContainer();
  toggleFormHandoverContainer();
});

// Open Submission Modal for Creating New
function openSubmissionModal() {
  document.getElementById('submission-id').value = '';
  document.getElementById('modal-submission-title').textContent = 'Buat Pengajuan Baru';
  document.getElementById('form-user-id').disabled = false;
  document.getElementById('form-user-id').value = '';
  document.getElementById('form-type').value = 'cuti';
  document.getElementById('form-start-date').value = '';
  document.getElementById('form-end-date').value = '';
  if (document.getElementById('form-start-time')) document.getElementById('form-start-time').value = '';
  if (document.getElementById('form-end-time')) document.getElementById('form-end-time').value = '';
  if (document.getElementById('form-handover-plan')) document.getElementById('form-handover-plan').value = '';
  if (document.getElementById('form-handover-to-name')) document.getElementById('form-handover-to-name').value = '';
  if (document.getElementById('form-handover-to-position')) document.getElementById('form-handover-to-position').value = '';
  document.getElementById('form-status').value = 'pending';
  document.getElementById('form-review-note').value = '';
  document.getElementById('form-reason').value = '';

  toggleFormTimeContainer();
  toggleFormHandoverContainer();

  const modal = document.getElementById('modal-submission');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

// Close Submission Modal
function closeSubmissionModal() {
  const modal = document.getElementById('modal-submission');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// Open Modal for Editing Submission
function editSubmission(id, sourceTab) {
  const list = sourceTab === 'pending' ? state.pendingSubmissions : state.historySubmissions;
  const item = list.find(s => s.id === id);
  if (!item) return;

  document.getElementById('submission-id').value = item.id;
  document.getElementById('modal-submission-title').textContent = 'Edit Data Pengajuan';
  document.getElementById('form-user-id').value = item.user_id || '';
  document.getElementById('form-user-id').disabled = true; // Lock user in edit mode
  document.getElementById('form-type').value = item.type || 'cuti';
  document.getElementById('form-start-date').value = formatInputDate(item.start_date);
  document.getElementById('form-end-date').value = formatInputDate(item.end_date);
  if (document.getElementById('form-start-time')) document.getElementById('form-start-time').value = item.start_time || '';
  if (document.getElementById('form-end-time')) document.getElementById('form-end-time').value = item.end_time || '';
  if (document.getElementById('form-handover-plan')) document.getElementById('form-handover-plan').value = item.handover_plan || '';
  if (document.getElementById('form-handover-to-name')) document.getElementById('form-handover-to-name').value = item.handover_to_name || '';
  if (document.getElementById('form-handover-to-position')) document.getElementById('form-handover-to-position').value = item.handover_to_position || '';
  document.getElementById('form-status').value = item.status || 'pending';
  document.getElementById('form-review-note').value = item.review_note || '';
  document.getElementById('form-reason').value = item.reason || '';

  toggleFormTimeContainer();
  toggleFormHandoverContainer();

  const modal = document.getElementById('modal-submission');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

// Form Submit Handler (Create & Update)
async function handleFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('submission-id').value;
  const user_id = document.getElementById('form-user-id').value;
  const type = document.getElementById('form-type').value;
  const start_date = document.getElementById('form-start-date').value;
  const end_date = document.getElementById('form-end-date').value;
  const start_time = document.getElementById('form-start-time')?.value || null;
  const end_time = document.getElementById('form-end-time')?.value || null;
  const handover_plan = document.getElementById('form-handover-plan')?.value || null;
  const handover_to_name = document.getElementById('form-handover-to-name')?.value || null;
  const handover_to_position = document.getElementById('form-handover-to-position')?.value || null;
  const status = document.getElementById('form-status').value;
  const review_note = document.getElementById('form-review-note').value;
  const reason = document.getElementById('form-reason').value;

  if (!id && !user_id) {
    showToast('Karyawan wajib dipilih!', 'error');
    return;
  }
  if (!start_date || !end_date || !reason) {
    showToast('Semua field bertanda bintang (*) wajib diisi!', 'error');
    return;
  }
  if (type === 'lembur' && (!start_time || !end_time)) {
    showToast('Jam mulai dan selesai wajib diisi untuk pengajuan lembur!', 'error');
    return;
  }

  const isEdit = Boolean(id);
  const url = isEdit ? `/api/admin/submissions/${id}` : '/api/admin/submissions';
  const method = isEdit ? 'PUT' : 'POST';

  const payload = isEdit 
    ? { type, start_date, end_date, start_time, end_time, reason, handover_plan, handover_to_name, handover_to_position, status, review_note }
    : { user_id, type, start_date, end_date, start_time, end_time, reason, handover_plan, handover_to_name, handover_to_position, status, review_note };

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message || (isEdit ? 'Pengajuan berhasil diperbarui' : 'Pengajuan berhasil dibuat'), 'success');
      closeSubmissionModal();
      await refreshAllData();
    } else {
      showToast(data.message || 'Gagal menyimpan pengajuan', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan server', 'error');
  }
}

// Delete Submission
async function deleteSubmission(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus pengajuan ini secara permanen?')) return;

  try {
    const res = await fetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Pengajuan berhasil dihapus', 'success');
      await refreshAllData();
    } else {
      showToast(data.message || 'Gagal menghapus pengajuan', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan server', 'error');
  }
}

// Decision Modal (Approve / Reject Quick for Submissions & Overtime)
function openDecisionModal(id, decision) {
  document.getElementById('decision-submission-id').value = id;
  document.getElementById('decision-action-type').value = decision;
  document.getElementById('decision-review-note').value = decision === 'approved' ? 'Disetujui' : '';
  
  const titleEl = document.getElementById('modal-decision-title');
  const confirmBtn = document.getElementById('btn-confirm-decision');
  
  if (decision === 'approved') {
    titleEl.textContent = 'Setujui Pengajuan';
    confirmBtn.className = 'px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors';
  } else {
    titleEl.textContent = 'Tolak Pengajuan';
    confirmBtn.className = 'px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors';
  }

  const modal = document.getElementById('modal-decision');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeDecisionModal() {
  const modal = document.getElementById('modal-decision');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function handleDecisionSubmit() {
  const id = document.getElementById('decision-submission-id').value;
  const rawAction = document.getElementById('decision-action-type').value;
  const review_note = document.getElementById('decision-review-note').value.trim();

  if (!review_note) {
    showToast('Catatan / Alasan keputusan wajib diisi!', 'error');
    return;
  }

  const isOvertime = rawAction.startsWith('overtime_');
  const decision = isOvertime ? rawAction.replace('overtime_', '') : rawAction;
  const endpoint = isOvertime ? `/api/admin/overtime/${id}/decision` : `/api/admin/submissions/${id}/decision`;

  try {
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, review_note })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeDecisionModal();
      await refreshAllData();
    } else {
      showToast(data.message || 'Gagal memproses keputusan', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan server', 'error');
  }
}

// Attach helper functions to window for onclick handlers in HTML strings
window.openDecisionModal = openDecisionModal;
window.openOvertimeDecisionModal = openOvertimeDecisionModal;
window.openOvertimeDetailModal = openOvertimeDetailModal;
window.editSubmission = editSubmission;
window.deleteSubmission = deleteSubmission;

// Utility Helpers
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatInputDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Toast Notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-600 text-white' :
                  type === 'error' ? 'bg-rose-600 text-white' :
                  'bg-slate-800 text-white';

  toast.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 ${bgClass}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
