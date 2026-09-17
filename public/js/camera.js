// public/js/camera.js
// Modul kamera depan LIVE menggunakan MediaDevices API.
// Dipakai untuk Clock In / Clock Out (foto wajib diambil langsung, bukan upload file lama)
// dan untuk foto lampiran bila diperlukan.

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
   * Melempar error yang sudah diberi pesan ramah pengguna jika gagal.
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
   * Mengambil satu frame dari video live saat ini dan mengembalikannya sebagai Blob JPEG.
   */
  async capture() {
    if (!this.stream) throw new Error('Kamera belum aktif.');
    const canvas = document.createElement('canvas');
    canvas.width = this.videoEl.videoWidth;
    canvas.height = this.videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    // Cermin horizontal agar hasil foto sesuai orientasi yang dilihat user di preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.videoEl, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Gagal mengambil foto.'))),
        'image/jpeg',
        0.9
      );
    });
  }

  /** Mematikan semua track kamera agar lampu indikator kamera perangkat ikut mati. */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}
