// public/js/geolocation.js
// Modul penguncian lokasi GPS LIVE & Network Triangulation multi-stage fallback.
// Kompatibel dengan seluruh browser (Chrome, Safari, Edge, Firefox, Brave)
// dan seluruh perangkat (Smartphone, Laptop, PC Desktop, ngrok SSL).

const MESSAGES = {
  1: 'Izin lokasi ditolak. Memakai estimasi lokasi jaringan...',
  2: 'Lokasi tidak dapat ditentukan. Memakai estimasi lokasi jaringan...',
  3: 'Waktu pengambilan lokasi habis. Memakai estimasi lokasi jaringan...'
};

/**
 * Meminta lokasi via IP Geolocation jika GPS browser mengalami timeout/gangguan.
 */
export async function getIpLocationFallback() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data && data.latitude && data.longitude) {
        return {
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          accuracy: 500,
          isIpFallback: true,
          provider: data.city || 'Network IP'
        };
      }
    }
  } catch (e) {}

  try {
    const res2 = await fetch('https://ip-api.com/json/?fields=status,lat,lon,city');
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2 && data2.status === 'success' && data2.lat && data2.lon) {
        return {
          latitude: parseFloat(data2.lat),
          longitude: parseFloat(data2.lon),
          accuracy: 500,
          isIpFallback: true,
          provider: data2.city || 'Network IP'
        };
      }
    }
  } catch (e) {}

  // Defisit lokasi kantor/default jika seluruh jaringan publik terblokir
  return {
    latitude: -6.597147,
    longitude: 106.806038,
    accuracy: 1000,
    isIpFallback: true,
    provider: 'Kantor Pusat'
  };
}

/**
 * Meminta satu pembacaan lokasi dengan multi-stage fallback (Cached -> High Accuracy -> Standard -> IP Fallback).
 * @returns {Promise<{latitude:number, longitude:number, accuracy:number}>}
 */
export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      getIpLocationFallback().then(resolve);
      return;
    }

    // Stage 1: Coba ambil posisi dari cache / standar dulu (sangat cepat untuk PC/Laptop)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      async (err1) => {
        if (err1.code === 1) {
          const ipLoc = await getIpLocationFallback();
          resolve(ipLoc);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          async () => {
            const ipLoc = await getIpLocationFallback();
            resolve(ipLoc);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 300000 }
    );
  });
}

/**
 * Memantau lokasi secara live dengan fallback otomatis hingga lokasi TERKUNCI.
 * @param {(pos:{latitude:number, longitude:number, accuracy:number, isIpFallback?:boolean, provider?:string})=>void} onUpdate
 * @param {(message:string)=>void} onError
 * @returns {object} watchController — simpan untuk pembatalan kelak.
 */
export function watchPosition(onUpdate, onError) {
  let activeWatchId = null;
  let hasLockedLocation = false;
  let fallbackTimer = null;

  const handleSuccess = (pos) => {
    hasLockedLocation = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    onUpdate({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy
    });
  };

  const triggerIpFallback = async () => {
    if (hasLockedLocation) return;
    try {
      const ipLoc = await getIpLocationFallback();
      if (!hasLockedLocation) {
        hasLockedLocation = true;
        onUpdate(ipLoc);
      }
    } catch (e) {
      if (!hasLockedLocation && onError) {
        onError('Gagal mengunci lokasi.');
      }
    }
  };

  // Timer pengaman 3.5 detik: Jika GPS satelit lambat terkunci (misal di PC/Laptop macOS),
  // aktifkan IP Geolocation fallback agar pengguna langsung bisa absen tanpa menunggu lama!
  fallbackTimer = setTimeout(() => {
    if (!hasLockedLocation) {
      triggerIpFallback();
    }
  }, 3500);

  if (!navigator.geolocation) {
    triggerIpFallback();
    return { clear: () => {} };
  }

  // Stage 1: Fast cached position
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (!hasLockedLocation) handleSuccess(pos);
    },
    () => {},
    { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 }
  );

  // Stage 2: Watch position
  try {
    activeWatchId = navigator.geolocation.watchPosition(
      (pos) => handleSuccess(pos),
      (err) => {
        triggerIpFallback();
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
  } catch (e) {
    triggerIpFallback();
  }

  return {
    clear: () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
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
