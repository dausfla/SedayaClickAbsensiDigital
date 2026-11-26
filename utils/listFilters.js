// utils/listFilters.js
// Filter bersama (rentang tanggal & nama karyawan) untuk daftar dan ekspor
// Pengajuan Izin/Cuti/Sakit serta Presensi Lembur.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRESET_DAYS = { today: 0, weekly: 7, monthly: 30 };

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function jakartaDate(daysAgo = 0) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(Date.now() - daysAgo * 86400000));
}

function isValidDate(str) {
  if (!DATE_RE.test(str || '')) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

/**
 * period: 'today' | 'weekly' | 'monthly' | 'custom' (butuh start_date & end_date) | lainnya = tanpa filter.
 * Mengembalikan { start, end } (YYYY-MM-DD) atau null.
 */
function resolveDateRange({ period, start_date, end_date }) {
  if (Object.prototype.hasOwnProperty.call(PRESET_DAYS, period)) {
    return { start: jakartaDate(PRESET_DAYS[period]), end: jakartaDate(0) };
  }
  if (period === 'custom') {
    if (!isValidDate(start_date) || !isValidDate(end_date)) {
      throw badRequest('Tanggal mulai dan tanggal akhir wajib diisi dengan format yang benar.');
    }
    if (start_date > end_date) {
      throw badRequest('Tanggal mulai tidak boleh melewati tanggal akhir.');
    }
    return { start: start_date, end: end_date };
  }
  return null;
}

function nameLikeParam(name) {
  const trimmed = String(name || '').trim().slice(0, 100);
  if (!trimmed) return null;
  return `%${trimmed.replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * Pengajuan masuk ke rentang jika periode pelaksanaannya beririsan dengan rentang
 * ATAU diajukan di dalam rentang tersebut.
 */
function applySubmissionFilters(query, conditions, params) {
  const range = resolveDateRange(query);
  if (range) {
    conditions.push('((s.start_date <= ? AND s.end_date >= ?) OR DATE(s.created_at) BETWEEN ? AND ?)');
    params.push(range.end, range.start, range.start, range.end);
  }
  const like = nameLikeParam(query.name);
  if (like) {
    conditions.push('u.full_name LIKE ?');
    params.push(like);
  }
}

function applyOvertimeFilters(query, conditions, params) {
  const range = resolveDateRange(query);
  if (range) {
    conditions.push('a.attendance_date BETWEEN ? AND ?');
    params.push(range.start, range.end);
  }
  const like = nameLikeParam(query.name);
  if (like) {
    conditions.push('u.full_name LIKE ?');
    params.push(like);
  }
}

module.exports = { resolveDateRange, applySubmissionFilters, applyOvertimeFilters };
