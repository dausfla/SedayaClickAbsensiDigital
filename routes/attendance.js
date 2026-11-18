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
        `SELECT s.id, s.name, s.shift_type, s.min_work_hours, s.is_flexible_arrival, s.start_time, s.tolerance_minutes
         FROM users u LEFT JOIN shift_settings s ON s.id = u.shift_id
         WHERE u.id = ?`,
        [userId]
      );
      const shift = userRows[0] && userRows[0].start_time
        ? userRows[0]
        : { start_time: '08:00:00', tolerance_minutes: 0, shift_type: 'fixed', is_flexible_arrival: 0 };

      const now = new Date();
      const isFlexible = shift.shift_type === 'flexible_hours' || shift.is_flexible_arrival === 1;

      // Pada shift khusus fleksibel: tidak ada sanksi/ketentuan keterlambatan saat clock in
      const lateSeconds = isFlexible ? 0 : calculateLateDuration(date, now, shift.start_time, shift.tolerance_minutes);
      const status = isFlexible ? 'on_time' : determineStatus(lateSeconds);
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
        `SELECT s.id, s.name, s.shift_type, s.min_work_hours, s.is_flexible_arrival, s.end_time 
         FROM users u LEFT JOIN shift_settings s ON s.id = u.shift_id WHERE u.id = ?`,
        [userId]
      );
      const shift = userRows[0] || {};
      const isFlexible = shift.shift_type === 'flexible_hours' || shift.is_flexible_arrival === 1;
      const minWorkSeconds = Math.round((Number(shift.min_work_hours) || 9.0) * 3600);

      const now = new Date();
      const workDurationSeconds = calculateWorkDuration(existing[0].clock_in_time, now);
      
      let finalStatus = existing[0].status;
      let overtimeSeconds = 0;

      if (isFlexible) {
        // Shift Khusus 9 Jam: jika akumulasi jam kerja >= 9 jam, dianggap hadir penuh (on_time)
        if (workDurationSeconds >= minWorkSeconds) {
          finalStatus = 'on_time';
          overtimeSeconds = workDurationSeconds - minWorkSeconds;
        } else {
          finalStatus = 'early_leave'; // pulang sebelum target 9 jam
        }
      } else {
        const shiftEnd = shift.end_time || '17:00:00';
        overtimeSeconds = calculateOvertime(date, now, shiftEnd);
      }

      const photoPath = `/uploads/attendance/${req.file.filename}`;
      const clockOutNote = note && note.trim() ? note.trim() : null;

      await pool.query(
        `UPDATE attendances SET clock_out_time = ?, clock_out_photo = ?, clock_out_lat = ?, clock_out_lng = ?,
         clock_out_note = ?, work_duration_seconds = ?, overtime_seconds = ?, status = ? WHERE id = ?`,
        [now, photoPath, latitude, longitude, clockOutNote, workDurationSeconds, overtimeSeconds, finalStatus, existing[0].id]
      );

      let successMsg = 'Clock Out berhasil. Terima kasih atas kerja keras Anda hari ini.';
      if (isFlexible) {
        if (workDurationSeconds >= minWorkSeconds) {
          successMsg = `Clock Out berhasil. Target minimal 9 jam kerja harian terpenuhi (${secondsToHMS(workDurationSeconds)}).`;
        } else {
          const shortage = minWorkSeconds - workDurationSeconds;
          successMsg = `Clock Out berhasil. Durasi kerja: ${secondsToHMS(workDurationSeconds)} (kurang ${secondsToHMS(shortage)} dari target 9 jam).`;
        }
      }

      res.json({
        success: true,
        message: successMsg,
        work_duration_hms: secondsToHMS(workDurationSeconds),
        overtime_hms: secondsToHMS(overtimeSeconds)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Gagal melakukan Clock Out.' });
    }
  }
);

/* ---------------------------------------------------------
   OVERTIME ATTENDANCE (ABSEN MASUK & PULANG LEMBUR)
--------------------------------------------------------- */

/**
 * GET /api/attendance/overtime/today
 * Mengembalikan status absensi lembur HARI INI milik user yang login
 */
router.get('/overtime/today', requireAuth, requireRole('employee'), requireActiveAccount, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, overtime_clock_in_time, overtime_clock_out_time, overtime_task_reason, 
              overtime_duration_seconds, overtime_clock_in_note, overtime_clock_out_note,
              overtime_status, overtime_review_note, overtime_reviewed_at
       FROM attendances WHERE user_id = ? AND attendance_date = ?`,
      [req.session.user.id, todayStr()]
    );
    res.json({ success: true, overtime: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat status absensi lembur.' });
  }
});

/**
 * POST /api/attendance/overtime/clock-in
 * multipart/form-data: photo, latitude, longitude, task_reason (WAJIB), note (optional)
 */
router.post(
  '/overtime/clock-in',
  requireAuth,
  requireRole('employee'),
  requireActiveAccount,
  uploadAttendancePhoto.single('photo'),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const { latitude, longitude, task_reason, note } = req.body;
      const date = todayStr();

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Foto Absen Masuk Lembur wajib diambil.' });
      }
      if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: 'Lokasi GPS wajib aktif dan terkunci.' });
      }
      if (!task_reason || !task_reason.trim()) {
        return res.status(400).json({ success: false, message: 'Keterangan tugas lembur (ngerjain apa) wajib diisi.' });
      }

      const [existing] = await pool.query(
        'SELECT id, overtime_clock_in_time FROM attendances WHERE user_id = ? AND attendance_date = ?',
        [userId, date]
      );

      if (existing.length > 0 && existing[0].overtime_clock_in_time) {
        return res.status(409).json({ success: false, message: 'Anda sudah melakukan Absen Masuk Lembur hari ini.' });
      }

      const now = new Date();
      const photoPath = `/uploads/attendance/${req.file.filename}`;

      if (existing.length > 0) {
        await pool.query(
          `UPDATE attendances SET 
             overtime_clock_in_time = ?, 
             overtime_clock_in_photo = ?, 
             overtime_clock_in_lat = ?, 
             overtime_clock_in_lng = ?,
             overtime_task_reason = ?, 
             overtime_clock_in_note = ?,
             overtime_status = 'pending'
           WHERE id = ?`,
          [now, photoPath, latitude, longitude, task_reason.trim(), note ? note.trim() : null, existing[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO attendances
           (user_id, attendance_date, overtime_clock_in_time, overtime_clock_in_photo, 
            overtime_clock_in_lat, overtime_clock_in_lng, overtime_task_reason, overtime_clock_in_note, status, overtime_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'on_time', 'pending')`,
          [userId, date, now, photoPath, latitude, longitude, task_reason.trim(), note ? note.trim() : null]
        );
      }

      res.json({
        success: true,
        message: 'Absen Masuk Lembur berhasil dicatat dan menunggu persetujuan.'
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Gagal melakukan Absen Masuk Lembur.' });
    }
  }
);

/**
 * POST /api/attendance/overtime/clock-out
 * multipart/form-data: photo, latitude, longitude, note (WAJIB diisi)
 */
router.post(
  '/overtime/clock-out',
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
        return res.status(400).json({ success: false, message: 'Foto Absen Pulang Lembur wajib diambil.' });
      }
      if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: 'Lokasi GPS wajib aktif dan terkunci.' });
      }

      const [existing] = await pool.query(
        'SELECT id, overtime_clock_in_time, overtime_clock_out_time FROM attendances WHERE user_id = ? AND attendance_date = ?',
        [userId, date]
      );

      if (existing.length === 0 || !existing[0].overtime_clock_in_time) {
        return res.status(400).json({ success: false, message: 'Anda belum melakukan Absen Masuk Lembur hari ini.' });
      }
      if (existing[0].overtime_clock_out_time) {
        return res.status(409).json({ success: false, message: 'Anda sudah melakukan Absen Pulang Lembur hari ini.' });
      }

      const now = new Date();
      const overtimeDurationSeconds = calculateWorkDuration(existing[0].overtime_clock_in_time, now);
      const photoPath = `/uploads/attendance/${req.file.filename}`;
      const overtimeClockOutNote = note && note.trim() ? note.trim() : null;

      await pool.query(
        `UPDATE attendances SET 
           overtime_clock_out_time = ?, 
           overtime_clock_out_photo = ?, 
           overtime_clock_out_lat = ?, 
           overtime_clock_out_lng = ?,
           overtime_clock_out_note = ?, 
           overtime_duration_seconds = ?,
           overtime_status = 'pending'
         WHERE id = ?`,
        [now, photoPath, latitude, longitude, overtimeClockOutNote, overtimeDurationSeconds, existing[0].id]
      );

      res.json({
        success: true,
        message: 'Absen Pulang Lembur berhasil dicatat dan menunggu persetujuan.',
        overtime_duration_hms: secondsToHMS(overtimeDurationSeconds)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Gagal melakukan Absen Pulang Lembur.' });
    }
  }
);

module.exports = router;
