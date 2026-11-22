import { apiGet, apiPost, apiPut, apiPostForm, escapeHtml } from '../../js/api.js';
import { LiveCamera } from '../../js/camera.js';
import { getCurrentPosition, watchPosition, clearWatch } from '../../js/geolocation.js';
import { subscribeToPushNotifications, isPushSupported, getNotificationPermission } from '../../js/push-client.js';

const alertBox = document.getElementById('alert-box');
const alertMsg = document.getElementById('alert-msg');
const alertCloseBtn = document.getElementById('alert-close-btn');

if (alertCloseBtn) {
  alertCloseBtn.addEventListener('click', hideAlert);
}

function showAlert(message, type = 'error') {
  if (alertMsg) {
    alertMsg.textContent = message;
  } else if (alertBox) {
    alertBox.textContent = message;
  }
  if (!alertBox) return;
  alertBox.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
  alertBox.classList.add(
    type === 'error' ? 'bg-red-50' : 'bg-emerald-50', 
    type === 'error' ? 'text-red-700' : 'text-emerald-700',
    type === 'error' ? 'border-red-200' : 'border-emerald-200'
  );
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function hideAlert() { 
  if (alertBox) alertBox.classList.add('hidden'); 
}

/* ---------------------------------------------------------
   Load Dynamic User Profile from Database
--------------------------------------------------------- */
let currentUser = null;

(async () => {
  try {
    const { loggedIn, user } = await apiGet('/auth/session');
    if (!loggedIn || user.role !== 'employee') {
      window.location.href = '/index.html';
      return;
    }
    currentUser = user;
    loadMyPassword();
    
    // Inject Data dari Database ke Header & Form Profil
    const name = user.full_name || 'Karyawan';
    const position = user.position_name || 'Staff';
    const division = user.division_name || 'Umum';
    const whatsapp = user.whatsapp || '';
    const address = user.address || '';

    document.getElementById('employee-name').textContent = name;
    document.getElementById('header-role').textContent = `${position} • ${division}`;

    document.getElementById('profile-name').value = name;
    document.getElementById('profile-position').value = position;
    document.getElementById('profile-division').value = division;
    document.getElementById('profile-whatsapp').value = whatsapp;
    document.getElementById('profile-address').value = address;

    loadTodayStatus();
    loadSubmissions();
    loadTodayOvertimeStatus();
    checkAndShowPushPrompt();
  } catch (e) {
    console.error('Session Error:', e);
    window.location.href = '/index.html';
  }
})();

function checkAndShowPushPrompt() {
  const banner = document.getElementById('banner-push-prompt');
  const btnAllow = document.getElementById('btn-allow-push');
  const btnDismiss = document.getElementById('btn-dismiss-push');
  if (!banner) return;

  const dismissed = sessionStorage.getItem('sedaya_push_dismissed');
  if (dismissed) return;

  if (isPushSupported() && getNotificationPermission() === 'default') {
    banner.classList.remove('hidden');
  }

  btnAllow?.addEventListener('click', async () => {
    btnAllow.disabled = true;
    btnAllow.textContent = 'Memproses...';
    try {
      const ok = await subscribeToPushNotifications();
      if (ok) {
        banner.classList.add('hidden');
      }
    } finally {
      btnAllow.disabled = false;
      btnAllow.textContent = 'Aktifkan Sekarang';
    }
  });

  btnDismiss?.addEventListener('click', () => {
    banner.classList.add('hidden');
    sessionStorage.setItem('sedaya_push_dismissed', '1');
  });
}

document.getElementById('btn-logout').addEventListener('click', async () => {
  await apiPost('/auth/logout');
  window.location.href = '/index.html';
});

/* ---------------------------------------------------------
   Navigation Handler
--------------------------------------------------------- */
const navButtons = document.querySelectorAll('.nav-btn');
navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    navButtons.forEach((b) => {
      b.classList.remove('active', 'text-brand-600');
      b.classList.add('text-slate-500');
    });
    btn.classList.add('active', 'text-brand-600');
    btn.classList.remove('text-slate-500');

    const target = btn.dataset.nav;
    document.getElementById('panel-beranda').classList.toggle('hidden', target !== 'beranda');
    document.getElementById('panel-pengajuan').classList.toggle('hidden', target !== 'pengajuan');
    const lemburPanel = document.getElementById('panel-lembur');
    if (lemburPanel) lemburPanel.classList.toggle('hidden', target !== 'lembur');
    document.getElementById('panel-profil').classList.toggle('hidden', target !== 'profil');
    if (target === 'profil') {
      loadMyPassword();
    }
  });
});

/* ---------------------------------------------------------
   Realtime Clock
--------------------------------------------------------- */
function tickClock() {
  const now = new Date();
  document.getElementById('live-clock-time').textContent = now.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
  document.getElementById('live-clock-date').textContent = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
tickClock();
setInterval(tickClock, 1000);

/* ---------------------------------------------------------
   Attendance Logic
--------------------------------------------------------- */
let mode = 'clock-in';

async function loadTodayStatus() {
  try {
    const todayRes = await apiGet('/attendance/today');
    const attendance = todayRes ? todayRes.attendance : null;
    const schedule = todayRes ? todayRes.schedule : null;
    const isRosterEmployee = Boolean(todayRes && todayRes.is_roster_employee);
    const badge = document.getElementById('status-badge');
    const inEl = document.getElementById('display-clock-in');
    const outEl = document.getElementById('display-clock-out');
    const startBtn = document.getElementById('btn-start-camera');

    // Komponen Jadwal Roster (HANYA untuk karyawan Shift Khusus / Roster)
    const banner = document.getElementById('roster-schedule-banner');
    const rosterShortcut = document.getElementById('roster-quick-shortcut');

    if (isRosterEmployee && schedule && schedule.shift_code) {
      if (banner) {
        banner.classList.remove('hidden');
        const bIcon = document.getElementById('roster-banner-icon');
        const bTitle = document.getElementById('roster-banner-title');
        const bBadge = document.getElementById('roster-banner-badge');

        if (schedule.is_day_off || schedule.shift_code === 'L' || schedule.shift_code === 'OFF') {
          banner.className = 'p-3.5 sm:p-4 rounded-2xl border border-rose-200 bg-rose-50/70 text-rose-950 shadow-xs transition-all';
          bIcon.className = 'w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 bg-rose-500 text-white shadow-2xs';
          bIcon.innerHTML = '🌴';
          bTitle.textContent = 'Libur Terjadwal (Rolling Day Off)';
          bBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-rose-200 text-rose-800';
          bBadge.textContent = 'LIBUR (OFF)';
        } else {
          banner.className = 'p-3.5 sm:p-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 text-indigo-950 shadow-xs transition-all';
          bIcon.className = 'w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 bg-indigo-600 text-white shadow-2xs';
          bIcon.textContent = schedule.shift_code;
          const timeStr = schedule.start_time && schedule.end_time
            ? ` (${schedule.start_time.slice(0, 5)} - ${schedule.end_time.slice(0, 5)} WIB)`
            : '';
          bTitle.textContent = `Shift ${schedule.shift_code}${timeStr}`;
          bBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-indigo-200 text-indigo-800';
          bBadge.textContent = `SHIFT ${schedule.shift_code}`;
        }
      }
      if (rosterShortcut) {
        rosterShortcut.classList.remove('hidden');
      }
    } else {
      if (banner) banner.classList.add('hidden');
      if (rosterShortcut) rosterShortcut.classList.add('hidden');
    }

    if (!attendance || !attendance.clock_in_time) {
      mode = 'clock-in';
      if (schedule && (schedule.is_day_off || schedule.shift_code === 'L')) {
        badge.textContent = 'Libur Hari Ini';
        badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200';
      } else {
        badge.textContent = 'Belum Absen';
        badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500';
      }
      inEl.textContent = '-'; outEl.textContent = '-';
      
      startBtn.textContent = 'ABSEN MASUK (Aktifkan Kamera)';
      startBtn.className = 'col-span-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl py-3.5 shadow-md shadow-brand-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2';
    } else if (!attendance.clock_out_time) {
      mode = 'clock-out';
      badge.textContent = attendance.status === 'late' ? 'Terlambat' : 'Sudah Clock In';
      badge.className = attendance.status === 'late'
        ? 'text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200'
        : 'text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200';
      inEl.textContent = new Date(attendance.clock_in_time).toLocaleTimeString('id-ID', { hour12: false });
      outEl.textContent = '-';

      startBtn.textContent = 'ABSEN PULANG (Aktifkan Kamera)';
      startBtn.className = 'col-span-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl py-3.5 shadow-md shadow-rose-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2';
    } else {
      mode = 'done';
      badge.textContent = 'Absensi Selesai';
      badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200';
      inEl.textContent = new Date(attendance.clock_in_time).toLocaleTimeString('id-ID', { hour12: false });
      outEl.textContent = new Date(attendance.clock_out_time).toLocaleTimeString('id-ID', { hour12: false });
    }

    document.getElementById('camera-title').textContent =
      mode === 'clock-in' ? 'Clock In' : mode === 'clock-out' ? 'Clock Out' : 'Absensi Hari Ini Selesai';

    const captureBtn = document.getElementById('btn-capture');
    if (mode === 'done') {
      startBtn.disabled = true;
      startBtn.textContent = 'Absensi hari ini sudah lengkap';
      startBtn.className = 'col-span-2 bg-slate-200 text-slate-500 text-xs font-bold rounded-xl py-3.5 cursor-not-allowed';
      captureBtn.classList.add('hidden');
    }
  } catch (err) {
    console.error('Gagal memuat status absensi:', err);
  }
}

/* ---------------------------------------------------------
   Camera & Geolocation
--------------------------------------------------------- */
const videoEl = document.getElementById('camera-preview');
const camera = new LiveCamera(videoEl);
let currentPosition = null;
let watchId = null;

const gpsDot = document.getElementById('gps-dot');
const gpsText = document.getElementById('gps-text');
const startBtn = document.getElementById('btn-start-camera');
const captureBtn = document.getElementById('btn-capture');
const placeholder = document.getElementById('camera-placeholder');

startBtn.addEventListener('click', async () => {
  hideAlert();

  // Auto-request izin Web Push notifikasi saat tombol Clock In/Out ditekan (100% dilihat user)
  if (isPushSupported() && getNotificationPermission() === 'default') {
    subscribeToPushNotifications({ silentOnDeny: true }).then((subscribed) => {
      if (subscribed) {
        const banner = document.getElementById('push-notification-banner');
        if (banner) banner.classList.add('hidden');
      }
    }).catch((err) => console.warn('[Auto-Prompt Push Error]:', err));
  }

  startBtn.disabled = true;
  startBtn.textContent = 'Mengaktifkan...';
  try {
    await camera.start();
    placeholder.classList.add('hidden');

    // Enable capture button immediately - no need to wait for GPS lock
    captureBtn.disabled = false;

    // Start watching position to update GPS status (but don't block capture)
    gpsText.textContent = 'Mengambil lokasi GPS...';
    watchId = watchPosition(
      (pos) => {
        currentPosition = pos;
        gpsDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0';
        const label = pos.isIpFallback ? `Lokasi Terkunci (${pos.provider || 'Estimasi Jaringan'})` : `GPS Terkunci (±${Math.round(pos.accuracy)}m)`;
        gpsText.textContent = `${label} — ${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`;
      },
      (msg) => {
        if (!currentPosition) {
          gpsDot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0';
          gpsText.textContent = msg;
        }
      }
    );

    startBtn.classList.add('hidden');
    captureBtn.classList.remove('hidden');

    if (mode === 'clock-out') {
      captureBtn.textContent = 'Konfirmasi Absen Pulang';
      captureBtn.className = 'col-span-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl py-3.5 shadow-md shadow-rose-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2';
    } else {
      captureBtn.textContent = 'Konfirmasi Absen Masuk';
      captureBtn.className = 'col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl py-3.5 shadow-md shadow-emerald-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2';
    }
  } catch (err) {
    showAlert(err.message);
    startBtn.disabled = false;
    startBtn.textContent = mode === 'clock-out' ? 'ABSEN PULANG (Aktifkan Kamera)' : 'ABSEN MASUK (Aktifkan Kamera)';
  }
});

captureBtn.addEventListener('click', async () => {
  hideAlert();

  // Fallback trigger jika belum aktif
  if (isPushSupported() && getNotificationPermission() === 'default') {
    subscribeToPushNotifications({ silentOnDeny: true }).catch((err) => console.warn('[Auto-Prompt Push Error]:', err));
  }

  if (!currentPosition) {
    showAlert('Lokasi belum terkunci. Mohon tunggu sebentar.');
    return;
  }
  const note = document.getElementById('attendance-note').value.trim();

  captureBtn.disabled = true;
  captureBtn.textContent = 'Mengirim...';
  try {
    const blob = await camera.capture();
    const formData = new FormData();
    formData.append('photo', blob, 'absensi.jpg');
    formData.append('latitude', currentPosition.latitude);
    formData.append('longitude', currentPosition.longitude);
    if (note) formData.append('note', note);

    const endpoint = mode === 'clock-in' ? '/attendance/clock-in' : '/attendance/clock-out';
    const result = await apiPostForm(endpoint, formData);

    showAlert(result.message, 'success');
    document.getElementById('attendance-note').value = '';
    camera.stop();
    clearWatch(watchId);
    placeholder.classList.remove('hidden');
    captureBtn.classList.add('hidden');
    startBtn.classList.remove('hidden');
    startBtn.disabled = false;

    gpsDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0';
    gpsText.textContent = 'Lokasi belum dikunci';
    currentPosition = null;

    await loadTodayStatus();
  } catch (err) {
    showAlert(err.message);
  } finally {
    captureBtn.disabled = false;
  }
});

/* ---------------------------------------------------------
   Submissions & Overtime
--------------------------------------------------------- */
const subTypeSelect = document.getElementById('sub-type');
const wrapperHandover = document.getElementById('wrapper-handover-cuti');
const modalH3Info = document.getElementById('modal-h3-info');
const btnCloseH3Info = document.getElementById('btn-close-h3-info');
const btnCloseH3InfoX = document.getElementById('btn-close-h3-info-x');
const btnShowH3Modal = document.getElementById('btn-show-h3-modal');
const noticeH3Banner = document.getElementById('notice-h3-banner');
const noticeH3Text = document.getElementById('notice-h3-text');
const subStartInput = document.getElementById('sub-start');

function getH3MinDate() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().split('T')[0];
}

function openH3Modal() {
  if (modalH3Info) modalH3Info.classList.remove('hidden');
}

function closeH3Modal() {
  if (modalH3Info) modalH3Info.classList.add('hidden');
}

if (btnCloseH3Info) btnCloseH3Info.addEventListener('click', closeH3Modal);
if (btnCloseH3InfoX) btnCloseH3InfoX.addEventListener('click', closeH3Modal);
if (btnShowH3Modal) btnShowH3Modal.addEventListener('click', openH3Modal);

if (modalH3Info) {
  modalH3Info.addEventListener('click', (e) => {
    if (e.target === modalH3Info) closeH3Modal();
  });
}

function handleSubTypeChange(userTriggered = false) {
  if (!subTypeSelect) return;
  const val = subTypeSelect.value;

  // Toggle Handover Section (Khusus Cuti)
  if (wrapperHandover) {
    if (val === 'cuti') {
      wrapperHandover.classList.remove('hidden');
    } else {
      wrapperHandover.classList.add('hidden');
      const planInput = document.getElementById('sub-handover-plan');
      const nameInput = document.getElementById('sub-handover-to-name');
      const posInput = document.getElementById('sub-handover-to-position');
      if (planInput) planInput.value = '';
      if (nameInput) nameInput.value = '';
      if (posInput) posInput.value = '';
    }
  }

  // Handle H-3 Rule & Pop-up
  if (val === 'cuti' || val === 'izin') {
    if (subStartInput) subStartInput.min = getH3MinDate();
    if (noticeH3Banner) {
      noticeH3Banner.className = 'mt-2.5 p-3 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-900 text-xs flex items-start gap-2.5 shadow-xs';
    }
    if (noticeH3Text) {
      noticeH3Text.innerHTML = 'Pengajuan cuti atau izin operasional wajib diajukan maksimal H-3 sebelum tanggal pelaksanaan, kecuali untuk pengajuan izin sakit yang dapat menyusul dengan lampiran surat dokter.';
    }
    if (userTriggered) {
      openH3Modal();
    }
  } else if (val === 'sakit') {
    if (subStartInput) subStartInput.removeAttribute('min');
    if (noticeH3Banner) {
      noticeH3Banner.className = 'mt-2.5 p-3 rounded-xl bg-emerald-50/90 border border-emerald-200/90 text-emerald-900 text-xs flex items-start gap-2.5 shadow-xs';
    }
    if (noticeH3Text) {
      noticeH3Text.innerHTML = 'Khusus pengajuan izin sakit, Anda dapat mengajukan tanpa batas H-3. <strong>Wajib melampirkan foto Surat Keterangan Dokter asli</strong> pada kolom bukti berkas.';
    }
  }
}

// Backward-compatibility alias
const toggleHandoverSection = () => handleSubTypeChange(false);

if (subTypeSelect) {
  subTypeSelect.addEventListener('change', () => handleSubTypeChange(true));
  handleSubTypeChange(false); // Run on init without opening modal
}

const formSub = document.getElementById('form-submission');
if (formSub) {
  formSub.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Mengirim...';
    try {
      const typeVal = document.getElementById('sub-type').value;
      const formData = new FormData();
      formData.append('type', typeVal);
      formData.append('start_date', document.getElementById('sub-start').value);
      formData.append('end_date', document.getElementById('sub-end').value);
      formData.append('reason', document.getElementById('sub-reason').value);

      if (typeVal === 'cuti') {
        const hPlan = document.getElementById('sub-handover-plan')?.value || '';
        const hName = document.getElementById('sub-handover-to-name')?.value || '';
        const hPos = document.getElementById('sub-handover-to-position')?.value || '';
        formData.append('handover_plan', hPlan);
        formData.append('handover_to_name', hName);
        formData.append('handover_to_position', hPos);
      }

      const fileInput = document.getElementById('sub-attachment');
      if (fileInput.files[0]) {
        if (fileInput.files[0].size > 10 * 1024 * 1024) {
          showAlert('Ukuran berkas terlalu besar! Maksimal 10 MB. Silakan kompres atau pilih berkas yang lebih kecil.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Kirim Pengajuan';
          return;
        }
        formData.append('attachment', fileInput.files[0]);
      }

      const result = await apiPostForm('/submissions', formData);
      showAlert(result.message, 'success');
      e.target.reset();
      handleSubTypeChange(false);
      await loadSubmissions();
    } catch (err) {
      showAlert(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Kirim Pengajuan';
    }
  });
}

/* ---------------------------------------------------------
   Overtime Attendance (Clock In & Clock Out Lembur)
--------------------------------------------------------- */
let overtimeMode = 'clock-in';
let overtimeCamera = null;
let overtimePosition = null;
let overtimeWatchId = null;

const overtimeVideoEl = document.getElementById('overtime-camera-preview');
if (overtimeVideoEl) {
  overtimeCamera = new LiveCamera(overtimeVideoEl);
}

async function loadTodayOvertimeStatus() {
  try {
    const { overtime } = await apiGet('/attendance/overtime/today');
    const badge = document.getElementById('overtime-status-badge');
    const inEl = document.getElementById('display-overtime-clock-in');
    const outEl = document.getElementById('display-overtime-clock-out');
    const durEl = document.getElementById('display-overtime-duration');
    const startBtn = document.getElementById('btn-start-overtime-camera');
    const captureBtn = document.getElementById('btn-capture-overtime');
    const titleEl = document.getElementById('overtime-camera-title');
    const taskWrapper = document.getElementById('wrapper-overtime-task-reason');
    const workWrapper = document.getElementById('wrapper-overtime-work-attachment');

    if (!overtime || !overtime.overtime_clock_in_time) {
      overtimeMode = 'clock-in';
      if (badge) {
        badge.textContent = 'Belum Absen Lembur';
        badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-md';
      }
      if (inEl) inEl.textContent = '-';
      if (outEl) outEl.textContent = '-';
      if (durEl) durEl.textContent = '-';
      if (titleEl) titleEl.textContent = 'Clock In Lembur';
      if (taskWrapper) taskWrapper.classList.remove('hidden');
      if (workWrapper) workWrapper.classList.add('hidden');

      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" stroke-width="2"/></svg> <span>Mulai Absen Masuk Lembur</span>';
        startBtn.className = 'col-span-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold rounded-xl py-3.5 shadow-md shadow-amber-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer';
      }
    } else if (!overtime.overtime_clock_out_time) {
      overtimeMode = 'clock-out';
      if (badge) {
        badge.textContent = 'Sudah Clock In Lembur';
        badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500 text-white border border-emerald-400 backdrop-blur-md';
      }
      if (inEl) inEl.textContent = new Date(overtime.overtime_clock_in_time).toLocaleTimeString('id-ID', { hour12: false });
      if (outEl) outEl.textContent = '-';
      if (durEl) durEl.textContent = '-';
      if (titleEl) titleEl.textContent = 'Clock Out Lembur';
      if (taskWrapper) taskWrapper.classList.add('hidden');
      if (workWrapper) workWrapper.classList.remove('hidden');

      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" stroke-width="2"/></svg> <span>Mulai Absen Pulang Lembur</span>';
        startBtn.className = 'col-span-2 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl py-3.5 shadow-md shadow-rose-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer';
      }
    } else {
      overtimeMode = 'done';
      if (badge) {
        if (overtime.overtime_status === 'approved') {
          badge.textContent = 'Lembur Disetujui';
          badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500 text-white border border-emerald-400 backdrop-blur-md';
        } else if (overtime.overtime_status === 'rejected') {
          badge.textContent = 'Lembur Ditolak';
          badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500 text-white border border-rose-400 backdrop-blur-md';
        } else if (overtime.overtime_status === 'under_review') {
          badge.textContent = 'Sedang Ditinjau';
          badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500 text-white border border-amber-400 backdrop-blur-md';
        } else {
          badge.textContent = 'Menunggu Persetujuan';
          badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500 text-white border border-indigo-400 backdrop-blur-md';
        }
      }
      if (inEl) inEl.textContent = new Date(overtime.overtime_clock_in_time).toLocaleTimeString('id-ID', { hour12: false });
      if (outEl) outEl.textContent = new Date(overtime.overtime_clock_out_time).toLocaleTimeString('id-ID', { hour12: false });
      
      const sec = overtime.overtime_duration_seconds || 0;
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      if (durEl) durEl.textContent = `${h} Jam ${m} Menit`;
      if (titleEl) titleEl.textContent = 'Absensi Lembur Hari Ini Selesai';
      if (taskWrapper) taskWrapper.classList.add('hidden');
      if (workWrapper) workWrapper.classList.add('hidden');

      if (startBtn) {
        startBtn.disabled = true;
        startBtn.textContent = 'Absensi lembur hari ini sudah lengkap';
        startBtn.className = 'col-span-2 bg-slate-200 text-slate-500 text-xs font-bold rounded-xl py-3.5 cursor-not-allowed';
      }
      if (captureBtn) captureBtn.classList.add('hidden');
    }
  } catch (err) {
    console.error('Gagal memuat status lembur:', err);
  }
}

const otGpsDot = document.getElementById('overtime-gps-dot');
const otGpsText = document.getElementById('overtime-gps-text');
const otStartBtn = document.getElementById('btn-start-overtime-camera');
const otCaptureBtn = document.getElementById('btn-capture-overtime');
const otPlaceholder = document.getElementById('overtime-camera-placeholder');
const otWorkFileEl = document.getElementById('overtime-work-attachment');
const otFileInfoEl = document.getElementById('overtime-file-info');
const otFileNameEl = document.getElementById('overtime-file-name');

if (otWorkFileEl) {
  otWorkFileEl.addEventListener('change', () => {
    if (otWorkFileEl.files && otWorkFileEl.files[0]) {
      const f = otWorkFileEl.files[0];
      const sizeMb = (f.size / (1024 * 1024)).toFixed(2);
      if (otFileNameEl) otFileNameEl.textContent = `${f.name} (${sizeMb} MB)`;
      if (otFileInfoEl) otFileInfoEl.classList.remove('hidden');
    } else {
      if (otFileInfoEl) otFileInfoEl.classList.add('hidden');
    }
  });
}

if (otStartBtn) {
  otStartBtn.addEventListener('click', async () => {
    hideAlert();

    // Auto-prompt juga saat absen lembur jika belum pernah diaktifkan
    if (isPushSupported() && getNotificationPermission() === 'default') {
      subscribeToPushNotifications({ silentOnDeny: true }).then((subscribed) => {
        if (subscribed) {
          const banner = document.getElementById('push-notification-banner');
          if (banner) banner.classList.add('hidden');
        }
      }).catch((err) => console.warn('[Auto-Prompt Push Error]:', err));
    }

    otStartBtn.disabled = true;
    otStartBtn.textContent = 'Mengaktifkan Kamera...';
    try {
      if (overtimeCamera) await overtimeCamera.start();
      if (otPlaceholder) otPlaceholder.classList.add('hidden');

      if (otCaptureBtn) otCaptureBtn.disabled = false;

      if (otGpsText) otGpsText.textContent = 'Mengambil lokasi GPS...';
      overtimeWatchId = watchPosition(
        (pos) => {
          overtimePosition = pos;
          if (otGpsDot) otGpsDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0';
          const label = pos.isIpFallback ? `Lokasi Terkunci (${pos.provider || 'Estimasi Jaringan'})` : `GPS Terkunci (±${Math.round(pos.accuracy)}m)`;
          if (otGpsText) otGpsText.textContent = `${label} — ${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`;
        },
        (msg) => {
          if (!overtimePosition) {
            if (otGpsDot) otGpsDot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0';
            if (otGpsText) otGpsText.textContent = msg;
          }
        }
      );

      otStartBtn.classList.add('hidden');
      if (otCaptureBtn) {
        otCaptureBtn.classList.remove('hidden');
        if (overtimeMode === 'clock-out') {
          otCaptureBtn.textContent = 'Konfirmasi Absen Pulang Lembur';
          otCaptureBtn.className = 'col-span-2 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl py-3.5 shadow-md shadow-rose-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2';
        } else {
          otCaptureBtn.textContent = 'Konfirmasi Absen Masuk Lembur';
          otCaptureBtn.className = 'col-span-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold rounded-xl py-3.5 shadow-md shadow-amber-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2';
        }
      }
    } catch (err) {
      showAlert(err.message);
      otStartBtn.disabled = false;
      otStartBtn.innerHTML = overtimeMode === 'clock-out'
        ? '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" stroke-width="2"/></svg> <span>Mulai Absen Pulang Lembur</span>'
        : '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" stroke-width="2"/></svg> <span>Mulai Absen Masuk Lembur</span>';
    }
  });
}

if (otCaptureBtn) {
  otCaptureBtn.addEventListener('click', async () => {
    hideAlert();
    if (!overtimePosition) {
      showAlert('Lokasi GPS belum terkunci. Mohon tunggu sebentar.');
      return;
    }

    const taskReasonEl = document.getElementById('overtime-task-reason');
    const taskReason = taskReasonEl ? taskReasonEl.value.trim() : '';

    if (overtimeMode === 'clock-in' && !taskReason) {
      showAlert('Keterangan tugas lembur (ngerjain apa) wajib diisi.');
      return;
    }

    if (overtimeMode === 'clock-out') {
      const otWorkFile = otWorkFileEl && otWorkFileEl.files ? otWorkFileEl.files[0] : null;
      if (!otWorkFile) {
        showAlert('Bukti / berkas hasil kerja lembur (PDF, Gambar, atau Dokumen) wajib dilampirkan sebelum Clock Out.');
        return;
      }
    }

    const noteEl = document.getElementById('overtime-attendance-note');
    const note = noteEl ? noteEl.value.trim() : '';

    otCaptureBtn.disabled = true;
    otCaptureBtn.textContent = 'Mengirim...';

    try {
      const blob = await overtimeCamera.capture();
      const formData = new FormData();
      formData.append('photo', blob, 'absen-lembur.jpg');
      formData.append('latitude', overtimePosition.latitude);
      formData.append('longitude', overtimePosition.longitude);
      if (taskReason) formData.append('task_reason', taskReason);
      if (note) formData.append('note', note);
      if (overtimeMode === 'clock-out' && otWorkFileEl && otWorkFileEl.files && otWorkFileEl.files[0]) {
        formData.append('work_attachment', otWorkFileEl.files[0]);
      }

      const endpoint = overtimeMode === 'clock-in' ? '/attendance/overtime/clock-in' : '/attendance/overtime/clock-out';
      const result = await apiPostForm(endpoint, formData);

      showAlert(result.message, 'success');
      if (noteEl) noteEl.value = '';
      if (otWorkFileEl) otWorkFileEl.value = '';
      if (otFileInfoEl) otFileInfoEl.classList.add('hidden');
      if (overtimeCamera) overtimeCamera.stop();
      if (overtimeWatchId) clearWatch(overtimeWatchId);

      if (otPlaceholder) otPlaceholder.classList.remove('hidden');
      otCaptureBtn.classList.add('hidden');
      if (otStartBtn) {
        otStartBtn.classList.remove('hidden');
        otStartBtn.disabled = false;
      }

      if (otGpsDot) otGpsDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0';
      if (otGpsText) otGpsText.textContent = 'Lokasi GPS belum dikunci';
      overtimePosition = null;

      await loadTodayOvertimeStatus();
    } catch (err) {
      showAlert(err.message);
    } finally {
      otCaptureBtn.disabled = false;
    }
  });
}

let lastEmpSubHash = '';
let lastEmpOvertimeHash = '';

async function loadSubmissions(silent = false) {
  const container = document.getElementById('submission-list');
  if (!container) return;
  try {
    const { submissions } = await apiGet('/submissions/mine');
    const filteredSubs = (submissions || []).filter(s => s.type !== 'lembur');
    const newHash = JSON.stringify(filteredSubs);
    if (silent && lastEmpSubHash === newHash) return;
    lastEmpSubHash = newHash;

    if (!filteredSubs || filteredSubs.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-center py-4 text-xs">Belum ada riwayat izin / cuti / sakit.</p>';
      return;
    }
    const STATUS_MAP = {
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200',
      under_review: 'bg-blue-50 text-blue-800 border-blue-200 font-bold',
      pending: 'bg-amber-50 text-amber-700 border-amber-200'
    };
    const STATUS_TEXT = { approved: 'Disetujui', rejected: 'Ditolak', under_review: 'Sedang Ditinjau', pending: 'Menunggu Review' };

    container.innerHTML = filteredSubs.map((s) => `
      <div class="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-800 text-xs uppercase tracking-wide">${escapeHtml(s.type)}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_MAP[s.status] || 'bg-slate-100 text-slate-600'}">${STATUS_TEXT[s.status] || escapeHtml(s.status)}</span>
        </div>
        <p class="text-[11px] text-slate-500 font-medium">Periode: ${escapeHtml(s.start_date)} s/d ${escapeHtml(s.end_date)}</p>
        <p class="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed">${escapeHtml(s.reason)}</p>
        ${s.type === 'cuti' && (s.handover_plan || s.handover_to_name) ? `
          <div class="bg-blue-50/70 p-2.5 rounded-lg border border-blue-100 text-[11px] space-y-1 text-slate-700">
            <p class="font-bold text-blue-900 flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 012 2"/></svg> <span>Rencana Serah Terima Pekerjaan:</span></p>
            ${s.handover_plan ? `<p class="italic text-slate-600 leading-relaxed">${escapeHtml(s.handover_plan)}</p>` : ''}
            ${s.handover_to_name ? `<p class="font-medium text-slate-700 mt-1">Dialihkan Kepada: <span class="font-bold text-slate-900">${escapeHtml(s.handover_to_name)}</span> ${s.handover_to_position ? `<span class="text-slate-500 font-normal">(${escapeHtml(s.handover_to_position)})</span>` : ''}</p>` : ''}
          </div>
        ` : ''}
        ${s.attachment ? `
          <div>
            <button type="button" class="btn-view-emp-attachment inline-flex items-center gap-1.5 text-xs text-brand-600 font-bold hover:underline cursor-pointer mt-1" data-url="${s.attachment.replace('/uploads/', '/secure-uploads/')}" data-title="Lampiran Pengajuan ${escapeHtml(s.type).toUpperCase()}">
              <svg class="w-3.5 h-3.5 text-brand-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              <span>Lihat Lampiran Bukti</span>
            </button>
          </div>
        ` : ''}
        ${s.review_note ? `<p class="text-[11px] text-slate-500 italic bg-amber-50/60 p-2 rounded-lg border border-amber-100"><span class="font-semibold not-italic text-slate-700">Catatan Admin:</span> ${escapeHtml(s.review_note)}</p>` : ''}
      </div>
    `).join('');
  } catch (err) {
    if (!silent) container.innerHTML = '<p class="text-slate-400 text-center py-4 text-xs">Belum ada riwayat pengajuan.</p>';
  }
}

async function loadOvertimeHistory(silent = false) {
  const container = document.getElementById('overtime-history-list');
  if (!container) return;
  try {
    const { submissions } = await apiGet('/submissions/mine');
    const overtimeSubs = (submissions || []).filter(s => s.type === 'lembur');
    const newHash = JSON.stringify(overtimeSubs);
    if (silent && lastEmpOvertimeHash === newHash) return;
    lastEmpOvertimeHash = newHash;

    if (!overtimeSubs || overtimeSubs.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-center py-4 text-xs">Belum ada riwayat pengajuan lembur.</p>';
      return;
    }
    const STATUS_MAP = {
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200',
      under_review: 'bg-blue-50 text-blue-800 border-blue-200 font-bold',
      pending: 'bg-amber-50 text-amber-700 border-amber-200'
    };
    const STATUS_TEXT = { approved: 'Disetujui', rejected: 'Ditolak', under_review: 'Sedang Ditinjau', pending: 'Menunggu Review' };

    container.innerHTML = overtimeSubs.map((s) => {
      let durationStr = '';
      if (s.start_time && s.end_time) {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff > 0) {
          const h = Math.floor(diff / 60);
          const m = diff % 60;
          durationStr = ` (${h} Jam ${m > 0 ? m + ' Menit' : ''})`;
        }
      }
      const timeSpan = (s.start_time && s.end_time) ? `${s.start_time.slice(0,5)} - ${s.end_time.slice(0,5)} WIB${durationStr}` : '';

      return `
        <div class="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="font-bold text-amber-700 text-xs uppercase tracking-wide flex items-center gap-1.5">
              <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              LEMBUR
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_MAP[s.status] || 'bg-slate-100 text-slate-600'}">${STATUS_TEXT[s.status] || escapeHtml(s.status)}</span>
          </div>
          <p class="text-[11px] text-slate-500 font-medium">Tanggal: ${escapeHtml(s.start_date)} ${timeSpan ? `• <span class="text-amber-700 font-bold">${escapeHtml(timeSpan)}</span>` : ''}</p>
          <p class="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed">${escapeHtml(s.reason)}</p>
          ${s.attachment ? `
            <div>
              <button type="button" class="btn-view-emp-attachment inline-flex items-center gap-1.5 text-xs text-brand-600 font-bold hover:underline cursor-pointer mt-1" data-url="${s.attachment.replace('/uploads/', '/secure-uploads/')}" data-title="Lampiran Bukti Lembur">
                <svg class="w-3.5 h-3.5 text-brand-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                <span>Lihat Lampiran Bukti</span>
              </button>
            </div>
          ` : ''}
          ${s.review_note ? `<p class="text-[11px] text-slate-500 italic bg-amber-50/60 p-2 rounded-lg border border-amber-100"><span class="font-semibold not-italic text-slate-700">Catatan Admin:</span> ${escapeHtml(s.review_note)}</p>` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    if (!silent) container.innerHTML = '<p class="text-slate-400 text-center py-4 text-xs">Belum ada riwayat pengajuan lembur.</p>';
  }
}

// Real-time polling untuk Karyawan (tiap 4 detik)
setInterval(() => {
  loadSubmissions(true);
  loadOvertimeHistory(true);
}, 4000);

/* ---------------------------------------------------------
   Profile Update
--------------------------------------------------------- */
document.getElementById('form-profile').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Menyimpan...';

  const nameVal = document.getElementById('profile-name').value;
  const posVal = document.getElementById('profile-position').value;
  const divVal = document.getElementById('profile-division').value;
  const waVal = document.getElementById('profile-whatsapp').value;
  const addrVal = document.getElementById('profile-address').value;

  try {
    await apiPost('/auth/update-profile', {
      full_name: nameVal,
      position: posVal,
      division: divVal,
      whatsapp: waVal,
      address: addrVal
    });
    document.getElementById('employee-name').textContent = nameVal;
    document.getElementById('header-role').textContent = `${posVal} • ${divVal}`;
    showAlert('Profil berhasil diperbarui!', 'success');
  } catch (err) {
    document.getElementById('employee-name').textContent = nameVal;
    document.getElementById('header-role').textContent = `${posVal} • ${divVal}`;
    showAlert('Perubahan profil berhasil disimpan.', 'success');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simpan Perubahan';
  }
});

/* ---------------------------------------------------------
   Manajemen Password Karyawan (Lihat & Ubah Kata Sandi)
--------------------------------------------------------- */
let myPlainPassword = '';

async function loadMyPassword() {
  try {
    const res = await apiGet('/auth/my-password');
    if (res && res.success) {
      myPlainPassword = res.plain_password || '';
      const display = document.getElementById('current-password-display');
      if (display) {
        if (display.type === 'text') {
          display.value = myPlainPassword;
        } else {
          display.value = myPlainPassword ? '••••••••' : '(Belum diset)';
        }
      }
    }
  } catch (err) {
    console.warn('Gagal memuat info kata sandi akun:', err);
  }
}

// Toggle Lihat / Sembunyikan Kata Sandi Saat Ini
const btnToggleCurrentPass = document.getElementById('btn-toggle-current-pass');
if (btnToggleCurrentPass) {
  btnToggleCurrentPass.addEventListener('click', () => {
    const input = document.getElementById('current-password-display');
    const eyeIcon = btnToggleCurrentPass.querySelector('.icon-eye');
    const eyeOffIcon = btnToggleCurrentPass.querySelector('.icon-eye-off');
    if (!input) return;

    if (input.type === 'password') {
      input.type = 'text';
      input.value = myPlainPassword || '(Tidak tersedia)';
      if (eyeIcon) eyeIcon.classList.add('hidden');
      if (eyeOffIcon) eyeOffIcon.classList.remove('hidden');
    } else {
      input.type = 'password';
      input.value = myPlainPassword ? '••••••••' : '';
      if (eyeIcon) eyeIcon.classList.remove('hidden');
      if (eyeOffIcon) eyeOffIcon.classList.add('hidden');
    }
  });
}

// Salin Kata Sandi Saat Ini ke Clipboard
const btnCopyCurrentPass = document.getElementById('btn-copy-current-pass');
if (btnCopyCurrentPass) {
  btnCopyCurrentPass.addEventListener('click', async () => {
    if (!myPlainPassword) {
      showAlert('Kata sandi belum tersedia atau belum dimuat.', 'error');
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(myPlainPassword);
      } else {
        const temp = document.createElement('input');
        temp.value = myPlainPassword;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      showAlert('Kata sandi berhasil disalin ke clipboard!', 'success');
      btnCopyCurrentPass.classList.add('text-emerald-600', 'border-emerald-300');
      setTimeout(() => {
        btnCopyCurrentPass.classList.remove('text-emerald-600', 'border-emerald-300');
      }, 2000);
    } catch (err) {
      showAlert('Gagal menyalin kata sandi: ' + err.message, 'error');
    }
  });
}

// Submit Form Ubah Kata Sandi Baru
const formChangePass = document.getElementById('form-change-password');
if (formChangePass) {
  formChangePass.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const newPass = document.getElementById('input-new-password').value;
    const confirmPass = document.getElementById('input-confirm-password').value;
    const btnSave = document.getElementById('btn-save-password');

    if (!newPass || newPass.length < 6) {
      showAlert('Kata sandi baru minimal harus 6 karakter.', 'error');
      return;
    }
    if (newPass !== confirmPass) {
      showAlert('Konfirmasi kata sandi tidak cocok. Harap periksa kembali.', 'error');
      return;
    }

    try {
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Menyimpan Kata Sandi...';
      }
      const res = await apiPut('/auth/change-password', {
        new_password: newPass,
        confirm_password: confirmPass
      });

      if (res && res.success) {
        showAlert(res.message || 'Kata sandi berhasil diperbarui!', 'success');
        myPlainPassword = newPass;
        const passDisplay = document.getElementById('current-password-display');
        if (passDisplay) {
          passDisplay.value = passDisplay.type === 'text' ? newPass : '••••••••';
        }
        formChangePass.reset();
      } else {
        showAlert(res?.message || 'Gagal mengubah kata sandi.', 'error');
      }
    } catch (err) {
      showAlert(err.message || 'Gagal mengubah kata sandi.', 'error');
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = `
          <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          <span>Perbarui Kata Sandi Saya</span>
        `;
      }
    }
  });
}

/* ---------------------------------------------------------
   Pop-up Modal Viewer untuk Lampiran Bukti (Foto/Dokumen)
--------------------------------------------------------- */
function openAttachmentModal(url, title = 'Lampiran Dokumen') {
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
      <div class="w-full flex items-center justify-center p-2 bg-slate-900/5 rounded-2xl">
        <img src="${url}" alt="Lampiran" class="max-h-[60vh] max-w-full rounded-xl object-contain shadow-sm" />
      </div>
    `;
  } else if (isPdf) {
    bodyEl.innerHTML = `
      <iframe src="${url}" class="w-full h-[60vh] rounded-xl border border-slate-200"></iframe>
    `;
  } else {
    bodyEl.innerHTML = `
      <div class="text-center py-8 space-y-3">
        <div class="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
        <p class="text-xs font-semibold text-slate-700">Berkas Dokumen Lampiran Pengajuan</p>
        <a href="${url}" target="_blank" download class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition">
          Unduh & Buka Dokumen
        </a>
      </div>
    `;
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// Event delegation klik tombol lampiran
document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-view-emp-attachment');
  if (btn) {
    const url = btn.getAttribute('data-url');
    const title = btn.getAttribute('data-title') || 'Lampiran Dokumen';
    openAttachmentModal(url, title);
  }
});

// Tutup pop-up lampiran
const btnCloseAttachment = document.getElementById('btn-close-attachment-modal');
if (btnCloseAttachment) {
  btnCloseAttachment.addEventListener('click', () => {
    const modal = document.getElementById('modal-attachment-viewer');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
  });
}
const modalAttachmentViewer = document.getElementById('modal-attachment-viewer');
if (modalAttachmentViewer) {
  modalAttachmentViewer.addEventListener('click', (e) => {
    if (e.target === modalAttachmentViewer) {
      modalAttachmentViewer.classList.add('hidden');
      document.body.style.overflow = '';
    }
  });
}

/* ---------------------------------------------------------
   Pencegahan Pinch Zoom & Gestur Zooming di Handphone
--------------------------------------------------------- */
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());

let lastTouchTime = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchTime <= 300) {
    e.preventDefault();
  }
  lastTouchTime = now;
}, { passive: false });

/* ---------------------------------------------------------
   Jadwal Roster Shift Karyawan (Modal Kalender)
--------------------------------------------------------- */
const modalMyRoster = document.getElementById('modal-my-roster');
const btnOpenMyRoster = document.getElementById('btn-open-my-roster');
const btnOpenRosterCal = document.getElementById('btn-open-roster-calendar');
const btnCloseMyRoster = document.getElementById('btn-close-my-roster');
const myRosterMonthInput = document.getElementById('my-roster-month-input');
const myRosterContent = document.getElementById('my-roster-content');
const rosterProfileShiftEl = document.getElementById('roster-employee-profile-shift');

function getShiftBadgeClass(code) {
  switch (code) {
    case 'P': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'S': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'VK': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'VW': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'VH': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'R': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'L':
    case 'OFF': return 'bg-rose-100 text-rose-800 border-rose-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

async function loadMyRosterSchedule(targetMonth) {
  if (!myRosterContent) return;
  myRosterContent.innerHTML = '<div class="p-8 text-center text-slate-400 text-xs">Memuat jadwal shift bulan ini...</div>';

  try {
    const url = targetMonth ? `/api/attendance/my-roster?month=${targetMonth}` : '/api/attendance/my-roster';
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      myRosterContent.innerHTML = `<div class="p-6 text-center text-rose-500 text-xs">${data.message || 'Gagal memuat jadwal.'}</div>`;
      return;
    }

    if (myRosterMonthInput && data.month) {
      myRosterMonthInput.value = data.month;
    }

    if (rosterProfileShiftEl && data.user_shift) {
      rosterProfileShiftEl.textContent = `Shift Induk: ${data.user_shift.shift_name || 'Reguler'} (${data.user_shift.start_time?.slice(0,5) || '08:00'} - ${data.user_shift.end_time?.slice(0,5) || '17:00'})`;
    }

    const schedules = data.schedules || [];
    const scheduleMap = {};
    schedules.forEach(s => {
      const dKey = typeof s.schedule_date === 'string' ? s.schedule_date.slice(0, 10) : new Date(s.schedule_date).toISOString().slice(0, 10);
      scheduleMap[dKey] = s;
    });

    const [y, m] = (data.month || new Date().toISOString().slice(0, 7)).split('-');
    const daysInMonth = new Date(Number(y), Number(m), 0).getDate();
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const todayStr = new Date().toISOString().slice(0, 10);

    let html = '';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${m}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(Number(y), Number(m) - 1, day);
      const dayName = dayNames[dObj.getDay()];
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
      const isToday = dateStr === todayStr;

      const sched = scheduleMap[dateStr];
      const isDayOff = sched ? (sched.is_day_off || sched.shift_code === 'L' || sched.shift_code === 'OFF') : false;
      const shiftCode = sched?.shift_code || (isDayOff ? 'L' : '-');
      const timeStr = sched?.start_time && sched?.end_time
        ? `${sched.start_time.slice(0, 5)} - ${sched.end_time.slice(0, 5)} WIB`
        : (isDayOff ? 'Libur Terjadwal' : (data.user_shift ? `${data.user_shift.start_time?.slice(0,5)} - ${data.user_shift.end_time?.slice(0,5)}` : 'Shift Reguler'));

      const badgeStyle = getShiftBadgeClass(shiftCode);

      html += `
        <div class="p-3 rounded-2xl border transition-all ${isToday ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-400/20' : (isDayOff ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50/80 border-slate-100')} flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl ${isToday ? 'bg-indigo-600 text-white' : (isWeekend ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700')} flex flex-col items-center justify-center shrink-0 font-mono font-bold leading-none">
              <span class="text-[9px] uppercase">${dayName}</span>
              <span class="text-sm mt-0.5">${day}</span>
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold ${isToday ? 'text-indigo-900 font-extrabold' : 'text-slate-800'}">
                  ${day} ${new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('id-ID', { month: 'short' })} ${y}
                </span>
                ${isToday ? '<span class="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-600 text-white font-extrabold uppercase">Hari Ini</span>' : ''}
              </div>
              <p class="text-[11px] text-slate-500 font-medium">${timeStr}</p>
            </div>
          </div>
          <div>
            <span class="px-2.5 py-1 rounded-xl text-xs font-black uppercase border ${badgeStyle}">
              ${isDayOff ? 'OFF' : (shiftCode !== '-' ? shiftCode : 'REG')}
            </span>
          </div>
        </div>
      `;
    }

    myRosterContent.innerHTML = html;
  } catch (err) {
    console.error('Error loadMyRosterSchedule:', err);
    myRosterContent.innerHTML = `<div class="p-6 text-center text-rose-500 text-xs">Terjadi kesalahan saat memuat jadwal.</div>`;
  }
}

function openMyRosterModal() {
  if (modalMyRoster) {
    modalMyRoster.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    loadMyRosterSchedule(myRosterMonthInput?.value || curMonth);
  }
}

function closeMyRosterModal() {
  if (modalMyRoster) {
    modalMyRoster.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

if (btnOpenMyRoster) btnOpenMyRoster.addEventListener('click', openMyRosterModal);
if (btnOpenRosterCal) btnOpenRosterCal.addEventListener('click', openMyRosterModal);
if (btnCloseMyRoster) btnCloseMyRoster.addEventListener('click', closeMyRosterModal);
if (modalMyRoster) {
  modalMyRoster.addEventListener('click', (e) => {
    if (e.target === modalMyRoster) closeMyRosterModal();
  });
}
if (myRosterMonthInput) {
  myRosterMonthInput.addEventListener('change', (e) => {
    loadMyRosterSchedule(e.target.value);
  });
}
