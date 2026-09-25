// routes/secureUploads.js
// Route terproteksi untuk menyajikan berkas foto absensi & lampiran pengajuan.
// Memastikan user sudah login & memiliki hak akses yang valid.

const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const defaultPhotoPath = path.join(__dirname, '../public/assets/default/default-photo.png');

/**
 * GET /secure-uploads/attendance/:filename
 */
router.get('/attendance/:filename', requireAuth, async (req, res) => {
  try {
    const rawFilename = req.params.filename;
    const safeFilename = path.basename(rawFilename);
    const user = req.session.user;

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (safeFilename === 'default-photo.png' || safeFilename.includes('default')) {
      if (fs.existsSync(defaultPhotoPath)) return res.sendFile(defaultPhotoPath);
    }

    const filePattern = `%${safeFilename}`;
    let isAuthorized = false;

    if (user.role === 'super_admin' || user.role === 'admin_manager') {
      // Super admin dan Admin Manager memiliki akses ke seluruh foto absensi & lembur
      isAuthorized = true;
    } else if (user.role === 'employee') {
      // Karyawan HANYA boleh akses foto absensi miliknya sendiri
      const [rows] = await pool.query(
        `SELECT id FROM attendances 
         WHERE user_id = ? AND (
           clock_in_photo LIKE ? OR clock_out_photo LIKE ? OR 
           overtime_clock_in_photo LIKE ? OR overtime_clock_out_photo LIKE ?
         ) 
         LIMIT 1`,
        [user.id, filePattern, filePattern, filePattern, filePattern]
      );
      isAuthorized = rows.length > 0;
    }

    if (!isAuthorized) {
      if (fs.existsSync(defaultPhotoPath)) return res.sendFile(defaultPhotoPath);
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke berkas ini.' });
    }

    const filePath = path.join(__dirname, '../uploads/attendance', safeFilename);
    if (!fs.existsSync(filePath)) {
      if (fs.existsSync(defaultPhotoPath)) return res.sendFile(defaultPhotoPath);
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    return res.sendFile(filePath);
  } catch (err) {
    console.error('Error secure-uploads attendance:', err);
    if (fs.existsSync(defaultPhotoPath)) return res.sendFile(defaultPhotoPath);
    return res.status(500).json({ success: false, message: 'Gagal mengambil berkas.' });
  }
});

/**
 * GET /secure-uploads/submissions/:filename
 */
router.get('/submissions/:filename', requireAuth, async (req, res) => {
  try {
    const rawFilename = req.params.filename;
    const safeFilename = path.basename(rawFilename);
    const user = req.session.user;

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const filePattern = `%${safeFilename}`;
    let isAuthorized = false;

    if (user.role === 'super_admin' || user.role === 'admin_manager') {
      // Super admin dan Admin Manager memiliki akses ke seluruh lampiran pengajuan
      isAuthorized = true;
    } else if (user.role === 'employee') {
      // Karyawan HANYA boleh akses lampiran pengajuan miliknya sendiri
      const [rows] = await pool.query(
        `SELECT id FROM submissions 
         WHERE user_id = ? AND attachment LIKE ? 
         LIMIT 1`,
        [user.id, filePattern]
      );
      isAuthorized = rows.length > 0;
    }

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke berkas ini.' });
    }

    const filePath = path.join(__dirname, '../uploads/submissions', safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Berkas tidak ditemukan.' });
    }

    return res.sendFile(filePath);
  } catch (err) {
    console.error('Error secure-uploads submissions:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil berkas.' });
  }
});

module.exports = router;
