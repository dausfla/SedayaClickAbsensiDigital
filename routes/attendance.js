// routes/attendance.js
// Step 3: Modul Absensi Karyawan (Clock In / Clock Out).
// Aturan bisnis: maksimal 1 catatan absensi per karyawan per hari.
// Karyawan TIDAK diberi endpoint untuk melihat rekap/riwayat (lihat catatan di bawah).

const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole, requireActiveAccount } = require('../middleware/auth');
const { uploadAttendancePhoto } = require('../utils/uploadConfig');
const {
  secondsToHMS,
  calculateLateDuration,
  calculateOvertime,
  calculateWorkDuration,
  determineStatus
} = require('../utils/timeCalc');

const router = express.Router();

function todayStr() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

/**
 * GET /api/attendance/today
 * Mengembalikan status absensi HARI INI milik user yang login saja
 * (bukan riwayat/rekap — sengaja dibatasi hanya baris "hari ini" untuk
 * mendukung tampilan tombol Clock In/Clock Out, sesuai batasan bahwa
 * karyawan tidak boleh melihat rekap/riwayat harian mereka).
 */
router.get('/today', requireAuth, requireRole('employee'), requireActiveAccount, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, clock_in_time, clock_out_time, status FROM attendances WHERE user_id = ? AND attendance_date = ?',
      [req.session.user.id, todayStr()]
    );
    res.json({ success: true, attendance: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat status absensi.' });
  }
});

/**
 * POST /api/attendance/clock-in
 * multipart/form-data: photo, latitude, longitude, note(optional)
 */
router.post(
  '/clock-in',
  requireAuth,
  requireRole('employee'),
  requireActiveAccount,
  uploadAttendancePhoto.single('photo'),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const { latitude, longitude, note } = req.body;
      const date = todayStr();

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Foto Clock In wajib diambil.' });
      }
      if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: 'Lokasi GPS wajib aktif dan terkunci.' });
      }

      const [existing] = await pool.query(
        'SELECT id, clock_in_time FROM attendances WHERE user_id = ? AND attendance_date = ?',
        [userId, date]
      );
      if (existing.length > 0 && existing[0].clock_in_time) {
        return res.status(409).json({ success: false, message: 'Anda sudah melakukan Clock In hari ini.' });
      }

      // Ambil shift milik user untuk menghitung keterlambatan.
      const [userRows] = await pool.query(
        `SELECT s.start_time, s.tolerance_minutes
         FROM users u LEFT JOIN shift_settings s ON s.id = u.shift_id
         WHERE u.id = ?`,
        [userId]
      );
      const shift = userRows[0] && userRows[0].start_time
        ? userRows[0]
        : { start_time: '08:00:00', tolerance_minutes: 0 };

      const now = new Date();
      const lateSeconds = calculateLateDuration(date, now, shift.start_time, shift.tolerance_minutes);
      const status = determineStatus(lateSeconds);
      const photoPath = `/uploads/attendance/${req.file.filename}`;

      if (existing.length > 0) {
        await pool.query(
          `UPDATE attendances SET clock_in_time = ?, clock_in_photo = ?, clock_in_lat = ?, clock_in_lng = ?,
           clock_in_note = ?, late_duration_seconds = ?, status = ? WHERE id = ?`,
          [now, photoPath, latitude, longitude, note || null, lateSeconds, status, existing[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO attendances
           (user_id, attendance_date, clock_in_time, clock_in_photo, clock_in_lat, clock_in_lng, clock_in_note,
            late_duration_seconds, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, date, now, photoPath, latitude, longitude, note || null, lateSeconds, status]
        );
      }

      res.json({
        success: true,
        message: status === 'late'
          ? `Clock In berhasil. Anda terlambat ${secondsToHMS(lateSeconds)}.`
          : 'Clock In berhasil. Anda tepat waktu.',
        late_duration_hms: secondsToHMS(lateSeconds)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Gagal melakukan Clock In.' });
    }
  }
);

/**
 * POST /api/attendance/clock-out
 * multipart/form-data: photo, latitude, longitude, note (WAJIB diisi)
 */
router.post(
  '/clock-out',
  requireAuth,
  requireRole('employee'),
  requireActiveAccount,
  uploadAttendancePhoto.single('photo'),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const { latitude, longitude, note } = req.body;
      const date = todayStr();

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Foto Clock Out wajib diambil.' });
      }
      if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: 'Lokasi GPS wajib aktif dan terkunci.' });
      }
      if (!note || !note.trim()) {
        return res.status(400).json({ success: false, message: 'Catatan/keterangan wajib diisi saat Clock Out.' });
      }

      const [existing] = await pool.query(
        'SELECT id, clock_in_time, clock_out_time FROM attendances WHERE user_id = ? AND attendance_date = ?',
        [userId, date]
      );
      if (existing.length === 0 || !existing[0].clock_in_time) {
        return res.status(400).json({ success: false, message: 'Anda belum melakukan Clock In hari ini.' });
      }
      if (existing[0].clock_out_time) {
        return res.status(409).json({ success: false, message: 'Anda sudah melakukan Clock Out hari ini.' });
      }

      const [userRows] = await pool.query(
        `SELECT s.end_time FROM users u LEFT JOIN shift_settings s ON s.id = u.shift_id WHERE u.id = ?`,
        [userId]
      );
      const shiftEnd = userRows[0] && userRows[0].end_time ? userRows[0].end_time : '17:00:00';

      const now = new Date();
      const overtimeSeconds = calculateOvertime(date, now, shiftEnd);
      const workDurationSeconds = calculateWorkDuration(existing[0].clock_in_time, now);
      const photoPath = `/uploads/attendance/${req.file.filename}`;

      await pool.query(
        `UPDATE attendances SET clock_out_time = ?, clock_out_photo = ?, clock_out_lat = ?, clock_out_lng = ?,
         clock_out_note = ?, work_duration_seconds = ?, overtime_seconds = ? WHERE id = ?`,
        [now, photoPath, latitude, longitude, note, workDurationSeconds, overtimeSeconds, existing[0].id]
      );

      res.json({
        success: true,
        message: 'Clock Out berhasil. Terima kasih atas kerja keras Anda hari ini.',
        work_duration_hms: secondsToHMS(workDurationSeconds),
        overtime_hms: secondsToHMS(overtimeSeconds)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Gagal melakukan Clock Out.' });
    }
  }
);

/**
 * PENTING: Sengaja TIDAK ada endpoint GET /history atau GET /report di sini.
 * Sesuai spesifikasi, karyawan (role 'employee') tidak diberi akses untuk
 * melihat rekap/riwayat absensi. Endpoint rekap hanya tersedia di
 * routes/admin.js dan routes/reports.js yang dilindungi requireRole('admin_manager','super_admin').
 */

module.exports = router;
