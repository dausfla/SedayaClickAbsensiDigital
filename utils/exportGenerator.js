// utils/exportGenerator.js
// Generator ekspor CSV dan Excel (.xlsx) untuk laporan absensi & penggajian.
// Didesain khusus untuk kerapihan visual, kemudahan kalkulasi penggajian (payroll),
// serta mendukung 2 Sheet Excel:
// Sheet 1: Rekap Presensi & Gaji (Detail Presensi, Hari Kerja, Jam Kerja, Terlambat, Lembur, & Summary Row Total)
// Sheet 2: Detail Pengajuan (Izin, Cuti, Sakit, & Lembur beserta Alasan, Status, dan Catatan Review Admin)

const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const { secondsToHMS } = require('./timeCalc');

const REPORT_FIELDS = [
  { label: 'Nama Karyawan', value: 'full_name', key: 'full_name', align: 'left' },
  { label: 'Divisi', value: 'division_name', key: 'division_name', align: 'left' },
  { label: 'Jabatan', value: 'position_name', key: 'position_name', align: 'left' },
  { label: 'Tanggal', value: 'attendance_date', key: 'attendance_date', align: 'center' },
  { label: 'Hari Kerja', value: 'work_day_count', key: 'work_day_count', align: 'right', numFmt: '#,##0' },
  { label: 'Jam Masuk Shift', value: 'clock_in_display', key: 'clock_in_display', align: 'center' },
  { label: 'Jam Keluar Shift', value: 'clock_out_display', key: 'clock_out_display', align: 'center' },
  { label: 'Durasi Kerja (HH:mm:ss)', value: 'work_duration_hms', key: 'work_duration_hms', align: 'center' },
  { label: 'Total Jam Kerja (Desimal)', value: 'work_duration_hours', key: 'work_duration_hours', align: 'right', numFmt: '0.00' },
  { label: 'Durasi Terlambat (HH:mm:ss)', value: 'late_duration_hms', key: 'late_duration_hms', align: 'center' },
  { label: 'Terlambat (Menit)', value: 'late_duration_minutes', key: 'late_duration_minutes', align: 'right', numFmt: '#,##0' },
  { label: 'Status Lembur', value: 'overtime_status_label', key: 'overtime_status_label', align: 'center' },
  { label: 'Jam Masuk Lembur', value: 'overtime_clock_in_display', key: 'overtime_clock_in_display', align: 'center' },
  { label: 'Jam Keluar Lembur', value: 'overtime_clock_out_display', key: 'overtime_clock_out_display', align: 'center' },
  { label: 'Durasi Lembur (HH:mm:ss)', value: 'overtime_duration_hms', key: 'overtime_duration_hms', align: 'center' },
  { label: 'Total Jam Lembur (Desimal)', value: 'overtime_duration_hours', key: 'overtime_duration_hours', align: 'right', numFmt: '0.00' },
  { label: 'Tugas Lembur', value: 'overtime_task_reason', key: 'overtime_task_reason', align: 'left' },
  { label: 'Catatan Lembur', value: 'overtime_note', key: 'overtime_note', align: 'left' },
  { label: 'Status Kehadiran', value: 'status_label', key: 'status_label', align: 'center' }
];

const STATUS_LABELS = {
  on_time: 'Tepat Waktu',
  late: 'Terlambat',
  early_leave: 'Pulang Cepat',
  incomplete: 'Belum Lengkap'
};

function formatTimeOnly(timeVal) {
  if (!timeVal) return '-';
  const str = String(timeVal).trim();
  if (str.includes('T')) {
    return str.split('T')[1].slice(0, 8);
  }
  if (str.includes(' ')) {
    return str.split(' ')[1].slice(0, 8);
  }
  if (str.length >= 5 && str.includes(':')) {
    return str.slice(0, 8);
  }
  return str;
}

function formatDateOnly(dateVal) {
  if (!dateVal) return '-';
  if (dateVal instanceof Date) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(dateVal).trim();
  if (str.includes('T')) return str.split('T')[0];
  if (str.includes(' ')) return str.split(' ')[0];
  return str.slice(0, 10);
}

function prepareRows(rawRows) {
  return rawRows.map((r) => {
    const workSec = Number(r.work_duration_seconds || 0);
    const lateSec = Number(r.late_duration_seconds || 0);
    const otSec = Number(r.overtime_duration_seconds || r.overtime_seconds || 0);

    const workHours = Number((workSec / 3600).toFixed(2));
    const lateMinutes = Math.round(lateSec / 60);
    const otHours = Number((otSec / 3600).toFixed(2));

    const otNoteParts = [];
    if (r.overtime_clock_in_note) otNoteParts.push(`In: ${r.overtime_clock_in_note}`);
    if (r.overtime_clock_out_note) otNoteParts.push(`Out: ${r.overtime_clock_out_note}`);
    const otNote = otNoteParts.length ? otNoteParts.join(' | ') : '-';

    let otStatusLabel = 'Tidak Lembur';
    if (r.overtime_clock_in_time || otSec > 0) {
      if (r.overtime_status === 'approved') otStatusLabel = 'Disetujui';
      else if (r.overtime_status === 'rejected') otStatusLabel = 'Ditolak';
      else otStatusLabel = 'Menunggu Review';
    }

    const otInStr = formatTimeOnly(r.overtime_clock_in_time);
    const otOutStr = formatTimeOnly(r.overtime_clock_out_time);
    const otDurHms = secondsToHMS(otSec);

    let overtimeHmsDisplay = '-';
    if (r.overtime_clock_in_time || otSec > 0) {
      if (otInStr !== '-' && otOutStr !== '-') {
        overtimeHmsDisplay = `${otInStr.slice(0, 5)} - ${otOutStr.slice(0, 5)} (${otDurHms})`;
      } else if (otInStr !== '-') {
        overtimeHmsDisplay = `Masuk: ${otInStr.slice(0, 5)}`;
      } else {
        overtimeHmsDisplay = otDurHms;
      }
    }

    return {
      ...r,
      full_name: r.full_name || '-',
      division_name: r.division_name || '-',
      position_name: r.position_name || '-',
      attendance_date: formatDateOnly(r.attendance_date),
      work_day_count: 1,
      clock_in_display: formatTimeOnly(r.clock_in_time),
      clock_out_display: formatTimeOnly(r.clock_out_time),
      work_duration_hms: secondsToHMS(workSec),
      work_duration_hours: workHours,
      late_duration_hms: secondsToHMS(lateSec),
      late_duration_minutes: lateMinutes,
      overtime_status_label: otStatusLabel,
      overtime_clock_in_display: otInStr,
      overtime_clock_out_display: otOutStr,
      overtime_hms: overtimeHmsDisplay,
      overtime_duration_hms: otDurHms,
      overtime_duration_hours: otHours,
      overtime_task_reason: r.overtime_task_reason || '-',
      overtime_note: otNote,
      status_label: STATUS_LABELS[r.status] || r.status || 'Hadir'
    };
  });
}

function generateCSV(rawRows) {
  const rows = prepareRows(rawRows);
  const fields = REPORT_FIELDS.map((f) => ({ label: f.label, value: f.value }));
  const parser = new Parser({ fields });
  return parser.parse(rows);
}

/**
 * Menghasilkan Excel (.xlsx) dengan 2 Sheet Terintegrasi:
 * Sheet 1: Rekap Presensi & Gaji (Detail Harian + Summary Row)
 * Sheet 2: Detail Pengajuan (Daftar Pengajuan Izin/Cuti/Sakit/Lembur + Status + Catatan Admin)
 */
async function generateXLSX(rawRows, submissionRawRows = []) {
  const rows = prepareRows(rawRows);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SedayaClick';
  workbook.created = new Date();

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } }
  };

  // ============================================================
  // SHEET 1: REKAP PRESENSI & GAJI
  // ============================================================
  const sheet1 = workbook.addWorksheet('Rekap Presensi & Gaji', {
    views: [{ showGridLines: true }]
  });

  sheet1.columns = REPORT_FIELDS.map((f) => ({ header: f.label, key: f.key, width: 20 }));

  const headerRow1 = sheet1.getRow(1);
  headerRow1.height = 28;
  headerRow1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
  headerRow1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E3A8A' } // Dark Navy
  };
  headerRow1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  let totalWorkDays = rows.length;
  let totalWorkHours = 0;
  let totalLateMinutes = 0;
  let totalOvertimeHours = 0;

  rows.forEach((row) => {
    totalWorkHours += row.work_duration_hours || 0;
    totalLateMinutes += row.late_duration_minutes || 0;
    totalOvertimeHours += row.overtime_duration_hours || 0;

    const addedRow = sheet1.addRow(row);
    addedRow.height = 20;

    REPORT_FIELDS.forEach((f, idx) => {
      const cell = addedRow.getCell(idx + 1);
      cell.border = thinBorder;
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: f.align || 'left'
      };

      if (f.numFmt) {
        cell.numFmt = f.numFmt;
      }
    });
  });

  // Baris Total Rekapitulasi Sheet 1
  if (rows.length > 0) {
    const summaryRowData = {};
    REPORT_FIELDS.forEach((f) => {
      if (f.key === 'full_name') summaryRowData[f.key] = 'TOTAL REKAP';
      else if (f.key === 'work_day_count') summaryRowData[f.key] = totalWorkDays;
      else if (f.key === 'work_duration_hours') summaryRowData[f.key] = Number(totalWorkHours.toFixed(2));
      else if (f.key === 'late_duration_minutes') summaryRowData[f.key] = totalLateMinutes;
      else if (f.key === 'overtime_duration_hours') summaryRowData[f.key] = Number(totalOvertimeHours.toFixed(2));
      else summaryRowData[f.key] = '';
    });

    const summaryRow = sheet1.addRow(summaryRowData);
    summaryRow.height = 24;

    REPORT_FIELDS.forEach((f, idx) => {
      const cell = summaryRow.getCell(idx + 1);
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '0F172A' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F1F5F9' }
      };
      cell.border = {
        top: { style: 'medium', color: { argb: '475569' } },
        bottom: { style: 'double', color: { argb: '475569' } },
        left: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: f.align || 'left'
      };
      if (f.numFmt) cell.numFmt = f.numFmt;
    });
  }

  sheet1.columns.forEach((col, idx) => {
    const field = REPORT_FIELDS[idx];
    let maxLen = field.label.length;
    rows.forEach((r) => {
      const val = String(r[field.key] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    });
    col.width = Math.min(Math.max(maxLen + 4, 14), 45);
  });

  sheet1.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: REPORT_FIELDS.length }
  };

  // ============================================================
  // SHEET 2: DETAIL PENGAJUAN (IZIN, CUTI, SAKIT, LEMBUR)
  // ============================================================
  const subRows = prepareSubmissionRows(submissionRawRows || []);
  const sheet2 = workbook.addWorksheet('Detail Pengajuan (Cuti-Lembur)', {
    views: [{ showGridLines: true }]
  });

  sheet2.columns = SUBMISSION_REPORT_FIELDS.map((f) => ({ header: f.label, key: f.key, width: 22 }));

  const headerRow2 = sheet2.getRow(1);
  headerRow2.height = 28;
  headerRow2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
  headerRow2.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '0F766E' } // Deep Teal
  };
  headerRow2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  let totalSubmissionDays = 0;

  subRows.forEach((row) => {
    totalSubmissionDays += Number(row.total_days || 0);
    const addedRow = sheet2.addRow(row);
    addedRow.height = 20;

    SUBMISSION_REPORT_FIELDS.forEach((f, idx) => {
      const cell = addedRow.getCell(idx + 1);
      cell.border = thinBorder;
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: f.align || 'left'
      };

      if (f.numFmt) cell.numFmt = f.numFmt;
    });
  });

  // Baris Total Rekapitulasi Sheet 2
  if (subRows.length > 0) {
    const summaryRowData2 = {};
    SUBMISSION_REPORT_FIELDS.forEach((f) => {
      if (f.key === 'full_name') summaryRowData2[f.key] = 'TOTAL REKAP PENGAJUAN';
      else if (f.key === 'total_days') summaryRowData2[f.key] = totalSubmissionDays;
      else summaryRowData2[f.key] = '';
    });

    const summaryRow2 = sheet2.addRow(summaryRowData2);
    summaryRow2.height = 24;

    SUBMISSION_REPORT_FIELDS.forEach((f, idx) => {
      const cell = summaryRow2.getCell(idx + 1);
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '0F172A' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F1F5F9' }
      };
      cell.border = {
        top: { style: 'medium', color: { argb: '475569' } },
        bottom: { style: 'double', color: { argb: '475569' } },
        left: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: f.align || 'left'
      };
      if (f.numFmt) cell.numFmt = f.numFmt;
    });
  }

  sheet2.columns.forEach((col, idx) => {
    const field = SUBMISSION_REPORT_FIELDS[idx];
    let maxLen = field.label.length;
    subRows.forEach((r) => {
      const val = String(r[field.key] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    });
    col.width = Math.min(Math.max(maxLen + 4, 15), 45);
  });

  sheet2.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: SUBMISSION_REPORT_FIELDS.length }
  };

  return workbook.xlsx.writeBuffer();
}

/* ============================================================
   EKSPOR DATA PENGAJUAN (IZIN / CUTI / SAKIT / LEMBUR)
   ============================================================ */

const SUBMISSION_REPORT_FIELDS = [
  { label: 'Nama Karyawan', value: 'full_name', key: 'full_name', align: 'left' },
  { label: 'Divisi', value: 'division_name', key: 'division_name', align: 'left' },
  { label: 'Jabatan', value: 'position_name', key: 'position_name', align: 'left' },
  { label: 'Jenis Pengajuan', value: 'type_label', key: 'type_label', align: 'center' },
  { label: 'Mulai Dari', value: 'start_date', key: 'start_date', align: 'center' },
  { label: 'Sampai Dengan', value: 'end_date', key: 'end_date', align: 'center' },
  { label: 'Total (Hari)', value: 'total_days', key: 'total_days', align: 'right', numFmt: '#,##0' },
  { label: 'Alasan Pengajuan', value: 'reason', key: 'reason', align: 'left' },
  { label: 'Catatan Review Admin', value: 'review_note', key: 'review_note', align: 'left' },
  { label: 'Status Persetujuan', value: 'status_label', key: 'status_label', align: 'center' },
  { label: 'Tanggal Pengajuan', value: 'created_at', key: 'created_at', align: 'center' }
];

const SUBMISSION_TYPE_LABELS = {
  izin: 'Izin',
  cuti: 'Cuti Tahunan',
  sakit: 'Sakit',
  lembur: 'Pengajuan Lembur'
};

const SUBMISSION_STATUS_LABELS = {
  pending: 'Menunggu Persetujuan',
  approved: 'Disetujui',
  rejected: 'Ditolak'
};

function prepareSubmissionRows(rawRows) {
  return rawRows.map((r) => {
    let otSpan = '-';
    if (r.type === 'lembur' && r.start_time && r.end_time) {
      otSpan = `${String(r.start_time).slice(0, 5)} - ${String(r.end_time).slice(0, 5)}`;
    }
    return {
      ...r,
      full_name: r.full_name || '-',
      division_name: r.division_name || '-',
      position_name: r.position_name || '-',
      type_label: SUBMISSION_TYPE_LABELS[r.type] || r.type,
      status_label: SUBMISSION_STATUS_LABELS[r.status] || r.status,
      total_days: r.total_days || (r.start_date && r.end_date ? Math.ceil((new Date(r.end_date) - new Date(r.start_date)) / (1000 * 60 * 60 * 24)) + 1 : 1),
      overtime_time_span: otSpan,
      reason: r.reason || '-',
      review_note: r.review_note || '-',
      start_date: formatDateOnly(r.start_date),
      end_date: formatDateOnly(r.end_date),
      created_at: r.created_at ? formatDateOnly(r.created_at) : '-'
    };
  });
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

  const sheet = workbook.addWorksheet(sheetTitle, {
    views: [{ showGridLines: true }]
  });

  sheet.columns = SUBMISSION_REPORT_FIELDS.map((f) => ({ header: f.label, key: f.key, width: 22 }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E3A8A' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } }
  };

  let totalDaysSum = 0;

  rows.forEach((row) => {
    totalDaysSum += Number(row.total_days || 0);
    const addedRow = sheet.addRow(row);
    addedRow.height = 20;

    SUBMISSION_REPORT_FIELDS.forEach((f, idx) => {
      const cell = addedRow.getCell(idx + 1);
      cell.border = thinBorder;
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: f.align || 'left'
      };

      if (f.numFmt) {
        cell.numFmt = f.numFmt;
      }
    });
  });

  if (rows.length > 0) {
    const summaryRowData = {};
    SUBMISSION_REPORT_FIELDS.forEach((f) => {
      if (f.key === 'full_name') summaryRowData[f.key] = 'TOTAL HARI';
      else if (f.key === 'total_days') summaryRowData[f.key] = totalDaysSum;
      else summaryRowData[f.key] = '';
    });

    const summaryRow = sheet.addRow(summaryRowData);
    summaryRow.height = 24;

    SUBMISSION_REPORT_FIELDS.forEach((f, idx) => {
      const cell = summaryRow.getCell(idx + 1);
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '0F172A' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F1F5F9' }
      };
      cell.border = {
        top: { style: 'medium', color: { argb: '475569' } },
        bottom: { style: 'double', color: { argb: '475569' } },
        left: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: f.align || 'left'
      };
      if (f.numFmt) cell.numFmt = f.numFmt;
    });
  }

  sheet.columns.forEach((col, idx) => {
    const field = SUBMISSION_REPORT_FIELDS[idx];
    let maxLen = field.label.length;
    rows.forEach((r) => {
      const val = String(r[field.key] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    });
    col.width = Math.min(Math.max(maxLen + 4, 15), 45);
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: SUBMISSION_REPORT_FIELDS.length }
  };

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
