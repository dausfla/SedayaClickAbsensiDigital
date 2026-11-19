// routes/admin.js
// Modul Pengajuan (Admin Manager & Super Admin)
// Admin Manager & Super Admin dapat melihat, memproses, membuat, mengedit, dan menghapus pengajuan
// dari seluruh divisi atau memfilter per divisi.

const express = require('express');
const multer = require('multer');
const pool = require('../config/db');
const { requireAuth, requireRole, requireActiveAccount } = require('../middleware/auth');
const {
  DEFAULT_SHIFT_CODES,
  resolveShiftCode,
  getDaysInMonth,
  generateRosterTemplateXLSX,
  generateRosterMatrixXLSX,
  parseRosterXLSX
} = require('../utils/rosterHelper');

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

const scoped = [requireAuth, requireRole('admin_manager', 'super_admin'), requireActiveAccount];

/**
 * GET /api/admin/divisions
 * Daftar divisi langsung dari database untuk filter dropdown.
 */
router.get('/divisions', ...scoped, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM divisions ORDER BY name ASC');
    res.json({ success: true, divisions: rows });
  } catch (err) {
    console.error('Gagal mengambil daftar divisi:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar divisi.' });
  }
});

/**
 * GET /api/admin/submissions/pending
 * Daftar pengajuan izin/cuti/sakit yang berstatus 'pending'.
 */
router.get('/submissions/pending', ...scoped, async (req, res) => {
  try {
    const { division_id } = req.query;

    const conditions = ["s.status IN ('pending', 'under_review')"];
    const params = [];

    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT s.id, s.type, s.start_date, s.end_date, s.start_time, s.end_time, s.reason, s.attachment, s.handover_plan, s.handover_to_name, s.handover_to_position, s.status, s.review_note, s.reviewed_at, s.created_at,
              u.full_name, u.id AS user_id, p.name AS position_name, d.name AS division_name,
              reviewer.full_name AS reviewed_by_name, reviewer.role AS reviewed_by_role
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN users reviewer ON reviewer.id = s.reviewed_by
       ${where}
       ORDER BY s.created_at ASC`,
      params
    );
    res.json({ success: true, submissions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat pengajuan pending.' });
  }
});

/**
 * GET /api/admin/submissions/history
 * Riwayat pengajuan yang sudah dipproses (approved/rejected).
 */
router.get('/submissions/history', ...scoped, async (req, res) => {
  try {
    const { division_id } = req.query;

    const conditions = ["s.status IN ('approved','rejected')"];
    const params = [];

    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT s.id, s.type, s.start_date, s.end_date, s.start_time, s.end_time, s.reason, s.attachment, s.handover_plan, s.handover_to_name, s.handover_to_position, s.status, s.review_note, s.reviewed_at, s.created_at,
              u.full_name, d.name AS division_name,
              reviewer.full_name AS reviewed_by_name, reviewer.role AS reviewed_by_role
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN users reviewer ON reviewer.id = s.reviewed_by
       ${where}
       ORDER BY s.reviewed_at DESC LIMIT 150`,
      params
    );
    res.json({ success: true, submissions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat riwayat pengajuan.' });
  }
});

/**
 * PATCH /api/admin/submissions/:id/decision
 * body: { decision: 'approved' | 'rejected' | 'under_review', review_note: string }
 */
router.patch('/submissions/:id/decision', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, review_note } = req.body;

    if (!['approved', 'rejected', 'under_review'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Keputusan tidak valid.' });
    }
    const finalNote = review_note && review_note.trim() 
      ? review_note.trim() 
      : (decision === 'under_review' ? 'Pengajuan sedang ditinjau oleh manajemen' : '');

    if (['approved', 'rejected'].includes(decision) && !finalNote) {
      return res.status(400).json({ success: false, message: 'Catatan alasan wajib diisi.' });
    }

    const [rows] = await pool.query(
      `SELECT s.id FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.status IN ('pending', 'under_review')`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan atau sudah diproses.' });
    }

    await pool.query(
      `UPDATE submissions SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
      [decision, finalNote, req.session.user.id, id]
    );

    let msg = 'Keputusan berhasil disimpan.';
    if (decision === 'approved') msg = 'Pengajuan berhasil disetujui.';
    else if (decision === 'rejected') msg = 'Pengajuan berhasil ditolak.';
    else if (decision === 'under_review') msg = 'Pengajuan berhasil ditandai sedang ditinjau.';

    res.json({ success: true, message: msg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memproses keputusan.' });
  }
});

/**
 * GET /api/admin/monitoring/today
 * Monitoring kehadiran tim secara real-time (hari ini) untuk divisi Admin Manager.
 */
router.get('/monitoring/today', ...scoped, async (req, res) => {
  try {
    const { division_id } = req.query;
    let whereClause = "WHERE u.role = 'employee' AND u.status = 'active'";
    const params = [];
    if (division_id) {
      whereClause += " AND u.division_id = ?";
      params.push(division_id);
    }
    const [rows] = await pool.query(
      `SELECT u.id AS user_id, u.full_name, p.name AS position_name, d.name AS division_name,
              a.clock_in_time, a.clock_out_time, a.status,
              a.late_duration_seconds, a.overtime_seconds
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN attendances a ON a.user_id = u.id AND a.attendance_date = CURDATE()
       ${whereClause}
       ORDER BY u.full_name ASC`,
      params
    );
    res.json({ success: true, team: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat data monitoring.' });
  }
});

/**
 * GET /api/admin/employees
 * Daftar karyawan untuk dropdown pembuatan pengajuan baru.
 */
router.get('/employees', ...scoped, async (req, res) => {
  try {
    const { division_id } = req.query;

    const conditions = ["u.role = 'employee'", "u.status = 'active'"];
    const params = [];

    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, d.name AS division_name, p.name AS position_name
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       ${where}
       ORDER BY u.full_name ASC`,
      params
    );
    res.json({ success: true, employees: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar karyawan.' });
  }
});

/**
 * POST /api/admin/submissions
 * Buat pengajuan baru atas nama karyawan.
 */
router.post('/submissions', ...scoped, async (req, res) => {
  try {
    const { user_id, type, start_date, end_date, start_time, end_time, reason, handover_plan, handover_to_name, handover_to_position, status = 'pending', review_note = '' } = req.body;

    if (!user_id || !type || !start_date || !end_date || !reason) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }

    const reviewedBy = status !== 'pending' ? req.session.user.id : null;
    const reviewedAt = status !== 'pending' ? new Date() : null;

    const finalHandoverPlan = type === 'cuti' && handover_plan ? handover_plan.trim() : null;
    const finalHandoverToName = type === 'cuti' && handover_to_name ? handover_to_name.trim() : null;
    const finalHandoverToPos = type === 'cuti' && handover_to_position ? handover_to_position.trim() : null;

    const [result] = await pool.query(
      `INSERT INTO submissions (user_id, type, start_date, end_date, start_time, end_time, reason, handover_plan, handover_to_name, handover_to_position, status, review_note, reviewed_by, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, type, start_date, end_date, start_time || null, end_time || null, reason, finalHandoverPlan, finalHandoverToName, finalHandoverToPos, status, review_note || null, reviewedBy, reviewedAt]
    );

    res.json({ success: true, message: 'Pengajuan berhasil dibuat.', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal membuat pengajuan.' });
  }
});

/**
 * PUT /api/admin/submissions/:id
 * Edit / Update pengajuan.
 */
router.put('/submissions/:id', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, type, start_date, end_date, start_time, end_time, reason, handover_plan, handover_to_name, handover_to_position, status, review_note } = req.body;

    const [check] = await pool.query(
      `SELECT s.id FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan.' });
    }

    const reviewedBy = status && status !== 'pending' ? req.session.user.id : null;

    const finalHandoverPlan = type === 'cuti' ? (handover_plan ? handover_plan.trim() : null) : null;
    const finalHandoverToName = type === 'cuti' ? (handover_to_name ? handover_to_name.trim() : null) : null;
    const finalHandoverToPos = type === 'cuti' ? (handover_to_position ? handover_to_position.trim() : null) : null;

    await pool.query(
      `UPDATE submissions 
       SET user_id = COALESCE(?, user_id),
           type = COALESCE(?, type),
           start_date = COALESCE(?, start_date),
           end_date = COALESCE(?, end_date),
           start_time = COALESCE(?, start_time),
           end_time = COALESCE(?, end_time),
           reason = COALESCE(?, reason),
           handover_plan = ?,
           handover_to_name = ?,
           handover_to_position = ?,
           status = COALESCE(?, status),
           review_note = COALESCE(?, review_note),
           reviewed_by = IF(? IS NOT NULL AND ? != 'pending', ?, reviewed_by),
           reviewed_at = IF(? IS NOT NULL AND ? != 'pending', NOW(), reviewed_at)
       WHERE id = ?`,
      [user_id, type, start_date, end_date, start_time, end_time, reason, finalHandoverPlan, finalHandoverToName, finalHandoverToPos, status, review_note, status, status, reviewedBy, status, status, id]
    );

    res.json({ success: true, message: 'Pengajuan berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui pengajuan.' });
  }
});

/**
 * DELETE /api/admin/submissions/:id
 * Hapus data pengajuan.
 */
router.delete('/submissions/:id', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;

    const [check] = await pool.query(
      `SELECT s.id FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan.' });
    }

    await pool.query('DELETE FROM submissions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pengajuan berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghapus pengajuan.' });
  }
});

/* ============================================================
   MANAJEMEN PRESENSI LEMBUR (OVERTIME ATTENDANCE APPROVAL)
   ============================================================ */

/**
 * GET /api/admin/overtime/pending
 * Daftar presensi lembur karyawan berstatus 'pending'.
 */
router.get('/overtime/pending', ...scoped, async (req, res) => {
  try {
    const { division_id, period } = req.query;
    const conditions = ["a.overtime_clock_in_time IS NOT NULL", "(a.overtime_status IS NULL OR a.overtime_status IN ('pending', 'under_review'))"];
    const params = [];

    // Filter periode tanggal
    if (period === 'today') {
      conditions.push('a.attendance_date = CURDATE()');
    } else if (period === 'weekly') {
      conditions.push('a.attendance_date >= CURDATE() - INTERVAL 7 DAY');
    } else if (period === 'monthly') {
      conditions.push('a.attendance_date >= CURDATE() - INTERVAL 30 DAY');
    }

    // Filter divisi: jika ada parameter division_id, batasi ke divisi tersebut
    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.query(
      `SELECT a.id, a.user_id, a.attendance_date, a.overtime_clock_in_time, a.overtime_clock_out_time,
              a.overtime_clock_in_photo, a.overtime_clock_out_photo, a.overtime_clock_in_lat, a.overtime_clock_in_lng,
              a.overtime_clock_out_lat, a.overtime_clock_out_lng, a.overtime_task_reason, a.overtime_work_attachment,
              a.overtime_clock_in_note, a.overtime_clock_out_note, a.overtime_duration_seconds, 
              COALESCE(a.overtime_status, 'pending') AS overtime_status,
              a.overtime_review_note, a.overtime_reviewed_at,
              u.full_name, d.name AS division_name, p.name AS position_name,
              reviewer.full_name AS reviewed_by_name, reviewer.role AS reviewed_by_role
       FROM attendances a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN users reviewer ON reviewer.id = a.overtime_reviewed_by
       ${where}
       ORDER BY a.attendance_date DESC, a.overtime_clock_in_time DESC`,
      params
    );
    res.json({ success: true, overtimes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat presensi lembur pending.' });
  }
});

/**
 * GET /api/admin/overtime/history
 * Riwayat presensi lembur yang sudah diproses (approved/rejected).
 */
router.get('/overtime/history', ...scoped, async (req, res) => {
  try {
    const { division_id, period } = req.query;
    const conditions = ["a.overtime_status IN ('approved','rejected')"];
    const params = [];

    // Filter periode tanggal
    if (period === 'today') {
      conditions.push('a.attendance_date = CURDATE()');
    } else if (period === 'weekly') {
      conditions.push('a.attendance_date >= CURDATE() - INTERVAL 7 DAY');
    } else if (period === 'monthly') {
      conditions.push('a.attendance_date >= CURDATE() - INTERVAL 30 DAY');
    }

    // Filter divisi: jika ada parameter division_id, batasi ke divisi tersebut
    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.query(
      `SELECT a.id, a.user_id, a.attendance_date, a.overtime_clock_in_time, a.overtime_clock_out_time,
              a.overtime_clock_in_photo, a.overtime_clock_out_photo, a.overtime_clock_in_lat, a.overtime_clock_in_lng,
              a.overtime_clock_out_lat, a.overtime_clock_out_lng, a.overtime_task_reason, a.overtime_work_attachment,
              a.overtime_clock_in_note, a.overtime_clock_out_note, a.overtime_duration_seconds,
              a.overtime_status, a.overtime_review_note, a.overtime_reviewed_at,
              u.full_name, d.name AS division_name, p.name AS position_name,
              reviewer.full_name AS reviewed_by_name, reviewer.role AS reviewed_by_role
       FROM attendances a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN users reviewer ON reviewer.id = a.overtime_reviewed_by
       ${where}
       ORDER BY a.overtime_reviewed_at DESC LIMIT 500`,
      params
    );
    res.json({ success: true, overtimes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat riwayat presensi lembur.' });
  }
});

/**
 * PATCH /api/admin/overtime/:id/decision
 * body: { decision: 'approved' | 'rejected' | 'under_review', review_note: string }
 */
router.patch('/overtime/:id/decision', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, review_note } = req.body;

    if (!['approved', 'rejected', 'under_review'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Keputusan tidak valid.' });
    }
    const finalNote = review_note && review_note.trim() 
      ? review_note.trim() 
      : (decision === 'under_review' ? 'Presensi lembur sedang ditinjau oleh manajemen' : '');

    if (['approved', 'rejected'].includes(decision) && !finalNote) {
      return res.status(400).json({ success: false, message: 'Catatan alasan wajib diisi.' });
    }

    const [rows] = await pool.query(
      `SELECT a.id FROM attendances a JOIN users u ON u.id = a.user_id WHERE a.id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Presensi lembur tidak ditemukan.' });
    }

    await pool.query(
      `UPDATE attendances 
       SET overtime_status = ?, overtime_review_note = ?, overtime_reviewed_by = ?, overtime_reviewed_at = NOW() 
       WHERE id = ?`,
      [decision, finalNote, req.session.user.id, id]
    );

    let msg = 'Keputusan lembur berhasil disimpan.';
    if (decision === 'approved') msg = 'Presensi lembur berhasil disetujui.';
    else if (decision === 'rejected') msg = 'Presensi lembur berhasil ditolak.';
    else if (decision === 'under_review') msg = 'Presensi lembur ditandai sedang ditinjau.';

    res.json({ success: true, message: msg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memproses keputusan lembur.' });
  }
});

/**
 * PUT /api/admin/overtime/:id
 * Edit / Update rincian presensi lembur (koreksi data oleh manajemen).
 */
router.put('/overtime/:id', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const { overtime_task_reason, overtime_clock_in_note, overtime_clock_out_note, overtime_status, overtime_review_note } = req.body;

    const [rows] = await pool.query('SELECT id FROM attendances WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Presensi lembur tidak ditemukan.' });
    }

    await pool.query(
      `UPDATE attendances 
       SET overtime_task_reason = COALESCE(?, overtime_task_reason),
           overtime_clock_in_note = COALESCE(?, overtime_clock_in_note),
           overtime_clock_out_note = COALESCE(?, overtime_clock_out_note),
           overtime_status = COALESCE(?, overtime_status),
           overtime_review_note = COALESCE(?, overtime_review_note),
           overtime_reviewed_by = IF(? IS NOT NULL AND ? != 'pending', ?, overtime_reviewed_by),
           overtime_reviewed_at = IF(? IS NOT NULL AND ? != 'pending', NOW(), overtime_reviewed_at)
       WHERE id = ?`,
      [
        overtime_task_reason || null,
        overtime_clock_in_note || null,
        overtime_clock_out_note || null,
        overtime_status || null,
        overtime_review_note || null,
        overtime_status, overtime_status, req.session.user.id,
        overtime_status, overtime_status,
        id
      ]
    );

    res.json({ success: true, message: 'Data presensi lembur berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui presensi lembur.' });
  }
});

/**
 * DELETE /api/admin/overtime/:id
 * Hapus / reset data presensi lembur.
 */
router.delete('/overtime/:id', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query('SELECT * FROM attendances WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Presensi lembur tidak ditemukan.' });
    }

    const row = rows[0];
    if (row.clock_in_time) {
      // Jika ada presensi harian biasa, bersihkan data lembur saja
      await pool.query(
        `UPDATE attendances SET 
          overtime_clock_in_time = NULL, overtime_clock_out_time = NULL,
          overtime_clock_in_photo = NULL, overtime_clock_out_photo = NULL,
          overtime_clock_in_lat = NULL, overtime_clock_in_lng = NULL,
          overtime_clock_out_lat = NULL, overtime_clock_out_lng = NULL,
          overtime_task_reason = NULL, overtime_work_attachment = NULL,
          overtime_clock_in_note = NULL, overtime_clock_out_note = NULL,
          overtime_duration_seconds = 0, overtime_status = NULL,
          overtime_review_note = NULL, overtime_reviewed_by = NULL,
          overtime_reviewed_at = NULL
         WHERE id = ?`,
        [id]
      );
    } else {
      // Jika baris murni lembur tanpa jam kerja shift, hapus baris dari attendances
      await pool.query('DELETE FROM attendances WHERE id = ?', [id]);
    }

    res.json({ success: true, message: 'Presensi lembur berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghapus presensi lembur.' });
  }
});

/**
 * DELETE /api/admin/attendance/:id
 * Hapus data absensi dari tabel attendances.
 */
router.delete('/attendance/:id', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id FROM attendances WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan.' });
    }

    await pool.query('DELETE FROM attendances WHERE id = ?', [id]);
    res.json({ success: true, message: 'Data absensi berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghapus data absensi.' });
  }
});

/**
 * POST /api/admin/test-email
 * Endpoint pengujian pengiriman email SMTP oleh Super Admin / Admin Manager
 */
router.post('/test-email', ...scoped, async (req, res) => {
  try {
    const targetEmail = req.body.email || req.session.user.email;
    const { sendTestEmail } = require('../utils/mailer');
    const info = await sendTestEmail(targetEmail);
    res.json({
      success: true,
      message: `Email pengujian berhasil dikirim ke ${targetEmail}`,
      messageId: info.messageId,
    });
  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengirim email pengujian: ' + err.message });
  }
});

/**
 * POST /api/admin/send-pending-reminder
 * Mengirimkan email pengingat rekap antrean pengajuan tertunda (Lembur, Izin, Cuti, Sakit)
 * secara manual melalui form Modul Notifikasi Super Admin / Admin
 * Body: { target_emails, division_id, custom_subject, custom_note }
 */
router.post('/send-pending-reminder', ...scoped, async (req, res) => {
  try {
    const { target_emails, division_id, custom_subject, custom_note } = req.body;
    const { sendManualReminderEmail } = require('../utils/mailer');

    const targetDivision =
      req.session.user.role === 'admin_manager' && req.session.user.division_id
        ? req.session.user.division_id
        : division_id || null;

    const result = await sendManualReminderEmail({
      targetEmails: target_emails,
      divisionId: targetDivision,
      customSubject: custom_subject,
      customNote: custom_note,
    });

    res.json({
      success: true,
      message: `Email pengingat berhasil dikirim ke: ${result.recipients.join(', ')}`,
      recipients: result.recipients,
      pendingCount: result.pendingCount,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('Send pending reminder error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengirim email pengingat: ' + err.message });
  }
});

/* ---------------------------------------------------------
   SISTEM ROSTER SHIFT & LIBUR ROLLING (MATRIKS BULANAN)
--------------------------------------------------------- */

/**
 * GET /api/admin/roster/matrix
 * Mengambil matriks jadwal roster bulanan untuk seluruh karyawan atau per divisi.
 * Query: month=YYYY-MM, division_id=...
 */
router.get('/roster/matrix', ...scoped, async (req, res) => {
  try {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonthStr = req.query.month || defaultMonth;
    const [year, month] = targetMonthStr.split('-');
    const days = getDaysInMonth(year, month);
    const startDate = `${year}-${month}-01`;
    const lastDay = days[days.length - 1].day;
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;


    // Filter divisi
    let divisionId = req.query.division_id || null;
    if (req.session.user.role === 'admin_manager' && req.session.user.division_id) {
      divisionId = req.session.user.division_id;
    }

    const scope = (req.query.scope || 'roster').toLowerCase();
    const userConds = ["u.status = 'active'", "u.role = 'employee'"];
    const userParams = [];
    if (divisionId) {
      userConds.push('u.division_id = ?');
      userParams.push(divisionId);
    }

    if (scope !== 'all') {
      // Hanya tampilkan karyawan yang shift-nya diatur ke Shift Khusus / Roster
      // ATAU karyawan yang sudah memiliki entri jadwal di employee_schedules pada bulan target
      userConds.push(`(
        s.shift_type = 'roster' 
        OR LOWER(s.name) LIKE '%khusus%' 
        OR LOWER(s.name) LIKE '%roster%'
        OR u.id IN (
          SELECT DISTINCT es.user_id FROM employee_schedules es
          WHERE es.schedule_date BETWEEN ? AND ?
        )
      )`);
      userParams.push(startDate, endDate);
    }

    const [employees] = await pool.query(
      `SELECT u.id, u.full_name, u.division_id, d.name AS division_name, p.name AS position_name, 
              u.shift_id, s.name AS shift_name, s.shift_type
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN shift_settings s ON s.id = u.shift_id
       WHERE ${userConds.join(' AND ')}
       ORDER BY d.name ASC, u.full_name ASC`,
      userParams
    );

    // Ambil semua jadwal di bulan target
    const [scheduleRows] = await pool.query(
      `SELECT es.id, es.user_id, es.schedule_date, es.shift_code, es.start_time, es.end_time, es.is_day_off, es.notes
       FROM employee_schedules es
       JOIN users u ON u.id = es.user_id
       WHERE es.schedule_date BETWEEN ? AND ? ${divisionId ? 'AND u.division_id = ?' : ''}`,
      divisionId ? [startDate, endDate, divisionId] : [startDate, endDate]
    );

    // Strukturkan schedules: { [userId]: { [dateStr]: scheduleObj } }
    const schedulesByEmployee = {};
    scheduleRows.forEach(s => {
      const dateKey = typeof s.schedule_date === 'string'
        ? s.schedule_date.slice(0, 10)
        : new Date(s.schedule_date).toISOString().slice(0, 10);
      if (!schedulesByEmployee[s.user_id]) schedulesByEmployee[s.user_id] = {};
      schedulesByEmployee[s.user_id][dateKey] = {
        id: s.id,
        shift_code: s.shift_code,
        start_time: s.start_time,
        end_time: s.end_time,
        is_day_off: s.is_day_off,
        notes: s.notes
      };
    });

    res.json({
      success: true,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      monthStr: targetMonthStr,
      days,
      employees,
      schedules: schedulesByEmployee,
      shiftCodes: DEFAULT_SHIFT_CODES,
      scope
    });
  } catch (err) {
    console.error('Get roster matrix error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat matriks jadwal: ' + err.message });
  }
});

/**
 * POST /api/admin/roster/cell
 * Mengubah jadwal roster pada 1 sel (karyawan dan tanggal tertentu).
 * Body: { user_id, schedule_date, shift_code }
 */
router.post('/roster/cell', ...scoped, async (req, res) => {
  try {
    const { user_id, schedule_date, shift_code } = req.body;
    if (!user_id || !schedule_date) {
      return res.status(400).json({ success: false, message: 'user_id dan schedule_date wajib diisi.' });
    }

    // Jika shift_code kosong, hapus jadwal agar kembali ke shift default
    if (!shift_code || shift_code.trim() === '') {
      await pool.query('DELETE FROM employee_schedules WHERE user_id = ? AND schedule_date = ?', [user_id, schedule_date]);
      return res.json({ success: true, message: 'Jadwal dihapus (kembali ke default profil).' });
    }

    const shiftMeta = resolveShiftCode(shift_code);
    await pool.query(
      `INSERT INTO employee_schedules (user_id, schedule_date, shift_code, start_time, end_time, is_day_off)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         shift_code = VALUES(shift_code),
         start_time = VALUES(start_time),
         end_time = VALUES(end_time),
         is_day_off = VALUES(is_day_off)`,
      [
        user_id,
        schedule_date,
        shiftMeta.code,
        shiftMeta.start_time,
        shiftMeta.end_time,
        shiftMeta.is_day_off
      ]
    );

    res.json({
      success: true,
      message: `Jadwal ${shiftMeta.code} berhasil disimpan.`,
      schedule: {
        user_id,
        schedule_date,
        shift_code: shiftMeta.code,
        start_time: shiftMeta.start_time,
        end_time: shiftMeta.end_time,
        is_day_off: shiftMeta.is_day_off
      }
    });
  } catch (err) {
    console.error('Save roster cell error:', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan sel jadwal: ' + err.message });
  }
});

/**
 * POST /api/admin/roster/bulk-save
 * Menyimpan banyak jadwal sekaligus dari interactive grid editor.
 * Body: { schedules: [ { user_id, schedule_date, shift_code }, ... ] }
 */
router.post('/roster/bulk-save', ...scoped, async (req, res) => {
  try {
    const { schedules } = req.body;
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ success: false, message: 'Data schedules harus berupa array.' });
    }

    let savedCount = 0;
    for (const item of schedules) {
      if (!item.user_id || !item.schedule_date) continue;

      if (!item.shift_code || item.shift_code.trim() === '') {
        await pool.query('DELETE FROM employee_schedules WHERE user_id = ? AND schedule_date = ?', [item.user_id, item.schedule_date]);
        savedCount++;
        continue;
      }

      const shiftMeta = resolveShiftCode(item.shift_code);
      await pool.query(
        `INSERT INTO employee_schedules (user_id, schedule_date, shift_code, start_time, end_time, is_day_off)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           shift_code = VALUES(shift_code),
           start_time = VALUES(start_time),
           end_time = VALUES(end_time),
           is_day_off = VALUES(is_day_off)`,
        [
          item.user_id,
          item.schedule_date,
          shiftMeta.code,
          shiftMeta.start_time,
          shiftMeta.end_time,
          shiftMeta.is_day_off
        ]
      );
      savedCount++;
    }

    res.json({ success: true, message: `${savedCount} jadwal berhasil disimpan.`, savedCount });
  } catch (err) {
    console.error('Bulk save roster error:', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan jadwal: ' + err.message });
  }
});

/**
 * GET /api/admin/roster/export-template
 * Mengunduh file Excel Template Roster bulanan.
 * Query: month=YYYY-MM, division_id=...
 */
router.get('/roster/export-template', ...scoped, async (req, res) => {
  try {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonthStr = req.query.month || defaultMonth;
    const [year, month] = targetMonthStr.split('-');
    const days = getDaysInMonth(year, month);
    const startDate = `${year}-${month}-01`;
    const lastDay = days[days.length - 1].day;
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    let divisionId = req.query.division_id || null;
    if (req.session.user.role === 'admin_manager' && req.session.user.division_id) {
      divisionId = req.session.user.division_id;
    }

    const scope = (req.query.scope || 'roster').toLowerCase();
    const userConds = ["u.status = 'active'", "u.role = 'employee'"];
    const userParams = [];
    if (divisionId) {
      userConds.push('u.division_id = ?');
      userParams.push(divisionId);
    }

    if (scope !== 'all') {
      userConds.push(`(
        s.shift_type = 'roster' 
        OR LOWER(s.name) LIKE '%khusus%' 
        OR LOWER(s.name) LIKE '%roster%'
        OR u.id IN (
          SELECT DISTINCT es.user_id FROM employee_schedules es
          WHERE es.schedule_date BETWEEN ? AND ?
        )
      )`);
      userParams.push(startDate, endDate);
    }

    const [employees] = await pool.query(
      `SELECT u.id, u.full_name, d.name AS division_name, p.name AS position_name, u.shift_id
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN shift_settings s ON s.id = u.shift_id
       WHERE ${userConds.join(' AND ')}
       ORDER BY d.name ASC, u.full_name ASC`,
      userParams
    );

    const buffer = await generateRosterTemplateXLSX(year, month, employees);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="template-roster-${year}-${month}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Export roster template error:', err);
    res.status(500).json({ success: false, message: 'Gagal membuat template roster: ' + err.message });
  }
});

/**
 * POST /api/admin/roster/import-excel
 * Mengimpor jadwal roster dari file Excel yang diisi user.
 * multipart/form-data: file, month (YYYY-MM)
 */
router.post('/roster/import-excel', ...scoped, uploadExcel.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File Excel wajib diunggah.' });
    }

    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonthStr = req.body.month || defaultMonth;
    const [year, month] = targetMonthStr.split('-');
    const days = getDaysInMonth(year, month);
    const startDate = `${year}-${month}-01`;
    const lastDay = days[days.length - 1].day;
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const [usersList] = await pool.query(
      'SELECT id, full_name, division_id FROM users WHERE status = "active"'
    );

    const parsed = await parseRosterXLSX(req.file.buffer, year, month, usersList);
    const { schedules, unrecognizedNames, matchedCount } = parsed;

    if (schedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada jadwal yang berhasil dibaca dari file Excel. Pastikan nama karyawan cocok.',
        unrecognizedNames
      });
    }

    // Bulk upsert ke employee_schedules
    let importedCount = 0;
    for (const item of schedules) {
      await pool.query(
        `INSERT INTO employee_schedules (user_id, schedule_date, shift_code, start_time, end_time, is_day_off)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           shift_code = VALUES(shift_code),
           start_time = VALUES(start_time),
           end_time = VALUES(end_time),
           is_day_off = VALUES(is_day_off)`,
        [
          item.user_id,
          item.schedule_date,
          item.shift_code,
          item.start_time,
          item.end_time,
          item.is_day_off
        ]
      );
      importedCount++;
    }

    res.json({
      success: true,
      message: `Berhasil mengimpor ${importedCount} entri jadwal untuk ${matchedCount} karyawan pada bulan ${targetMonthStr}.`,
      totalEntries: importedCount,
      matchedEmployees: matchedCount,
      unrecognizedNames
    });
  } catch (err) {
    console.error('Import roster error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengimpor file roster: ' + err.message });
  }
});

/**
 * GET /api/admin/roster/export-matrix
 * Mengunduh laporan matriks jadwal bulanan (full grid berwarna siap cetak).
 * Query: month=YYYY-MM, division_id=...
 */
router.get('/roster/export-matrix', ...scoped, async (req, res) => {
  try {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonthStr = req.query.month || defaultMonth;
    const [year, month] = targetMonthStr.split('-');
    const days = getDaysInMonth(year, month);
    const startDate = `${year}-${month}-01`;
    const lastDay = days[days.length - 1].day;
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;


    let divisionId = req.query.division_id || null;
    if (req.session.user.role === 'admin_manager' && req.session.user.division_id) {
      divisionId = req.session.user.division_id;
    }

    const scope = (req.query.scope || 'roster').toLowerCase();
    const userConds = ["u.status = 'active'", "u.role = 'employee'"];
    const userParams = [];
    if (divisionId) {
      userConds.push('u.division_id = ?');
      userParams.push(divisionId);
    }

    if (scope !== 'all') {
      userConds.push(`(
        s.shift_type = 'roster' 
        OR LOWER(s.name) LIKE '%khusus%' 
        OR LOWER(s.name) LIKE '%roster%'
        OR u.id IN (
          SELECT DISTINCT es.user_id FROM employee_schedules es
          WHERE es.schedule_date BETWEEN ? AND ?
        )
      )`);
      userParams.push(startDate, endDate);
    }

    const [employees] = await pool.query(
      `SELECT u.id, u.full_name, d.name AS division_name, p.name AS position_name, u.shift_id
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN shift_settings s ON s.id = u.shift_id
       WHERE ${userConds.join(' AND ')}
       ORDER BY d.name ASC, u.full_name ASC`,
      userParams
    );

    const [scheduleRows] = await pool.query(
      `SELECT es.user_id, es.schedule_date, es.shift_code
       FROM employee_schedules es
       JOIN users u ON u.id = es.user_id
       WHERE es.schedule_date BETWEEN ? AND ? ${divisionId ? 'AND u.division_id = ?' : ''}`,
      divisionId ? [startDate, endDate, divisionId] : [startDate, endDate]
    );

    const schedulesByEmployee = {};
    scheduleRows.forEach(s => {
      const dateKey = typeof s.schedule_date === 'string'
        ? s.schedule_date.slice(0, 10)
        : new Date(s.schedule_date).toISOString().slice(0, 10);
      if (!schedulesByEmployee[s.user_id]) schedulesByEmployee[s.user_id] = {};
      schedulesByEmployee[s.user_id][dateKey] = s;
    });

    const buffer = await generateRosterMatrixXLSX(year, month, employees, schedulesByEmployee);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="matriks-jadwal-roster-${year}-${month}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Export roster matrix error:', err);
    res.status(500).json({ success: false, message: 'Gagal membuat matriks jadwal: ' + err.message });
  }
});

module.exports = router;

