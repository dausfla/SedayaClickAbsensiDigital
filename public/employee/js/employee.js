import { apiGet, apiPost, apiPostForm } from '../../js/api.js';
import { LiveCamera } from '../../js/camera.js';
import { getCurrentPosition, watchPosition, clearWatch } from '../../js/geolocation.js';

const alertBox = document.getElementById('alert-box');
function showAlert(message, type = 'error') {
  alertBox.textContent = message;
  alertBox.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
  alertBox.classList.add(
    type === 'error' ? 'bg-red-50' : 'bg-emerald-50', 
    type === 'error' ? 'text-red-700' : 'text-emerald-700',
    type === 'error' ? 'border-red-200' : 'border-emerald-200'
  );
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function hideAlert() { alertBox.classList.add('hidden'); }

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
        gpsDot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0';
        gpsText.textContent = msg;
        currentPosition = null;
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
   Submissions
--------------------------------------------------------- */
document.getElementById('form-submission').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Mengirim...';
  try {
    const formData = new FormData();
    formData.append('type', document.getElementById('sub-type').value);
    formData.append('start_date', document.getElementById('sub-start').value);
    formData.append('end_date', document.getElementById('sub-end').value);
    formData.append('reason', document.getElementById('sub-reason').value);
    const fileInput = document.getElementById('sub-attachment');
    if (fileInput.files[0]) formData.append('attachment', fileInput.files[0]);

    const result = await apiPostForm('/submissions', formData);
    showAlert(result.message, 'success');
    e.target.reset();
    await loadSubmissions();
  } catch (err) {
    showAlert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Kirim Pengajuan';
  }
});

let lastEmpSubHash = '';

async function loadSubmissions(silent = false) {
  const container = document.getElementById('submission-list');
  if (!container) return;
  try {
    const { submissions } = await apiGet('/submissions/mine');
    const newHash = JSON.stringify(submissions);
    if (silent && lastEmpSubHash === newHash) return;
    lastEmpSubHash = newHash;

    if (!submissions || submissions.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-center py-4 text-xs">Belum ada riwayat pengajuan.</p>';
      return;
    }
    const STATUS_MAP = {
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200',
      pending: 'bg-amber-50 text-amber-700 border-amber-200'
    };
    const STATUS_TEXT = { approved: 'Disetujui', rejected: 'Ditolak', pending: 'Menunggu Review' };

    container.innerHTML = submissions.map((s) => `
      <div class="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-800 text-xs uppercase tracking-wide">${s.type}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_MAP[s.status] || 'bg-slate-100 text-slate-600'}">${STATUS_TEXT[s.status] || s.status}</span>
        </div>
        <p class="text-[11px] text-slate-500 font-medium">Periode: ${s.start_date} s/d ${s.end_date}</p>
        <p class="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed">${s.reason}</p>
        ${s.review_note ? `<p class="text-[11px] text-slate-500 italic bg-amber-50/60 p-2 rounded-lg border border-amber-100"><span class="font-semibold not-italic text-slate-700">Catatan Admin:</span> ${s.review_note}</p>` : ''}
      </div>
    `).join('');
  } catch (err) {
    if (!silent) container.innerHTML = '<p class="text-slate-400 text-center py-4 text-xs">Belum ada riwayat pengajuan.</p>';
  }
}

// Real-time polling untuk Karyawan (tiap 4 detik)
setInterval(() => {
  loadSubmissions(true);
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