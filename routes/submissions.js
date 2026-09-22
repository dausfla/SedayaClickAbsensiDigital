// routes/submissions.js
// Step 3: Formulir Pengajuan Izin / Cuti / Sakit oleh karyawan.
// Karyawan HANYA boleh melihat daftar pengajuannya sendiri (bukan rekap divisi/semua orang).

const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole, requireActiveAccount } = require('../middleware/auth');
const { uploadSubmissionAttachment } = require('../utils/uploadConfig');

const router = express.Router();

/**
 * POST /api/submissions
 * multipart/form-data: type, start_date, end_date, reason, attachment(optional file)
 */
router.post(
  '/',
  requireAuth,
  requireRole('employee'),
  requireActiveAccount,
  uploadSubmissionAttachment.single('attachment'),
  async (req, res) => {
    try {
      const { type, start_date, end_date, start_time, end_time, reason } = req.body;
      const userId = req.session.user.id;

      if (!type || !['izin', 'cuti', 'sakit', 'lembur'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Jenis pengajuan tidak valid.' });
      }

      const effectiveStartDate = start_date || req.body.overtime_date;
      const effectiveEndDate = end_date || effectiveStartDate;

      if (!effectiveStartDate || !reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Tanggal dan alasan wajib diisi.' });
      }
      if (new Date(effectiveEndDate) < new Date(effectiveStartDate)) {
        return res.status(400).json({ success: false, message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' });
      }

      if (type === 'lembur' && (!start_time || !end_time)) {
        return res.status(400).json({ success: false, message: 'Jam mulai dan jam selesai lembur wajib diisi.' });
      }

      const attachmentPath = req.file ? `/uploads/submissions/${req.file.filename}` : null;

      const [result] = await pool.query(
        `INSERT INTO submissions (user_id, type, start_date, end_date, start_time, end_time, reason, attachment, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, type, effectiveStartDate, effectiveEndDate, start_time || null, end_time || null, reason.trim(), attachmentPath]
      );

      res.status(201).json({
        success: true,
        message: type === 'lembur' 
          ? 'Pengajuan lembur berhasil dikirim dan menunggu persetujuan Admin Manager.' 
          : 'Pengajuan berhasil dikirim dan menunggu persetujuan Admin Manager.',
        submission_id: result.insertId
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Gagal mengirim pengajuan.' });
    }
  }
);

/**
 * GET /api/submissions/mine
 * Daftar pengajuan milik user yang login.
 */
router.get('/mine', requireAuth, requireRole('employee'), requireActiveAccount, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, type, start_date, end_date, start_time, end_time, reason, attachment, status, review_note, reviewed_at, created_at
       FROM submissions WHERE user_id = ? ORDER BY created_at DESC`,
      [req.session.user.id]
    );
    res.json({ success: true, submissions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar pengajuan.' });
  }
});

module.exports = router;
