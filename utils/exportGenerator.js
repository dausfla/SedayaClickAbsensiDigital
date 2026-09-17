// utils/exportGenerator.js
// Step 6: Generator ekspor CSV dan Excel (.xlsx) untuk laporan absensi & penggajian.
// Durasi kerja/terlambat/lembur WAJIB tampil dalam format "HH:mm:ss".

const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const { secondsToHMS } = require('./timeCalc');

const REPORT_FIELDS = [
  { label: 'Nama Karyawan', value: 'full_name', key: 'full_name' },
  { label: 'Divisi', value: 'division_name', key: 'division_name' },
  { label: 'Jabatan', value: 'position_name', key: 'position_name' },
  { label: 'Tanggal', value: 'attendance_date', key: 'attendance_date' },
  { label: 'Jam Masuk', value: 'clock_in_display', key: 'clock_in_display' },
  { label: 'Jam Keluar', value: 'clock_out_display', key: 'clock_out_display' },
  { label: 'Durasi Kerja (HH:mm:ss)', value: 'work_duration_hms', key: 'work_duration_hms' },
  { label: 'Durasi Terlambat (HH:mm:ss)', value: 'late_duration_hms', key: 'late_duration_hms' },
  { label: 'Lembur (HH:mm:ss)', value: 'overtime_hms', key: 'overtime_hms' },
  { label: 'Status', value: 'status_label', key: 'status_label' }
];

const STATUS_LABELS = {
  on_time: 'Tepat Waktu',
  late: 'Terlambat',
  early_leave: 'Pulang Cepat',
  incomplete: 'Belum Lengkap'
};

/**
 * Menyiapkan baris data mentah dari DB menjadi baris siap-ekspor,
 * dengan durasi sudah dalam format HH:mm:ss.
 */
function prepareRows(rawRows) {
  return rawRows.map((r) => ({
    ...r,
    id: r.id,
    attendance_id: r.id,
    clock_in_display: r.clock_in_time ? String(r.clock_in_time).slice(11, 19) || String(r.clock_in_time) : '-',
    clock_out_display: r.clock_out_time ? String(r.clock_out_time).slice(11, 19) || String(r.clock_out_time) : '-',
    work_duration_hms: secondsToHMS(r.work_duration_seconds || 0),
    late_duration_hms: secondsToHMS(r.late_duration_seconds || 0),
    overtime_hms: secondsToHMS(r.overtime_seconds || 0),
    status_label: STATUS_LABELS[r.status] || r.status,
    status_display: STATUS_LABELS[r.status] || r.status
  }));
}

/**
 * Menghasilkan buffer CSV siap-download.
 */
function generateCSV(rawRows) {
  const rows = prepareRows(rawRows);
  const fields = REPORT_FIELDS.map((f) => ({ label: f.label, value: f.value }));
  const parser = new Parser({ fields });
  return parser.parse(rows);
}

/**
 * Menghasilkan buffer Excel (.xlsx) siap-download.
 * Kolom durasi diformat sebagai TEXT "HH:mm:ss" (bukan time-serial Excel)
 * agar nilai > 24 jam (mis. lembur akumulasi) tidak dibulatkan/di-reset oleh Excel,
 * dan agar presisi HH:mm:ss selalu tampil persis seperti yang diminta.
 */
async function generateXLSX(rawRows, sheetTitle = 'Rekap Absensi') {
  const rows = prepareRows(rawRows);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SedayaClick';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetTitle);

  sheet.columns = REPORT_FIELDS.map((f) => ({ header: f.label, key: f.key, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' }
  };

  rows.forEach((row) => {
    const newRow = sheet.addRow(row);
    // Paksa kolom durasi menjadi format teks agar "HH:mm:ss" tidak diubah oleh Excel.
    ['work_duration_hms', 'late_duration_hms', 'overtime_hms'].forEach((key) => {
      const colIndex = REPORT_FIELDS.findIndex((f) => f.key === key) + 1;
      const cell = newRow.getCell(colIndex);
      cell.numFmt = '@';
      cell.value = row[key];
    });
  });

  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + REPORT_FIELDS.length)}1` };

  return workbook.xlsx.writeBuffer();
}

/* ============================================================
   EKSPOR DATA PENGAJUAN (IZIN / CUTI / SAKIT)
   ============================================================ */

const SUBMISSION_REPORT_FIELDS = [
  { label: 'Nama Karyawan', value: 'full_name', key: 'full_name' },
  { label: 'Divisi', value: 'division_name', key: 'division_name' },
  { label: 'Jabatan', value: 'position_name', key: 'position_name' },
  { label: 'Jenis Pengajuan', value: 'type_label', key: 'type_label' },
  { label: 'Mulai Dari', value: 'start_date', key: 'start_date' },
  { label: 'Sampai Dengan', value: 'end_date', key: 'end_date' },
  { label: 'Total (Hari)', value: 'total_days', key: 'total_days' },
  { label: 'Alasan Pengajuan', value: 'reason', key: 'reason' },
  { label: 'Catatan Review', value: 'review_note', key: 'review_note' },
  { label: 'Status', value: 'status_label', key: 'status_label' },
  { label: 'Tanggal Dibuat', value: 'created_at', key: 'created_at' }
];

const SUBMISSION_TYPE_LABELS = {
  izin: 'Izin',
  cuti: 'Cuti',
  sakit: 'Sakit'
};

const SUBMISSION_STATUS_LABELS = {
  pending: 'Menunggu Persetujuan',
  approved: 'Disetujui',
  rejected: 'Ditolak'
};

function prepareSubmissionRows(rawRows) {
  return rawRows.map((r) => ({
    ...r,
    type_label: SUBMISSION_TYPE_LABELS[r.type] || r.type,
    status_label: SUBMISSION_STATUS_LABELS[r.status] || r.status,
    total_days: r.total_days || (r.start_date && r.end_date ? Math.ceil((new Date(r.end_date) - new Date(r.start_date)) / (1000 * 60 * 60 * 24)) + 1 : 1),
    review_note: r.review_note || '-',
    position_name: r.position_name || '-',
    division_name: r.division_name || '-',
    created_at: r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '-'
  }));
}

function generateSubmissionsCSV(rawRows) {
  const rows = prepareSubmissionRows(rawRows);
  const fields = SUBMISSION_REPORT_FIELDS.map((f) => ({ label: f.label, value: f.value }));
  const parser = new Parser({ fields });
  return parser.parse(rows);
}

async function generateSubmissionsXLSX(rawRows, sheetTitle = 'Rekap Pengajuan') {
  const rows = prepareSubmissionRows(rawRows);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SedayaClick';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetTitle);
  sheet.columns = SUBMISSION_REPORT_FIELDS.map((f) => ({ header: f.label, key: f.key, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' }
  };

  rows.forEach((row) => {
    sheet.addRow(row);
  });

  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + SUBMISSION_REPORT_FIELDS.length)}1` };
  return workbook.xlsx.writeBuffer();
}

module.exports = {
  generateCSV,
  generateXLSX,
  prepareRows,
  REPORT_FIELDS,
  generateSubmissionsCSV,
  generateSubmissionsXLSX,
  prepareSubmissionRows,
  SUBMISSION_REPORT_FIELDS
};
