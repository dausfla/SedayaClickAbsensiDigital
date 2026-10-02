// public/js/camera.js
// Modul kamera depan LIVE menggunakan MediaDevices API.
// Dipakai untuk Clock In / Clock Out (foto wajib diambil langsung, bukan upload file lama).

export class LiveCamera {
  /**
   * @param {HTMLVideoElement} videoEl elemen <video> untuk menampilkan preview live
   */
  constructor(videoEl) {
    this.videoEl = videoEl;
    this.stream = null;
  }

  /**
   * Meminta izin & menyalakan kamera DEPAN (facingMode: 'user').
   */
  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Perangkat/browser ini tidak mendukung akses kamera.');
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false
      });
      this.videoEl.srcObject = this.stream;
      await this.videoEl.play();
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser untuk melanjutkan absensi.');
      }
      throw new Error('Gagal mengakses kamera: ' + err.message);
    }
  }

  /**
   * Mengambil satu frame dari video live saat ini dan mengompresnya ke ukuran optimal (maks 720px, ~70KB)
   * agar proses pengiriman (upload) berlangsung instan di jaringan HP 3G/4G/5G.
   */
  async capture(maxDimension = 720, quality = 0.72) {
    if (!this.stream) throw new Error('Kamera belum aktif.');
    const videoWidth = this.videoEl.videoWidth || 640;
    const videoHeight = this.videoEl.videoHeight || 480;

    // Hitung dimensi berskala agar file berukuran super kecil (~60KB-90KB)
    let targetWidth = videoWidth;
    let targetHeight = videoHeight;
    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
        targetWidth = maxDimension;
      } else {
        targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
        targetHeight = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Cermin horizontal agar hasil foto sesuai orientasi preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.videoEl, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Gagal mengambil foto.'))),
        'image/jpeg',
        quality
      );
    });
  }

  /** Mematikan semua track kamera agar indikator kamera perangkat mati. */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}
