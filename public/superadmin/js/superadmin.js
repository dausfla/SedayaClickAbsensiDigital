// public/superadmin/js/superadmin.js
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, apiDownload } from '../../js/api.js';

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
const navPanels = { dashboard: 'panel-dashboard', users: 'panel-users', submissions: 'panel-submissions', master: 'panel-master', reports: 'panel-reports' };
navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll(`[data-nav="${btn.dataset.nav}"]`).forEach((b) => b.classList.add('active'));
    document.querySelectorAll(`.nav-btn:not([data-nav="${btn.dataset.nav}"])`).forEach((b) => b.classList.remove('active'));
    Object.entries(navPanels).forEach(([key, id]) => {
      document.getElementById(id).classList.toggle('hidden', key !== btn.dataset.nav);
    });
    if (btn.dataset.nav === 'dashboard') loadDashboard();
    if (btn.dataset.nav === 'users') loadUsers('pending');
    if (btn.dataset.nav === 'submissions') loadSubmissionsNav();
    if (btn.dataset.nav === 'master') { loadDivisions(); loadPositions(); loadShifts(); }
    if (btn.dataset.nav === 'reports') loadReport();
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

    const ctx = document.getElementById('chart-attendance').getContext('2d');
    if (attendanceChart) attendanceChart.destroy();
    attendanceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Tepat Waktu', data: onTimeData, backgroundColor: '#10b981', borderRadius: 8 },
          { label: 'Terlambat', data: lateData, backgroundColor: '#f59e0b', borderRadius: 8 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 12 }, color: textColor } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor } },
          y: { beginAtZero: true, ticks: { precision: 0, color: textColor }, grid: { color: gridColor } }
        }
      }
    });
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
document.querySelectorAll('[data-userstab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-userstab]').forEach((b) => b.classList.remove('active', 'text-slate-500'));
    btn.classList.add('active');
    currentUsersTab = btn.dataset.userstab;
    loadUsers(currentUsersTab);
  });
});

async function loadUsers(status) {
  const container = document.getElementById('users-list');
  container.innerHTML = 'Memuat...';
  try {
    const { users } = await apiGet('/superadmin/users', { status });
    if (users.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-center py-6 bg-white rounded-2xl border border-slate-200">Tidak ada data.</p>';
      return;
    }
    container.innerHTML = users.map((u) => `
      <div class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="font-semibold text-slate-800">${u.full_name} <span class="text-xs font-normal text-slate-400">(${u.role})</span></p>
          <p class="text-xs text-slate-500">${u.email} · ${u.division_name || '-'} · ${u.position_name || '-'}</p>
          <p class="text-xs text-slate-400">${u.whatsapp || ''}</p>
        </div>
        <div class="flex items-center gap-2">
          ${status === 'pending' ? `<button class="btn-activate bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors" data-id="${u.id}">Aktifkan</button>` : ''}
          ${status === 'active' ? `<button class="btn-edit bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-3 py-2 transition-colors" data-user='${JSON.stringify(u)}'>Edit</button>
             <button class="btn-deactivate bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg px-3 py-2 transition-colors" data-id="${u.id}">Nonaktifkan</button>` : ''}
          ${status === 'inactive' ? `<button class="btn-reactivate bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors" data-id="${u.id}">Aktifkan Kembali</button>` : ''}
          <button class="btn-delete-user bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors flex items-center gap-1" data-id="${u.id}" data-name="${u.full_name}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            Hapus
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-activate').forEach((b) => b.addEventListener('click', () => activateUser(b.dataset.id)));
    container.querySelectorAll('.btn-reactivate').forEach((b) => b.addEventListener('click', () => setUserStatus(b.dataset.id, 'active')));
    container.querySelectorAll('.btn-deactivate').forEach((b) => b.addEventListener('click', () => setUserStatus(b.dataset.id, 'inactive')));
    container.querySelectorAll('.btn-delete-user').forEach((b) => b.addEventListener('click', () => deleteUser(b.dataset.id, b.dataset.name)));
    container.querySelectorAll('.btn-edit').forEach((b) => b.addEventListener('click', () => openUserModal(JSON.parse(b.dataset.user))));
  } catch (err) {
    container.innerHTML = `<p class="text-red-500 text-center py-4">${err.message}</p>`;
  }
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
  document.getElementById('user-division').innerHTML = '<option value="">Divisi</option>' + divisions.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
  document.getElementById('user-position').innerHTML = '<option value="">Jabatan</option>' + positions.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('user-shift').innerHTML = '<option value="">Shift</option>' + shifts.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
}

document.getElementById('btn-open-create-user').addEventListener('click', async () => {
  await loadUserFormOptions();
  openUserModal(null);
});

function openUserModal(user) {
  document.getElementById('form-user').reset();
  document.getElementById('user-modal-title').textContent = user ? 'Edit User' : 'Buat User Baru';
  document.getElementById('user-id').value = user ? user.id : '';
  document.getElementById('user-password').placeholder = user ? 'Password (kosongkan jika tidak diubah)' : 'Password';
  if (user) {
    document.getElementById('user-full-name').value = user.full_name;
    document.getElementById('user-email').value = user.email;
    document.getElementById('user-email').disabled = true;
    document.getElementById('user-role').value = user.role;
    document.getElementById('user-division').value = user.division_id || '';
    document.getElementById('user-position').value = user.position_id || '';
    document.getElementById('user-shift').value = user.shift_id || '';
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
      <span class="text-sm text-slate-700">${d.name}</span>
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
      <span class="text-sm text-slate-700">${p.name}</span>
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
      <span class="text-sm text-slate-700">${s.name} · ${s.start_time} - ${s.end_time} (toleransi ${s.tolerance_minutes} menit)</span>
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
        <td class="px-4 py-3 text-center">
          <button class="btn-detail bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs px-3 py-1.5 rounded" data-id="${r.id || r.attendance_id}">Lihat Detail</button>
        </td>
      </tr>
    `).join('');

    // Add event listeners to detail buttons
    tbody.querySelectorAll('.btn-detail').forEach((btn) => {
      btn.addEventListener('click', () => openDetailModal(btn.dataset.id));
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

    // Times
    document.getElementById('detail-time-in').textContent = data.clock_in_time || '-';
    document.getElementById('detail-time-out').textContent = data.clock_out_time || '-';

    // Durations
    document.getElementById('detail-work-duration').textContent = data.work_duration_hms || '-';
    document.getElementById('detail-late-duration').textContent = data.late_duration_hms || '-';
    document.getElementById('detail-overtime').textContent = data.overtime_hms || '-';

    // Photos
    const clockInPhotoUrl = data.clock_in_photo ? `${data.clock_in_photo}` : '/assets/default/default-photo.png';
    const clockOutPhotoUrl = data.clock_out_photo ? `${data.clock_out_photo}` : '/assets/default/default-photo.png';
    const clockInImg = document.getElementById('detail-clock-in-photo');
    const clockOutImg = document.getElementById('detail-clock-out-photo');
    clockInImg.src = clockInPhotoUrl;
    clockOutImg.src = clockOutPhotoUrl;
    // Set time overlay on photos
    document.getElementById('detail-clock-in-time').textContent = data.clock_in_time ? data.clock_in_time.slice(0, 5) : '';
    document.getElementById('detail-clock-out-time').textContent = data.clock_out_time ? data.clock_out_time.slice(0, 5) : '';

    // Notes
    document.getElementById('detail-clock-in-note').textContent = data.clock_in_note || '-';
    document.getElementById('detail-clock-out-note').textContent = data.clock_out_note || '-';

    // Location links
    if (data.clock_in_lat && data.clock_in_lng) {
      document.getElementById('detail-clock-in-map').href = `https://www.google.com/maps?q=${data.clock_in_lat},${data.clock_in_lng}`;
      document.getElementById('detail-clock-in-map').classList.remove('hidden');
    } else {
      document.getElementById('detail-clock-in-map').href = '#';
      document.getElementById('detail-clock-in-map').classList.add('hidden');
    }
    if (data.clock_out_lat && data.clock_out_lng) {
      document.getElementById('detail-clock-out-map').href = `https://www.google.com/maps?q=${data.clock_out_lat},${data.clock_out_lng}`;
      document.getElementById('detail-clock-out-map').classList.remove('hidden');
    } else {
      document.getElementById('detail-clock-out-map').href = '#';
      document.getElementById('detail-clock-out-map').classList.add('hidden');
    }

    // Status
    const statusEl = document.getElementById('detail-status');
    statusEl.textContent = data.status_display;
    // Set status color
    statusEl.className = 'font-semibold text-lg';
    if (data.status_display === 'Tepat Waktu') statusEl.classList.add('text-green-600');
    else if (data.status_display === 'Terlambat') statusEl.classList.add('text-amber-600');
    else statusEl.classList.add('text-slate-500');

    // Show modal
    detailModal.classList.remove('hidden');

    // Add click listeners to photos for lightbox
    clockInImg.addEventListener('click', () => openLightbox(clockInPhotoUrl));
    clockOutImg.addEventListener('click', () => openLightbox(clockOutPhotoUrl));
  } catch (err) {
    showAlert(err.message);
  }
}

// Lightbox functions
function openLightbox(imageUrl) {
  lightboxImage.src = imageUrl;
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
const TYPE_LABEL = { izin: 'Izin', cuti: 'Cuti', sakit: 'Sakit' };
const STATUS_STYLE = { approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' };
const STATUS_LABEL = { approved: 'Disetujui', rejected: 'Ditolak' };

async function loadSubmissionsNav() {
  if (!submissionsDivisionsLoaded) {
    try {
      const { divisions } = await apiGet('/superadmin/divisions');
      const select = document.getElementById('submission-division-filter');
      select.innerHTML = '<option value="">Semua Divisi</option>' + divisions.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
      submissionsDivisionsLoaded = true;
    } catch (e) {
      console.error(e);
    }
  }
  loadSubmissionsData();
}

document.getElementById('submission-division-filter').addEventListener('change', () => {
  loadSubmissionsData();
});

document.querySelectorAll('[data-submissionstab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-submissionstab]').forEach((b) => b.classList.remove('active', 'text-slate-500'));
    btn.classList.add('active');
    currentSubmissionsTab = btn.dataset.submissionstab;
    document.getElementById('submission-pending-list').classList.toggle('hidden', currentSubmissionsTab !== 'pending');
    document.getElementById('submission-history-list').classList.toggle('hidden', currentSubmissionsTab !== 'history');
    loadSubmissionsData();
  });
});

function loadSubmissionsData() {
  if (currentSubmissionsTab === 'pending') {
    loadSubmissionsPending();
  } else {
    loadSubmissionsHistory();
  }
}

async function loadSubmissionsPending() {
  const container = document.getElementById('submission-pending-list');
  container.innerHTML = 'Memuat...';
  const divisionId = document.getElementById('submission-division-filter').value;
  const params = {};
  if (divisionId) params.division_id = divisionId;

  try {
    const { submissions } = await apiGet('/admin/submissions/pending', params);
    if (submissions.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-center py-6 bg-white rounded-2xl border border-slate-200">Tidak ada pengajuan yang menunggu persetujuan.</p>';
      return;
    }
    container.innerHTML = submissions.map((s) => `
      <div class="bg-white rounded-2xl border border-slate-200 p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="font-semibold text-slate-800">${s.full_name} <span class="text-xs font-normal text-slate-400">(${s.division_name || '-'})</span></span>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">${TYPE_LABEL[s.type] || s.type}</span>
        </div>
        <p class="text-xs text-slate-400 mb-2">${s.position_name || '-'} · ${s.start_date} s/d ${s.end_date}</p>
        <p class="text-sm text-slate-600 mb-3">${s.reason}</p>
        ${s.attachment ? `<a href="${s.attachment}" target="_blank" class="text-xs text-brand-600 underline mb-3 inline-block">Lihat lampiran</a><br/>` : ''}
        <div class="flex gap-2">
          <button class="btn-sub-approve flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg py-2 transition-colors" data-id="${s.id}" data-name="${s.full_name}">Setujui</button>
          <button class="btn-sub-reject flex-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg py-2 transition-colors" data-id="${s.id}" data-name="${s.full_name}">Tolak</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-sub-approve').forEach((b) => b.addEventListener('click', () => openDecisionModal(b.dataset.id, b.dataset.name, 'approved')));
    container.querySelectorAll('.btn-sub-reject').forEach((b) => b.addEventListener('click', () => openDecisionModal(b.dataset.id, b.dataset.name, 'rejected')));
  } catch (err) {
    container.innerHTML = `<p class="text-red-500 text-center py-4">${err.message}</p>`;
  }
}

async function loadSubmissionsHistory() {
  const container = document.getElementById('submission-history-list');
  container.innerHTML = 'Memuat...';
  const divisionId = document.getElementById('submission-division-filter').value;
  const params = {};
  if (divisionId) params.division_id = divisionId;

  try {
    const { submissions } = await apiGet('/admin/submissions/history', params);
    if (submissions.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-center py-6 bg-white rounded-2xl border border-slate-200">Belum ada riwayat pengajuan.</p>';
      return;
    }
    container.innerHTML = submissions.map((s) => `
      <div class="bg-white rounded-2xl border border-slate-200 p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="font-semibold text-slate-800">${s.full_name} <span class="text-xs font-normal text-slate-400">(${s.division_name || '-'})</span></span>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-700'}">${STATUS_LABEL[s.status] || s.status}</span>
        </div>
        <p class="text-xs text-slate-400 mb-1">${TYPE_LABEL[s.type] || s.type} · ${s.start_date} s/d ${s.end_date}</p>
        ${s.review_note ? `<p class="text-xs text-slate-500 italic">Catatan: ${s.review_note}</p>` : ''}
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="text-red-500 text-center py-4">${err.message}</p>`;
  }
}

/* Modal Decision */
const decisionModal = document.getElementById('decision-modal');
const decisionNote = document.getElementById('decision-note');
let activeDecision = null;

function openDecisionModal(id, name, decision) {
  activeDecision = { id, decision };
  decisionNote.value = '';
  document.getElementById('decision-title').textContent = `${decision === 'approved' ? 'Setujui' : 'Tolak'} pengajuan ${name}`;
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
    const result = await apiPatch(`/admin/submissions/${activeDecision.id}/decision`, {
      decision: activeDecision.decision,
      review_note: decisionNote.value.trim()
    });
    decisionModal.classList.add('hidden');
    showAlert(result.message, 'success');
    loadSubmissionsData();
  } catch (err) {
    showAlert(err.message);
  }
});

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

function updateThemeUI(isDark) {
  const icon = isDark ? '☀️' : '🌙';
  const text = isDark ? 'Mode Terang' : 'Mode Gelap';

  const iconEl = document.getElementById('theme-toggle-icon');
  const textEl = document.getElementById('theme-toggle-text');
  const iconMobEl = document.getElementById('theme-toggle-icon-mobile');

  if (iconEl) iconEl.textContent = icon;
  if (textEl) textEl.textContent = text;
  if (iconMobEl) iconMobEl.textContent = icon;
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

initSidebar();