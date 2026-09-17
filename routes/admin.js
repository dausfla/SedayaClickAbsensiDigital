// routes/admin.js
// Step 4: Modul Approval Admin Manager.
// Semua query di-scope ke division_id milik Admin Manager yang login,
// sehingga satu Admin Manager tidak bisa melihat/approve pengajuan divisi lain.

const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole, requireActiveAccount } = require('../middleware/auth');

const router = express.Router();

const scoped = [requireAuth, requireRole('admin_manager', 'super_admin'), requireActiveAccount];

/**
 * GET /api/admin/submissions/pending
 * Daftar pengajuan izin/cuti/sakit yang berstatus 'pending'.
 * Admin Manager hanya bisa melihat divisinya sendiri; Super Admin bisa melihat semua divisi atau memfilter per divisi.
 */
router.get('/submissions/pending', ...scoped, async (req, res) => {
  try {
    const { division_id } = req.query;
    const userRole = req.session.user.role;
    const userDivisionId = req.session.user.division_id;

    const conditions = ["s.status = 'pending'"];
    const params = [];

    if (userRole === 'admin_manager') {
      if (!userDivisionId) {
        return res.status(400).json({ success: false, message: 'Akun Anda belum terhubung ke divisi manapun.' });
      }
      conditions.push('u.division_id = ?');
      params.push(userDivisionId);
    } else if (division_id) {
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
 * Riwayat pengajuan yang sudah diproses (approved/rejected).
 */
router.get('/submissions/history', ...scoped, async (req, res) => {
  try {
    const { division_id } = req.query;
    const userRole = req.session.user.role;
    const userDivisionId = req.session.user.division_id;

    const conditions = ["s.status IN ('approved','rejected')"];
    const params = [];

    if (userRole === 'admin_manager') {
      conditions.push('u.division_id = ?');
      params.push(userDivisionId);
    } else if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT s.id, s.type, s.start_date, s.end_date, s.status, s.review_note, s.reviewed_at,
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
    const userRole = req.session.user.role;
    const userDivisionId = req.session.user.division_id;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Keputusan tidak valid.' });
    }
    if (!review_note || !review_note.trim()) {
      return res.status(400).json({ success: false, message: 'Catatan alasan wajib diisi.' });
    }

    const conditions = ['s.id = ?', "s.status = 'pending'"];
    const params = [id];

    if (userRole === 'admin_manager') {
      conditions.push('u.division_id = ?');
      params.push(userDivisionId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.query(
      `SELECT s.id FROM submissions s JOIN users u ON u.id = s.user_id ${where}`,
      params
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
 * Frontend dapat melakukan polling berkala ke endpoint ini untuk efek "real-time".
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

module.exports = router;
