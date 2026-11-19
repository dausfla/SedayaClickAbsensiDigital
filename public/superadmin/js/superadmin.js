// public/superadmin/js/superadmin.js
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, apiDownload, escapeHtml } from '../../js/api.js';
import { subscribeToPushNotifications, showModernToast } from '../../js/push-client.js';

const alertBox = document.getElementById('alert-box');
const alertMsg = document.getElementById('alert-msg');
const btnCloseAlert = document.getElementById('btn-close-alert');

function showAlert(message, type = 'error') {
  if (alertMsg) alertMsg.textContent = message;
  else alertBox.textContent = message;

  alertBox.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200', 'bg-green-50', 'text-green-700', 'border-green-200');
  alertBox.classList.add(
    type === 'error' ? 'bg-red-50' : 'bg-green-50',
    type === 'error' ? 'text-red-700' : 'text-green-700',
    type === 'error' ? 'border-red-200' : 'border-green-200'
  );
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function hideAlert() {
  if (alertBox) alertBox.classList.add('hidden');
}

if (btnCloseAlert) {
  btnCloseAlert.addEventListener('click', hideAlert);
}

/* ---------------------------------------------------------
   Guard sesi
--------------------------------------------------------- */
(async () => {
  try {
    const { loggedIn, user } = await apiGet('/auth/session');
    if (!loggedIn || user.role !== 'super_admin') {
      window.location.href = '/index.html';
      return;
    }
    document.getElementById('sa-name').textContent = user.full_name;
    loadDashboard();
    loadMasterOptionsForFilters();
    startSubmissionsPolling();
  } catch (e) {
    window.location.href = '/index.html';
  }
})();

async function doLogout() {
  await apiPost('/auth/logout');
  window.location.href = '/index.html';
}
document.getElementById('btn-logout').addEventListener('click', doLogout);
document.getElementById('btn-logout-mobile').addEventListener('click', doLogout);

/* ---------------------------------------------------------
   Navigasi sidebar
--------------------------------------------------------- */
const navButtons = document.querySelectorAll('.nav-btn');
const navPanels = {
  dashboard: 'panel-dashboard',
  users: 'panel-users',
  submissions: 'panel-submissions',
  overtime: 'panel-overtime',
  master: 'panel-master',
  reports: 'panel-reports',
  broadcast: 'panel-broadcast',
  roster: 'panel-roster'
};

let currentNav = 'dashboard';
let superSubmissionsTimer = null;
let isPollingBusy = false;

export function startSubmissionsPolling() {
  stopSubmissionsPolling();
  superSubmissionsTimer = setInterval(async () => {
    if (isPollingBusy) return;
    isPollingBusy = true;
    try {
      if (currentNav === 'dashboard') {
        await loadDashboard();
      } else if (currentNav === 'submissions') {
        await Promise.all([loadSubmissionsPending(true), loadSubmissionsHistory(true)]);
      } else if (currentNav === 'overtime') {
        await loadSAOvertimeData(true);
      }
    } catch (err) {
      console.warn('Super Admin polling error:', err);
    } finally {
      isPollingBusy = false;
    }
  }, 4000);
}

export function stopSubmissionsPolling() {
  if (superSubmissionsTimer) {
    clearInterval(superSubmissionsTimer);
    superSubmissionsTimer = null;
  }
}

/* ---------------------------------------------------------
   Mobile Bottom Sheet: Menu Lainnya Controller
--------------------------------------------------------- */
const btnBottomMore = document.getElementById('btn-bottom-more');
const mobileSheetBackdrop = document.getElementById('mobile-sheet-backdrop');
const mobileBottomSheet = document.getElementById('mobile-bottom-sheet');
const btnCloseSheet = document.getElementById('btn-close-sheet');
const sheetHandle = document.getElementById('sheet-handle');

export function openMobileSheet() {
  if (!mobileBottomSheet || !mobileSheetBackdrop) return;
  mobileSheetBackdrop.classList.remove('pointer-events-none', 'opacity-0');
  mobileSheetBackdrop.classList.add('pointer-events-auto', 'opacity-100');
  mobileBottomSheet.classList.remove('translate-y-full');
  mobileBottomSheet.classList.add('translate-y-0');
  document.body.style.overflow = 'hidden';
}

export function closeMobileSheet() {
  if (!mobileBottomSheet || !mobileSheetBackdrop) return;
  mobileSheetBackdrop.classList.remove('pointer-events-auto', 'opacity-100');
  mobileSheetBackdrop.classList.add('pointer-events-none', 'opacity-0');
  mobileBottomSheet.classList.remove('translate-y-0');
  mobileBottomSheet.classList.add('translate-y-full');
  document.body.style.overflow = '';
}

if (btnBottomMore) btnBottomMore.addEventListener('click', openMobileSheet);
if (mobileSheetBackdrop) mobileSheetBackdrop.addEventListener('click', closeMobileSheet);
if (btnCloseSheet) btnCloseSheet.addEventListener('click', closeMobileSheet);
if (sheetHandle) sheetHandle.addEventListener('click', closeMobileSheet);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMobileSheet();
});

// Gesture: swipe down to dismiss bottom sheet
let sheetTouchStartY = 0;
let sheetTouchCurrentY = 0;

if (mobileBottomSheet) {
  mobileBottomSheet.addEventListener('touchstart', (e) => {
    sheetTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  mobileBottomSheet.addEventListener('touchmove', (e) => {
    sheetTouchCurrentY = e.touches[0].clientY;
    const diff = sheetTouchCurrentY - sheetTouchStartY;
    if (diff > 0 && mobileBottomSheet.scrollTop <= 0) {
      mobileBottomSheet.style.transform = `translateY(${diff}px)`;
    }
  }, { passive: true });

  mobileBottomSheet.addEventListener('touchend', () => {
    const diff = sheetTouchCurrentY - sheetTouchStartY;
    if (diff > 80 && mobileBottomSheet.scrollTop <= 0) {
      mobileBottomSheet.style.transform = '';
      closeMobileSheet();
    } else {
      mobileBottomSheet.style.transform = '';
    }
    sheetTouchStartY = 0;
    sheetTouchCurrentY = 0;
  });
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    closeMobileSheet();
    currentNav = btn.dataset.nav;
    document.querySelectorAll(`[data-nav="${btn.dataset.nav}"]`).forEach((b) => b.classList.add('active'));
    document.querySelectorAll(`.nav-btn:not([data-nav="${btn.dataset.nav}"])`).forEach((b) => b.classList.remove('active'));

    // Highlight bottom bar "Lainnya" button if active panel is inside the sheet
    const isOtherMenu = ['overtime', 'master', 'reports', 'broadcast', 'roster'].includes(btn.dataset.nav);
    if (btnBottomMore) {
      btnBottomMore.classList.toggle('active', isOtherMenu);
    }

    Object.entries(navPanels).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', key !== btn.dataset.nav);
    });

    window.scrollTo({ top: 0, behavior: 'instant' });
    stopSubmissionsPolling();

    if (btn.dataset.nav === 'dashboard') loadDashboard();
    if (btn.dataset.nav === 'users') loadUsers('pending');
    if (btn.dataset.nav === 'submissions') {
      loadSubmissionsNav();
      startSubmissionsPolling();
    }
    if (btn.dataset.nav === 'overtime') {
      loadSAOvertimeData();
      startSubmissionsPolling();
    }
    if (btn.dataset.nav === 'master') { loadDivisions(); loadPositions(); loadShifts(); }
    if (btn.dataset.nav === 'reports') loadReport();
    if (btn.dataset.nav === 'broadcast') loadBroadcastPanel();
    if (btn.dataset.nav === 'roster') loadSARosterMatrix();
  });
});

/* ---------------------------------------------------------
   DASHBOARD: KPI + Chart
--------------------------------------------------------- */
let attendanceChart = null;
let currentDashboardPeriod = 'daily';

async function loadDashboard(period = currentDashboardPeriod) {
  currentDashboardPeriod = period;
  try {
    const { metrics, chart } = await apiGet('/superadmin/dashboard/summary', { period });
    document.getElementById('kpi-on-time').textContent = metrics.on_time || 0;
    document.getElementById('kpi-late').textContent = metrics.late || 0;
    document.getElementById('kpi-pending').textContent = metrics.pending_submissions || 0;
    document.getElementById('kpi-active').textContent = metrics.total_active_employees || 0;
    if (document.getElementById('kpi-izin')) document.getElementById('kpi-izin').textContent = metrics.izin || 0;
    if (document.getElementById('kpi-sakit')) document.getElementById('kpi-sakit').textContent = metrics.sakit || 0;
    if (document.getElementById('kpi-cuti')) document.getElementById('kpi-cuti').textContent = metrics.cuti || 0;
    if (document.getElementById('kpi-lembur')) document.getElementById('kpi-lembur').textContent = metrics.lembur || 0;

    const periodLabelMap = { daily: 'Harian', weekly: 'Mingguan (7 Hari)', monthly: 'Bulanan (30 Hari)' };
    const subTitle = document.getElementById('chart-period-subtitle');
    if (subTitle) subTitle.textContent = `Periode ${periodLabelMap[period] || 'Harian'}`;

    // Highlight active period button
    document.querySelectorAll('[data-dashboardperiod]').forEach((btn) => {
      const isActive = btn.dataset.dashboardperiod === period;
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('bg-white', isActive);
      btn.classList.toggle('text-brand-600', isActive);
      btn.classList.toggle('shadow-sm', isActive);
      btn.classList.toggle('text-slate-600', !isActive);
    });

    const labels = chart.map((c) => new Date(c.attendance_date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
    const onTimeData = chart.map((c) => c.on_time_count);
    const lateData = chart.map((c) => c.late_count);

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#334155' : '#f1f5f9';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const ctx = document.getElementById('chart-attendance')?.getContext('2d');
    if (ctx) {
      if (attendanceChart) {
        attendanceChart.data.labels = labels;
        if (attendanceChart.data.datasets[0]) attendanceChart.data.datasets[0].data = onTimeData;
        if (attendanceChart.data.datasets[1]) attendanceChart.data.datasets[1].data = lateData;
        attendanceChart.update('none');
      } else {
        attendanceChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Tepat Waktu',
                data: onTimeData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 6
              },
              {
                label: 'Terlambat',
                data: lateData,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#f59e0b',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 6
              }
            ]
          },
          options: {
            responsive: true,
            interaction: {
              mode: 'index',
              intersect: false
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  usePointStyle: true,
                  boxWidth: 8,
                  font: { family: 'Plus Jakarta Sans', size: 12 },
                  color: textColor
                }
              }
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: textColor } },
              y: { beginAtZero: true, ticks: { precision: 0, color: textColor }, grid: { color: gridColor } }
            }
          }
        });
      }
    }
  } catch (err) {
    showAlert(err.message);
  }
}

// Period filter button listeners
document.querySelectorAll('[data-dashboardperiod]').forEach((btn) => {
  btn.addEventListener('click', () => {
    loadDashboard(btn.dataset.dashboardperiod);
  });
});

/* ---------------------------------------------------------
   MANAJEMEN USER
--------------------------------------------------------- */
let currentUsersTab = 'pending';
let cachedUsersList = [];

document.querySelectorAll('[data-userstab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-userstab]').forEach((b) => {
      b.classList.remove('active', 'border-brand-600', 'text-brand-600');
      b.classList.add('border-transparent', 'text-slate-500');
    });
    btn.classList.add('active', 'border-brand-600', 'text-brand-600');
    btn.classList.remove('border-transparent', 'text-slate-500');
    currentUsersTab = btn.dataset.userstab;

    const searchInput = document.getElementById('search-users-input');
    if (searchInput) searchInput.value = '';

    loadUsers(currentUsersTab);
  });
});

// Listener live search untuk pengguna
document.getElementById('search-users-input')?.addEventListener('input', () => {
  renderFilteredUsers();
});

async function loadUsers(status) {
  const container = document.getElementById('users-list');
  container.innerHTML = '<div class="py-8 text-center text-slate-400">Memuat daftar pengguna...</div>';
  try {
    const { users } = await apiGet('/superadmin/users', { status });
    cachedUsersList = users || [];
    renderFilteredUsers();
  } catch (err) {
    container.innerHTML = `<p class="text-rose-500 text-center py-4">${escapeHtml(err.message)}</p>`;
  }
}

function renderFilteredUsers() {
  const container = document.getElementById('users-list');
  if (!container) return;

  const query = (document.getElementById('search-users-input')?.value || '').toLowerCase().trim();
  const filtered = cachedUsersList.filter((u) => {
    if (!query) return true;
    const nameMatch = (u.full_name || '').toLowerCase().includes(query);
    const emailMatch = (u.email || '').toLowerCase().includes(query);
    const divMatch = (u.division_name || '').toLowerCase().includes(query);
    const posMatch = (u.position_name || '').toLowerCase().includes(query);
    const roleMatch = (u.role || '').toLowerCase().includes(query);
    return nameMatch || emailMatch || divMatch || posMatch || roleMatch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-2">
        <svg class="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Tidak ada pengguna ditemukan</p>
        <p class="text-xs text-slate-400">Coba ubah kata kunci pencarian atau ganti tab status.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((u) => {
    const rawPass = u.plain_password || '';
    const roleBadgeColor = u.role === 'super_admin'
      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800'
      : u.role === 'admin_manager'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';

    const roleName = u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin_manager' ? 'Admin Manager' : 'Karyawan';

    return `
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-all flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-1.5 flex-1 min-w-[240px]">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-bold text-slate-800 dark:text-white text-sm sm:text-base">${escapeHtml(u.full_name)}</p>
            <span class="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full border ${roleBadgeColor}">
              ${roleName}
            </span>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="font-medium text-slate-700 dark:text-slate-300">${escapeHtml(u.email)}</span>
            <span>•</span>
            <span>${escapeHtml(u.division_name || 'Tanpa Divisi')}</span>
            <span>•</span>
            <span>${escapeHtml(u.position_name || 'Tanpa Jabatan')}</span>
          </p>

          ${u.whatsapp ? `<p class="text-[11px] text-slate-400">WhatsApp: <span class="text-slate-600 dark:text-slate-300 font-medium">${escapeHtml(u.whatsapp)}</span></p>` : ''}

          <!-- Seksi Kata Sandi dengan Tombol Lihat 👁️ dan Copy 📋 -->
          <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2 flex-wrap">
            <span class="text-[11px] font-semibold text-slate-400">Kata Sandi:</span>
            <div class="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1">
              <span class="user-pass-display font-mono text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wider" data-pass="${escapeHtml(rawPass)}">••••••••</span>
              
              <!-- Tombol Mata 👁️ -->
              <button type="button" class="btn-toggle-user-pass p-1 rounded-md text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Lihat/Sembunyikan Password">
                <svg class="w-3.5 h-3.5 icon-eye" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <svg class="w-3.5 h-3.5 icon-eye-off hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
              </button>

              <!-- Tombol Copy 📋 -->
              <button type="button" class="btn-copy-user-pass p-1 rounded-md text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Salin Kata Sandi" data-pass="${escapeHtml(rawPass)}">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              </button>
            </div>
            ${!rawPass ? `<span class="text-[10px] text-amber-500 italic">(Password lama di-hash. Klik Edit untuk ganti)</span>` : ''}
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          ${currentUsersTab === 'pending' ? `<button class="btn-activate bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl px-3.5 py-2 transition-all shadow-xs cursor-pointer" data-id="${u.id}">Aktifkan</button>` : ''}
          ${currentUsersTab === 'active' ? `
            <button class="btn-edit bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 transition-colors cursor-pointer" data-user='${JSON.stringify(u)}'>Edit User / Sandi</button>
            <button class="btn-deactivate bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 text-xs font-semibold rounded-xl px-3 py-2 transition-colors cursor-pointer" data-id="${u.id}">Nonaktifkan</button>
          ` : ''}
          ${currentUsersTab === 'inactive' ? `<button class="btn-reactivate bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl px-3.5 py-2 transition-colors cursor-pointer" data-id="${u.id}">Aktifkan Kembali</button>` : ''}
          
          <button class="btn-delete-user bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl px-3 py-2 border border-rose-200 dark:border-rose-900 transition-colors flex items-center gap-1 cursor-pointer" data-id="${u.id}" data-name="${escapeHtml(u.full_name)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            <span>Hapus</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Event listeners tombol aksi
  container.querySelectorAll('.btn-activate').forEach((b) => b.addEventListener('click', () => activateUser(b.dataset.id)));
  container.querySelectorAll('.btn-reactivate').forEach((b) => b.addEventListener('click', () => setUserStatus(b.dataset.id, 'active')));
  container.querySelectorAll('.btn-deactivate').forEach((b) => b.addEventListener('click', () => setUserStatus(b.dataset.id, 'inactive')));
  container.querySelectorAll('.btn-delete-user').forEach((b) => b.addEventListener('click', () => deleteUser(b.dataset.id, b.dataset.name)));
  container.querySelectorAll('.btn-edit').forEach((b) => b.addEventListener('click', () => openUserModal(JSON.parse(b.dataset.user))));

  // Event listeners tombol Toggle Password (👁️)
  container.querySelectorAll('.btn-toggle-user-pass').forEach((btn) => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('div');
      const textEl = parent.querySelector('.user-pass-display');
      const eyeIcon = btn.querySelector('.icon-eye');
      const eyeOffIcon = btn.querySelector('.icon-eye-off');
      const realPass = textEl.dataset.pass || '';

      if (textEl.textContent === '••••••••') {
        textEl.textContent = realPass || '(Belum diset)';
        eyeIcon.classList.add('hidden');
        eyeOffIcon.classList.remove('hidden');
      } else {
        textEl.textContent = '••••••••';
        eyeIcon.classList.remove('hidden');
        eyeOffIcon.classList.add('hidden');
      }
    });
  });

  // Event listeners tombol Copy Password (📋)
  container.querySelectorAll('.btn-copy-user-pass').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pass = btn.dataset.pass || '';
      if (!pass) {
        showAlert('Kata sandi pengguna ini belum tersimpan dalam format teks.', 'warning');
        return;
      }
      try {
        await navigator.clipboard.writeText(pass);
        showAlert('Kata sandi berhasil disalin ke clipboard!', 'success');
      } catch (err) {
        showAlert('Gagal menyalin kata sandi: ' + err.message);
      }
    });
  });
}

async function activateUser(id) {
  try {
    const result = await apiPatch(`/superadmin/users/${id}/activate`, {});
    showAlert(result.message, 'success');
    loadUsers('pending');
  } catch (err) { showAlert(err.message); }
}
async function setUserStatus(id, status) {
  try {
    const result = await apiPatch(`/superadmin/users/${id}/status`, { status });
    showAlert(result.message, 'success');
    loadUsers(currentUsersTab);
  } catch (err) { showAlert(err.message); }
}
async function deleteUser(id, name) {
  if (!confirm(`Apakah Anda yakin ingin menghapus akun "${name}" secara permanen? Seluruh riwayat absensi dan pengajuannya juga akan dihapus.`)) {
    return;
  }
  try {
    const result = await apiDelete(`/superadmin/users/${id}`);
    showAlert(result.message, 'success');
    loadUsers(currentUsersTab);
  } catch (err) { showAlert(err.message); }
}

/* Modal Buat/Edit User */
const userModal = document.getElementById('user-modal');
let userDivisionsCache = [], userPositionsCache = [], userShiftsCache = [];

async function loadUserFormOptions() {
  const [{ divisions }, { positions }, { shifts }] = await Promise.all([
    apiGet('/superadmin/divisions'), apiGet('/superadmin/positions'), apiGet('/superadmin/shifts')
  ]);
  userDivisionsCache = divisions; userPositionsCache = positions; userShiftsCache = shifts;
  document.getElementById('user-division').innerHTML = '<option value="">-- Pilih Divisi --</option>' + divisions.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
  document.getElementById('user-position').innerHTML = '<option value="">-- Pilih Jabatan --</option>' + positions.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  document.getElementById('user-shift').innerHTML = '<option value="">-- Pilih Shift --</option>' + shifts.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

document.getElementById('btn-open-create-user').addEventListener('click', () => {
  openUserModal(null);
});

async function openUserModal(user) {
  try {
    await loadUserFormOptions();
  } catch (err) {
    console.error('Failed to load user form options:', err);
  }
  document.getElementById('form-user').reset();
  document.getElementById('user-modal-title').textContent = user ? 'Edit User' : 'Buat User Baru';
  document.getElementById('user-id').value = user ? user.id : '';
  document.getElementById('user-password').placeholder = user ? 'Password (kosongkan jika tidak diubah)' : 'Password';
  if (user) {
    document.getElementById('user-full-name').value = user.full_name || '';
    document.getElementById('user-email').value = user.email || '';
    document.getElementById('user-email').disabled = true;
    document.getElementById('user-role').value = user.role || 'employee';
    document.getElementById('user-division').value = user.division_id != null ? String(user.division_id) : '';
    document.getElementById('user-position').value = user.position_id != null ? String(user.position_id) : '';
    document.getElementById('user-shift').value = user.shift_id != null ? String(user.shift_id) : '';
    document.getElementById('user-whatsapp').value = user.whatsapp || '';
    document.getElementById('user-address').value = user.address || '';
  } else {
    document.getElementById('user-email').disabled = false;
  }
  userModal.classList.remove('hidden');
}
document.getElementById('btn-cancel-user').addEventListener('click', () => userModal.classList.add('hidden'));

document.getElementById('form-user').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  const id = document.getElementById('user-id').value;
  const payload = {
    full_name: document.getElementById('user-full-name').value.trim(),
    email: document.getElementById('user-email').value.trim(),
    password: document.getElementById('user-password').value,
    role: document.getElementById('user-role').value,
    division_id: document.getElementById('user-division').value || null,
    position_id: document.getElementById('user-position').value || null,
    shift_id: document.getElementById('user-shift').value || null,
    whatsapp: document.getElementById('user-whatsapp').value.trim(),
    address: document.getElementById('user-address').value.trim()
  };
  try {
    if (id) {
      const result = await apiPut(`/superadmin/users/${id}`, payload);
      showAlert(result.message, 'success');
    } else {
      const result = await apiPost('/superadmin/users', payload);
      showAlert(result.message, 'success');
    }
    userModal.classList.add('hidden');
    loadUsers(currentUsersTab);
  } catch (err) {
    showAlert(err.message);
  }
});

/* ---------------------------------------------------------
   MASTER DATA
--------------------------------------------------------- */
document.querySelectorAll('[data-mastertab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-mastertab]').forEach((b) => b.classList.remove('active', 'text-slate-500'));
    btn.classList.add('active');
    document.querySelectorAll('.master-panel').forEach((p) => p.classList.add('hidden'));
    document.getElementById(`master-${btn.dataset.mastertab}`).classList.remove('hidden');
  });
});

async function loadDivisions() {
  const { divisions } = await apiGet('/superadmin/divisions');
  document.getElementById('list-divisions').innerHTML = divisions.map((d) => `
    <div class="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
      <span class="text-sm text-slate-700">${escapeHtml(d.name)}</span>
      <button class="btn-del-division text-xs text-red-600 font-semibold" data-id="${d.id}">Hapus</button>
    </div>`).join('');
  document.querySelectorAll('.btn-del-division').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Hapus divisi ini?')) return;
    await apiDelete(`/superadmin/divisions/${b.dataset.id}`);
    loadDivisions();
  }));
}
document.getElementById('form-add-division').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  try {
    await apiPost('/superadmin/divisions', { name: document.getElementById('input-division-name').value.trim() });
    document.getElementById('input-division-name').value = '';
    loadDivisions();
  } catch (err) { showAlert(err.message); }
});

async function loadPositions() {
  const { positions } = await apiGet('/superadmin/positions');
  document.getElementById('list-positions').innerHTML = positions.map((p) => `
    <div class="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
      <span class="text-sm text-slate-700">${escapeHtml(p.name)}</span>
      <button class="btn-del-position text-xs text-red-600 font-semibold" data-id="${p.id}">Hapus</button>
    </div>`).join('');
  document.querySelectorAll('.btn-del-position').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Hapus jabatan ini?')) return;
    await apiDelete(`/superadmin/positions/${b.dataset.id}`);
    loadPositions();
  }));
}
document.getElementById('form-add-position').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  try {
    await apiPost('/superadmin/positions', { name: document.getElementById('input-position-name').value.trim() });
    document.getElementById('input-position-name').value = '';
    loadPositions();
  } catch (err) { showAlert(err.message); }
});

async function loadShifts() {
  const { shifts } = await apiGet('/superadmin/shifts');
  document.getElementById('list-shifts').innerHTML = shifts.map((s) => `
    <div class="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
      <span class="text-sm text-slate-700">${escapeHtml(s.name)} · ${escapeHtml(s.start_time)} - ${escapeHtml(s.end_time)} (toleransi ${s.tolerance_minutes} menit)</span>
      <button class="btn-del-shift text-xs text-red-600 font-semibold" data-id="${s.id}">Hapus</button>
    </div>`).join('');
  document.querySelectorAll('.btn-del-shift').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Hapus pengaturan shift ini?')) return;
    await apiDelete(`/superadmin/shifts/${b.dataset.id}`);
    loadShifts();
  }));
}
document.getElementById('form-add-shift').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  try {
    await apiPost('/superadmin/shifts', {
      name: document.getElementById('input-shift-name').value.trim(),
      start_time: document.getElementById('input-shift-start').value,
      end_time: document.getElementById('input-shift-end').value,
      tolerance_minutes: document.getElementById('input-shift-tolerance').value || 0
    });
    e.target.reset();
    document.getElementById('input-shift-start').value = '08:00:00';
    document.getElementById('input-shift-end').value = '17:00:00';
    loadShifts();
  } catch (err) { showAlert(err.message); }
});

/* ---------------------------------------------------------
   PELAPORAN & EKSPOR
--------------------------------------------------------- */
async function loadMasterOptionsForFilters() {
  try {
    const { divisions } = await apiGet('/superadmin/divisions');
    document.getElementById('filter-division').innerHTML = '<option value="">Semua Divisi</option>' +
      divisions.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
  } catch (e) { /* diamkan, tidak kritikal */ }
}

document.getElementById('filter-period').addEventListener('change', (e) => {
  const isCustom = e.target.value === 'custom';
  document.getElementById('filter-start').classList.toggle('hidden', !isCustom);
  document.getElementById('filter-end').classList.toggle('hidden', !isCustom);
});

function currentFilterParams() {
  const period = document.getElementById('filter-period').value;
  const params = {};
  if (period !== 'all') params.period = period;
  if (period === 'custom') {
    params.start_date = document.getElementById('filter-start').value;
    params.end_date = document.getElementById('filter-end').value;
  }
  const division = document.getElementById('filter-division').value;
  if (division) params.division_id = division;
  // Employee name filter
  const name = document.getElementById('filter-name').value.trim();
  if (name) params.name = name;
  return params;
}

async function loadReport() {
  const tbody = document.getElementById('report-body');
  tbody.innerHTML = '<tr><td colspan="10" class="px-4 py-4 text-center text-slate-400">Memuat...</td></tr>';
  try {
    const { data } = await apiGet('/reports/attendance', currentFilterParams());
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="px-4 py-4 text-center text-slate-400">Tidak ada data untuk filter ini.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((r) => `
      <tr>
        <td class="px-4 py-3 font-medium text-slate-800">${r.full_name}</td>
        <td class="px-4 py-3 text-slate-500">${r.division_name || '-'}</td>
        <td class="px-4 py-3 text-slate-500">${r.attendance_date}</td>
        <td class="px-4 py-3 text-slate-600">${r.clock_in_display}</td>
        <td class="px-4 py-3 text-slate-600">${r.clock_out_display}</td>
        <td class="px-4 py-3 text-slate-600 tabular-nums">${r.work_duration_hms}</td>
        <td class="px-4 py-3 text-slate-600 tabular-nums">${r.late_duration_hms}</td>
        <td class="px-4 py-3 text-slate-600 tabular-nums">${r.overtime_hms}</td>
        <td class="px-4 py-3 text-slate-500">${r.status_label}</td>
        <td class="px-4 py-3 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1.5">
            <button class="btn-detail bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg shadow-xs transition-colors" data-id="${r.id || r.attendance_id}">Detail</button>
            <button class="btn-delete-report bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg shadow-xs transition-colors" data-id="${r.id || r.attendance_id}">Hapus</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Add event listeners to detail & delete buttons
    tbody.querySelectorAll('.btn-detail').forEach((btn) => {
      btn.addEventListener('click', () => openDetailModal(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-delete-report').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (confirm('Apakah Anda yakin ingin menghapus data absensi ini? Data yang dihapus tidak dapat dikembalikan.')) {
          try {
            await apiDelete(`/admin/attendance/${btn.dataset.id}`);
            showAlert('Data absensi berhasil dihapus.', 'success');
            loadReport();
          } catch (e) {
            showAlert(e.message || 'Gagal menghapus data absensi.');
          }
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-4 text-center text-red-500">${err.message}</td></tr>`;
  }
}

document.getElementById('btn-apply-filter').addEventListener('click', loadReport);

document.getElementById('btn-export-csv').addEventListener('click', async () => {
  try {
    await apiDownload('/reports/attendance/export', { ...currentFilterParams(), format: 'csv' }, 'rekap-absensi.csv');
  } catch (err) { showAlert(err.message); }
});
document.getElementById('btn-export-xlsx').addEventListener('click', async () => {
  try {
    await apiDownload('/reports/attendance/export', { ...currentFilterParams(), format: 'xlsx' }, 'rekap-absensi.xlsx');
  } catch (err) { showAlert(err.message); }
});

/* ---------------------------------------------------------
   DETAIL ABSENSI MODAL
--------------------------------------------------------- */
const detailModal = document.getElementById('detail-modal');
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImage = document.getElementById('lightbox-image');

// Open detail modal with attendance ID
async function openDetailModal(attendanceId) {
  try {
    const { data } = await apiGet(`/reports/attendance/${attendanceId}`);
    // Populate modal
    document.getElementById('detail-modal-title').textContent = `Detail Absensi - ${data.full_name}`;
    document.getElementById('detail-employee-info').textContent = `${data.full_name} · ${data.division_name || '-'} · ${data.position_name || '-'}`;
    document.getElementById('detail-date').textContent = `Tanggal: ${data.attendance_date}`;

    // Avatar initials
    const initials = (data.full_name || 'U')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(n => n[0].toUpperCase())
      .join('');
    const avatarEl = document.getElementById('detail-employee-avatar');
    if (avatarEl) avatarEl.textContent = initials;

    // Times
    document.getElementById('detail-time-in').textContent = data.clock_in_time || '-';
    document.getElementById('detail-time-out').textContent = data.clock_out_time || '-';

    // Durations
    document.getElementById('detail-work-duration').textContent = data.work_duration_hms || '-';
    document.getElementById('detail-late-duration').textContent = data.late_duration_hms || '-';
    document.getElementById('detail-overtime').textContent = data.overtime_hms || '-';

    // Photos
    const getSecureUrl = (url) => {
      if (!url || typeof url !== 'string' || !url.trim()) return '/assets/default/default-photo.png';
      let clean = url.trim();
      if (clean.startsWith('/uploads/')) return clean.replace('/uploads/', '/secure-uploads/');
      if (clean.startsWith('uploads/')) return '/' + clean.replace('uploads/', 'secure-uploads/');
      if (!clean.startsWith('/secure-uploads/')) return '/secure-uploads/attendance/' + clean.split('/').pop();
      return clean;
    };

    const clockInPhotoUrl = getSecureUrl(data.clock_in_photo);
    const clockOutPhotoUrl = getSecureUrl(data.clock_out_photo);

    const clockInImg = document.getElementById('detail-clock-in-photo');
    const clockOutImg = document.getElementById('detail-clock-out-photo');

    clockInImg.onerror = () => {
      clockInImg.onerror = null;
      clockInImg.src = '/assets/default/default-photo.png';
    };
    clockOutImg.onerror = () => {
      clockOutImg.onerror = null;
      clockOutImg.src = '/assets/default/default-photo.png';
    };

    clockInImg.src = clockInPhotoUrl;
    clockOutImg.src = clockOutPhotoUrl;

    // Set time overlay on photos
    document.getElementById('detail-clock-in-time').textContent = data.clock_in_time ? data.clock_in_time.slice(0, 5) : '';
    document.getElementById('detail-clock-out-time').textContent = data.clock_out_time ? data.clock_out_time.slice(0, 5) : '';

    // Notes
    document.getElementById('detail-clock-in-note').textContent = data.clock_in_note || '-';
    document.getElementById('detail-clock-out-note').textContent = data.clock_out_note || '-';

    // Location links
    const clockInGpsUrl = (data.clock_in_lat && data.clock_in_lng)
      ? `https://www.google.com/maps?q=${data.clock_in_lat},${data.clock_in_lng}`
      : null;
    const clockOutGpsUrl = (data.clock_out_lat && data.clock_out_lng)
      ? `https://www.google.com/maps?q=${data.clock_out_lat},${data.clock_out_lng}`
      : null;

    if (clockInGpsUrl) {
      document.getElementById('detail-clock-in-map').href = clockInGpsUrl;
      document.getElementById('detail-clock-in-map').classList.remove('hidden');
      const inPhotoMapBtn = document.getElementById('detail-clock-in-photo-map');
      if (inPhotoMapBtn) { inPhotoMapBtn.href = clockInGpsUrl; inPhotoMapBtn.classList.remove('hidden'); }
    } else {
      document.getElementById('detail-clock-in-map').href = '#';
      document.getElementById('detail-clock-in-map').classList.add('hidden');
      const inPhotoMapBtn = document.getElementById('detail-clock-in-photo-map');
      if (inPhotoMapBtn) { inPhotoMapBtn.classList.add('hidden'); }
    }

    if (clockOutGpsUrl) {
      document.getElementById('detail-clock-out-map').href = clockOutGpsUrl;
      document.getElementById('detail-clock-out-map').classList.remove('hidden');
      const outPhotoMapBtn = document.getElementById('detail-clock-out-photo-map');
      if (outPhotoMapBtn) { outPhotoMapBtn.href = clockOutGpsUrl; outPhotoMapBtn.classList.remove('hidden'); }
    } else {
      document.getElementById('detail-clock-out-map').href = '#';
      document.getElementById('detail-clock-out-map').classList.add('hidden');
      const outPhotoMapBtn = document.getElementById('detail-clock-out-photo-map');
      if (outPhotoMapBtn) { outPhotoMapBtn.classList.add('hidden'); }
    }

    // Status Pill
    const statusEl = document.getElementById('detail-status');
    if (statusEl) {
      statusEl.textContent = data.status_display;
      statusEl.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide border';
      if (data.status_display === 'Tepat Waktu' || data.status_display === 'Hadir') {
        statusEl.className += ' bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
      } else if (data.status_display === 'Terlambat') {
        statusEl.className += ' bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
      } else if (data.status_display === 'Izin' || data.status_display === 'Sakit') {
        statusEl.className += ' bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20';
      } else {
        statusEl.className += ' bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20';
      }
    }

    // Overtime section
    const overtimeSection = document.getElementById('detail-overtime-section');
    if (overtimeSection) {
      if (data.overtime_clock_in_time || data.overtime_task_reason) {
        overtimeSection.classList.remove('hidden');

        const otClockInPhotoUrl = getSecureUrl(data.overtime_clock_in_photo);
        const otClockOutPhotoUrl = getSecureUrl(data.overtime_clock_out_photo);

        const otInGpsUrl = (data.overtime_clock_in_lat && data.overtime_clock_in_lng)
          ? `https://www.google.com/maps?q=${data.overtime_clock_in_lat},${data.overtime_clock_in_lng}`
          : null;
        const otOutGpsUrl = (data.overtime_clock_out_lat && data.overtime_clock_out_lng)
          ? `https://www.google.com/maps?q=${data.overtime_clock_out_lat},${data.overtime_clock_out_lng}`
          : null;

        const otClockInImg = document.getElementById('detail-overtime-clock-in-photo');
        const otClockOutImg = document.getElementById('detail-overtime-clock-out-photo');

        if (otClockInImg) {
          otClockInImg.onerror = () => { otClockInImg.onerror = null; otClockInImg.src = '/assets/default/default-photo.png'; };
          otClockInImg.src = otClockInPhotoUrl;
          otClockInImg.onclick = () => openLightbox(otClockInImg.src, `Masuk Lembur - ${data.full_name}`, otInGpsUrl);
        }
        if (otClockOutImg) {
          otClockOutImg.onerror = () => { otClockOutImg.onerror = null; otClockOutImg.src = '/assets/default/default-photo.png'; };
          otClockOutImg.src = otClockOutPhotoUrl;
          otClockOutImg.onclick = () => openLightbox(otClockOutImg.src, `Keluar Lembur - ${data.full_name}`, otOutGpsUrl);
        }

        const otInTimeEl = document.getElementById('detail-overtime-clock-in-time');
        const otOutTimeEl = document.getElementById('detail-overtime-clock-out-time');
        if (otInTimeEl) otInTimeEl.textContent = data.overtime_clock_in_time ? data.overtime_clock_in_time.slice(0, 5) : '';
        if (otOutTimeEl) otOutTimeEl.textContent = data.overtime_clock_out_time ? data.overtime_clock_out_time.slice(0, 5) : '';

        const otDurationEl = document.getElementById('detail-overtime-duration');
        if (otDurationEl) otDurationEl.textContent = data.overtime_duration_hms || '-';

        const otTaskEl = document.getElementById('detail-overtime-task');
        if (otTaskEl) otTaskEl.textContent = data.overtime_task_reason || '-';

        const otInNoteEl = document.getElementById('detail-overtime-clock-in-note');
        if (otInNoteEl) otInNoteEl.textContent = data.overtime_clock_in_note || '-';

        const otOutNoteEl = document.getElementById('detail-overtime-clock-out-note');
        if (otOutNoteEl) otOutNoteEl.textContent = data.overtime_clock_out_note || '-';

        const otInMapEl = document.getElementById('detail-overtime-clock-in-map');
        const otInPhotoMapEl = document.getElementById('detail-overtime-clock-in-photo-map');
        if (otInGpsUrl) {
          if (otInMapEl) { otInMapEl.href = otInGpsUrl; otInMapEl.classList.remove('hidden'); }
          if (otInPhotoMapEl) { otInPhotoMapEl.href = otInGpsUrl; otInPhotoMapEl.classList.remove('hidden'); }
        } else {
          if (otInMapEl) otInMapEl.classList.add('hidden');
          if (otInPhotoMapEl) otInPhotoMapEl.classList.add('hidden');
        }

        const otOutMapEl = document.getElementById('detail-overtime-clock-out-map');
        const otOutPhotoMapEl = document.getElementById('detail-overtime-clock-out-photo-map');
        if (otOutGpsUrl) {
          if (otOutMapEl) { otOutMapEl.href = otOutGpsUrl; otOutMapEl.classList.remove('hidden'); }
          if (otOutPhotoMapEl) { otOutPhotoMapEl.href = otOutGpsUrl; otOutPhotoMapEl.classList.remove('hidden'); }
        } else {
          if (otOutMapEl) otOutMapEl.classList.add('hidden');
          if (otOutPhotoMapEl) otOutPhotoMapEl.classList.add('hidden');
        }
      } else {
        overtimeSection.classList.add('hidden');
      }
    }

    // Show modal
    detailModal.classList.remove('hidden');

    // Add click listeners to photos for lightbox
    clockInImg.onclick = () => openLightbox(clockInImg.src, `Clock In - ${data.full_name}`, clockInGpsUrl);
    clockOutImg.onclick = () => openLightbox(clockOutImg.src, `Clock Out - ${data.full_name}`, clockOutGpsUrl);
  } catch (err) {
    showAlert(err.message);
  }
}

// Lightbox functions
function openLightbox(imageUrl, title = 'Detail Foto Presensi', gpsUrl = null) {
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxLoc = document.getElementById('lightbox-location');
  if (lightboxTitle) lightboxTitle.textContent = title;
  lightboxImage.src = imageUrl;

  if (lightboxLoc) {
    if (gpsUrl && gpsUrl !== '#') {
      lightboxLoc.innerHTML = `
        <a href="${gpsUrl}" target="_blank" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 dark:hover:bg-brand-900/50 font-bold text-xs border border-brand-200/80 dark:border-brand-800/50 shadow-xs transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          Lihat Titik Lokasi Google Maps
        </a>
      `;
    } else {
      lightboxLoc.innerHTML = `
        <span class="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          Koordinat GPS tidak tercatat
        </span>
      `;
    }
  }

  lightboxModal.classList.remove('hidden');
}
function closeLightbox() {
  lightboxModal.classList.add('hidden');
  lightboxImage.src = '';
}
// Close lightbox when clicking outside the image or on close button
lightboxModal.addEventListener('click', (e) => {
  if (e.target === lightboxModal || e.target.id === 'btn-close-lightbox') {
    closeLightbox();
  }
});

// Close detail modal
['btn-close-detail', 'btn-close-detail-bottom'].forEach((id) => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', () => detailModal.classList.add('hidden'));
});
// Also close when clicking outside the modal content
detailModal.addEventListener('click', (e) => {
  if (e.target === detailModal) {
    detailModal.classList.add('hidden');
  }
});

/* ---------------------------------------------------------
   PENGAJUAN (Izin / Cuti / Sakit)
--------------------------------------------------------- */
let currentSubmissionsTab = 'pending';
let submissionsDivisionsLoaded = false;
let lastSuperPendingHash = '';
let lastSuperHistoryHash = '';

const TYPE_LABEL = { izin: 'Izin', cuti: 'Cuti', sakit: 'Sakit', lembur: 'Lembur' };
const STATUS_STYLE = { approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };
const STATUS_LABEL = { approved: 'Disetujui', rejected: 'Ditolak' };

async function loadSubmissionsNav() {
  if (!submissionsDivisionsLoaded) {
    try {
      const { divisions } = await apiGet('/superadmin/divisions');
      const select = document.getElementById('submission-division-filter');
      select.innerHTML = '<option value="">Semua Divisi</option>' + divisions.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
      submissionsDivisionsLoaded = true;
    } catch (e) {
      console.error(e);
    }
  }
  loadSubmissionsData();
}

// Polling interval managed via startSubmissionsPolling() & stopSubmissionsPolling()

document.getElementById('submission-division-filter').addEventListener('change', () => {
  lastSuperPendingHash = '';
  lastSuperHistoryHash = '';
  loadSubmissionsData();
});

document.querySelectorAll('[data-submissionstab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-submissionstab]').forEach((b) => {
      b.classList.remove('active', 'border-brand-600', 'text-brand-600', 'dark:border-brand-400', 'dark:text-brand-300');
      b.classList.add('border-transparent', 'text-slate-500');
    });
    btn.classList.add('active', 'border-brand-600', 'text-brand-600', 'dark:border-brand-400', 'dark:text-brand-300');
    btn.classList.remove('border-transparent', 'text-slate-500');
    currentSubmissionsTab = btn.dataset.submissionstab;

    document.getElementById('submission-pending-list')?.classList.toggle('hidden', currentSubmissionsTab !== 'pending');
    document.getElementById('submission-overtime-pending-list')?.classList.toggle('hidden', currentSubmissionsTab !== 'overtime-pending');
    document.getElementById('submission-history-list')?.classList.toggle('hidden', currentSubmissionsTab !== 'history');
    document.getElementById('submission-overtime-history-list')?.classList.toggle('hidden', currentSubmissionsTab !== 'overtime-history');
    loadSubmissionsData();
  });
});

function loadSubmissionsData(silent = false) {
  if (!silent) {
    lastSuperPendingHash = '';
    lastSuperHistoryHash = '';
  }
  loadSubmissionsPending(silent);
  loadSubmissionsHistory(silent);
  loadSAOvertimeData(silent);
}

async function loadSubmissionsPending(silent = false) {
  const container = document.getElementById('submission-pending-list');
  if (!container) return;
  const divisionId = document.getElementById('submission-division-filter').value;
  const params = {};
  if (divisionId) params.division_id = divisionId;

  try {
    const { submissions } = await apiGet('/admin/submissions/pending', params);
    const filteredSubs = (submissions || []).filter(s => s.type !== 'lembur');

    if (document.getElementById('sa-sub-badge-pending')) {
      document.getElementById('sa-sub-badge-pending').textContent = filteredSubs.length;
    }

    const newHash = JSON.stringify(filteredSubs);
    if (silent && lastSuperPendingHash === newHash) return;
    lastSuperPendingHash = newHash;

    if (filteredSubs.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-center py-6 bg-white rounded-2xl border border-slate-200">Tidak ada pengajuan yang menunggu persetujuan.</p>';
      return;
    }
    container.innerHTML = filteredSubs.map((s) => {
      const submitTimeStr = s.created_at ? new Date(s.created_at).toLocaleString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) + ' WIB' : '-';
      return `
      <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 shadow-xs">
        <div class="flex items-center justify-between">
          <div>
            <span class="font-bold text-slate-900 text-sm">${escapeHtml(s.full_name)}</span>
            <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md ml-1.5">${escapeHtml(s.division_name || '-')}</span>
            <span class="text-xs text-slate-400 block sm:inline sm:ml-2 font-normal">${escapeHtml(s.position_name || 'Staff')}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-extrabold px-2.5 py-1 rounded-full uppercase ${s.type === 'cuti' ? 'bg-blue-100 text-blue-800' : s.type === 'sakit' ? 'bg-rose-100 text-rose-800' : 'bg-purple-100 text-purple-800'}">
              ${escapeHtml(TYPE_LABEL[s.type] || s.type)}
            </span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${s.status === 'under_review' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-slate-100 text-slate-700'}">
              ${s.status === 'under_review' ? 'Sedang Ditinjau' : 'Pending'}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-1.5 text-[11px] font-mono text-indigo-600 bg-indigo-50/70 p-2 rounded-xl border border-indigo-100">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Waktu Submit: <strong>${submitTimeStr}</strong></span>
        </div>

        <div class="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span>Tanggal Mulai: <strong class="text-slate-800 dark:text-slate-200 font-mono">${escapeHtml(s.start_date)}</strong> s/d <strong class="text-slate-800 dark:text-slate-200 font-mono">${escapeHtml(s.end_date)}</strong></span>
        </div>

        <div class="text-xs text-slate-700 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
          <p class="font-bold text-slate-800 dark:text-slate-200">Alasan / Keterangan Detail:</p>
          <p class="leading-relaxed text-slate-600 dark:text-slate-400">${escapeHtml(s.reason || '-')}</p>
        </div>

        ${s.type === 'cuti' && (s.handover_plan || s.handover_to_name) ? `
          <div class="bg-blue-50/80 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200/80 dark:border-blue-900/50 text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
            <p class="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              Rencana Serah Terima Pekerjaan (Cuti):
            </p>
            ${s.handover_plan ? `<p class="italic text-slate-600 dark:text-slate-400 leading-relaxed">${escapeHtml(s.handover_plan)}</p>` : ''}
            ${s.handover_to_name ? `<p class="font-medium text-slate-800 dark:text-slate-200 pt-0.5">Dialihkan Kepada: <strong>${escapeHtml(s.handover_to_name)}</strong> ${s.handover_to_position ? `<span class="text-slate-500">(${escapeHtml(s.handover_to_position)})</span>` : ''}</p>` : ''}
          </div>
        ` : ''}

        ${s.attachment ? `
          <div>
            <button type="button" class="btn-view-super-attachment inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 bg-brand-50 dark:bg-brand-950/50 border border-brand-200/60 dark:border-brand-800/40 px-3 py-1.5 rounded-xl transition-colors cursor-pointer" data-url="${s.attachment.replace('/uploads/', '/secure-uploads/')}" data-title="Lampiran Pengajuan ${escapeHtml(s.full_name || '')}">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              <span>Lihat Bukti File / Surat Dokter</span>
            </button>
          </div>
        ` : ''}

        <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button class="btn-sub-approve flex-1 min-w-[70px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl py-2 transition-colors shadow-xs" data-id="${s.id}" data-name="${escapeHtml(s.full_name)}">Setujui</button>
          <button class="btn-sub-review flex-1 min-w-[70px] bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl py-2 transition-colors shadow-xs" data-id="${s.id}" data-name="${escapeHtml(s.full_name)}">Tinjau</button>
          <button class="btn-sub-reject flex-1 min-w-[70px] bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl py-2 transition-colors border border-rose-200" data-id="${s.id}" data-name="${escapeHtml(s.full_name)}">Tolak</button>
          <button class="btn-super-edit-sub px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl py-2 transition-colors" data-sub='${JSON.stringify(s).replace(/'/g, "&apos;")}'>Edit</button>
          <button class="btn-super-del-sub px-3 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold rounded-xl py-2 transition-colors" data-id="${s.id}">Hapus</button>
        </div>
      </div>
    `;
    }).join('');

    container.querySelectorAll('.btn-sub-approve').forEach((b) => b.addEventListener('click', () => openDecisionModal(b.dataset.id, b.dataset.name, 'approved')));
    container.querySelectorAll('.btn-sub-review').forEach((b) => b.addEventListener('click', () => openDecisionModal(b.dataset.id, b.dataset.name, 'under_review')));
    container.querySelectorAll('.btn-sub-reject').forEach((b) => b.addEventListener('click', () => openDecisionModal(b.dataset.id, b.dataset.name, 'rejected')));
    container.querySelectorAll('.btn-super-edit-sub').forEach((b) => b.addEventListener('click', () => openSuperSubModal(JSON.parse(b.dataset.sub))));
    container.querySelectorAll('.btn-super-del-sub').forEach((b) => b.addEventListener('click', () => deleteSuperSubmission(b.dataset.id)));
  } catch (err) {
    if (!silent) container.innerHTML = `<p class="text-red-500 text-center py-4">${err.message}</p>`;
  }
}

async function loadSubmissionsHistory(silent = false) {
  const container = document.getElementById('submission-history-list');
  if (!container) return;
  const divisionId = document.getElementById('submission-division-filter').value;
  const params = {};
  if (divisionId) params.division_id = divisionId;

  try {
    const { submissions } = await apiGet('/admin/submissions/history', params);
    const filteredSubs = (submissions || []).filter(s => s.type !== 'lembur');

    if (document.getElementById('sa-sub-badge-history')) {
      document.getElementById('sa-sub-badge-history').textContent = filteredSubs.length;
    }

    const newHash = JSON.stringify(filteredSubs);
    if (silent && lastSuperHistoryHash === newHash) return;
    lastSuperHistoryHash = newHash;

    if (filteredSubs.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-center py-6 bg-white rounded-2xl border border-slate-200">Belum ada riwayat pengajuan.</p>';
      return;
    }
    container.innerHTML = filteredSubs.map((s) => {
      const submitTimeStr = s.created_at ? new Date(s.created_at).toLocaleString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) + ' WIB' : '-';
      const reviewTimeStr = s.reviewed_at ? new Date(s.reviewed_at).toLocaleString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) + ' WIB' : '-';
      return `
      <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 shadow-xs">
        <div class="flex items-center justify-between mb-1">
          <div>
            <span class="font-bold text-slate-900 text-sm">${escapeHtml(s.full_name)}</span>
            <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md ml-1.5">${escapeHtml(s.division_name || '-')}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-extrabold px-2.5 py-1 rounded-full uppercase ${s.type === 'cuti' ? 'bg-blue-100 text-blue-800' : s.type === 'sakit' ? 'bg-rose-100 text-rose-800' : 'bg-purple-100 text-purple-800'}">
              ${escapeHtml(TYPE_LABEL[s.type] || s.type)}
            </span>
            <span class="text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-700'}">${STATUS_LABEL[s.status] || escapeHtml(s.status)}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
          <div class="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
            <svg class="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Diajukan: <strong>${submitTimeStr}</strong></span>
          </div>
          <div class="text-[11px] flex items-center gap-1.5 flex-wrap">
            ${s.reviewed_by_name ? `
              <span class="text-slate-500">Ditinjau oleh:</span>
              <strong class="text-indigo-600 dark:text-indigo-400">${escapeHtml(s.reviewed_by_name)}</strong>
              ${s.reviewed_by_role === 'admin_manager'
                ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200">Middle Management</span>'
                : (s.reviewed_by_role === 'super_admin' || s.reviewed_by_role === 'superadmin')
                ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200">Super Admin</span>'
                : ''}
              <span class="text-slate-400 font-mono">(${reviewTimeStr})</span>
            ` : '<span class="text-slate-400 italic">Admin Sistem</span>'}
          </div>
        </div>

        <div class="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span>Tanggal Mulai: <strong class="text-slate-800 dark:text-slate-200 font-mono">${escapeHtml(s.start_date)}</strong> s/d <strong class="text-slate-800 dark:text-slate-200 font-mono">${escapeHtml(s.end_date)}</strong></span>
        </div>

        <div class="text-xs text-slate-700 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
          <p class="font-bold text-slate-800 dark:text-slate-200">Alasan / Keterangan Detail:</p>
          <p class="leading-relaxed text-slate-600 dark:text-slate-400">${escapeHtml(s.reason || '-')}</p>
        </div>

        ${s.type === 'cuti' && (s.handover_plan || s.handover_to_name) ? `
          <div class="bg-blue-50/80 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200/80 dark:border-blue-900/50 text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
            <p class="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 012 2"/></svg>
              Rencana Serah Terima Pekerjaan (Cuti):
            </p>
            ${s.handover_plan ? `<p class="italic text-slate-600 dark:text-slate-400 leading-relaxed">${escapeHtml(s.handover_plan)}</p>` : ''}
            ${s.handover_to_name ? `<p class="font-medium text-slate-800 dark:text-slate-200 pt-0.5">Dialihkan Kepada: <strong>${escapeHtml(s.handover_to_name)}</strong> ${s.handover_to_position ? `<span class="text-slate-500">(${escapeHtml(s.handover_to_position)})</span>` : ''}</p>` : ''}
          </div>
        ` : ''}

        ${s.attachment ? `
          <div>
            <button type="button" class="btn-view-super-attachment inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 bg-brand-50 dark:bg-brand-950/50 border border-brand-200/60 dark:border-brand-800/40 px-3 py-1.5 rounded-xl transition-colors cursor-pointer" data-url="${s.attachment.replace('/uploads/', '/secure-uploads/')}" data-title="Lampiran Riwayat ${escapeHtml(s.full_name || '')}">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              <span>Lihat Bukti File / Surat Dokter</span>
            </button>
          </div>
        ` : ''}

        ${s.review_note ? `<p class="text-xs text-slate-500 italic bg-amber-50/60 p-2.5 rounded-xl border border-amber-100"><span class="font-bold not-italic text-slate-700">Catatan Review Admin:</span> ${escapeHtml(s.review_note)}</p>` : ''}
        
        <div class="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <button class="btn-super-edit-sub px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl py-1.5 transition-colors" data-sub='${JSON.stringify(s).replace(/'/g, "&apos;")}'>Edit</button>
          <button class="btn-super-del-sub px-3 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold rounded-xl py-1.5 transition-colors" data-id="${s.id}">Hapus</button>
        </div>
      </div>
    `;
    }).join('');

    container.querySelectorAll('.btn-super-edit-sub').forEach((b) => b.addEventListener('click', () => openSuperSubModal(JSON.parse(b.dataset.sub))));
    container.querySelectorAll('.btn-super-del-sub').forEach((b) => b.addEventListener('click', () => deleteSuperSubmission(b.dataset.id)));
  } catch (err) {
    if (!silent) container.innerHTML = `<p class="text-red-500 text-center py-4">${err.message}</p>`;
  }
}

/* Modal Decision */
const decisionModal = document.getElementById('decision-modal');
const decisionNote = document.getElementById('decision-note');
let activeDecision = null;

function openDecisionModal(id, name, decision) {
  activeDecision = { id, decision, isOvertime: false };
  decisionNote.value = decision === 'under_review' ? 'Pengajuan sedang ditinjau manajemen' : '';
  const actionText = decision === 'approved' ? 'Setujui' : decision === 'under_review' ? 'Tinjau' : 'Tolak';
  document.getElementById('decision-title').textContent = `${actionText} pengajuan ${name}`;
  decisionModal.classList.remove('hidden');
}

document.getElementById('btn-cancel-decision').addEventListener('click', () => decisionModal.classList.add('hidden'));
document.getElementById('btn-confirm-decision').addEventListener('click', async () => {
  hideAlert();
  if (!decisionNote.value.trim()) {
    showAlert('Catatan alasan wajib diisi.');
    return;
  }
  try {
    const endpoint = activeDecision && activeDecision.isOvertime
      ? `/admin/overtime/${activeDecision.id}/decision`
      : `/admin/submissions/${activeDecision.id}/decision`;

    const result = await apiPatch(endpoint, {
      decision: activeDecision.decision,
      review_note: decisionNote.value.trim()
    });
    decisionModal.classList.add('hidden');
    showAlert(result.message, 'success');
    if (activeDecision && activeDecision.isOvertime) {
      loadSAOvertimeData();
    } else {
      loadSubmissionsData();
    }
  } catch (err) {
    showAlert(err.message);
  }
});

/* ---------------------------------------------------------
   SUPER ADMIN OVERTIME ATTENDANCE MANAGEMENT
--------------------------------------------------------- */
let saOtCurrentTab = 'pending';
let saOtPendingList = [];
let saOtHistoryList = [];
let saOtDivisionsLoaded = false;

async function populateSAOvertimeDivisions() {
  if (saOtDivisionsLoaded) return;
  try {
    const select = document.getElementById('sa-ot-filter-division');
    if (!select) return;
    const { divisions } = await apiGet('/superadmin/divisions');
    if (divisions && divisions.length > 0) {
      const currentVal = select.value;
      select.innerHTML = '<option value="">Semua Divisi</option>' +
        divisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
      select.value = currentVal;
      saOtDivisionsLoaded = true;
    }
  } catch (err) {
    console.error('Gagal memuat divisi presensi lembur:', err);
  }
}

export async function loadSAOvertimeData(silent = false) {
  try {
    await populateSAOvertimeDivisions();

    const divId = document.getElementById('sa-ot-filter-division')?.value || '';
    const period = document.getElementById('sa-ot-filter-period')?.value || 'all';
    const params = new URLSearchParams();
    if (divId) params.append('division_id', divId);
    if (period && period !== 'all') params.append('period', period);
    const query = params.toString() ? `?${params.toString()}` : '';

    const [resPending, resHistory] = await Promise.all([
      apiGet(`/admin/overtime/pending${query}`),
      apiGet(`/admin/overtime/history${query}`)
    ]);

    saOtPendingList = resPending.overtimes || [];
    saOtHistoryList = resHistory.overtimes || [];

    if (document.getElementById('sa-ot-badge-pending')) document.getElementById('sa-ot-badge-pending').textContent = saOtPendingList.length;
    if (document.getElementById('sa-ot-badge-history')) document.getElementById('sa-ot-badge-history').textContent = saOtHistoryList.length;
    if (document.getElementById('sa-sub-badge-ot-pending')) document.getElementById('sa-sub-badge-ot-pending').textContent = saOtPendingList.length;
    if (document.getElementById('sa-sub-badge-ot-history')) document.getElementById('sa-sub-badge-ot-history').textContent = saOtHistoryList.length;

    renderSAOvertimeTables();
  } catch (err) {
    console.error('Gagal memuat data lembur super admin:', err);
  }
}

function renderSAOvertimeTables() {
  renderSAOvertimePendingTable();
  renderSAOvertimeHistoryTable();
  renderSubmissionsOvertimeLists();
}

function renderSubmissionsOvertimeLists() {
  const pendingContainer = document.getElementById('submission-overtime-pending-list');
  const historyContainer = document.getElementById('submission-overtime-history-list');

  // Render Overtime Pending in Submissions panel
  if (pendingContainer) {
    if (saOtPendingList.length === 0) {
      pendingContainer.innerHTML = '<p class="text-slate-400 text-center py-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">Tidak ada presensi lembur yang menunggu persetujuan.</p>';
    } else {
      pendingContainer.innerHTML = saOtPendingList.map(item => {
        const inTime = item.overtime_clock_in_time ? new Date(item.overtime_clock_in_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
        const outTime = item.overtime_clock_out_time ? new Date(item.overtime_clock_out_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
        const sec = item.overtime_duration_seconds || 0;
        const durStr = sec > 0 ? `${Math.floor(sec / 3600)}j ${Math.floor((sec % 3600) / 60)}m` : '-';

        return `
          <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 shadow-xs">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-bold text-slate-900 dark:text-white text-sm">${escapeHtml(item.full_name)}</span>
                <span class="text-xs font-semibold text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-md ml-1.5">${escapeHtml(item.division_name || '-')}</span>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${item.overtime_status === 'under_review' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-slate-100 text-slate-700'}">${item.overtime_status === 'under_review' ? 'Sedang Ditinjau' : 'Pending'}</span>
            </div>
            <div class="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/30 text-xs space-y-1">
              <div class="flex items-center justify-between font-mono">
                <span class="text-slate-600 dark:text-slate-300">Tanggal: <strong>${escapeHtml(item.attendance_date)}</strong></span>
                <span class="font-bold text-amber-700 dark:text-amber-400">Durasi: ${durStr}</span>
              </div>
              <div class="text-slate-700 dark:text-slate-200 font-mono text-[11px]">
                Masuk: <strong>${inTime}</strong> — Pulang: <strong>${outTime}</strong>
              </div>
            </div>
            <div class="text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <p class="font-bold text-[11px] text-slate-400 uppercase">Tugas Lembur:</p>
              <p class="leading-relaxed">${escapeHtml(item.overtime_task_reason || '-')}</p>
            </div>

            ${item.overtime_work_attachment ? `
              <div>
                <a href="${item.overtime_work_attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="w-full py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-1.5">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <span>Lihat Berkas Hasil Kerja</span>
                </a>
              </div>
            ` : ''}
            ${item.overtime_work_attachment ? `
              <div>
                <a href="${item.overtime_work_attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="w-full py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-1.5">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <span>Lihat Berkas Hasil Kerja</span>
                </a>
              </div>
            ` : ''}
            <div class="pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <button onclick="openSAOvertimeDetailModal('${item.id}')" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                <span>Foto & GPS</span>
              </button>
              <div class="flex items-center gap-1.5">
                <button data-id="${item.id}" data-name="${escapeHtml(item.full_name)}" data-decision="approved" class="btn-sa-ot-decide px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm cursor-pointer">Setujui</button>
                <button data-id="${item.id}" data-name="${escapeHtml(item.full_name)}" data-decision="under_review" class="btn-sa-ot-decide px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm cursor-pointer">Tinjau</button>
                <button data-id="${item.id}" data-name="${escapeHtml(item.full_name)}" data-decision="rejected" class="btn-sa-ot-decide px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm cursor-pointer">Tolak</button>
                <button data-id="${item.id}" class="btn-sa-ot-delete px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200 cursor-pointer">Hapus</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      pendingContainer.querySelectorAll('.btn-sa-ot-decide').forEach(b => b.addEventListener('click', () => openSAOvertimeDecisionModal(b.dataset.id, b.dataset.name, b.dataset.decision)));
      pendingContainer.querySelectorAll('.btn-sa-ot-delete').forEach(b => b.addEventListener('click', () => deleteSAOvertime(b.dataset.id)));
    }
  }

  // Render Overtime History in Submissions panel
  if (historyContainer) {
    if (saOtHistoryList.length === 0) {
      historyContainer.innerHTML = '<p class="text-slate-400 text-center py-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">Belum ada riwayat presensi lembur.</p>';
    } else {
      historyContainer.innerHTML = saOtHistoryList.map(item => {
        const inTime = item.overtime_clock_in_time ? new Date(item.overtime_clock_in_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
        const outTime = item.overtime_clock_out_time ? new Date(item.overtime_clock_out_time).toLocaleTimeString('id-ID', { hour12: false }) : '-';
        const sec = item.overtime_duration_seconds || 0;
        const durStr = sec > 0 ? `${Math.floor(sec / 3600)}j ${Math.floor((sec % 3600) / 60)}m` : '-';
        const reviewTimeStr = item.overtime_reviewed_at ? new Date(item.overtime_reviewed_at).toLocaleString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) + ' WIB' : '-';

        return `
          <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 shadow-xs">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-bold text-slate-900 dark:text-white text-sm">${escapeHtml(item.full_name)}</span>
                <span class="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md ml-1.5">${escapeHtml(item.division_name || '-')}</span>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${item.overtime_status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'}">
                ${item.overtime_status === 'approved' ? 'Disetujui' : 'Ditolak'}
              </span>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 text-xs">
              <div class="font-mono text-slate-600 dark:text-slate-300">
                Tanggal: <strong>${escapeHtml(item.attendance_date)}</strong> (${inTime} — ${outTime}, Durasi: ${durStr})
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-slate-500">Ditinjau oleh:</span>
                <strong class="text-slate-900 dark:text-white">${escapeHtml(item.reviewed_by_name || 'Admin Sistem')}</strong>
                ${item.reviewed_by_role === 'admin_manager'
                  ? '<span class="px-2 py-0.5 rounded text-[9px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200">Middle Management</span>'
                  : (item.reviewed_by_role === 'super_admin' || item.reviewed_by_role === 'superadmin')
                  ? '<span class="px-2 py-0.5 rounded text-[9px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200">Super Admin</span>'
                  : ''}
                <span class="text-slate-400 font-mono">(${reviewTimeStr})</span>
              </div>
            </div>

            <div class="text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <p class="font-bold text-[11px] text-slate-400 uppercase">Tugas Lembur:</p>
              <p class="leading-relaxed">${escapeHtml(item.overtime_task_reason || '-')}</p>
            </div>

            ${item.overtime_work_attachment ? `
              <div>
                <a href="${item.overtime_work_attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="w-full py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-1.5">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <span>Lihat Berkas Hasil Kerja</span>
                </a>
              </div>
            ` : ''}

            ${item.overtime_review_note ? `
              <div class="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 text-xs text-amber-900 dark:text-amber-300">
                <span class="font-bold">Catatan Peninjau:</span> ${escapeHtml(item.overtime_review_note)}
              </div>
            ` : ''}

            <div class="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <button onclick="openSAOvertimeDetailModal('${item.id}')" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                <span>Detail Foto & GPS</span>
              </button>
              <button data-id="${item.id}" class="btn-sa-ot-delete px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200 transition-colors cursor-pointer">Hapus</button>
            </div>
          </div>
        `;
      }).join('');

      historyContainer.querySelectorAll('.btn-sa-ot-delete').forEach(b => b.addEventListener('click', () => deleteSAOvertime(b.dataset.id)));
    }
  }
}

function renderSAOvertimePendingTable() {
  const tbody = document.getElementById('sa-ot-tbody-pending');
  if (!tbody) return;

  const keyword = document.getElementById('sa-ot-search-input')?.value.toLowerCase().trim() || '';
  let list = saOtPendingList;
  if (keyword) list = list.filter(o => o.full_name && o.full_name.toLowerCase().includes(keyword));

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-slate-400">Tidak ada presensi lembur pending.</td></tr>`;
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
        <td class="px-4 py-3 font-bold text-slate-900 dark:text-white">${escapeHtml(item.full_name)}</td>
        <td class="px-4 py-3 text-slate-600 dark:text-slate-300"><span class="px-2 py-0.5 rounded-lg bg-amber-100/70 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] font-semibold">${escapeHtml(item.division_name || '-')}</span></td>
        <td class="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">${escapeHtml(item.attendance_date)}</td>
        <td class="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap"><div class="font-bold text-amber-700 dark:text-amber-400">In: ${inTime} | Out: ${outTime}</div><div class="text-[11px] text-slate-500 font-medium">Durasi: <span class="font-bold">${durStr}</span></div></td>
        <td class="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs" title="${escapeHtml(item.overtime_task_reason)}">
          <div class="font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(item.overtime_task_reason || '-')}</div>
          ${item.overtime_clock_out_note ? `<div class="text-[11px] text-slate-500 italic">Catatan: ${escapeHtml(item.overtime_clock_out_note)}</div>` : ''}
          ${item.overtime_work_attachment ? `
            <div class="mt-1">
              <a href="${item.overtime_work_attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md">
                <svg class="w-3 h-3 stroke-[2] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <span>Berkas Kerja</span>
              </a>
            </div>
          ` : ''}
        </td>
        <td class="px-4 py-3 whitespace-nowrap"><button onclick="openSAOvertimeDetailModal('${item.id}')" data-id="${item.id}" class="btn-sa-ot-detail px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer"><svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" stroke-width="2"/></svg> <span>Verifikasi Foto & GPS</span></button></td>
        <td class="px-4 py-3 text-center"><span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${item.overtime_status === 'under_review' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}">${item.overtime_status === 'under_review' ? 'Sedang Ditinjau' : 'Pending'}</span></td>
        <td class="px-4 py-3 text-right whitespace-nowrap"><div class="flex items-center justify-end gap-1.5"><button data-id="${item.id}" data-name="${escapeHtml(item.full_name)}" data-decision="approved" class="btn-sa-ot-decide px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px]">Setujui</button><button data-id="${item.id}" data-name="${escapeHtml(item.full_name)}" data-decision="under_review" class="btn-sa-ot-decide px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px]">Tinjau</button><button data-id="${item.id}" data-name="${escapeHtml(item.full_name)}" data-decision="rejected" class="btn-sa-ot-decide px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px]">Tolak</button><button data-id="${item.id}" class="btn-sa-ot-delete px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] border border-rose-200">Hapus</button></div></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-sa-ot-detail').forEach(b => b.addEventListener('click', () => openSAOvertimeDetailModal(b.dataset.id)));
  tbody.querySelectorAll('.btn-sa-ot-decide').forEach(b => b.addEventListener('click', () => openSAOvertimeDecisionModal(b.dataset.id, b.dataset.name, b.dataset.decision)));
  tbody.querySelectorAll('.btn-sa-ot-delete').forEach(b => b.addEventListener('click', () => deleteSAOvertime(b.dataset.id)));
}

function renderSAOvertimeHistoryTable() {
  const tbody = document.getElementById('sa-ot-tbody-history');
  if (!tbody) return;

  const keyword = document.getElementById('sa-ot-search-input')?.value.toLowerCase().trim() || '';
  let list = saOtHistoryList;
  if (keyword) list = list.filter(o => o.full_name && o.full_name.toLowerCase().includes(keyword));

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">Belum ada riwayat presensi lembur.</td></tr>`;
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
        <td class="px-4 py-3.5 font-bold text-slate-900 dark:text-white">${escapeHtml(item.full_name)}</td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300"><span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-[11px] font-semibold">${escapeHtml(item.division_name || '-')}</span></td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">${escapeHtml(item.attendance_date)}<div class="text-[11px] font-semibold text-amber-600 dark:text-amber-400 font-mono flex items-center gap-1 mt-0.5"><svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> ${inTime} - ${outTime} (${durStr})</div></td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 max-w-xs" title="${escapeHtml(item.overtime_task_reason)}">
          <div>${escapeHtml(item.overtime_task_reason || '-')}</div>
          ${item.overtime_work_attachment ? `
            <div class="mt-1">
              <a href="${item.overtime_work_attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md">
                <svg class="w-3 h-3 stroke-[2] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <span>Berkas Kerja</span>
              </a>
            </div>
          ` : ''}
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
          <button onclick="openSAOvertimeDetailModal('${item.id}')" data-id="${item.id}" class="btn-sa-ot-detail px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[10px] transition-colors inline-flex items-center gap-1 cursor-pointer">
            <svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" stroke-width="2"/></svg>
            <span>Verifikasi Foto & GPS</span>
          </button>
        </td>
        <td class="px-4 py-3.5 text-right whitespace-nowrap text-xs">
          <div class="flex flex-col items-end gap-1">
            <div class="flex items-center gap-1.5 justify-end flex-wrap">
              <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(item.reviewed_by_name || 'Admin Sistem')}</span>
              ${item.reviewed_by_role === 'admin_manager'
                ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">Middle Management</span>'
                : (item.reviewed_by_role === 'super_admin' || item.reviewed_by_role === 'superadmin')
                ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Super Admin</span>'
                : ''}
            </div>
            ${item.overtime_reviewed_at ? `<div class="text-[10px] text-slate-400 font-mono">${new Date(item.overtime_reviewed_at).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })} WIB</div>` : ''}
            <button data-id="${item.id}" class="btn-sa-ot-delete mt-0.5 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] border border-rose-200 transition-colors cursor-pointer">Hapus</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-sa-ot-detail').forEach(b => b.addEventListener('click', () => openSAOvertimeDetailModal(b.dataset.id)));
  tbody.querySelectorAll('.btn-sa-ot-delete').forEach(b => b.addEventListener('click', () => deleteSAOvertime(b.dataset.id)));
}

async function deleteSAOvertime(id) {
  if (confirm('Apakah Anda yakin ingin menghapus data presensi lembur ini? Data yang dihapus tidak dapat dikembalikan.')) {
    try {
      await apiDelete(`/admin/overtime/${id}`);
      showAlert('Presensi lembur berhasil dihapus.', 'success');
      loadSAOvertimeData();
    } catch (err) {
      showAlert(err.message || 'Gagal menghapus presensi lembur.');
    }
  }
}

function openSAOvertimeDecisionModal(id, name, decision) {
  activeDecision = { id, decision, isOvertime: true };
  decisionNote.value = decision === 'approved' ? 'Lembur Disetujui' : decision === 'under_review' ? 'Sedang ditinjau manajemen' : '';
  const actionText = decision === 'approved' ? 'Setujui' : decision === 'under_review' ? 'Tinjau' : 'Tolak';
  document.getElementById('decision-title').textContent = `${actionText} presensi lembur ${name}`;
  decisionModal.classList.remove('hidden');
}

function openSAOvertimeDetailModal(id) {
  const item = saOtPendingList.find(o => String(o.id) === String(id)) || saOtHistoryList.find(o => String(o.id) === String(id));
  if (!item) return;

  const content = document.getElementById('ot-detail-content');
  if (!content) return;

  const inPhoto = item.overtime_clock_in_photo ? item.overtime_clock_in_photo.replace('/uploads/', '/secure-uploads/') : null;
  const outPhoto = item.overtime_clock_out_photo ? item.overtime_clock_out_photo.replace('/uploads/', '/secure-uploads/') : null;

  const inGpsStr = (item.overtime_clock_in_lat && item.overtime_clock_in_lng)
    ? `${Number(item.overtime_clock_in_lat).toFixed(6)}, ${Number(item.overtime_clock_in_lng).toFixed(6)}`
    : null;

  const outGpsStr = (item.overtime_clock_out_lat && item.overtime_clock_out_lng)
    ? `${Number(item.overtime_clock_out_lat).toFixed(6)}, ${Number(item.overtime_clock_out_lng).toFixed(6)}`
    : null;

  const inGpsLink = inGpsStr ? `https://maps.google.com/?q=${item.overtime_clock_in_lat},${item.overtime_clock_in_lng}` : null;
  const outGpsLink = outGpsStr ? `https://maps.google.com/?q=${item.overtime_clock_out_lat},${item.overtime_clock_out_lng}` : null;

  content.innerHTML = `
    <div class="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl space-y-1.5 text-xs border border-slate-200/80 dark:border-slate-800">
      <div class="font-bold text-slate-900 dark:text-white text-sm sm:text-base">${escapeHtml(item.full_name)} <span class="text-xs font-semibold text-slate-500 font-normal">(${escapeHtml(item.division_name || '-')})</span></div>
      <div class="text-slate-500 dark:text-slate-400">Tanggal: <span class="font-semibold text-slate-800 dark:text-slate-200 font-mono">${escapeHtml(item.attendance_date)}</span></div>
      <div class="text-slate-500 dark:text-slate-400">Tugas Lembur: <span class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(item.overtime_task_reason || '-')}</span></div>
    </div>

    ${item.overtime_work_attachment ? `
      <div class="bg-indigo-50/70 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div>
            <div class="text-xs font-bold text-indigo-950 dark:text-indigo-200">Berkas Bukti Hasil Kerja Lembur</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400">File lampiran output tugas lembur karyawan</div>
          </div>
        </div>
        <a href="${item.overtime_work_attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 shrink-0 shadow-xs">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          <span>Unduh / Buka File</span>
        </a>
      </div>
    ` : ''}

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="bg-white dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center space-y-2.5">
        <span class="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Absen Masuk Lembur</span>
        ${inPhoto ? `<img src="${inPhoto}" class="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" alt="Foto Masuk Lembur" />` : '<div class="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800/80 rounded-xl flex items-center justify-center text-xs text-slate-400">Tidak ada foto</div>'}
        ${inGpsStr ? `
          <div class="space-y-1.5">
            <div class="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              ${inGpsStr}
            </div>
            <a href="${inGpsLink}" target="_blank" class="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-3 py-1.5 rounded-xl border border-brand-200/60 dark:border-brand-800/40 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              Buka Maps GPS Masuk
            </a>
          </div>
        ` : '<span class="inline-flex items-center gap-1 text-xs text-slate-400 pt-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> GPS Masuk tidak tercatat</span>'}
      </div>

      <div class="bg-white dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center space-y-2.5">
        <span class="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Absen Pulang Lembur</span>
        ${outPhoto ? `<img src="${outPhoto}" class="w-full aspect-[4/3] object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" alt="Foto Pulang Lembur" />` : '<div class="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800/80 rounded-xl flex items-center justify-center text-xs text-slate-400">Tidak ada foto</div>'}
        ${outGpsStr ? `
          <div class="space-y-1.5">
            <div class="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <svg class="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              ${outGpsStr}
            </div>
            <a href="${outGpsLink}" target="_blank" class="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-3 py-1.5 rounded-xl border border-brand-200/60 dark:border-brand-800/40 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              Buka Maps GPS Pulang
            </a>
          </div>
        ` : '<span class="inline-flex items-center gap-1 text-xs text-slate-400 pt-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> GPS Pulang tidak tercatat</span>'}
      </div>
    </div>
  `;

  const modal = document.getElementById('modal-overtime-detail');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

window.openSAOvertimeDetailModal = openSAOvertimeDetailModal;

// Subtab & Event Listeners for Super Admin Overtime
document.getElementById('sa-ot-tab-pending')?.addEventListener('click', () => {
  saOtCurrentTab = 'pending';
  document.getElementById('sa-ot-tab-pending').classList.add('border-brand-600', 'text-brand-600', 'dark:border-brand-400', 'dark:text-brand-300');
  document.getElementById('sa-ot-tab-pending').classList.remove('border-transparent', 'text-slate-500');
  document.getElementById('sa-ot-tab-history').classList.remove('border-brand-600', 'text-brand-600', 'dark:border-brand-400', 'dark:text-brand-300');
  document.getElementById('sa-ot-tab-history').classList.add('border-transparent', 'text-slate-500');
  document.getElementById('sa-ot-panel-pending').classList.remove('hidden');
  document.getElementById('sa-ot-panel-history').classList.add('hidden');
});

document.getElementById('sa-ot-tab-history')?.addEventListener('click', () => {
  saOtCurrentTab = 'history';
  document.getElementById('sa-ot-tab-history').classList.add('border-brand-600', 'text-brand-600', 'dark:border-brand-400', 'dark:text-brand-300');
  document.getElementById('sa-ot-tab-history').classList.remove('border-transparent', 'text-slate-500');
  document.getElementById('sa-ot-tab-pending').classList.remove('border-brand-600', 'text-brand-600', 'dark:border-brand-400', 'dark:text-brand-300');
  document.getElementById('sa-ot-tab-pending').classList.add('border-transparent', 'text-slate-500');
  document.getElementById('sa-ot-panel-history').classList.remove('hidden');
  document.getElementById('sa-ot-panel-pending').classList.add('hidden');
});

document.getElementById('sa-ot-filter-period')?.addEventListener('change', () => loadSAOvertimeData());
document.getElementById('sa-ot-filter-division')?.addEventListener('change', () => loadSAOvertimeData());
document.getElementById('sa-ot-search-input')?.addEventListener('input', renderSAOvertimeTables);
document.getElementById('sa-ot-btn-refresh')?.addEventListener('click', () => loadSAOvertimeData());

document.getElementById('sa-ot-btn-export-xlsx')?.addEventListener('click', async () => {
  const btn = document.getElementById('sa-ot-btn-export-xlsx');
  const originalHtml = btn ? btn.innerHTML : '';
  try {
    if (btn) {
      btn.disabled = true;
      btn.classList.add('opacity-75');
      btn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> <span>Mengekspor...</span>`;
    }
    const divId = document.getElementById('sa-ot-filter-division')?.value || '';
    const period = document.getElementById('sa-ot-filter-period')?.value || 'monthly';
    const params = { format: 'xlsx' };
    if (divId) params.division_id = divId;
    if (period) params.period = period;

    await apiDownload('/reports/overtime/export', params, `rekap-presensi-lembur-${period}-${Date.now()}.xlsx`);
  } catch (err) {
    showAlert(err.message || 'Gagal mengekspor data lembur.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-75');
      btn.innerHTML = originalHtml;
    }
  }
});

/* Super Admin Submission CRUD */
const superSubModal = document.getElementById('superadmin-sub-modal');
const formSuperSub = document.getElementById('form-super-sub');

document.getElementById('btn-super-create-submission').addEventListener('click', () => openSuperSubModal(null));
document.getElementById('btn-close-super-sub-modal').addEventListener('click', () => superSubModal.classList.add('hidden'));
document.getElementById('btn-cancel-super-sub').addEventListener('click', () => superSubModal.classList.add('hidden'));

function toggleSuperSubTimeContainer() {
  const type = document.getElementById('super-sub-type')?.value;
  const timeWrapper = document.getElementById('wrapper-super-sub-time');
  if (timeWrapper) {
    timeWrapper.classList.toggle('hidden', type !== 'lembur');
  }
}

function toggleSuperSubHandoverContainer() {
  const type = document.getElementById('super-sub-type')?.value;
  const handoverWrapper = document.getElementById('wrapper-super-sub-handover');
  if (handoverWrapper) {
    handoverWrapper.classList.toggle('hidden', type !== 'cuti');
    if (type !== 'cuti') {
      if (document.getElementById('super-sub-handover-plan')) document.getElementById('super-sub-handover-plan').value = '';
      if (document.getElementById('super-sub-handover-to-name')) document.getElementById('super-sub-handover-to-name').value = '';
      if (document.getElementById('super-sub-handover-to-position')) document.getElementById('super-sub-handover-to-position').value = '';
    }
  }
}

document.getElementById('super-sub-type')?.addEventListener('change', () => {
  toggleSuperSubTimeContainer();
  toggleSuperSubHandoverContainer();
});

async function openSuperSubModal(sub = null) {
  hideAlert();
  document.getElementById('super-sub-id').value = sub ? sub.id : '';
  document.getElementById('super-sub-modal-title').textContent = sub ? `Edit Pengajuan #${sub.id}` : 'Buat Pengajuan Baru';

  const userWrapper = document.getElementById('wrapper-super-sub-user');
  const userSelect = document.getElementById('super-sub-user');

  if (!sub) {
    userWrapper.classList.remove('hidden');
    userSelect.setAttribute('required', 'true');
    userSelect.innerHTML = '<option value="">Memuat...</option>';
    try {
      const { employees } = await apiGet('/admin/employees');
      userSelect.innerHTML = '<option value="">-- Pilih Karyawan --</option>' +
        employees.map((e) => `<option value="${e.id}">${escapeHtml(e.full_name)} (${escapeHtml(e.division_name || 'Umum')} - ${escapeHtml(e.position_name || 'Staff')})</option>`).join('');
    } catch (err) {
      userSelect.innerHTML = '<option value="">Gagal memuat karyawan</option>';
    }
  } else {
    userWrapper.classList.add('hidden');
    userSelect.removeAttribute('required');
  }

  document.getElementById('super-sub-type').value = sub ? sub.type : 'cuti';
  document.getElementById('super-sub-start').value = sub && sub.start_date ? sub.start_date.split('T')[0] : '';
  document.getElementById('super-sub-end').value = sub && sub.end_date ? sub.end_date.split('T')[0] : '';
  if (document.getElementById('super-sub-start-time')) document.getElementById('super-sub-start-time').value = sub ? sub.start_time || '' : '';
  if (document.getElementById('super-sub-end-time')) document.getElementById('super-sub-end-time').value = sub ? sub.end_time || '' : '';
  if (document.getElementById('super-sub-handover-plan')) document.getElementById('super-sub-handover-plan').value = sub ? sub.handover_plan || '' : '';
  if (document.getElementById('super-sub-handover-to-name')) document.getElementById('super-sub-handover-to-name').value = sub ? sub.handover_to_name || '' : '';
  if (document.getElementById('super-sub-handover-to-position')) document.getElementById('super-sub-handover-to-position').value = sub ? sub.handover_to_position || '' : '';
  document.getElementById('super-sub-reason').value = sub ? sub.reason || '' : '';
  document.getElementById('super-sub-status').value = sub ? sub.status || 'pending' : 'pending';
  document.getElementById('super-sub-note').value = sub ? sub.review_note || '' : '';

  toggleSuperSubTimeContainer();
  toggleSuperSubHandoverContainer();

  superSubModal.classList.remove('hidden');
}

if (formSuperSub) {
  formSuperSub.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const id = document.getElementById('super-sub-id').value;
    const saveBtn = document.getElementById('btn-save-super-sub');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan...';

    const payload = {
      user_id: document.getElementById('super-sub-user').value,
      type: document.getElementById('super-sub-type').value,
      start_date: document.getElementById('super-sub-start').value,
      end_date: document.getElementById('super-sub-end').value,
      start_time: document.getElementById('super-sub-start-time')?.value || null,
      end_time: document.getElementById('super-sub-end-time')?.value || null,
      handover_plan: document.getElementById('super-sub-handover-plan')?.value || null,
      handover_to_name: document.getElementById('super-sub-handover-to-name')?.value || null,
      handover_to_position: document.getElementById('super-sub-handover-to-position')?.value || null,
      reason: document.getElementById('super-sub-reason').value.trim(),
      status: document.getElementById('super-sub-status').value,
      review_note: document.getElementById('super-sub-note').value.trim()
    };

    try {
      let res;
      if (id) {
        res = await apiPut(`/admin/submissions/${id}`, payload);
      } else {
        res = await apiPost('/admin/submissions', payload);
      }
      superSubModal.classList.add('hidden');
      showAlert(res.message, 'success');
      loadSubmissionsData();
    } catch (err) {
      showAlert(err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Simpan';
    }
  });
}

async function deleteSuperSubmission(id) {
  if (!confirm(`Apakah Anda yakin ingin menghapus data pengajuan #${id}?`)) return;
  hideAlert();
  try {
    const res = await apiDelete(`/admin/submissions/${id}`);
    showAlert(res.message, 'success');
    loadSubmissionsData();
  } catch (err) {
    showAlert(err.message);
  }
}

/* Export Submissions Event Listeners */
document.getElementById('btn-export-submissions-csv').addEventListener('click', async () => {
  try {
    const divisionId = document.getElementById('submission-division-filter').value;
    const params = { format: 'csv' };
    if (divisionId) params.division_id = divisionId;
    await apiDownload('/reports/submissions/export', params, `rekap-pengajuan-${Date.now()}.csv`);
  } catch (err) { showAlert(err.message); }
});

document.getElementById('btn-export-submissions-xlsx').addEventListener('click', async () => {
  try {
    const divisionId = document.getElementById('submission-division-filter').value;
    const params = { format: 'xlsx' };
    if (divisionId) params.division_id = divisionId;
    await apiDownload('/reports/submissions/export', params, `rekap-pengajuan-${Date.now()}.xlsx`);
  } catch (err) { showAlert(err.message); }
});

/* ---------------------------------------------------------
   Dark / Light Mode Controller
--------------------------------------------------------- */
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    updateThemeUI(true);
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    updateThemeUI(false);
  }
}

function renderPillButtonContent(btn, isDark, isMobile = false) {
  if (!btn) return;
  if (isDark) {
    btn.className = isMobile
      ? 'relative inline-flex items-center justify-between w-[125px] h-8 px-1 rounded-full bg-black border border-slate-800 cursor-pointer select-none transition-all duration-300 shadow-xs shrink-0'
      : 'relative inline-flex items-center justify-between w-full h-9 px-1 rounded-full bg-black border border-slate-800 cursor-pointer select-none transition-all duration-300 shadow-xs hover:scale-[1.02] shrink-0 mb-3';
    btn.innerHTML = `
      <div class="${isMobile ? 'w-6 h-6' : 'w-7 h-7'} rounded-full bg-white shadow-md flex items-center justify-center shrink-0 border border-slate-200">
        <svg class="${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-slate-900" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.3 2a10 10 0 0 0 9.7 12.8 10 10 0 1 1-9.7-12.8z"/>
          <path d="M18 3.5l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4z"/>
          <path d="M21 8.5l.3.6.6.3-.6.3-.3.6-.3-.6-.6-.3.6-.3z"/>
        </svg>
      </div>
      <span class="${isMobile ? '' : 'sidebar-label'} text-[9px] sm:text-[10px] font-black tracking-wider text-white ${isMobile ? 'pr-2' : 'pr-2.5'} uppercase select-none">NIGHT MODE</span>
    `;
  } else {
    btn.className = isMobile
      ? 'relative inline-flex items-center justify-between w-[125px] h-8 px-1 rounded-full bg-[#EBEBEB] border border-[#D1D1D1] cursor-pointer select-none transition-all duration-300 shadow-xs shrink-0'
      : 'relative inline-flex items-center justify-between w-full h-9 px-1 rounded-full bg-[#EBEBEB] border border-[#D1D1D1] cursor-pointer select-none transition-all duration-300 shadow-xs hover:scale-[1.02] shrink-0 mb-3';
    btn.innerHTML = `
      <span class="${isMobile ? '' : 'sidebar-label'} text-[9px] sm:text-[10px] font-black tracking-wider text-slate-900 ${isMobile ? 'pl-2' : 'pl-2.5'} uppercase select-none">DAY MODE</span>
      <div class="${isMobile ? 'w-6 h-6' : 'w-7 h-7'} rounded-full bg-white shadow-md flex items-center justify-center shrink-0 border border-slate-200">
        <svg class="${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-slate-900" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
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

function updateThemeUI(isDark) {
  const deskBtn = document.getElementById('btn-toggle-theme');
  const mobBtn = document.getElementById('btn-toggle-theme-mobile');
  renderPillButtonContent(deskBtn, isDark, false);
  renderPillButtonContent(mobBtn, isDark, true);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
  if (typeof loadDashboard === 'function') {
    loadDashboard(currentDashboardPeriod);
  }
}

['btn-toggle-theme', 'btn-toggle-theme-mobile'].forEach((id) => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', toggleTheme);
});

initTheme();

/* ---------------------------------------------------------
   Sidebar Collapse / Hide / Split Controller
--------------------------------------------------------- */
function initSidebar() {
  const savedState = localStorage.getItem('sidebar_state') || 'full';
  applySidebarState(savedState);
}

function applySidebarState(state) {
  const sidebar = document.getElementById('main-sidebar');
  const btnShow = document.getElementById('btn-show-sidebar');
  const collapseIcon = document.getElementById('sidebar-collapse-icon');
  const topCollapseIcon = document.getElementById('top-collapse-icon');

  if (!sidebar) return;

  // Clear state classes
  sidebar.classList.remove('sidebar-collapsed', 'sidebar-hidden');

  if (state === 'collapsed') {
    sidebar.classList.add('sidebar-collapsed');
    if (btnShow) {
      btnShow.classList.add('hidden');
      btnShow.classList.remove('flex');
    }
    if (collapseIcon) collapseIcon.textContent = '▶';
    if (topCollapseIcon) topCollapseIcon.textContent = '▶';
    localStorage.setItem('sidebar_state', 'collapsed');
  } else if (state === 'hidden') {
    sidebar.classList.add('sidebar-hidden');
    if (btnShow) {
      btnShow.classList.remove('hidden');
      btnShow.classList.add('flex');
    }
    if (collapseIcon) collapseIcon.textContent = '◀';
    if (topCollapseIcon) topCollapseIcon.textContent = '◀';
    localStorage.setItem('sidebar_state', 'hidden');
  } else {
    // 'full'
    if (btnShow) {
      btnShow.classList.add('hidden');
      btnShow.classList.remove('flex');
    }
    if (collapseIcon) collapseIcon.textContent = '◀';
    if (topCollapseIcon) topCollapseIcon.textContent = '◀';
    localStorage.setItem('sidebar_state', 'full');
  }
}

function toggleSidebarCollapse() {
  const currentState = localStorage.getItem('sidebar_state') || 'full';
  if (currentState === 'collapsed') {
    applySidebarState('full');
  } else {
    applySidebarState('collapsed');
  }
}

function toggleSidebarHide() {
  const currentState = localStorage.getItem('sidebar_state') || 'full';
  if (currentState === 'hidden') {
    applySidebarState('full');
  } else {
    applySidebarState('hidden');
  }
}

// Sidebar Event Listeners
const btnCollapse = document.getElementById('btn-toggle-sidebar-collapse');
const btnCollapseTop = document.getElementById('btn-toggle-sidebar-collapse-top');
const btnHide = document.getElementById('btn-toggle-sidebar-hide');
const btnShow = document.getElementById('btn-show-sidebar');

if (btnCollapse) btnCollapse.addEventListener('click', toggleSidebarCollapse);
if (btnCollapseTop) btnCollapseTop.addEventListener('click', toggleSidebarCollapse);
if (btnHide) btnHide.addEventListener('click', toggleSidebarHide);
if (btnShow) btnShow.addEventListener('click', () => applySidebarState('full'));

const closeOtDetail = () => {
  const modal = document.getElementById('modal-overtime-detail');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};
document.getElementById('btn-close-ot-detail')?.addEventListener('click', closeOtDetail);
document.getElementById('btn-done-ot-detail')?.addEventListener('click', closeOtDetail);

initSidebar();

/* ---------------------------------------------------------
   BROADCAST & PUSH NOTIFIKASI CONTROLLER
--------------------------------------------------------- */
const formBroadcast = document.getElementById('form-broadcast-notif');
const broadcastTitleInput = document.getElementById('broadcast-title-input');
const broadcastMsgInput = document.getElementById('broadcast-message-input');
const broadcastUrlInput = document.getElementById('broadcast-url-input');
const broadcastCharCount = document.getElementById('broadcast-char-count');
const wrapperBroadcastDivision = document.getElementById('wrapper-broadcast-division');
const broadcastDivisionSelect = document.getElementById('broadcast-division-select');
const btnSubscribeDevice = document.getElementById('btn-subscribe-device');
const btnTestNotification = document.getElementById('btn-test-notification');
const btnRefreshHistory = document.getElementById('btn-refresh-history');
const tbodyBroadcastHistory = document.getElementById('tbody-broadcast-history');

// Mockup Elements
const previewClock = document.getElementById('preview-clock');
const previewTitle = document.getElementById('preview-title');
const previewBody = document.getElementById('preview-body');
const previewCardBanner = document.getElementById('preview-card-banner');
const previewTargetBadge = document.getElementById('preview-target-badge');

let cachedDivisions = [];

async function loadBroadcastPanel() {
  if (previewClock) {
    const now = new Date();
    previewClock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  try {
    const res = await apiGet('/superadmin/divisions');
    if (res.success && res.divisions) {
      cachedDivisions = res.divisions;
      if (broadcastDivisionSelect) {
        broadcastDivisionSelect.innerHTML = '<option value="">-- Pilih Divisi Sasaran --</option>' +
          res.divisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
      }
      const emailReminderDivisionSelect = document.getElementById('email-reminder-division-select');
      if (emailReminderDivisionSelect) {
        emailReminderDivisionSelect.innerHTML = '<option value="">Semua Divisi (Seluruh Antrean Pengajuan)</option>' +
          res.divisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
      }
    }
  } catch (err) {
    console.warn('[Broadcast] Gagal memuat divisi:', err);
  }

  loadBroadcastHistory();
}

async function loadBroadcastHistory() {
  if (!tbodyBroadcastHistory) return;
  tbodyBroadcastHistory.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-400">Memuat riwayat broadcast...</td></tr>`;

  try {
    const res = await apiGet('/notifications/history');
    if (!res.success || !res.history || res.history.length === 0) {
      tbodyBroadcastHistory.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">Belum ada riwayat broadcast notifikasi yang dikirim.</td></tr>`;
      return;
    }

    tbodyBroadcastHistory.innerHTML = res.history.map(item => {
      let typeBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold">📢 Info</span>';
      if (item.type === 'warning') {
        typeBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold">⚠️ Peringatan</span>';
      } else if (item.type === 'urgent') {
        typeBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold">🚨 Darurat</span>';
      }

      let targetLabel = 'Semua User';
      if (item.target_role === 'employee') targetLabel = 'Karyawan Saja';
      if (item.target_role === 'admin_manager') targetLabel = 'Manager Saja';
      if (item.target_role === 'division') targetLabel = `Divisi: ${escapeHtml(item.division_name || 'Spesifik')}`;

      const dateStr = new Date(item.created_at).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-750/50 transition-colors">
          <td class="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">${dateStr} WIB</td>
          <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px]">${targetLabel}</span></td>
          <td class="px-4 py-3 whitespace-nowrap">${typeBadge}</td>
          <td class="px-4 py-3 max-w-[280px]">
            <div class="font-bold text-slate-800 dark:text-white truncate">${escapeHtml(item.title)}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">${escapeHtml(item.message)}</div>
          </td>
          <td class="px-4 py-3 text-center whitespace-nowrap">
            <span class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">${item.total_success}</span>
            <span class="text-slate-400 font-mono text-[10px]"> / ${item.total_sent}</span>
            ${item.total_failed > 0 ? `<div class="text-[9px] text-rose-500 font-semibold">${item.total_failed} gagal</div>` : ''}
          </td>
          <td class="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">${escapeHtml(item.sender_name || 'Super Admin')}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('[Broadcast History Error]:', err);
    tbodyBroadcastHistory.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-rose-500">Gagal memuat riwayat broadcast: ${err.message}</td></tr>`;
  }
}

// Live Preview Bindings
if (broadcastTitleInput) {
  broadcastTitleInput.addEventListener('input', (e) => {
    if (previewTitle) {
      previewTitle.textContent = e.target.value.trim() || 'Pengingat Absensi Masuk ⏰';
    }
  });
}

if (broadcastMsgInput) {
  broadcastMsgInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (broadcastCharCount) broadcastCharCount.textContent = val.length;
    if (previewBody) {
      previewBody.textContent = val.trim() || 'Waktunya Clock In! Shift kerja Anda dimulai pukul 08:00 WIB. Pastikan selfie dan GPS aktif.';
    }
  });
}

// Target Selector Change Handler
document.querySelectorAll('input[name="broadcast_target"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    const targetVal = e.target.value;
    if (wrapperBroadcastDivision) {
      wrapperBroadcastDivision.classList.toggle('hidden', targetVal !== 'division');
    }
    if (previewTargetBadge) {
      if (targetVal === 'all') previewTargetBadge.textContent = 'Semua User';
      else if (targetVal === 'employee') previewTargetBadge.textContent = 'Karyawan Saja';
      else if (targetVal === 'admin_manager') previewTargetBadge.textContent = 'Manager Saja';
      else if (targetVal === 'division') {
        const selectedDivName = broadcastDivisionSelect?.options[broadcastDivisionSelect.selectedIndex]?.text || 'Per Divisi';
        previewTargetBadge.textContent = selectedDivName.replace('-- Pilih Divisi --', 'Per Divisi');
      }
    }
  });
});

if (broadcastDivisionSelect) {
  broadcastDivisionSelect.addEventListener('change', (e) => {
    const selectedText = e.target.options[e.target.selectedIndex]?.text;
    if (previewTargetBadge && selectedText) {
      previewTargetBadge.textContent = `Divisi: ${selectedText}`;
    }
  });
}

// Type Selector Change Handler
document.querySelectorAll('input[name="broadcast_type"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    const typeVal = e.target.value;
    if (previewCardBanner) {
      previewCardBanner.classList.remove('border-indigo-500/40', 'border-amber-500/40', 'border-rose-500/40');
      if (typeVal === 'info') previewCardBanner.classList.add('border-indigo-500/40');
      else if (typeVal === 'warning') previewCardBanner.classList.add('border-amber-500/40');
      else if (typeVal === 'urgent') previewCardBanner.classList.add('border-rose-500/40');
    }
  });
});

// Tombol Aktifkan Notifikasi di Perangkat Ini
if (btnSubscribeDevice) {
  btnSubscribeDevice.addEventListener('click', async () => {
    btnSubscribeDevice.disabled = true;
    btnSubscribeDevice.classList.add('opacity-70');
    try {
      await subscribeToPushNotifications();
    } finally {
      btnSubscribeDevice.disabled = false;
      btnSubscribeDevice.classList.remove('opacity-70');
    }
  });
}

// Tombol Tes Notifikasi HP
if (btnTestNotification) {
  btnTestNotification.addEventListener('click', async () => {
    btnTestNotification.disabled = true;
    const originalText = btnTestNotification.innerHTML;
    btnTestNotification.innerHTML = `
      <svg class="w-4 h-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
      <span>Mengirim...</span>
    `;

    try {
      const res = await apiPost('/notifications/test');
      if (res.success) {
        showModernToast('Tes Terkirim 🚀', res.message || 'Notifikasi tes berhasil dikirim ke perangkat Anda.', 'success');
      } else {
        showModernToast('Perhatian', res.message || 'Gagal mengirim notifikasi tes.', 'warning');
      }
    } catch (err) {
      showModernToast('Gagal', err.message || 'Terjadi kesalahan saat mengirim notifikasi tes.', 'error');
    } finally {
      btnTestNotification.disabled = false;
      btnTestNotification.innerHTML = originalText;
    }
  });
}

// Tombol Refresh Riwayat
if (btnRefreshHistory) {
  btnRefreshHistory.addEventListener('click', loadBroadcastHistory);
}

// Formulir Kirim Email Pengingat Pengajuan ke Manajer (Custom Gmail Recipients)
const formManagerEmailReminder = document.getElementById('form-manager-email-reminder');
if (formManagerEmailReminder) {
  formManagerEmailReminder.addEventListener('submit', async (e) => {
    e.preventDefault();

    const recipientsInput = document.getElementById('email-reminder-recipients');
    const divisionSelect = document.getElementById('email-reminder-division-select');
    const subjectInput = document.getElementById('email-reminder-subject');
    const noteInput = document.getElementById('email-reminder-note');
    const btnSubmit = document.getElementById('btn-submit-manual-email');

    const targetEmails = recipientsInput ? recipientsInput.value.trim() : '';
    if (!targetEmails) {
      showModernToast('Email Wajib Diisi', 'Silakan masukkan minimal satu alamat email Gmail penerima.', 'warning');
      return;
    }

    if (!confirm(`Kirimkan rekap pengingat antrean pengajuan ke alamat email:\n${targetEmails}\n\nLanjutkan pengiriman?`)) {
      return;
    }

    const origHtml = btnSubmit ? btnSubmit.innerHTML : '';
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `
        <svg class="w-4 h-4 animate-spin text-white inline-block" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span>Mengirimkan Email Pengingat...</span>
      `;
    }

    try {
      const res = await apiPost('/admin/send-pending-reminder', {
        target_emails: targetEmails,
        division_id: divisionSelect?.value ? parseInt(divisionSelect.value) : null,
        custom_subject: subjectInput ? subjectInput.value.trim() : '',
        custom_note: noteInput ? noteInput.value.trim() : '',
      });

      if (res && res.success) {
        showModernToast('Email Terkirim 📬', res.message || 'Email pengingat berhasil dikirim!', 'success');
      } else {
        showModernToast('Pengiriman Gagal', (res && res.message) || 'Gagal mengirim email pengingat.', 'warning');
      }
    } catch (err) {
      showModernToast('Error Sistem', err.message || 'Terjadi kesalahan sistem saat mengirim email.', 'error');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = origHtml;
      }
    }
  });
}

// Submit Form Broadcast
if (formBroadcast) {
  formBroadcast.addEventListener('submit', async (e) => {
    e.preventDefault();

    const targetRole = document.querySelector('input[name="broadcast_target"]:checked')?.value || 'all';
    const type = document.querySelector('input[name="broadcast_type"]:checked')?.value || 'info';
    const divisionId = broadcastDivisionSelect?.value ? parseInt(broadcastDivisionSelect.value) : null;
    const title = broadcastTitleInput?.value.trim();
    const message = broadcastMsgInput?.value.trim();
    const targetUrl = broadcastUrlInput?.value.trim() || '/employee/dashboard.html';

    if (targetRole === 'division' && !divisionId) {
      showModernToast('Validasi Gagal', 'Harap pilih divisi sasaran terlebih dahulu.', 'warning');
      return;
    }

    if (!title || !message) {
      showModernToast('Validasi Gagal', 'Judul dan isi pesan notifikasi wajib diisi.', 'warning');
      return;
    }

    const btnSubmit = document.getElementById('btn-send-broadcast');
    const origSubmitHtml = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `
      <svg class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
      <span>Mengirimkan Broadcast ke Jaringan PWA...</span>
    `;

    try {
      const res = await apiPost('/notifications/broadcast', {
        target_role: targetRole,
        target_division_id: divisionId,
        title,
        message,
        type,
        target_url: targetUrl
      });

      if (res.success) {
        showModernToast('Broadcast Berhasil! 🎉', res.message || 'Pesan berhasil dipancarkan ke perangkat karyawan.', 'success');
        broadcastTitleInput.value = '';
        broadcastMsgInput.value = '';
        if (broadcastCharCount) broadcastCharCount.textContent = '0';
        loadBroadcastHistory();
      } else {
        showModernToast('Gagal Mengirim', res.message || 'Terjadi kesalahan pada server saat broadcast.', 'error');
      }
    } catch (err) {
      showModernToast('Error Sistem', err.message || 'Terjadi kendala jaringan saat broadcast.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = origSubmitHtml;
    }
  });
}

/* ---------------------------------------------------------
   Super Admin Attachment Pop-up Modal Viewer
--------------------------------------------------------- */
function openSuperAttachmentModal(url, title = 'Lampiran Dokumen') {
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
        <div class="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
        <p class="text-xs font-semibold text-slate-700 dark:text-slate-300">Berkas Dokumen Lampiran Pengajuan</p>
        <a href="${url}" target="_blank" download class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition">
          Unduh & Buka Dokumen
        </a>
      </div>
    `;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-view-super-attachment');
  if (btn) {
    const url = btn.getAttribute('data-url');
    const title = btn.getAttribute('data-title') || 'Lampiran Dokumen';
    openSuperAttachmentModal(url, title);
  }
});

const btnCloseSuperAttachment = document.getElementById('btn-close-attachment-modal');
if (btnCloseSuperAttachment) {
  btnCloseSuperAttachment.addEventListener('click', () => {
    const modal = document.getElementById('modal-attachment-viewer');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    document.body.style.overflow = '';
  });
}
const superAttachmentModal = document.getElementById('modal-attachment-viewer');
if (superAttachmentModal) {
  superAttachmentModal.addEventListener('click', (e) => {
    if (e.target === superAttachmentModal) {
      superAttachmentModal.classList.add('hidden');
      superAttachmentModal.classList.remove('flex');
      document.body.style.overflow = '';
    }
  });
}

/* ---------------------------------------------------------
   SUPER ADMIN: SISTEM ROSTER SHIFT & LIBUR ROLLING BULANAN
--------------------------------------------------------- */
const saRosterState = {
  month: '',
  divisionId: '',
  scope: 'roster',
  searchKeyword: '',
  days: [],
  employees: [],
  schedules: {},
  shiftCodes: {},
  loaded: false
};

function getSAShiftPillStyle(code) {
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

async function loadSARosterMatrix(silent = false) {
  const container = document.getElementById('sa-roster-matrix-container');
  const monthInput = document.getElementById('sa-roster-month-input');

  if (!saRosterState.month) {
    const now = new Date();
    saRosterState.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  if (monthInput && !monthInput.value) {
    monthInput.value = saRosterState.month;
  }

  // Populate division options if needed
  const divSelect = document.getElementById('sa-roster-division-filter');
  if (divSelect && divSelect.options.length <= 1) {
    try {
      const { divisions } = await apiGet('/superadmin/divisions');
      if (divisions && divisions.length > 0) {
        divSelect.innerHTML = '<option value="">Semua Divisi</option>' +
          divisions.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
      }
    } catch {}
  }

  try {
    if (!silent && container) {
      container.innerHTML = '<div class="p-12 text-center text-slate-400 text-xs">Memuat matriks jadwal roster bulanan...</div>';
    }

    const params = {};
    if (saRosterState.month) params.month = saRosterState.month;
    if (saRosterState.divisionId) params.division_id = saRosterState.divisionId;
    if (saRosterState.scope) params.scope = saRosterState.scope;

    const data = await apiGet('/admin/roster/matrix', params);
    if (!data.success) throw new Error(data.message || 'Gagal memuat roster.');

    saRosterState.days = data.days || [];
    saRosterState.employees = data.employees || [];
    saRosterState.schedules = data.schedules || {};
    saRosterState.shiftCodes = data.shiftCodes || {};
    saRosterState.loaded = true;

    renderSARosterMatrix();
  } catch (err) {
    console.error('Superadmin roster error:', err);
    if (container) {
      container.innerHTML = `<div class="p-8 text-center text-rose-500 text-xs">${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderSARosterMatrix() {
  const container = document.getElementById('sa-roster-matrix-container');
  if (!container) return;

  const { days, employees, schedules } = saRosterState;

  let filteredEmployees = employees || [];
  if (saRosterState.searchKeyword) {
    filteredEmployees = filteredEmployees.filter(emp =>
      emp.full_name && emp.full_name.toLowerCase().includes(saRosterState.searchKeyword)
    );
  }

  if (filteredEmployees.length === 0) {
    const isRosterOnly = (saRosterState.scope || 'roster') === 'roster';
    container.innerHTML = `
      <div class="p-12 text-center text-slate-500 max-w-md mx-auto space-y-3">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
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
        <tr class="bg-slate-900 text-white font-mono sticky top-0 z-20">
          <th class="px-3 py-2.5 text-center font-bold sticky left-0 z-30 bg-slate-900 border-r border-slate-800 w-12 min-w-[48px]">No</th>
          <th class="px-4 py-2.5 text-left font-bold sticky left-12 z-30 bg-slate-900 border-r border-slate-800 min-w-[200px]">Nama Karyawan</th>
          <th class="px-3 py-2.5 text-left font-bold border-r border-slate-800 min-w-[140px]">Divisi</th>
          ${days.map(d => {
            const isWk = d.isWeekend;
            return `<th class="px-1 py-2 text-center font-black border-r border-slate-800 min-w-[56px] ${isWk ? 'bg-rose-950/80 text-rose-300' : ''}">${d.day}</th>`;
          }).join('')}
        </tr>
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
      <tr class="hover:bg-brand-50/30 dark:hover:bg-slate-800/40 transition-colors">
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
      const pillClass = getSAShiftPillStyle(curCode);
      const isWk = d.isWeekend;

      html += `
        <td class="p-1 text-center border-r border-slate-100 dark:border-slate-800 ${isWk ? 'bg-slate-50/50 dark:bg-slate-900/40' : ''}">
          <select
            onchange="updateSARosterCell(${emp.id}, '${d.date}', this.value, this)"
            title="${d.date}: ${curCode || 'Reguler'}"
            class="sa-roster-cell-select w-full text-center py-1 px-0.5 rounded-lg border text-[11px] cursor-pointer outline-none transition-all ${pillClass}"
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

async function updateSARosterCell(userId, dateStr, shiftCode, selectEl) {
  try {
    const data = await apiPost('/admin/roster/cell', {
      user_id: userId,
      schedule_date: dateStr,
      shift_code: shiftCode
    });

    if (!saRosterState.schedules[userId]) saRosterState.schedules[userId] = {};
    if (shiftCode) {
      saRosterState.schedules[userId][dateStr] = data.schedule || { shift_code: shiftCode };
    } else {
      delete saRosterState.schedules[userId][dateStr];
    }

    if (selectEl) {
      selectEl.className = `sa-roster-cell-select w-full text-center py-1 px-0.5 rounded-lg border text-[11px] cursor-pointer outline-none transition-all ${getSAShiftPillStyle(shiftCode)}`;
    }

    showAlert(`Jadwal ${dateStr.slice(8, 10)}: ${shiftCode || 'Default'} disimpan.`, 'success');
  } catch (err) {
    showAlert(err.message);
  }
}

window.updateSARosterCell = updateSARosterCell;
window.loadSARosterMatrix = loadSARosterMatrix;

// Super Admin Roster Toolbar Listeners
document.getElementById('sa-roster-month-input')?.addEventListener('change', (e) => {
  saRosterState.month = e.target.value;
  loadSARosterMatrix();
});

document.getElementById('sa-roster-division-filter')?.addEventListener('change', (e) => {
  saRosterState.divisionId = e.target.value;
  loadSARosterMatrix();
});

document.getElementById('sa-roster-scope-filter')?.addEventListener('change', (e) => {
  saRosterState.scope = e.target.value;
  loadSARosterMatrix();
});

document.getElementById('sa-roster-search-input')?.addEventListener('input', (e) => {
  saRosterState.searchKeyword = e.target.value.toLowerCase().trim();
  renderSARosterMatrix();
});

document.getElementById('sa-btn-roster-download-template')?.addEventListener('click', () => {
  const month = saRosterState.month || document.getElementById('sa-roster-month-input')?.value || '';
  const divId = saRosterState.divisionId || document.getElementById('sa-roster-division-filter')?.value || '';
  const scope = saRosterState.scope || document.getElementById('sa-roster-scope-filter')?.value || 'roster';
  const params = new URLSearchParams();
  if (month) params.append('month', month);
  if (divId) params.append('division_id', divId);
  if (scope) params.append('scope', scope);
  window.location.href = `/api/admin/roster/export-template?${params.toString()}`;
});

document.getElementById('sa-btn-roster-export-matrix')?.addEventListener('click', () => {
  const month = saRosterState.month || document.getElementById('sa-roster-month-input')?.value || '';
  const divId = saRosterState.divisionId || document.getElementById('sa-roster-division-filter')?.value || '';
  const scope = saRosterState.scope || document.getElementById('sa-roster-scope-filter')?.value || 'roster';
  const params = new URLSearchParams();
  if (month) params.append('month', month);
  if (divId) params.append('division_id', divId);
  if (scope) params.append('scope', scope);
  window.location.href = `/api/admin/roster/export-matrix?${params.toString()}`;
});

// Modal Import Excel Handlers for Super Admin
const saImportModal = document.getElementById('sa-modal-import-roster');
document.getElementById('sa-btn-open-roster-import')?.addEventListener('click', () => {
  const mInput = document.getElementById('sa-import-roster-month');
  if (mInput) mInput.value = saRosterState.month || document.getElementById('sa-roster-month-input')?.value || '';
  const fb = document.getElementById('sa-import-roster-feedback');
  if (fb) fb.classList.add('hidden');
  document.getElementById('sa-form-import-roster')?.reset();
  if (mInput) mInput.value = saRosterState.month || document.getElementById('sa-roster-month-input')?.value || '';
  if (saImportModal) {
    saImportModal.classList.remove('hidden');
    saImportModal.classList.add('flex');
  }
});

function closeSAImportModal() {
  if (saImportModal) {
    saImportModal.classList.add('hidden');
    saImportModal.classList.remove('flex');
  }
}

document.getElementById('sa-btn-close-import-modal')?.addEventListener('click', closeSAImportModal);
document.getElementById('sa-btn-cancel-import')?.addEventListener('click', closeSAImportModal);

document.getElementById('sa-form-import-roster')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('sa-import-roster-file');
  const monthInput = document.getElementById('sa-import-roster-month');
  const feedback = document.getElementById('sa-import-roster-feedback');
  const btnSubmit = document.getElementById('sa-btn-submit-import');

  if (!fileInput.files || fileInput.files.length === 0) {
    showAlert('Pilih file Excel terlebih dahulu.');
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

    if (!data.success) throw new Error(data.message || 'Gagal mengimpor file.');

    if (feedback) {
      feedback.className = 'text-xs p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200';
      feedback.innerHTML = `<strong>Berhasil!</strong> ${escapeHtml(data.message)}`;
      if (data.unrecognizedNames && data.unrecognizedNames.length > 0) {
        feedback.innerHTML += `<div class="mt-1 text-[11px] text-amber-700">Nama tidak dikenali: ${data.unrecognizedNames.map(escapeHtml).join(', ')}</div>`;
      }
    }

    showAlert('Import jadwal roster berhasil!', 'success');
    saRosterState.month = monthInput.value;
    const mainMInput = document.getElementById('sa-roster-month-input');
    if (mainMInput) mainMInput.value = monthInput.value;

    await loadSARosterMatrix(true);

    setTimeout(() => {
      closeSAImportModal();
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Unggah & Terapkan';
    }, 1800);
  } catch (err) {
    console.error('Superadmin import error:', err);
    if (feedback) {
      feedback.className = 'text-xs p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200';
      feedback.textContent = err.message;
    }
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Unggah & Terapkan';
    showAlert(err.message);
  }
});
