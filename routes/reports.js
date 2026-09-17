// routes/reports.js
// Step 6: Engine pelaporan multi-filter (Mingguan, Bulanan, Rentang Custom, Divisi)
// + endpoint ekspor CSV / Excel. Hanya bisa diakses Admin Manager (scoped ke divisinya)
// dan Super Admin (bebas lintas divisi).

const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole, requireActiveAccount } = require('../middleware/auth');
const { generateCSV, generateXLSX, prepareRows, generateSubmissionsCSV, generateSubmissionsXLSX } = require('../utils/exportGenerator');
const { secondsToHMS } = require('../utils/timeCalc');

const router = express.Router();
const scoped = [requireAuth, requireRole('admin_manager', 'super_admin'), requireActiveAccount];

/**
 * Membangun klausa WHERE + params berdasarkan query filter:
 * - period: 'weekly' | 'monthly' | 'custom'
 * - start_date, end_date (wajib jika period = 'custom')
 * - division_id (opsional; Admin Manager otomatis dikunci ke divisinya sendiri)
 * - name: nama karyawan (opsional, pencarian)
 */
function buildFilter(req) {
  const { period, start_date, end_date, division_id, name } = req.query;
  const conditions = [];
  const params = [];

  if (period === 'weekly') {
    conditions.push('a.attendance_date >= CURDATE() - INTERVAL 7 DAY');
  } else if (period === 'monthly') {
    conditions.push('a.attendance_date >= CURDATE() - INTERVAL 30 DAY');
  } else if (period === 'custom') {
    if (!start_date || !end_date) {
      throw new Error('start_date dan end_date wajib diisi untuk filter rentang custom.');
    }
    conditions.push('a.attendance_date BETWEEN ? AND ?');
    params.push(start_date, end_date);
  }
  // Jika period tidak dikirim / tidak dikenali, tidak ada filter tanggal (semua data).

  // Admin Manager terkunci ke divisinya sendiri, tidak peduli apa yang dikirim di query.
  if (req.session.user.role === 'admin_manager') {
    conditions.push('u.division_id = ?');
    params.push(req.session.user.division_id);
  } else if (division_id) {
    conditions.push('u.division_id = ?');
    params.push(division_id);
  }

  // Pencarian nama karyawan (LIKE)
  if (name) {
    conditions.push('u.full_name LIKE ?');
    params.push(`%${name}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

async function fetchReportRows(req) {
  const { where, params } = buildFilter(req);
  const [rows] = await pool.query(
    `SELECT a.*, u.full_name, d.name AS division_name, p.name AS position_name
     FROM attendances a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN divisions d ON d.id = u.division_id
     LEFT JOIN positions p ON p.id = u.position_id
     ${where}
     ORDER BY a.attendance_date DESC, u.full_name ASC`,
    params
  );
  return rows;
}

/**
 * GET /api/reports/attendance
 * Menampilkan data rekap absensi + penggajian sesuai filter, untuk ditampilkan
 * di tabel UI sebelum diekspor.
 */
router.get('/attendance', ...scoped, async (req, res) => {
  try {
    const rows = await fetchReportRows(req);
    res.json({ success: true, total: rows.length, data: prepareRows(rows) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Gagal memuat laporan.' });
  }
});

/**
 * GET /api/reports/attendance/export?format=csv|xlsx&period=...&division_id=...
 */
router.get('/attendance/export', ...scoped, async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    const rows = await fetchReportRows(req);

    if (format === 'csv') {
      const csv = generateCSV(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="rekap-absensi-${Date.now()}.csv"`);
      return res.send(csv);
    }

    const buffer = await generateXLSX(rows, 'Rekap Absensi & Penggajian');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rekap-absensi-${Date.now()}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message || 'Gagal mengekspor laporan.' });
  }
});

/**
 * GET /api/reports/submissions
 * Rekap pengajuan (izin/cuti/sakit) dengan filter periode & divisi yang sama.
 */
router.get('/submissions', ...scoped, async (req, res) => {
  try {
    const { period, start_date, end_date, division_id } = req.query;
    const conditions = [];
    const params = [];

    if (period === 'weekly') conditions.push('s.start_date >= CURDATE() - INTERVAL 7 DAY');
    else if (period === 'monthly') conditions.push('s.start_date >= CURDATE() - INTERVAL 30 DAY');
    else if (period === 'custom') {
      if (!start_date || !end_date) {
        return res.status(400).json({ success: false, message: 'Rentang tanggal wajib diisi.' });
      }
      conditions.push('s.start_date BETWEEN ? AND ?');
      params.push(start_date, end_date);
    }

    if (req.session.user.role === 'admin_manager') {
      conditions.push('u.division_id = ?');
      params.push(req.session.user.division_id);
    } else if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT s.id, s.type, s.start_date, s.end_date, s.status, s.reason,
              DATEDIFF(s.end_date, s.start_date) + 1 AS total_days,
              u.full_name, d.name AS division_name
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       ${where}
       ORDER BY s.start_date DESC`,
      params
    );

    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat rekap pengajuan.' });
  }
});

/**
 * GET /api/reports/submissions/export?format=csv|xlsx&division_id=...
 * Ekspor rekap data pengajuan (Izin/Cuti/Sakit) ke format CSV atau Excel (.xlsx).
 */
router.get('/submissions/export', ...scoped, async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    const { division_id, type, status } = req.query;

    const conditions = [];
    const params = [];

    if (req.session.user.role === 'admin_manager') {
      conditions.push('u.division_id = ?');
      params.push(req.session.user.division_id);
    } else if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    if (type) {
      conditions.push('s.type = ?');
      params.push(type);
    }
    if (status) {
      conditions.push('s.status = ?');
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT s.id, s.type, s.start_date, s.end_date, s.status, s.reason, s.review_note, s.created_at,
              DATEDIFF(s.end_date, s.start_date) + 1 AS total_days,
              u.full_name, d.name AS division_name, p.name AS position_name
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       ${where}
       ORDER BY s.created_at DESC`,
      params
    );

    if (format === 'csv') {
      const csv = generateSubmissionsCSV(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="rekap-pengajuan-${Date.now()}.csv"`);
      return res.send(csv);
    }

    const buffer = await generateSubmissionsXLSX(rows, 'Rekap Pengajuan');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rekap-pengajuan-${Date.now()}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message || 'Gagal mengekspor data pengajuan.' });
  }
});

/**
 * GET /api/reports/attendance/:id
 * Detail satu record absensi (foto, lokasi, durasi, dll.) untuk Super Admin dan Admin Manager (terbatas pada divisinya).
 */
router.get('/attendance/:id', ...scoped, async (req, res) => {
  try {
    const attendanceId = req.params.id;
    // Validasi bahwa ID adalah angka
    if (!/^\d+$/.test(attendanceId)) {
      return res.status(400).json({ success: false, message: 'ID absensi tidak valid.' });
    }
    const userRole = req.session.user.role;
    const userDivisionId = req.session.user.division_id; // only for admin_manager

    // Build the query with division condition for admin_manager
    let params = [attendanceId];
    let divisionCondition = '';
    if (userRole === 'admin_manager') {
      divisionCondition = ' AND u.division_id = ?';
      params.push(userDivisionId);
    }

    const [rows] = await pool.query(
      `SELECT a.*, u.full_name, d.name AS division_name, p.name AS position_name
       FROM attendances a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       WHERE a.id = ?${divisionCondition}
       LIMIT 1`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan atau Anda tidak memiliki akses.' });
    }

    const row = rows[0];

    // Format times to HH:mm
    const formatTime = (datetime) => {
      if (!datetime) return null;
      return new Date(datetime).toTimeString().slice(0, 5);
    };

    // Determine display status
    let status_display;
    if (!row.clock_out_time) {
      status_display = 'Belum Lengkap';
    } else if (row.late_duration_seconds > 0) {
      status_display = 'Terlambat';
    } else {
      status_display = 'Tepat Waktu';
    }

    const data = {
      id: row.id,
      attendance_id: row.id,
      user_id: row.user_id,
      full_name: row.full_name,
      division_name: row.division_name,
      position_name: row.position_name,
      attendance_date: row.attendance_date, // keep as string (YYYY-MM-DD)
      clock_in_time: formatTime(row.clock_in_time),
      clock_out_time: formatTime(row.clock_out_time),
      clock_in_photo: row.clock_in_photo,
      clock_out_photo: row.clock_out_photo,
      clock_in_lat: row.clock_in_lat,
      clock_in_lng: row.clock_in_lng,
      clock_out_lat: row.clock_out_lat,
      clock_out_lng: row.clock_out_lng,
      clock_in_note: row.clock_in_note,
      clock_out_note: row.clock_out_note,
      work_duration_seconds: row.work_duration_seconds,
      late_duration_seconds: row.late_duration_seconds,
      overtime_seconds: row.overtime_seconds,
      work_duration_hms: secondsToHMS(row.work_duration_seconds),
      late_duration_hms: secondsToHMS(row.late_duration_seconds),
      overtime_hms: secondsToHMS(row.overtime_seconds),
      status_display: status_display,
      status_label: status_display
    };

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat detail absensi.' });
  }
});

/**
 * GET /api/reports/attendance/by-user/:userId?start_date=&end_date=&period=
 * Ringkasan riwayat absensi satu karyawan (untuk Super Admin dan Admin Manager dengan batasan divisinya).
 */
router.get('/attendance/by-user/:userId', ...scoped, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { start_date, end_date, period } = req.query;
    const userRole = req.session.user.role;
    const userDivisionId = req.session.user.division_id;

    // Build WHERE clause
    const conditions = ['a.user_id = ?'];
    let params = [userId];

    // Date filter (similar to buildFilter in reports.js)
    if (period === 'weekly') {
      conditions.push('a.attendance_date >= CURDATE() - INTERVAL 7 DAY');
    } else if (period === 'monthly') {
      conditions.push('a.attendance_date >= CURDATE() - INTERVAL 30 DAY');
    } else if (period === 'custom') {
      if (!start_date || !end_date) {
        return res.status(400).json({ success: false, message: 'start_date dan end_date wajib diisi untuk filter rentang custom.' });
      }
      conditions.push('a.attendance_date BETWEEN ? AND ?');
      params.push(start_date, end_date);
    }
    // If period is not set, no date filter (all data)

    // Division condition for admin_manager: they can only see users in their own division
    if (userRole === 'admin_manager') {
      conditions.push('u.division_id = ?');
      params.push(userDivisionId);
    } else if (userRole === 'super_admin') {
      // super_admin can see any division, but we still need to join to get division_name, etc.
      // no extra condition
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT a.*, u.full_name, d.name AS division_name, p.name AS position_name
       FROM attendances a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       ${where}
       ORDER BY a.attendance_date DESC`,
      params
    );

    // Prepare rows: format times and durations for each row
    const formatTime = (datetime) => {
      if (!datetime) return null;
      return new Date(datetime).toTimeString().slice(0, 5);
    };

    const data = rows.map(row => {
      let status_display;
      if (!row.clock_out_time) {
        status_display = 'Belum Lengkap';
      } else if (row.late_duration_seconds > 0) {
        status_display = 'Terlambat';
      } else {
        status_display = 'Tepat Waktu';
      }

      return {
        id: row.id,
        attendance_id: row.id,
        user_id: row.user_id,
        full_name: row.full_name,
        division_name: row.division_name,
        position_name: row.position_name,
        attendance_date: row.attendance_date,
        clock_in_time: formatTime(row.clock_in_time),
        clock_out_time: formatTime(row.clock_out_time),
        clock_in_photo: row.clock_in_photo,
        clock_out_photo: row.clock_out_photo,
        clock_in_lat: row.clock_in_lat,
        clock_in_lng: row.clock_in_lng,
        clock_out_lat: row.clock_out_lat,
        clock_out_lng: row.clock_out_lng,
        clock_in_note: row.clock_in_note,
        clock_out_note: row.clock_out_note,
        work_duration_seconds: row.work_duration_seconds,
        late_duration_seconds: row.late_duration_seconds,
        overtime_seconds: row.overtime_seconds,
        work_duration_hms: secondsToHMS(row.work_duration_seconds),
        late_duration_hms: secondsToHMS(row.late_duration_seconds),
        overtime_hms: secondsToHMS(row.overtime_seconds),
        status_display: status_display,
        status_label: status_display
      };
    });

    res.json({ success: true, total: data.length, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat riwayat absensi.' });
  }
});

module.exports = router;