import { apiGet, apiPost, apiPostForm, escapeHtml } from '../../js/api.js';
import { LiveCamera } from '../../js/camera.js';
import { getCurrentPosition, watchPosition, clearWatch } from '../../js/geolocation.js';

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
  } catch (e) {
    console.error('Session Error:', e);
    window.location.href = '/index.html';
  }
})();

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
    const { attendance } = await apiGet('/attendance/today');
    const badge = document.getElementById('status-badge');
    const inEl = document.getElementById('display-clock-in');
    const outEl = document.getElementById('display-clock-out');
    const startBtn = document.getElementById('btn-start-camera');

    if (!attendance || !attendance.clock_in_time) {
      mode = 'clock-in';
      badge.textContent = 'Belum Absen';
      badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500';
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
        gpsText.textContent = `GPS Terkunci (±${Math.round(pos.accuracy)}m) — ${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`;
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

function toggleHandoverSection() {
  if (!subTypeSelect || !wrapperHandover) return;
  if (subTypeSelect.value === 'cuti') {
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

if (subTypeSelect) {
  subTypeSelect.addEventListener('change', toggleHandoverSection);
  toggleHandoverSection(); // Run on init
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
      toggleHandoverSection();
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

      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3" stroke-width="2"/></svg> <span>Mulai Absen Pulang Lembur</span>';
        startBtn.className = 'col-span-2 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl py-3.5 shadow-md shadow-rose-500/20 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer';
      }
    } else {
      overtimeMode = 'done';
      if (badge) {
        badge.textContent = 'Absensi Lembur Selesai';
        badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500 text-white border border-indigo-400 backdrop-blur-md';
      }
      if (inEl) inEl.textContent = new Date(overtime.overtime_clock_in_time).toLocaleTimeString('id-ID', { hour12: false });
      if (outEl) outEl.textContent = new Date(overtime.overtime_clock_out_time).toLocaleTimeString('id-ID', { hour12: false });
      
      const sec = overtime.overtime_duration_seconds || 0;
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      if (durEl) durEl.textContent = `${h} Jam ${m} Menit`;
      if (titleEl) titleEl.textContent = 'Absensi Lembur Hari Ini Selesai';
      if (taskWrapper) taskWrapper.classList.add('hidden');

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

if (otStartBtn) {
  otStartBtn.addEventListener('click', async () => {
    hideAlert();
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
          if (otGpsText) otGpsText.textContent = `GPS Terkunci (±${Math.round(pos.accuracy)}m) — ${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`;
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

      const endpoint = overtimeMode === 'clock-in' ? '/attendance/overtime/clock-in' : '/attendance/overtime/clock-out';
      const result = await apiPostForm(endpoint, formData);

      showAlert(result.message, 'success');
      if (noteEl) noteEl.value = '';
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
      pending: 'bg-amber-50 text-amber-700 border-amber-200'
    };
    const STATUS_TEXT = { approved: 'Disetujui', rejected: 'Ditolak', pending: 'Menunggu Review' };

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
        ${s.attachment ? `<a href="${s.attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="text-xs text-brand-600 underline inline-block">Lihat Lampiran</a>` : ''}
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
      pending: 'bg-amber-50 text-amber-700 border-amber-200'
    };
    const STATUS_TEXT = { approved: 'Disetujui', rejected: 'Ditolak', pending: 'Menunggu Review' };

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
          ${s.attachment ? `<a href="${s.attachment.replace('/uploads/', '/secure-uploads/')}" target="_blank" class="text-xs text-brand-600 underline inline-block font-medium mt-1">Lihat Lampiran</a>` : ''}
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