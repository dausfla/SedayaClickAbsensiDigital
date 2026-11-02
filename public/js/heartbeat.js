// public/js/heartbeat.js
// Layanan berkala (Heartbeat ping) untuk mendeteksi user aktif/online secara real-time.
// Didesain hemat baterai dan hemat kuota: hanya memancarkan ping saat tab/layar aktif.

let heartbeatInterval = null;
let lastHeartbeatTime = 0;
const HEARTBEAT_INTERVAL_MS = 45000; // Ping setiap 45 detik
const MIN_GAP_MS = 25000; // Minimal selang waktu antar ping 25 detik

async function sendHeartbeat() {
  const now = Date.now();
  if (now - lastHeartbeatTime < MIN_GAP_MS) return;

  try {
    const res = await fetch('/api/auth/heartbeat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      lastHeartbeatTime = now;
    }
  } catch (err) {
    // Silent fail jika offline/koneksi terputus sesaat
  }
}

export function startHeartbeat() {
  if (heartbeatInterval) return;

  // Ping pertama saat aplikasi dimuat
  sendHeartbeat();

  // Ping berkala setiap 45 detik saat tab aktif
  heartbeatInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Jika user kembali membuka tab / menyalakan layar HP
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
    }
  });

  // User interactions trigger ping jika sudah melewati batas waktu interval
  const onUserActivity = () => {
    if (Date.now() - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
      sendHeartbeat();
    }
  };

  ['click', 'touchstart', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, onUserActivity, { passive: true });
  });
}

// Auto start saat script dimuat
startHeartbeat();
