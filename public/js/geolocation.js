// public/js/geolocation.js
// Modul penguncian lokasi GPS LIVE presisi tinggi dengan multi-stage fallback.
// Kompatibel dengan seluruh browser (Chrome, Safari, Edge, Firefox, Brave)
// dan seluruh perangkat (Smartphone iOS/Android, Laptop, PC Desktop).

/**
 * Meminta lokasi via IP Geolocation jika GPS hardware tidak tersedia/timeout.
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
          accuracy: 1500,
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
          accuracy: 1500,
          isIpFallback: true,
          provider: data2.city || 'Network IP'
        };
      }
    }
  } catch (e) {}

  return {
    latitude: -6.597147,
    longitude: 106.806038,
    accuracy: 3000,
    isIpFallback: true,
    provider: 'Lokasi Perusahaan'
  };
}

/**
 * Meminta satu pembacaan lokasi dengan prioritas GPS Presisi (Device Satelit/Wi-Fi).
 */
export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      getIpLocationFallback().then(resolve);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy, isIpFallback: false }),
      async () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy, isIpFallback: false }),
          async () => {
            const ipLoc = await getIpLocationFallback();
            resolve(ipLoc);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
    );
  });
}

/**
 * Memantau lokasi secara live dengan upgrade otomatis dari IP Fallback ke GPS Presisi.
 * @param {(pos:{latitude:number, longitude:number, accuracy:number, isIpFallback?:boolean, provider?:string})=>void} onUpdate
 * @param {(message:string)=>void} onError
 * @returns {object} watchController
 */
export function watchPosition(onUpdate, onError) {
  let activeWatchId = null;
  let bestAccuracy = 999999;
  let hasLockedAnyLocation = false;
  let fallbackTimer = null;

  const emitPosition = (pos) => {
    // Jika menemukan posisi yang lebih akurat, atau ini adalah locking pertama
    if (pos.accuracy < bestAccuracy || (pos.isIpFallback && !hasLockedAnyLocation)) {
      bestAccuracy = pos.accuracy;
      hasLockedAnyLocation = true;
      onUpdate({
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
        isIpFallback: !!pos.isIpFallback,
        provider: pos.provider
      });
    }
  };

  // Primary: GPS Sensor Hardware (High Accuracy)
  if (navigator.geolocation) {
    try {
      activeWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (fallbackTimer) clearTimeout(fallbackTimer);
          emitPosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            isIpFallback: false
          });
        },
        async (err) => {
          if (!hasLockedAnyLocation) {
            const ipLoc = await getIpLocationFallback();
            emitPosition(ipLoc);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );
    } catch (e) {
      getIpLocationFallback().then(emitPosition);
    }
  } else {
    getIpLocationFallback().then(emitPosition);
  }

  // Timer Cadangan (7 detik): Jika HP di dalam ruangan dan GPS satelit belum selesai memindai,
  // aktifkan dulu lokasi IP sementara agar tombol tidak menggantung. Nanti begitu GPS satelit mengunci, lokasi otomatis di-upgrade!
  fallbackTimer = setTimeout(async () => {
    if (!hasLockedAnyLocation) {
      const ipLoc = await getIpLocationFallback();
      emitPosition(ipLoc);
    }
  }, 7000);

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
