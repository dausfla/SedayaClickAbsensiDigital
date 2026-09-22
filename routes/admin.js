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

    const conditions = ["s.status = 'pending'"];
    const params = [];

    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT s.id, s.type, s.start_date, s.end_date, s.start_time, s.end_time, s.reason, s.attachment, s.status, s.created_at,
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
      `SELECT s.id, s.type, s.start_date, s.end_date, s.start_time, s.end_time, s.reason, s.status, s.review_note, s.reviewed_at,
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
    const { user_id, type, start_date, end_date, start_time, end_time, reason, status = 'pending', review_note = '' } = req.body;

    if (!user_id || !type || !start_date || !end_date || !reason) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }

    const reviewedBy = status !== 'pending' ? req.session.user.id : null;
    const reviewedAt = status !== 'pending' ? new Date() : null;

    const [result] = await pool.query(
      `INSERT INTO submissions (user_id, type, start_date, end_date, start_time, end_time, reason, status, review_note, reviewed_by, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, type, start_date, end_date, start_time || null, end_time || null, reason, status, review_note || null, reviewedBy, reviewedAt]
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
    const { type, start_date, end_date, start_time, end_time, reason, status, review_note } = req.body;

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
           start_time = COALESCE(?, start_time),
           end_time = COALESCE(?, end_time),
           reason = COALESCE(?, reason),
           status = COALESCE(?, status),
           review_note = COALESCE(?, review_note),
           reviewed_by = IF(? IS NOT NULL AND ? != 'pending', ?, reviewed_by),
           reviewed_at = IF(? IS NOT NULL AND ? != 'pending', NOW(), reviewed_at)
       WHERE id = ?`,
      [type, start_date, end_date, start_time, end_time, reason, status, review_note, status, status, reviewedBy, status, status, id]
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
    const { division_id } = req.query;
    const conditions = ["a.overtime_clock_in_time IS NOT NULL", "(a.overtime_status IS NULL OR a.overtime_status = 'pending')"];
    const params = [];

    // Filter divisi opsional jika dikirim via query
    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.query(
      `SELECT a.id, a.user_id, a.attendance_date, a.overtime_clock_in_time, a.overtime_clock_out_time,
              a.overtime_clock_in_photo, a.overtime_clock_out_photo, a.overtime_clock_in_lat, a.overtime_clock_in_lng,
              a.overtime_clock_out_lat, a.overtime_clock_out_lng, a.overtime_task_reason, a.overtime_clock_in_note,
              a.overtime_clock_out_note, a.overtime_duration_seconds, COALESCE(a.overtime_status, 'pending') AS overtime_status,
              u.full_name, d.name AS division_name, p.name AS position_name
       FROM attendances a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
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
    const { division_id } = req.query;
    const conditions = ["a.overtime_status IN ('approved','rejected')"];
    const params = [];

    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.query(
      `SELECT a.id, a.user_id, a.attendance_date, a.overtime_clock_in_time, a.overtime_clock_out_time,
              a.overtime_clock_in_photo, a.overtime_clock_out_photo, a.overtime_task_reason,
              a.overtime_clock_in_note, a.overtime_clock_out_note, a.overtime_duration_seconds,
              a.overtime_status, a.overtime_review_note, a.overtime_reviewed_at,
              u.full_name, d.name AS division_name, p.name AS position_name,
              reviewer.full_name AS reviewed_by_name
       FROM attendances a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN users reviewer ON reviewer.id = a.overtime_reviewed_by
       ${where}
       ORDER BY a.overtime_reviewed_at DESC LIMIT 100`,
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
 * body: { decision: 'approved' | 'rejected', review_note: string (wajib) }
 */
router.patch('/overtime/:id/decision', ...scoped, async (req, res) => {
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
      [decision, review_note.trim(), req.session.user.id, id]
    );

    res.json({ success: true, message: `Presensi lembur berhasil di-${decision === 'approved' ? 'setujui' : 'tolak'}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memproses keputusan lembur.' });
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
          overtime_task_reason = NULL, overtime_clock_in_note = NULL,
          overtime_clock_out_note = NULL, overtime_duration_seconds = 0,
          overtime_status = NULL, overtime_review_note = NULL,
          overtime_reviewed_by = NULL, overtime_reviewed_at = NULL
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

module.exports = router;

