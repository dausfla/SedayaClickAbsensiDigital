// public/js/geolocation.js
// Modul penguncian lokasi GPS LIVE & Network Triangulation multi-stage fallback.
// Kompatibel dengan seluruh browser (Chrome, Safari, Edge, Firefox, Brave)
// dan seluruh perangkat (Smartphone, Laptop, PC Desktop, ngrok SSL).

const MESSAGES = {
  1: 'Izin lokasi ditolak. Mohon izinkan akses lokasi (GPS) di pengaturan browser Anda.',
  2: 'Lokasi tidak dapat ditentukan. Pastikan GPS / Layanan Lokasi perangkat aktif.',
  3: 'Waktu pengambilan lokasi habis. Coba di area dengan sinyal jaringan lebih baik.'
};

/**
 * Meminta satu pembacaan lokasi dengan multi-stage fallback (High Accuracy -> Standard Accuracy).
 * @returns {Promise<{latitude:number, longitude:number, accuracy:number}>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Perangkat/browser ini tidak mendukung Geolocation.'));
      return;
    }

    // Stage 1: Coba High Accuracy (GPS Satelit) dengan timeout cepat (6s)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err1) => {
        if (err1.code === 1) {
          reject(new Error(MESSAGES[1]));
          return;
        }

        // Stage 2: Fallback ke Standard Accuracy (Wi-Fi / IP Network Triangulation)
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          (err2) => {
            const finalMsg = MESSAGES[err2.code] || 'Gagal mendapatkan lokasi perangkat.';
            reject(new Error(finalMsg));
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  });
}

/**
 * Memantau lokasi secara live dengan fallback otomatis.
 * @param {(pos:{latitude:number, longitude:number, accuracy:number})=>void} onUpdate
 * @param {(message:string)=>void} onError
 * @returns {object} watchController — simpan untuk pembatalan kelak.
 */
export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError('Perangkat/browser ini tidak mendukung Geolocation.');
    return null;
  }

  let activeWatchId = null;
  let hasLockedLocation = false;

  const handleSuccess = (pos) => {
    hasLockedLocation = true;
    onUpdate({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy
    });
  };

  // Immediate Stage 1: Parallel quick fetch via getCurrentPosition (Standard/Cached)
  // Memastikan lokasi langsung terkunci dalam 1-2 detik pada laptop/PC
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (!hasLockedLocation) handleSuccess(pos);
    },
    () => { /* Biarkan watchPosition menangani jika ganjalan sementara */ },
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
  );

  // Stage 2: Primary watch dengan high accuracy
  activeWatchId = navigator.geolocation.watchPosition(
    (pos) => handleSuccess(pos),
    (err) => {
      if (err.code === 1) {
        onError(MESSAGES[1]);
        return;
      }

      // Jika High Accuracy mengalami timeout/unavailable, fallback ke Standard Accuracy
      if (activeWatchId !== null) {
        try { navigator.geolocation.clearWatch(activeWatchId); } catch (e) {}
      }

      activeWatchId = navigator.geolocation.watchPosition(
        (pos) => handleSuccess(pos),
        (errFallback) => {
          if (!hasLockedLocation) {
            onError(MESSAGES[errFallback.code] || 'Gagal memantau lokasi.');
          }
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
  );

  return {
    clear: () => {
      if (activeWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(activeWatchId);
      }
    }
  };
}

export function clearWatch(watchHandle) {
  if (!watchHandle) return;
  if (typeof watchHandle === 'object' && typeof watchHandle.clear === 'function') {
    watchHandle.clear();
  } else if (typeof watchHandle === 'number' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchHandle);
  }
}
