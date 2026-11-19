// utils/uploadConfig.js
// Konfigurasi Multer untuk menyimpan foto absensi dan lampiran pengajuan
// ke disk lokal dengan nama file unik agar tidak saling menimpa.

const multer = require('multer');
const path = require('path');
const fs = require('fs');

function makeStorage(subfolder) {
  const dest = path.join(__dirname, '..', 'uploads', subfolder);
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${subfolder}-${uniqueSuffix}${ext}`);
    }
  });
}

const imageFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Format file harus JPG, PNG, atau WEBP.'));
};

const overtimeClockOutFilter = (req, file, cb) => {
  if (file.fieldname === 'photo') {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Format foto selfie harus JPG, PNG, atau WEBP.'));
  }
  // Untuk berkas hasil kerja lembur (work_attachment)
  const allowedDocTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/octet-stream',
    'text/plain',
    'text/csv'
  ];
  if (allowedDocTypes.includes(file.mimetype) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('application/')) {
    return cb(null, true);
  }
  cb(new Error('Format file hasil kerja harus berupa PDF, Dokumen (DOC/XLS), Gambar (PNG/JPG), atau ZIP.'));
};

const uploadAttendancePhoto = multer({
  storage: makeStorage('attendance'),
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const uploadOvertimeClockOut = multer({
  storage: makeStorage('attendance'),
  fileFilter: overtimeClockOutFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

const uploadSubmissionAttachment = multer({
  storage: makeStorage('submissions'),
  fileFilter: (req, file, cb) => {
    // Izinkan gambar dan PDF untuk pengajuan izin/sakit/cuti (misal surat dokter)
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Format lampiran pengajuan harus JPG, PNG, WEBP, atau PDF.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

module.exports = { uploadAttendancePhoto, uploadOvertimeClockOut, uploadSubmissionAttachment };
