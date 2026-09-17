// public/js/pwa-register.js
// Mendaftarkan Service Worker agar SedayaClick dapat di-install penuh sebagai PWA
// (tampilan standalone, tanpa address bar browser).

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Registrasi Service Worker gagal:', err);
    });
  });
}

// Menangkap event "beforeinstallprompt" agar tombol "Install Aplikasi" kustom
// bisa ditampilkan di UI alih-alih mengandalkan prompt otomatis browser.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const btn = document.getElementById('btn-install-pwa');
  if (btn) btn.classList.remove('hidden');
});

export function bindInstallButton(buttonId = 'btn-install-pwa') {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    btn.classList.add('hidden');
  });
}
