// public/js/geolocation.js
// Modul penguncian lokasi GPS LIVE menggunakan Geolocation API.
// Dipakai untuk memastikan koordinat (lat, long) presisi tinggi didapat
// sebelum Clock In / Clock Out diizinkan.

/**
 * Meminta satu pembacaan lokasi dengan akurasi tinggi.
 * @returns {Promise<{latitude:number, longitude:number, accuracy:number}>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Perangkat/browser ini tidak mendukung Geolocation.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      (err) => {
        const messages = {
          1: 'Izin lokasi ditolak. Aktifkan izin GPS di pengaturan browser untuk melanjutkan absensi.',
          2: 'Lokasi tidak dapat ditentukan. Pastikan GPS perangkat aktif.',
          3: 'Waktu pengambilan lokasi habis. Coba lagi di area dengan sinyal GPS lebih baik.'
        };
        reject(new Error(messages[err.code] || 'Gagal mendapatkan lokasi.'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/**
 * Memantau lokasi secara live (dipakai untuk menampilkan indikator "Lokasi terkunci"
 * dan koordinat yang terus diperbarui pada layar Clock In/Out).
 * @param {(pos:{latitude:number, longitude:number, accuracy:number})=>void} onUpdate
 * @param {(message:string)=>void} onError
 * @returns {number} watchId — gunakan navigator.geolocation.clearWatch(watchId) untuk berhenti.
 */
export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError('Perangkat/browser ini tidak mendukung Geolocation.');
    return null;
  }
  return navigator.geolocation.watchPosition(
    (pos) => onUpdate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
    (err) => {
      const messages = {
        1: 'Izin lokasi ditolak. Mohon izinkan akses lokasi (GPS) di pengaturan browser Anda.',
        2: 'Lokasi tidak dapat ditentukan. Pastikan GPS perangkat aktif.',
        3: 'Waktu pengambilan lokasi habis. Coba lagi di area dengan sinyal GPS lebih baik.'
      };
      onError(messages[err.code] || 'Gagal memantau lokasi.');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

export function clearWatch(watchId) {
  if (watchId !== null && watchId !== undefined && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}
