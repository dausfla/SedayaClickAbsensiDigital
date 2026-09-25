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

const uploadAttendancePhoto = multer({
  storage: makeStorage('attendance'),
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const uploadSubmissionAttachment = multer({
  storage: makeStorage('submissions'),
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

module.exports = { uploadAttendancePhoto, uploadSubmissionAttachment };
