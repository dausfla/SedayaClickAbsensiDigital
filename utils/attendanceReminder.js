// utils/attendanceReminder.js
// Scheduler otomatis untuk pengingat absensi karyawan (H-15 Menit Clock In & Clock Out)
// Mendukung jadwal shift reguler, shift khusus, dan roster dinamis (P, S, VK, VW, VH, R, PL, SAT, L).

const pool = require('../config/db');
const { webpush } = require('../config/webpush');
const { resolveShiftCode } = require('./rosterHelper');

// Menyimpan riwayat pengingat harian di memori agar user tidak dispam berkali-kali
const sentReminders = {
  date: '',
  clockIn: new Set(),
  clockOut: new Set()
};

function getLocalTimeInfo() {
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  return { now, timeStr, localDate };
}

// Menghitung selisih menit antara waktu saat ini (HH:mm) dengan target shift (HH:mm)
function getMinutesDiff(currentHHMM, targetTime) {
  if (!targetTime) return null;
  const targetHHMM = targetTime.slice(0, 5);
  const [curH, curM] = currentHHMM.split(':').map(Number);
  const [tarH, tarM] = targetHHMM.split(':').map(Number);

  const curTotal = curH * 60 + curM;
  const tarTotal = tarH * 60 + tarM;

  return tarTotal - curTotal; // positif jika targetTime berada di masa depan
}

async function checkAndSendReminders() {
  const { timeStr, localDate } = getLocalTimeInfo();

  // Reset cache jika tanggal telah berganti
  if (sentReminders.date !== localDate) {
    sentReminders.date = localDate;
    sentReminders.clockIn.clear();
    sentReminders.clockOut.clear();
  }

  try {
    // 1. Ambil seluruh karyawan aktif beserta jadwal roster harian dan status absensi hari ini
    const [employees] = await pool.query(`
      SELECT 
        u.id, 
        u.full_name, 
        es.shift_code,
        es.start_time AS roster_start_time,
        es.end_time AS roster_end_time,
        es.is_day_off AS roster_is_day_off,
        s.name AS shift_setting_name,
        s.shift_type,
        s.is_flexible_arrival,
        s.start_time AS default_start_time,
        s.end_time AS default_end_time,
        a.clock_in_time,
        a.clock_out_time
      FROM users u
      LEFT JOIN shift_settings s ON u.shift_id = s.id
      LEFT JOIN employee_schedules es ON es.user_id = u.id AND es.schedule_date = ?
      LEFT JOIN attendances a ON a.user_id = u.id AND a.attendance_date = ?
      WHERE u.role = 'employee' AND u.status = 'active'
    `, [localDate, localDate]);

    if (!employees || employees.length === 0) return;

    for (const emp of employees) {
      // A. Jika karyawan terjadwal LIBUR hari ini (is_day_off = 1):
      // JANGAN kirim pengingat masuk atau pulang!
      if (emp.roster_is_day_off === 1 || emp.shift_code === 'L' || emp.shift_code === 'OFF') {
        continue;
      }

      // B. Tentukan shift aktual hari ini:
      let startTime = null;
      let endTime = null;
      let shiftTitle = 'Shift Reguler';

      if (emp.shift_code) {
        const meta = resolveShiftCode(emp.shift_code) || {};
        startTime = emp.roster_start_time || meta.start_time || '08:00:00';
        endTime = emp.roster_end_time || meta.end_time || '17:00:00';
        shiftTitle = `Shift ${meta.name || emp.shift_code}`;
      } else {
        const isRosterProfile = emp.shift_type === 'roster' ||
                                emp.is_flexible_arrival === 1 ||
                                (emp.shift_setting_name && (emp.shift_setting_name.toLowerCase().includes('khusus') || emp.shift_setting_name.toLowerCase().includes('roster')));
        if (isRosterProfile) {
          // Karyawan Shift Khusus tapi belum ada sel spesifik hari ini:
          // Jangan kirim notifikasi kaku jam 08:00
          continue;
        }
        startTime = emp.default_start_time || '08:00:00';
        endTime = emp.default_end_time || '17:00:00';
        shiftTitle = emp.shift_setting_name || 'Shift Reguler';
      }

      if (!startTime || !endTime) continue;

      const shiftStartDiff = getMinutesDiff(timeStr, startTime);
      const shiftEndDiff = getMinutesDiff(timeStr, endTime);

      // --- KASUS 1: PENGINGAT CLOCK IN (H-15 Menit sebelum jam shift masuk) ---
      if (
        shiftStartDiff !== null &&
        shiftStartDiff >= 13 &&
        shiftStartDiff <= 16 &&
        !emp.clock_in_time &&
        !sentReminders.clockIn.has(emp.id)
      ) {
        sentReminders.clockIn.add(emp.id);
        await sendNotificationToUser(emp.id, {
          title: '⏰ Pengingat Absensi Masuk',
          body: `Halo ${emp.full_name}, 15 menit lagi ${shiftTitle} (${startTime.slice(0, 5)} WIB) dimulai. Jangan lupa Clock In tepat waktu ya!`,
          icon: '/icons/icon-192.png',
          badge: '/favicon.png',
          url: '/employee/dashboard.html',
          type: 'info',
          tag: `reminder-in-${emp.id}-${localDate}`
        });
      }

      // --- KASUS 2: PENGINGAT CLOCK OUT (H-15 Menit sebelum jam shift berakhir) ---
      if (
        shiftEndDiff !== null &&
        shiftEndDiff >= 13 &&
        shiftEndDiff <= 16 &&
        emp.clock_in_time &&
        !emp.clock_out_time &&
        !sentReminders.clockOut.has(emp.id)
      ) {
        sentReminders.clockOut.add(emp.id);
        await sendNotificationToUser(emp.id, {
          title: '🏁 Jam Pulang Kerja Segera Tiba',
          body: `Halo ${emp.full_name}, 15 menit lagi ${shiftTitle} (${endTime.slice(0, 5)} WIB) berakhir. Pastikan Anda Clock Out sebelum pulang!`,
          icon: '/icons/icon-192.png',
          badge: '/favicon.png',
          url: '/employee/dashboard.html',
          type: 'info',
          tag: `reminder-out-${emp.id}-${localDate}`
        });
      }
    }
  } catch (err) {
    console.error('[AttendanceReminder] Error saat memeriksa jadwal absensi:', err.message);
  }
}

async function sendNotificationToUser(userId, payloadObj) {
  try {
    const [subs] = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);
    if (!subs || subs.length === 0) return;

    const payload = JSON.stringify(payloadObj);
    const deadEndpoints = [];

    await Promise.all(
      subs.map(async (sub) => {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushConfig, payload);
        } catch (pushErr) {
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            deadEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    if (deadEndpoints.length > 0) {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint IN (?)', [deadEndpoints]);
    }
  } catch (err) {
    console.error(`[AttendanceReminder] Gagal mengirim push ke user ID ${userId}:`, err.message);
  }
}

let reminderInterval = null;

function startAttendanceReminder() {
  if (reminderInterval) clearInterval(reminderInterval);
  // Jalankan segera saat server boot
  checkAndSendReminders();
  // Ulangi pemeriksaan setiap 60 detik (1 menit)
  reminderInterval = setInterval(checkAndSendReminders, 60 * 1000);
  console.log('[AttendanceReminder] ✅ Scheduler pengingat absensi H-15 menit aktif.');
}

function stopAttendanceReminder() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}

module.exports = {
  startAttendanceReminder,
  stopAttendanceReminder,
  checkAndSendReminders
};
