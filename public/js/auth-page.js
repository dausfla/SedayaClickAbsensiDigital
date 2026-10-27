// public/js/auth-page.js
import { apiGet, apiPost, escapeHtml } from './api.js';
import { bindInstallButton } from './pwa-register.js';

const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const alertBox = document.getElementById('alert-box');

function showAlert(message, type = 'error') {
  alertBox.textContent = message;
  alertBox.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'bg-green-50', 'text-green-700');
  if (type === 'error') alertBox.classList.add('bg-red-50', 'text-red-700');
  else alertBox.classList.add('bg-green-50', 'text-green-700');
}
function hideAlert() {
  alertBox.classList.add('hidden');
}

function switchTab(target) {
  hideAlert();
  const loginActive = target === 'login';
  formLogin.classList.toggle('hidden', !loginActive);
  formRegister.classList.toggle('hidden', loginActive);
  tabLogin.classList.toggle('tab-active', loginActive);
  tabLogin.classList.toggle('text-slate-500', !loginActive);
  tabRegister.classList.toggle('tab-active', !loginActive);
  tabRegister.classList.toggle('text-slate-500', loginActive);
}
tabLogin.addEventListener('click', () => switchTab('login'));
tabRegister.addEventListener('click', () => switchTab('register'));

function redirectByRole(role) {
  if (role === 'employee') window.location.href = '/employee/dashboard.html';
  else if (role === 'admin_manager') window.location.href = '/admin/dashboard.html';
  else if (role === 'super_admin') window.location.href = '/superadmin/dashboard.html';
}

// Cek apakah sudah login sebelumnya (mis. buka ulang PWA) -> langsung redirect.
(async () => {
  try {
    const { loggedIn, user } = await apiGet('/auth/session');
    if (loggedIn) {
      redirectByRole(user.role);
      return;
    }
  } catch (e) { /* diam saja, biarkan user login manual */ }

  // Auto-fill email jika 'Ingatkan Saya' sebelumnya aktif
  if (localStorage.getItem('remember_me') === 'true') {
    const savedEmail = localStorage.getItem('saved_email');
    const emailInput = document.getElementById('login-email');
    const rememberCheckbox = document.getElementById('login-remember-me');
    if (savedEmail && emailInput) emailInput.value = savedEmail;
    if (rememberCheckbox) rememberCheckbox.checked = true;
  }
})();

// Muat data divisi & jabatan untuk form pendaftaran.
(async () => {
  try {
    const { divisions, positions } = await apiGet('/auth/meta');
    const divSelect = document.getElementById('reg-division');
    const posSelect = document.getElementById('reg-position');
    divSelect.innerHTML = '<option value="">Pilih Divisi</option>' +
      divisions.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
    posSelect.innerHTML = '<option value="">Pilih Jabatan</option>' +
      positions.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  } catch (e) {
    console.error('Gagal memuat data master:', e);
  }
})();

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  const submitBtn = formLogin.querySelector('button[type="submit"]');
  const originalHtml = submitBtn.innerHTML;
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <div class="flex items-center justify-center gap-2.5">
      <svg class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
      <span>Memverifikasi Kredensial...</span>
    </div>
  `;
  submitBtn.classList.add('opacity-90', 'cursor-wait');

  const emailVal = document.getElementById('login-email').value.trim();
  const passwordVal = document.getElementById('login-password').value;
  const rememberMeVal = document.getElementById('login-remember-me')?.checked || false;

  try {
    const { user } = await apiPost('/auth/login', {
      email: emailVal,
      password: passwordVal,
      remember_me: rememberMeVal
    });

    if (rememberMeVal) {
      localStorage.setItem('remember_me', 'true');
      localStorage.setItem('saved_email', emailVal);
    } else {
      localStorage.removeItem('remember_me');
      localStorage.removeItem('saved_email');
    }

    // Tampilkan status sukses di tombol
    submitBtn.classList.remove('bg-brand-600', 'hover:bg-brand-500');
    submitBtn.classList.add('bg-emerald-600', 'text-white');
    submitBtn.innerHTML = `
      <div class="flex items-center justify-center gap-2">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
        <span>Login Berhasil! Mengalihkan...</span>
      </div>
    `;

    // Tampilkan transisi loading layar penuh yang elegan
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center text-white transition-opacity duration-300';
    overlay.innerHTML = `
      <div class="relative w-16 h-16 mb-4 flex items-center justify-center">
        <div class="absolute inset-0 rounded-2xl bg-indigo-500/30 blur-xl animate-pulse"></div>
        <img src="/icons/icon-192.png" alt="Logo" class="relative w-14 h-14 rounded-2xl ring-2 ring-white/20 shadow-2xl" />
      </div>
      <p class="text-sm font-bold text-white tracking-tight">Selamat Datang, ${escapeHtml(user.full_name || 'User')}</p>
      <div class="w-36 h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
        <div class="w-full h-full bg-indigo-500 animate-[pulse_1s_infinite]"></div>
      </div>
      <p class="text-[11px] text-slate-400 mt-2 font-mono">Membuka ruang kerja Anda...</p>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
      redirectByRole(user.role);
    }, 450);
  } catch (err) {
    showAlert(err.message);
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
    submitBtn.classList.remove('opacity-90', 'cursor-wait');
  }
});

formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  const submitBtn = formRegister.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses...';
  try {
    const payload = {
      full_name: document.getElementById('reg-full-name').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      division_id: document.getElementById('reg-division').value,
      position_id: document.getElementById('reg-position').value,
      whatsapp: document.getElementById('reg-whatsapp').value.trim(),
      address: document.getElementById('reg-address').value.trim()
    };
    const result = await apiPost('/auth/register', payload);
    showAlert(result.message, 'success');
    formRegister.reset();
    setTimeout(() => switchTab('login'), 1800);
  } catch (err) {
    showAlert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Daftar';
  }
});

bindInstallButton();
