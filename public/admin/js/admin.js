// public/admin/js/admin.js
// Dashboard Admin Manager - Focused Submissions Module

let state = {
  user: null,
  divisions: [],
  employees: [],
  pendingSubmissions: [],
  historySubmissions: [],
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

  // Start polling every 10 seconds for real-time synchronization
  state.pollingInterval = setInterval(refreshAllData, 10000);
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
  document.getElementById('tab-btn-history')?.addEventListener('click', () => switchTab('history'));

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
}

// Switch Tabs
function switchTab(tab) {
  state.activeTab = tab;
  const btnPending = document.getElementById('tab-btn-pending');
  const btnHistory = document.getElementById('tab-btn-history');
  const panelPending = document.getElementById('panel-pending');
  const panelHistory = document.getElementById('panel-history');

  if (tab === 'pending') {
    btnPending.classList.add('border-brand-600', 'text-brand-600', 'dark:border-brand-500', 'dark:text-brand-400');
    btnPending.classList.remove('border-transparent', 'text-slate-500', 'dark:text-slate-400');
    btnHistory.classList.remove('border-brand-600', 'text-brand-600', 'dark:border-brand-500', 'dark:text-brand-400');
    btnHistory.classList.add('border-transparent', 'text-slate-500', 'dark:text-slate-400');

    panelPending.classList.remove('hidden');
    panelHistory.classList.add('hidden');
  } else {
    btnHistory.classList.add('border-brand-600', 'text-brand-600', 'dark:border-brand-500', 'dark:text-brand-400');
    btnHistory.classList.remove('border-transparent', 'text-slate-500', 'dark:text-slate-400');
    btnPending.classList.remove('border-brand-600', 'text-brand-600', 'dark:border-brand-500', 'dark:text-brand-400');
    btnPending.classList.add('border-transparent', 'text-slate-500', 'dark:text-slate-400');

    panelHistory.classList.remove('hidden');
    panelPending.classList.add('hidden');
  }
}

// Load Divisions
async function loadDivisions() {
  try {
    const res = await fetch('/api/superadmin/divisions');
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

// Refresh All Submissions Data
async function refreshAllData() {
  try {
    const divisionParam = state.selectedDivisionId ? `?division_id=${state.selectedDivisionId}` : '';
    
    const [resPending, resHistory] = await Promise.all([
      fetch(`/api/admin/submissions/pending${divisionParam}`),
      fetch(`/api/admin/submissions/history${divisionParam}`)
    ]);

    const dataPending = await resPending.json();
    const dataHistory = await resHistory.json();

    if (dataPending.success) state.pendingSubmissions = dataPending.submissions || [];
    if (dataHistory.success) state.historySubmissions = dataHistory.submissions || [];

    updateCounters();
    renderTables();
  } catch (err) {
    console.error('Gagal merefresh data:', err);
  }
}

// Update Counters in Cards and Badges
function updateCounters() {
  const pendingCount = state.pendingSubmissions.length;
  const approvedCount = state.historySubmissions.filter(s => s.status === 'approved').length;
  const rejectedCount = state.historySubmissions.filter(s => s.status === 'rejected').length;

  document.getElementById('stat-pending').textContent = pendingCount;
  document.getElementById('stat-approved').textContent = approvedCount;
  document.getElementById('stat-rejected').textContent = rejectedCount;

  document.getElementById('badge-pending-count').textContent = pendingCount;
  document.getElementById('badge-history-count').textContent = state.historySubmissions.length;
}

// Render Both Pending & History Tables
function renderTables() {
  renderPendingTable();
  renderHistoryTable();
}

// Render Pending Submissions Table
function renderPendingTable() {
  const tbody = document.getElementById('tbody-pending');
  if (!tbody) return;

  let list = state.pendingSubmissions;
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
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
        ${formatDate(item.start_date)} - ${formatDate(item.end_date)}
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 max-w-xs truncate" title="${escapeHtml(item.reason)}">
        ${escapeHtml(item.reason || '-')}
        ${item.attachment ? `<br/><a href="${item.attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="text-xs text-brand-600 underline">Lihat Lampiran</a>` : ''}
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

  let list = state.historySubmissions;
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
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
        ${formatDate(item.start_date)} - ${formatDate(item.end_date)}
      </td>
      <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'}">
            ${item.status === 'approved' ? 'Disetujui' : 'Ditolak'}
          </span>
          <span class="text-xs text-slate-500 truncate max-w-xs" title="${escapeHtml(item.review_note)}">
            ${escapeHtml(item.review_note || '-')}
          </span>
        </div>
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

// Badge Helpers
function getTypeBadgeStyle(type) {
  switch (type) {
    case 'cuti': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
    case 'izin': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300';
    case 'sakit': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    default: return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
  }
}

// Open Submission Modal for Creating New
function openSubmissionModal() {
  document.getElementById('submission-id').value = '';
  document.getElementById('modal-submission-title').textContent = 'Buat Pengajuan Baru';
  document.getElementById('form-user-id').disabled = false;
  document.getElementById('form-user-id').value = '';
  document.getElementById('form-type').value = 'cuti';
  document.getElementById('form-start-date').value = '';
  document.getElementById('form-end-date').value = '';
  document.getElementById('form-status').value = 'pending';
  document.getElementById('form-review-note').value = '';
  document.getElementById('form-reason').value = '';

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
  document.getElementById('form-status').value = item.status || 'pending';
  document.getElementById('form-review-note').value = item.review_note || '';
  document.getElementById('form-reason').value = item.reason || '';

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

  const isEdit = Boolean(id);
  const url = isEdit ? `/api/admin/submissions/${id}` : '/api/admin/submissions';
  const method = isEdit ? 'PUT' : 'POST';

  const payload = isEdit 
    ? { type, start_date, end_date, reason, status, review_note }
    : { user_id, type, start_date, end_date, reason, status, review_note };

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

// Decision Modal (Approve / Reject Quick)
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
  const decision = document.getElementById('decision-action-type').value;
  const review_note = document.getElementById('decision-review-note').value.trim();

  if (!review_note) {
    showToast('Catatan / Alasan keputusan wajib diisi!', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/admin/submissions/${id}/decision`, {
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
