// routes/superadmin.js
// Step 5: Dashboard Super Admin & Manajemen User + Master Data.

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAuth, requireRole, requireActiveAccount } = require('../middleware/auth');

const router = express.Router();
const scoped = [requireAuth, requireRole('super_admin'), requireActiveAccount];

/* ============================================================
   DASHBOARD SUMMARY (gaya Mekari Talenta)
   ============================================================ */

/**
 * GET /api/superadmin/dashboard/summary?period=daily|weekly|monthly
 * Metrik KPI utama (Hadir, Terlambat, Izin, Sakit, Cuti, Pending) + data grafik distribusi.
 */
router.get('/dashboard/summary', ...scoped, async (req, res) => {
  try {
    const { period = 'daily' } = req.query;

    let attCondition = 'attendance_date = CURDATE()';
    let subCondition = 'start_date = CURDATE()';
    let chartDays = 6;

    if (period === 'weekly') {
      attCondition = 'attendance_date >= CURDATE() - INTERVAL 7 DAY';
      subCondition = 'start_date >= CURDATE() - INTERVAL 7 DAY';
      chartDays = 7;
    } else if (period === 'monthly') {
      attCondition = 'attendance_date >= CURDATE() - INTERVAL 30 DAY';
      subCondition = 'start_date >= CURDATE() - INTERVAL 30 DAY';
      chartDays = 30;
    }

    const [[onTime]] = await pool.query(
      `SELECT COUNT(*) AS total FROM attendances WHERE ${attCondition} AND status = 'on_time'`
    );
    const [[late]] = await pool.query(
      `SELECT COUNT(*) AS total FROM attendances WHERE ${attCondition} AND status = 'late'`
    );
    const [[pending]] = await pool.query(
      `SELECT COUNT(*) AS total FROM submissions WHERE status = 'pending'`
    );
    const [[activeUsers]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users WHERE status = 'active' AND role = 'employee'`
    );

    // Hitung Pengajuan per jenis (Izin, Sakit, Cuti)
    const [[izin]] = await pool.query(
      `SELECT COUNT(*) AS total FROM submissions WHERE type = 'izin' AND ${subCondition}`
    );
    const [[sakit]] = await pool.query(
      `SELECT COUNT(*) AS total FROM submissions WHERE type = 'sakit' AND ${subCondition}`
    );
    const [[cuti]] = await pool.query(
      `SELECT COUNT(*) AS total FROM submissions WHERE type = 'cuti' AND ${subCondition}`
    );

    const [chart] = await pool.query(
      `SELECT attendance_date,
              SUM(CASE WHEN status = 'on_time' THEN 1 ELSE 0 END) AS on_time_count,
              SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late_count
       FROM attendances
       WHERE attendance_date >= CURDATE() - INTERVAL ? DAY
       GROUP BY attendance_date
       ORDER BY attendance_date ASC`,
      [chartDays]
    );

    res.json({
      success: true,
      period,
      metrics: {
        on_time: onTime.total,
        late: late.total,
        pending_submissions: pending.total,
        total_active_employees: activeUsers.total,
        izin: izin.total,
        sakit: sakit.total,
        cuti: cuti.total
      },
      chart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat ringkasan dashboard.' });
  }
});

/* ============================================================
   MANAJEMEN USER
   ============================================================ */

/**
 * GET /api/superadmin/users?status=pending|active|inactive&role=...
 */
router.get('/users', ...scoped, async (req, res) => {
  try {
    const { status, role } = req.query;
    let sql = `SELECT u.id, u.full_name, u.email, u.whatsapp, u.address, u.role, u.status,
                      d.name AS division_name, p.name AS position_name, s.name AS shift_name,
                      u.division_id, u.position_id, u.shift_id, u.created_at
               FROM users u
               LEFT JOIN divisions d ON d.id = u.division_id
               LEFT JOIN positions p ON p.id = u.position_id
               LEFT JOIN shift_settings s ON s.id = u.shift_id
               WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND u.status = ?'; params.push(status); }
    if (role) { sql += ' AND u.role = ?'; params.push(role); }
    sql += ' ORDER BY u.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar pengguna.' });
  }
});

/**
 * PATCH /api/superadmin/users/:id/activate
 * Mengaktifkan akun hasil pendaftaran mandiri (status pending -> active),
 * sekaligus opsional melengkapi role/shift jika belum diset saat mendaftar.
 */
router.patch('/users/:id/activate', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, shift_id } = req.body;

    const fields = ["status = 'active'"];
    const params = [];
    if (role) { fields.push('role = ?'); params.push(role); }
    if (shift_id) { fields.push('shift_id = ?'); params.push(shift_id); }
    params.push(id);

    const [result] = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Akun berhasil diaktifkan.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengaktifkan akun.' });
  }
});

/**
 * PATCH /api/superadmin/users/:id/status
 * Menonaktifkan / mengaktifkan kembali akun secara manual.
 */
router.patch('/users/:id/status', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Status pengguna berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui status.' });
  }
});

/**
 * DELETE /api/superadmin/users/:id
 * Menghapus akun pengguna dari database beserta data absensi dan pengajuannya.
 */
router.delete('/users/:id', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id, 10) === req.session.user.id) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    }
    // Hapus data terkait terlebih dahulu agar tidak melanggar FK constraint
    await pool.query('DELETE FROM attendances WHERE user_id = ?', [id]);
    await pool.query('DELETE FROM submissions WHERE user_id = ?', [id]);
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghapus pengguna.' });
  }
});

/**
 * POST /api/superadmin/users
 * Formulir pembuatan user manual oleh Super Admin (langsung berstatus 'active').
 */
router.post('/users', ...scoped, async (req, res) => {
  try {
    const { full_name, email, password, whatsapp, address, division_id, position_id, shift_id, role } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Nama, email, password, dan role wajib diisi.' });
    }
    if (!['employee', 'admin_manager', 'super_admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role tidak valid.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email sudah digunakan.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password, whatsapp, address, division_id, position_id, shift_id, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [full_name, email, hashed, whatsapp || null, address || null, division_id || null, position_id || null, shift_id || null, role]
    );

    res.status(201).json({ success: true, message: 'Pengguna berhasil dibuat.', user_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal membuat pengguna.' });
  }
});

/**
 * PUT /api/superadmin/users/:id
 * Edit data pengguna (tidak termasuk password — gunakan endpoint reset terpisah jika perlu).
 */
router.put('/users/:id', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, whatsapp, address, division_id, position_id, shift_id, role } = req.body;

    await pool.query(
      `UPDATE users SET full_name = ?, whatsapp = ?, address = ?, division_id = ?, position_id = ?, shift_id = ?, role = ?
       WHERE id = ?`,
      [full_name, whatsapp || null, address || null, division_id || null, position_id || null, shift_id || null, role, id]
    );
    res.json({ success: true, message: 'Data pengguna berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui pengguna.' });
  }
});

/* ============================================================
   MASTER DATA: DIVISI
   ============================================================ */

router.get('/divisions', ...scoped, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM divisions ORDER BY name');
  res.json({ success: true, divisions: rows });
});

router.post('/divisions', ...scoped, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Nama divisi wajib diisi.' });
    const [result] = await pool.query('INSERT INTO divisions (name) VALUES (?)', [name.trim()]);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Nama divisi sudah ada.' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menambah divisi.' });
  }
});

router.put('/divisions/:id', ...scoped, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  await pool.query('UPDATE divisions SET name = ? WHERE id = ?', [name, id]);
  res.json({ success: true, message: 'Divisi berhasil diperbarui.' });
});

router.delete('/divisions/:id', ...scoped, async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM divisions WHERE id = ?', [id]);
  res.json({ success: true, message: 'Divisi berhasil dihapus.' });
});

/* ============================================================
   MASTER DATA: JABATAN
   ============================================================ */

router.get('/positions', ...scoped, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM positions ORDER BY name');
  res.json({ success: true, positions: rows });
});

router.post('/positions', ...scoped, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Nama jabatan wajib diisi.' });
    const [result] = await pool.query('INSERT INTO positions (name) VALUES (?)', [name.trim()]);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Nama jabatan sudah ada.' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menambah jabatan.' });
  }
});

router.put('/positions/:id', ...scoped, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  await pool.query('UPDATE positions SET name = ? WHERE id = ?', [name, id]);
  res.json({ success: true, message: 'Jabatan berhasil diperbarui.' });
});

router.delete('/positions/:id', ...scoped, async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM positions WHERE id = ?', [id]);
  res.json({ success: true, message: 'Jabatan berhasil dihapus.' });
});

/* ============================================================
   MASTER DATA: PENGATURAN SHIFT
   ============================================================ */

router.get('/shifts', ...scoped, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM shift_settings ORDER BY name');
  res.json({ success: true, shifts: rows });
});

router.post('/shifts', ...scoped, async (req, res) => {
  const { name, start_time, end_time, tolerance_minutes } = req.body;
  if (!name || !start_time || !end_time) {
    return res.status(400).json({ success: false, message: 'Nama shift dan jam wajib diisi.' });
  }
  const [result] = await pool.query(
    'INSERT INTO shift_settings (name, start_time, end_time, tolerance_minutes) VALUES (?, ?, ?, ?)',
    [name, start_time, end_time, tolerance_minutes || 0]
  );
  res.status(201).json({ success: true, id: result.insertId });
});

router.put('/shifts/:id', ...scoped, async (req, res) => {
  const { id } = req.params;
  const { name, start_time, end_time, tolerance_minutes, is_active } = req.body;
  await pool.query(
    'UPDATE shift_settings SET name = ?, start_time = ?, end_time = ?, tolerance_minutes = ?, is_active = ? WHERE id = ?',
    [name, start_time, end_time, tolerance_minutes || 0, is_active === undefined ? 1 : is_active, id]
  );
  res.json({ success: true, message: 'Pengaturan shift berhasil diperbarui.' });
});

router.delete('/shifts/:id', ...scoped, async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM shift_settings WHERE id = ?', [id]);
  res.json({ success: true, message: 'Pengaturan shift berhasil dihapus.' });
});

module.exports = router;
