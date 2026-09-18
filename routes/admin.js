// routes/admin.js
// Modul Pengajuan (Admin Manager & Super Admin)
// Admin Manager & Super Admin dapat melihat, memproses, membuat, mengedit, dan menghapus pengajuan
// dari seluruh divisi atau memfilter per divisi.

const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole, requireActiveAccount } = require('../middleware/auth');

const router = express.Router();

const scoped = [requireAuth, requireRole('admin_manager', 'super_admin'), requireActiveAccount];

/**
 * GET /api/admin/submissions/pending
 * Daftar pengajuan izin/cuti/sakit yang berstatus 'pending'.
 */
router.get('/submissions/pending', ...scoped, async (req, res) => {
  try {
    const { division_id } = req.query;

    const conditions = ["s.status = 'pending'"];
    const params = [];

    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT s.id, s.type, s.start_date, s.end_date, s.reason, s.attachment, s.status, s.created_at,
              u.full_name, u.id AS user_id, p.name AS position_name, d.name AS division_name
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN divisions d ON d.id = u.division_id
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
      `SELECT s.id, s.type, s.start_date, s.end_date, s.reason, s.status, s.review_note, s.reviewed_at,
              u.full_name, d.name AS division_name
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       ${where}
       ORDER BY s.reviewed_at DESC LIMIT 100`,
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
 * body: { decision: 'approved' | 'rejected', review_note: string (wajib) }
 */
router.patch('/submissions/:id/decision', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, review_note } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Keputusan tidak valid.' });
    }
    if (!review_note || !review_note.trim()) {
      return res.status(400).json({ success: false, message: 'Catatan alasan wajib diisi.' });
    }

    const [rows] = await pool.query(
      `SELECT s.id FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.status = 'pending'`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan atau sudah diproses.' });
    }

    await pool.query(
      `UPDATE submissions SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
      [decision, review_note, req.session.user.id, id]
    );

    res.json({ success: true, message: `Pengajuan berhasil di-${decision === 'approved' ? 'setujui' : 'tolak'}.` });
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
    const divisionId = req.session.user.division_id;
    const [rows] = await pool.query(
      `SELECT u.id AS user_id, u.full_name, p.name AS position_name,
              a.clock_in_time, a.clock_out_time, a.status,
              a.late_duration_seconds, a.overtime_seconds
       FROM users u
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN attendances a ON a.user_id = u.id AND a.attendance_date = CURDATE()
       WHERE u.division_id = ? AND u.role = 'employee' AND u.status = 'active'
       ORDER BY u.full_name ASC`,
      [divisionId]
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
    const { user_id, type, start_date, end_date, reason, status = 'pending', review_note = '' } = req.body;

    if (!user_id || !type || !start_date || !end_date || !reason) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }

    const reviewedBy = status !== 'pending' ? req.session.user.id : null;
    const reviewedAt = status !== 'pending' ? new Date() : null;

    const [result] = await pool.query(
      `INSERT INTO submissions (user_id, type, start_date, end_date, reason, status, review_note, reviewed_by, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, type, start_date, end_date, reason, status, review_note || null, reviewedBy, reviewedAt]
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
    const { type, start_date, end_date, reason, status, review_note } = req.body;

    const [check] = await pool.query(
      `SELECT s.id FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan.' });
    }

    const reviewedBy = status && status !== 'pending' ? req.session.user.id : null;

    await pool.query(
      `UPDATE submissions 
       SET type = COALESCE(?, type),
           start_date = COALESCE(?, start_date),
           end_date = COALESCE(?, end_date),
           reason = COALESCE(?, reason),
           status = COALESCE(?, status),
           review_note = COALESCE(?, review_note),
           reviewed_by = IF(? IS NOT NULL AND ? != 'pending', ?, reviewed_by),
           reviewed_at = IF(? IS NOT NULL AND ? != 'pending', NOW(), reviewed_at)
       WHERE id = ?`,
      [type, start_date, end_date, reason, status, review_note, status, status, reviewedBy, status, status, id]
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

module.exports = router;

