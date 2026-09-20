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
    if (loggedIn) redirectByRole(user.role);
  } catch (e) { /* diam saja, biarkan user login manual */ }
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
  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses...';
  try {
    const { user } = await apiPost('/auth/login', {
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value
    });
    redirectByRole(user.role);
  } catch (err) {
    showAlert(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Masuk';
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
