// public/js/pwa-register.js
// Mendaftarkan Service Worker agar SedayaClick dapat di-install penuh sebagai PWA.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Registrasi Service Worker gagal:', err);
    });
  });
}

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

export function bindInstallButton(buttonId = 'btn-install-pwa') {
  const btn = document.getElementById(buttonId);
  const modal = document.getElementById('pwa-install-modal');
  const btnClose = document.getElementById('btn-close-pwa-modal');
  const btnOk = document.getElementById('btn-pwa-modal-ok');
  const iosInstr = document.getElementById('pwa-instructions-ios');
  const androidInstr = document.getElementById('pwa-instructions-android');

  // Sembunyikan tombol jika sudah dibuka dalam mode standalone (aplikasi terinstall)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone && btn) {
    btn.classList.add('hidden');
    return;
  }

  function showModal() {
    if (!modal) return;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (iosInstr && androidInstr) {
      iosInstr.classList.toggle('hidden', !isIOS);
      androidInstr.classList.toggle('hidden', isIOS);
    }
    modal.classList.remove('hidden');
  }

  function hideModal() {
    if (modal) modal.classList.add('hidden');
  }

  if (btnClose) btnClose.addEventListener('click', hideModal);
  if (btnOk) btnOk.addEventListener('click', hideModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal();
    });
  }

  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        deferredInstallPrompt = null;
        btn.classList.add('hidden');
      }
    } else {
      // Jika browser tidak mendukung trigger otomatis (seperti Safari di iOS),
      // tampilkan petunjuk langkah-langkah PWA yang ramah pengguna.
      showModal();
    }
  });
}
