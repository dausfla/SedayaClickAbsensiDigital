// routes/attendance.js
// Step 3: Modul Absensi Karyawan (Clock In / Clock Out).
// Aturan bisnis: maksimal 1 catatan absensi per karyawan per hari.
// Karyawan TIDAK diberi endpoint untuk melihat rekap/riwayat (lihat catatan di bawah).

const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole, requireActiveAccount } = require('../middleware/auth');
const { uploadAttendancePhoto, uploadOvertimeClockOut } = require('../utils/uploadConfig');
const {
  secondsToHMS,
  calculateLateDuration,
  calculateOvertime,
  calculateWorkDuration,
  determineStatus
} = require('../utils/timeCalc');
const { resolveShiftCode } = require('../utils/rosterHelper');

const router = express.Router();

function todayStr() {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
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
    const [scheduleRows] = await pool.query(
      'SELECT shift_code, start_time, end_time, is_day_off, notes FROM employee_schedules WHERE user_id = ? AND schedule_date = ?',
      [req.session.user.id, todayStr()]
    ).catch(() => [[]]);
    
    let schedule = scheduleRows && scheduleRows[0] ? scheduleRows[0] : null;
    if (schedule && schedule.shift_code) {
      const meta = resolveShiftCode(schedule.shift_code) || {};
      schedule.start_time = schedule.start_time || meta.start_time;
      schedule.end_time = schedule.end_time || meta.end_time;
      schedule.shift_name = meta.name || schedule.shift_code;
    } else {
      const [uShift] = await pool.query(
        `SELECT s.name, s.shift_type, s.start_time, s.end_time, s.is_flexible_arrival
         FROM users u JOIN shift_settings s ON s.id = u.shift_id
         WHERE u.id = ?`,
        [req.session.user.id]
      ).catch(() => [[]]);
      if (uShift && uShift[0]) {
        schedule = {
          shift_code: uShift[0].shift_type === 'roster' ? 'Khusus' : 'Reguler',
          shift_name: uShift[0].name,
          start_time: uShift[0].start_time,
          end_time: uShift[0].end_time,
          is_day_off: 0,
          is_profile_shift: true
        };
      }
    }

    res.json({ success: true, attendance: rows[0] || null, schedule });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat status absensi.' });
  }
});

/**
 * GET /api/attendance/my-roster
 * Mengembalikan jadwal roster bulanan milik karyawan yang sedang login
 */
router.get('/my-roster', requireAuth, requireRole('employee'), requireActiveAccount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonthStr = req.query.month || defaultMonth;
    const [year, month] = targetMonthStr.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const [rows] = await pool.query(
      `SELECT schedule_date, shift_code, start_time, end_time, is_day_off, notes
       FROM employee_schedules
       WHERE user_id = ? AND schedule_date BETWEEN ? AND ?
       ORDER BY schedule_date ASC`,
      [userId, startDate, endDate]
    );

    const [userRows] = await pool.query(
      `SELECT u.id, u.full_name, s.name AS shift_name, s.shift_type, s.start_time, s.end_time
       FROM users u LEFT JOIN shift_settings s ON s.id = u.shift_id
       WHERE u.id = ?`,
      [userId]
    );

    res.json({
      success: true,
      month: targetMonthStr,
      schedules: rows,
      user_shift: userRows[0] || null
    });
  } catch (err) {
    console.error('Error load my-roster:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat jadwal roster saya.' });
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

      const now = new Date();
      // Jam sekarang dalam WIB (Asia/Jakarta)
      const nowWIB = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(now);
      const [curHour, curMin] = nowWIB.split(':').map(Number);

      // Ambil shift milik user (prioritaskan jadwal roster harian di employee_schedules)
      const [scheduleRows] = await pool.query(
        `SELECT shift_code, start_time, end_time, is_day_off, notes
         FROM employee_schedules
         WHERE user_id = ? AND schedule_date = ?`,
        [userId, date]
      ).catch(() => [[]]);

      const [userRows] = await pool.query(
        `SELECT s.id, s.name, s.shift_type, s.min_work_hours, s.is_flexible_arrival, s.start_time, s.end_time, s.tolerance_minutes
         FROM users u LEFT JOIN shift_settings s ON s.id = u.shift_id
         WHERE u.id = ?`,
        [userId]
      );
      const userProfileShift = userRows[0] || {};
      const isRosterProfile = userProfileShift.shift_type === 'roster' ||
        userProfileShift.is_flexible_arrival === 1 ||
        (userProfileShift.name && (userProfileShift.name.toLowerCase().includes('khusus') || userProfileShift.name.toLowerCase().includes('roster')));

      let shift;
      if (scheduleRows && scheduleRows[0] && scheduleRows[0].shift_code) {
        const sc = scheduleRows[0];
        const meta = resolveShiftCode(sc.shift_code) || {};
        shift = {
          id: null,
          name: `Roster (${meta.name || sc.shift_code})`,
          shift_code: sc.shift_code,
          shift_type: (sc.is_day_off || meta.is_day_off) ? 'flexible_hours' : 'fixed',
          min_work_hours: 9.00,
          is_flexible_arrival: (sc.is_day_off || meta.is_day_off) ? 1 : 0,
          is_day_off: (sc.is_day_off || meta.is_day_off) ? 1 : 0,
          start_time: sc.start_time || meta.start_time || '08:00:00',
          end_time: sc.end_time || meta.end_time || '17:00:00',
          tolerance_minutes: meta.tolerance_minutes !== undefined ? meta.tolerance_minutes : 15
        };
      } else if (isRosterProfile) {
        // Karyawan Shift Khusus (Roster) yang belum memiliki sel spesifik di employee_schedules hari ini:
        // Cek jam clock in saat ini dalam WIB (Asia/Jakarta)
        let resolvedCode = 'S';
        let startTime = '13:00:00';
        let endTime = '22:00:00';

        if (curHour < 7) {
          resolvedCode = 'P';
          startTime = '06:00:00';
          endTime = '15:00:00';
        } else if (curHour >= 7 && curHour < 11) {
          resolvedCode = 'VK';
          startTime = '08:00:00';
          endTime = '17:00:00';
        } else if (curHour >= 11 && curHour <= 15) {
          // Siang (cth: masuk pukul 12:33 WIB -> Shift Siang 13:00 - 22:00)
          resolvedCode = 'S';
          startTime = '13:00:00';
          endTime = '22:00:00';
        } else {
          resolvedCode = 'R';
          startTime = '14:00:00';
          endTime = '23:00:00';
        }

        const meta = resolveShiftCode(resolvedCode) || {};
        shift = {
          id: userProfileShift.id || null,
          name: `Shift Khusus (${meta.name || resolvedCode})`,
          shift_code: resolvedCode,
          shift_type: 'roster',
          min_work_hours: 9.00,
          is_flexible_arrival: 1, // Fleksibel kedatangan
          is_day_off: 0,
          start_time: startTime,
          end_time: endTime,
          tolerance_minutes: 15
        };

        // Simpan / upsert ke employee_schedules agar konsisten untuk pengingat dan clock out
        try {
          await pool.query(
            `INSERT INTO employee_schedules (user_id, schedule_date, shift_code, start_time, end_time, is_day_off, notes)
             VALUES (?, ?, ?, ?, ?, 0, 'Auto-assigned saat Clock In')
             ON DUPLICATE KEY UPDATE shift_code = VALUES(shift_code), start_time = VALUES(start_time), end_time = VALUES(end_time)`,
            [userId, date, resolvedCode, startTime, endTime]
          );
        } catch (e) {
          console.warn('[Attendance ClockIn] Auto-schedule upsert warning:', e.message);
        }
      } else {
        shift = userProfileShift && userProfileShift.start_time
          ? userProfileShift
          : { start_time: '08:00:00', end_time: '17:00:00', tolerance_minutes: 15, shift_type: 'fixed', is_flexible_arrival: 0, is_day_off: 0 };
      }

      const isFlexible = shift.shift_type === 'flexible_hours' || shift.is_flexible_arrival === 1 || shift.is_day_off === 1;

      // Pada shift khusus fleksibel / hari libur rolling: tidak ada sanksi keterlambatan saat clock in
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
        'SELECT id, clock_in_time, clock_out_time, status FROM attendances WHERE user_id = ? AND attendance_date = ?',
        [userId, date]
      );
      if (existing.length === 0 || !existing[0].clock_in_time) {
        return res.status(400).json({ success: false, message: 'Anda belum melakukan Clock In hari ini.' });
      }
      if (existing[0].clock_out_time) {
        return res.status(409).json({ success: false, message: 'Anda sudah melakukan Clock Out hari ini.' });
      }

      // Ambil shift milik user (prioritaskan jadwal roster harian di employee_schedules)
      const [scheduleRows] = await pool.query(
        `SELECT shift_code, start_time, end_time, is_day_off
         FROM employee_schedules
         WHERE user_id = ? AND schedule_date = ?`,
        [userId, date]
      ).catch(() => [[]]);

      let shift;
      if (scheduleRows && scheduleRows[0] && scheduleRows[0].shift_code) {
        const sc = scheduleRows[0];
        const meta = resolveShiftCode(sc.shift_code) || {};
        shift = {
          shift_code: sc.shift_code,
          shift_type: (sc.is_day_off || meta.is_day_off) ? 'flexible_hours' : 'fixed',
          min_work_hours: 9.0,
          is_flexible_arrival: (sc.is_day_off || meta.is_day_off) ? 1 : 0,
          end_time: sc.end_time || meta.end_time || '17:00:00'
        };
      } else {
        const [userRows] = await pool.query(
          `SELECT s.id, s.name, s.shift_type, s.min_work_hours, s.is_flexible_arrival, s.end_time 
           FROM users u LEFT JOIN shift_settings s ON s.id = u.shift_id WHERE u.id = ?`,
          [userId]
        );
        shift = userRows[0] || {};
      }
      const isFlexible = shift.shift_type === 'flexible_hours' || shift.is_flexible_arrival === 1;
      const minWorkSeconds = Math.round((Number(shift.min_work_hours) || 9.0) * 3600);

      const now = new Date();
      const workDurationSeconds = calculateWorkDuration(existing[0].clock_in_time, now);

      let finalStatus = existing[0].status || 'on_time';
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
      `SELECT id, overtime_clock_in_time, overtime_clock_out_time, overtime_task_reason, overtime_work_attachment,
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
 * multipart/form-data: photo (selfie), work_attachment (dokumen/hasil kerja), latitude, longitude, note (optional)
 */
router.post(
  '/overtime/clock-out',
  requireAuth,
  requireRole('employee'),
  requireActiveAccount,
  uploadOvertimeClockOut.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'work_attachment', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const { latitude, longitude, note } = req.body;
      const date = todayStr();

      const photoFile = req.files && req.files['photo'] ? req.files['photo'][0] : null;
      const workFile = req.files && req.files['work_attachment'] ? req.files['work_attachment'][0] : null;

      if (!photoFile) {
        return res.status(400).json({ success: false, message: 'Foto selfie Absen Pulang Lembur wajib diambil.' });
      }
      if (!workFile) {
        return res.status(400).json({ success: false, message: 'Bukti berkas hasil kerja lembur (PDF, Gambar, atau Dokumen) wajib dilampirkan sebelum Clock Out.' });
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
      const photoPath = `/uploads/attendance/${photoFile.filename}`;
      const workAttachmentPath = `/uploads/attendance/${workFile.filename}`;
      const overtimeClockOutNote = note && note.trim() ? note.trim() : null;

      await pool.query(
        `UPDATE attendances SET 
           overtime_clock_out_time = ?, 
           overtime_clock_out_photo = ?, 
           overtime_clock_out_lat = ?, 
           overtime_clock_out_lng = ?,
           overtime_work_attachment = ?,
           overtime_clock_out_note = ?, 
           overtime_duration_seconds = ?,
           overtime_status = 'pending'
         WHERE id = ?`,
        [now, photoPath, latitude, longitude, workAttachmentPath, overtimeClockOutNote, overtimeDurationSeconds, existing[0].id]
      );

      res.json({
        success: true,
        message: 'Absen Pulang Lembur dan berkas hasil kerja berhasil dicatat.',
        overtime_duration_hms: secondsToHMS(overtimeDurationSeconds)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Gagal melakukan Absen Pulang Lembur.' });
    }
  }
);

module.exports = router;
