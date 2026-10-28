// public/js/push-client.js
// Client helper untuk pendaftaran Web Push Notification di PWA SedayaClick

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function subscribeToPushNotifications(options = {}) {
  const { silentOnDeny = false, silentOnSuccess = false } = options;
  if (!isPushSupported()) {
    if (!silentOnDeny) showModernToast('Pemberitahuan', 'Browser ini belum mendukung Web Push Notification.', 'warning');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      if (!silentOnDeny) showModernToast('Izin Ditolak', 'Izin notifikasi tidak diaktifkan. Anda bisa mengaktifkannya di setelan browser.', 'warning');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;

    // Ambil VAPID Public Key dari backend
    const res = await fetch('/api/notifications/vapid-public-key');
    const keyData = await res.json();
    if (!keyData.success || !keyData.publicKey) {
      throw new Error(keyData.message || 'Gagal mengambil VAPID Public Key');
    }

    const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);

    // Dapatkan subscription yang sudah ada atau buat baru
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    // Kirim subscription ke backend
    const saveRes = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent
      })
    });

    const saveResult = await saveRes.json();
    if (saveResult.success) {
      if (!silentOnSuccess) {
        showModernToast('Notifikasi Aktif 🔔', 'Pengingat absen otomatis berhasil diaktifkan di perangkat ini.', 'success');
      }
      return true;
    } else {
      throw new Error(saveResult.message || 'Gagal menyimpan subscription');
    }
  } catch (err) {
    console.error('[PushClient Error]:', err);
    if (!silentOnDeny) {
      showModernToast('Gagal', err.message || 'Terjadi kesalahan saat mengaktifkan notifikasi.', 'error');
    }
    return false;
  }
}

export async function unsubscribeFromPushNotifications() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });
    }
    showModernToast('Notifikasi Nonaktif', 'Perangkat ini telah berhenti berlangganan notifikasi.', 'info');
    return true;
  } catch (err) {
    console.error('[PushClient Unsubscribe Error]:', err);
    return false;
  }
}

// Modern Glassmorphism Toast Component
export function showModernToast(title, message, type = 'info') {
  let toastContainer = document.getElementById('modern-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'modern-toast-container';
    toastContainer.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-11/12 max-w-sm pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto transform transition-all duration-300 ease-out translate-y-[-20px] opacity-0 flex items-start gap-3 p-3.5 rounded-2xl shadow-xl backdrop-blur-xl border text-sm text-white`;

  let bgClass = 'bg-slate-900/90 border-slate-700/60';
  let iconSvg = `<svg class="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

  if (type === 'success') {
    bgClass = 'bg-emerald-950/90 border-emerald-500/40';
    iconSvg = `<svg class="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  } else if (type === 'warning') {
    bgClass = 'bg-amber-950/90 border-amber-500/40';
    iconSvg = `<svg class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
  } else if (type === 'error') {
    bgClass = 'bg-rose-950/90 border-rose-500/40';
    iconSvg = `<svg class="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  }

  toast.className += ` ${bgClass}`;
  toast.innerHTML = `
    ${iconSvg}
    <div class="flex-1">
      <div class="font-bold text-slate-100">${title}</div>
      <div class="text-xs text-slate-300 mt-0.5 leading-relaxed">${message}</div>
    </div>
  `;

  toastContainer.appendChild(toast);

  // Trigger Haptic Feedback pada perangkat yang mendukung
  if ('vibrate' in navigator) {
    try { navigator.vibrate(40); } catch(e) {}
  }

  // Animation In
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-[-20px]', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  // Auto remove after 3.8s
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-[-20px]', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3800);
}
