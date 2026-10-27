// utils/attendanceReminder.js
// Scheduler otomatis untuk pengingat absensi karyawan (H-15 Menit Clock In & Clock Out)

const pool = require('../config/db');
const { webpush } = require('../config/webpush');

// Menyimpan riwayat pengingat harian di memori agar user tidak dispam berkali-kali
const sentReminders = {
  date: '',
  clockIn: new Set(),
  clockOut: new Set()
};

function getLocalTimeInfo() {
  const now = new Date();
  // Format jam lokal server ke WIB (Asia/Jakarta) atau waktu lokal
  const timeStr = now.toTimeString().slice(0, 5); // "HH:MM"
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10); // "YYYY-MM-DD"
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
    // 1. Ambil seluruh karyawan aktif beserta shift dan status absensi hari ini
    const [employees] = await pool.query(`
      SELECT 
        u.id, 
        u.full_name, 
        COALESCE(s.name, 'Shift Reguler') AS shift_name,
        COALESCE(s.start_time, '08:00:00') AS start_time,
        COALESCE(s.end_time, '17:00:00') AS end_time,
        a.clock_in_time,
        a.clock_out_time
      FROM users u
      LEFT JOIN shift_settings s ON u.shift_id = s.id
      LEFT JOIN attendances a ON a.user_id = u.id AND a.attendance_date = ?
      WHERE u.role = 'employee' AND u.status = 'active'
    `, [localDate]);

    if (!employees || employees.length === 0) return;

    for (const emp of employees) {
      const shiftStartDiff = getMinutesDiff(timeStr, emp.start_time);
      const shiftEndDiff = getMinutesDiff(timeStr, emp.end_time);

      // --- KASUS 1: PENGINGAT CLOCK IN (H-15 Menit sebelum jam shift masuk) ---
      // Aktif jika selisih waktu 14 - 16 menit, belum clock in, dan belum pernah diingatkan hari ini
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
          body: `Halo ${emp.full_name}, 15 menit lagi shift kerja (${emp.start_time.slice(0, 5)} WIB) dimulai. Jangan lupa Clock In tepat waktu ya!`,
          icon: '/icons/icon-192.png',
          badge: '/favicon.png',
          url: '/employee/dashboard.html',
          type: 'info',
          tag: `reminder-in-${emp.id}-${localDate}`
        });
      }

      // --- KASUS 2: PENGINGAT CLOCK OUT (H-15 Menit sebelum jam shift berakhir) ---
      // Aktif jika selisih waktu 14 - 16 menit, sudah clock in tapi belum clock out
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
          body: `Halo ${emp.full_name}, 15 menit lagi shift kerja (${emp.end_time.slice(0, 5)} WIB) berakhir. Pastikan Anda Clock Out sebelum pulang!`,
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
