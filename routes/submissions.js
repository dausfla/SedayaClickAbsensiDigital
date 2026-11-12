// routes/submissions.js
// Step 3: Formulir Pengajuan Izin / Cuti / Sakit oleh karyawan.
// Karyawan HANYA boleh melihat daftar pengajuannya sendiri (bukan rekap divisi/semua orang).

const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole, requireActiveAccount } = require('../middleware/auth');
const { uploadSubmissionAttachment } = require('../utils/uploadConfig');
const { sendOvertimeAlertEmail, sendGeneralSubmissionAlertEmail } = require('../utils/mailer');

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
      const { type, start_date, end_date, start_time, end_time, reason, handover_plan, handover_to_name, handover_to_position } = req.body;
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

      const finalHandoverPlan = type === 'cuti' && handover_plan ? handover_plan.trim() : null;
      const finalHandoverToName = type === 'cuti' && handover_to_name ? handover_to_name.trim() : null;
      const finalHandoverToPos = type === 'cuti' && handover_to_position ? handover_to_position.trim() : null;

      const [result] = await pool.query(
        `INSERT INTO submissions (user_id, type, start_date, end_date, start_time, end_time, reason, attachment, handover_plan, handover_to_name, handover_to_position, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, type, effectiveStartDate, effectiveEndDate, start_time || null, end_time || null, reason.trim(), attachmentPath, finalHandoverPlan, finalHandoverToName, finalHandoverToPos]
      );

      // Kirim notifikasi email darurat ke Manajer (asynchronous / non-blocking)
      setImmediate(async () => {
        try {
          const [userRows] = await pool.query(
            `SELECT u.id, u.full_name, u.division_id, d.name AS division_name, p.name AS position_name
             FROM users u
             LEFT JOIN divisions d ON d.id = u.division_id
             LEFT JOIN positions p ON p.id = u.position_id
             WHERE u.id = ?`,
            [userId]
          );
          const emp = userRows[0] || { full_name: req.session.user.full_name };

          if (type === 'lembur') {
            await sendOvertimeAlertEmail({
              userId,
              employeeName: emp.full_name,
              divisionName: emp.division_name || 'Umum',
              positionName: emp.position_name || 'Staff',
              divisionId: emp.division_id,
              type: 'submission_form',
              taskReason: reason.trim(),
              submissionDate: effectiveStartDate,
              startTime: start_time || null,
              endTime: end_time || null,
              photoUrl: attachmentPath,
              currentSubmissionId: result.insertId,
            });
          } else {
            // Pengajuan Izin / Cuti / Sakit
            await sendGeneralSubmissionAlertEmail({
              userId,
              employeeName: emp.full_name,
              divisionName: emp.division_name || 'Umum',
              positionName: emp.position_name || 'Staff',
              divisionId: emp.division_id,
              type: type,
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              reason: reason.trim(),
              handoverPlan: finalHandoverPlan,
              handoverToName: finalHandoverToName,
              attachmentUrl: attachmentPath,
              currentSubmissionId: result.insertId,
            });
          }
        } catch (mailErr) {
          console.error(`[Submission Mail Notification Error (${type})]:`, mailErr.message);
        }
      });

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
      `SELECT id, type, start_date, end_date, start_time, end_time, reason, attachment, handover_plan, handover_to_name, handover_to_position, status, review_note, reviewed_at, created_at
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
