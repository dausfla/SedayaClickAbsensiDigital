// utils/timeCalc.js
// Kumpulan fungsi murni untuk menghitung Durasi Kerja, Durasi Terlambat,
// dan Lembur dalam presisi detik, lalu diformat ke "HH:mm:ss".
// Dipisah dari routes supaya bisa dipakai ulang oleh modul absensi
// maupun modul pelaporan/ekspor tanpa duplikasi logika.

/**
 * Mengubah total detik menjadi string "HH:mm:ss".
 * Mendukung durasi > 24 jam (misal lembur lintas hari), jam tidak dibatasi 2 digit
 * kecuali < 100 jam, cukup untuk kasus absensi harian.
 */
function secondsToHMS(totalSeconds) {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalSeconds || 0));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${sign}${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Menghitung selisih dua objek Date dalam detik (b - a).
 */
function diffInSeconds(dateA, dateB) {
  return Math.floor((dateB.getTime() - dateA.getTime()) / 1000);
}

/**
 * Menggabungkan tanggal (YYYY-MM-DD) dengan jam (HH:mm:ss) menjadi objek Date lokal.
 */
function combineDateAndTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}`);
}

/**
 * Menghitung Durasi Terlambat (dalam detik) berdasarkan jam clock-in aktual
 * dibandingkan jam mulai shift + toleransi.
 * Mengembalikan 0 jika tidak terlambat.
 */
function calculateLateDuration(attendanceDate, clockInTime, shiftStartTime, toleranceMinutes = 0) {
  const scheduledStart = combineDateAndTime(attendanceDate, shiftStartTime);
  scheduledStart.setMinutes(scheduledStart.getMinutes() + Number(toleranceMinutes || 0));
  const actualIn = new Date(clockInTime);
  const diff = diffInSeconds(scheduledStart, actualIn);
  return diff > 0 ? diff : 0;
}

/**
 * Menghitung Lembur (dalam detik) berdasarkan jam clock-out aktual
 * dibandingkan jam selesai shift.
 * Mengembalikan 0 jika pulang sebelum/tepat jam shift berakhir.
 */
function calculateOvertime(attendanceDate, clockOutTime, shiftEndTime) {
  const scheduledEnd = combineDateAndTime(attendanceDate, shiftEndTime);
  const actualOut = new Date(clockOutTime);
  const diff = diffInSeconds(scheduledEnd, actualOut);
  return diff > 0 ? diff : 0;
}

/**
 * Menghitung Durasi Kerja total (dalam detik) dari clock-in ke clock-out.
 */
function calculateWorkDuration(clockInTime, clockOutTime) {
  const inDate = new Date(clockInTime);
  const outDate = new Date(clockOutTime);
  const diff = diffInSeconds(inDate, outDate);
  return diff > 0 ? diff : 0;
}

/**
 * Menentukan status kehadiran berdasarkan durasi terlambat.
 */
function determineStatus(lateDurationSeconds) {
  return lateDurationSeconds > 0 ? 'late' : 'on_time';
}

module.exports = {
  secondsToHMS,
  diffInSeconds,
  combineDateAndTime,
  calculateLateDuration,
  calculateOvertime,
  calculateWorkDuration,
  determineStatus
};
