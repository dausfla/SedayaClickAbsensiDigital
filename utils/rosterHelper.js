// utils/rosterHelper.js
// Modul Helper untuk Pengelolaan Roster Shift & Libur Rolling Bulanan.
// Mengadopsi format matriks jadwal operasional tim (seperti Casa Nawasena & SSV).

const ExcelJS = require('exceljs');

const DEFAULT_SHIFT_CODES = {
  P: {
    code: 'P',
    name: 'Pagi',
    start_time: '06:00:00',
    end_time: '15:00:00',
    is_day_off: 0,
    tolerance_minutes: 15,
    description: 'Shift Pagi (06:00 - 15:00 WIB)',
    color: '#059669', // Emerald
    bgColor: '#D1FAE5'
  },
  S: {
    code: 'S',
    name: 'Siang',
    start_time: '13:00:00',
    end_time: '22:00:00',
    is_day_off: 0,
    tolerance_minutes: 15,
    description: 'Shift Siang (13:00 - 22:00 WIB)',
    color: '#D97706', // Amber
    bgColor: '#FEF3C7'
  },
  VK: {
    code: 'VK',
    name: 'Kantor - SSV',
    start_time: '08:00:00',
    end_time: '17:00:00',
    is_day_off: 0,
    tolerance_minutes: 15,
    description: 'Kantor SSV (08:00 - 17:00 WIB)',
    color: '#4F46E5', // Indigo
    bgColor: '#E0E7FF'
  },
  VW: {
    code: 'VW',
    name: 'Kantor - SSV + PIC WA',
    start_time: '08:00:00',
    end_time: '17:00:00',
    is_day_off: 0,
    tolerance_minutes: 15,
    description: 'Kantor SSV + PIC WA (08:00 - 17:00 WIB)',
    color: '#2563EB', // Blue
    bgColor: '#DBEAFE'
  },
  VH: {
    code: 'VH',
    name: 'Setengah Hari - SSV',
    start_time: '08:00:00',
    end_time: '13:00:00',
    is_day_off: 0,
    tolerance_minutes: 15,
    description: 'Setengah Hari SSV (08:00 - 13:00 WIB)',
    color: '#0891B2', // Cyan
    bgColor: '#CFFAFE'
  },
  R: {
    code: 'R',
    name: 'Sore',
    start_time: '14:00:00',
    end_time: '23:00:00',
    is_day_off: 0,
    tolerance_minutes: 15,
    description: 'Shift Sore (14:00 - 23:00 WIB)',
    color: '#7C3AED', // Purple
    bgColor: '#EDE9FE'
  },
  PL: {
    code: 'PL',
    name: 'Pengelola Lapangan',
    start_time: '08:00:00',
    end_time: '17:00:00',
    is_day_off: 0,
    tolerance_minutes: 15,
    description: 'Pengelola Lapangan (08:00 - 17:00 WIB)',
    color: '#0D9488', // Teal
    bgColor: '#CCFBF1'
  },
  SAT: {
    code: 'SAT',
    name: 'Standby / Satpam',
    start_time: '08:00:00',
    end_time: '20:00:00',
    is_day_off: 0,
    tolerance_minutes: 15,
    description: 'Standby / Satpam (08:00 - 20:00 WIB)',
    color: '#475569', // Slate
    bgColor: '#F1F5F9'
  },
  L: {
    code: 'L',
    name: 'Libur Terjadwal (OFF)',
    start_time: null,
    end_time: null,
    is_day_off: 1,
    tolerance_minutes: 0,
    description: 'Hari Libur Terjadwal (OFF / Rolling Day Off)',
    color: '#E11D48', // Rose
    bgColor: '#FFE4E6'
  },
  REG: {
    code: 'REG',
    name: 'Reguler Kantor',
    start_time: '08:00:00',
    end_time: '17:00:00',
    is_day_off: 0,
    tolerance_minutes: 15,
    description: 'Reguler Jam Kantor (08:00 - 17:00 WIB)',
    color: '#0284C7', // Sky
    bgColor: '#E0F2FE'
  }
};

const DAY_NAMES_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/**
 * Resolusi detail shift berdasarkan kode string.
 */
function resolveShiftCode(rawCode) {
  if (!rawCode) return null;
  const code = String(rawCode).trim().toUpperCase();
  if (DEFAULT_SHIFT_CODES[code]) {
    return { ...DEFAULT_SHIFT_CODES[code] };
  }
  // Custom code fallback
  return {
    code,
    name: code,
    start_time: '08:00:00',
    end_time: '17:00:00',
    is_day_off: code === 'OFF' || code === 'LIBUR' ? 1 : 0,
    tolerance_minutes: 15,
    description: `Shift Khusus ${code}`,
    color: '#64748B',
    bgColor: '#F8FAFC'
  };
}

/**
 * Dapatkan daftar tanggal dalam satu bulan (YYYY-MM).
 */
function getDaysInMonth(year, month) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10); // 1 - 12
  const numDays = new Date(y, m, 0).getDate();
  const days = [];

  for (let d = 1; d <= numDays; d++) {
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      day: d,
      date: dateStr,
      dayOfWeek,
      dayName: DAY_NAMES_ID[dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6
    });
  }

  return days;
}

/**
 * Buat file Excel Template Roster untuk diisi dan diunggah.
 */
async function generateRosterTemplateXLSX(year, month, employees) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SedayaClick';
  workbook.created = new Date();

  const days = getDaysInMonth(year, month);
  const sheetName = `Roster ${year}-${String(month).padStart(2, '0')}`;
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true, state: 'frozen', xSplit: 4, ySplit: 2 }]
  });

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } }
  };

  // Baris 1: Header Tanggal (Nomor 1..N)
  // Baris 2: Header Hari (Sen, Sel, ...)
  const row1Values = ['ID User', 'Nama Karyawan', 'Divisi', 'Jabatan'];
  const row2Values = ['', '', '', ''];

  days.forEach((d) => {
    row1Values.push(d.day);
    row2Values.push(d.dayName);
  });

  sheet.addRow(row1Values);
  sheet.addRow(row2Values);

  // Styling Header Baris 1 & 2
  const headerRow1 = sheet.getRow(1);
  const headerRow2 = sheet.getRow(2);

  headerRow1.height = 24;
  headerRow2.height = 20;

  for (let col = 1; col <= 4; col++) {
    sheet.mergeCells(1, col, 2, col);
    const cell = sheet.getCell(1, col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'center' : 'left' };
    cell.border = thinBorder;
  }

  days.forEach((d, idx) => {
    const colNum = 5 + idx;
    const cell1 = sheet.getCell(1, colNum);
    const cell2 = sheet.getCell(2, colNum);

    const isWeekend = d.isWeekend;
    const headerBg = isWeekend ? '991B1B' : '334155'; // Merah tua utk weekend

    cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } };
    cell1.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell1.alignment = { vertical: 'middle', horizontal: 'center' };
    cell1.border = thinBorder;

    cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isWeekend ? 'FEE2E2' : 'F1F5F9' } };
    cell2.font = { name: 'Arial', size: 9, bold: true, color: { argb: isWeekend ? '991B1B' : '475569' } };
    cell2.alignment = { vertical: 'middle', horizontal: 'center' };
    cell2.border = thinBorder;
  });

  // Isi Baris Data Karyawan
  employees.forEach((emp) => {
    const rowData = [
      emp.id,
      emp.full_name,
      emp.division_name || '-',
      emp.position_name || '-'
    ];
    // Default cell kosong agar user bisa mengisi kode shift
    days.forEach(() => rowData.push(''));
    const addedRow = sheet.addRow(rowData);
    addedRow.height = 22;

    addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { name: 'Arial', size: 10 };
      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Arial', size: 9, color: { argb: '64748B' } };
      } else if (colNumber >= 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // Atur Lebar Kolom
  sheet.getColumn(1).width = 10;
  sheet.getColumn(2).width = 28;
  sheet.getColumn(3).width = 22;
  sheet.getColumn(4).width = 22;
  for (let c = 5; c <= 4 + days.length; c++) {
    sheet.getColumn(c).width = 6;
  }

  // Sheet 2: Panduan Kode Shift
  const guideSheet = workbook.addWorksheet('Panduan Kode Shift', {
    views: [{ showGridLines: true }]
  });
  guideSheet.addRow(['Kode Shift', 'Nama Shift', 'Jam Masuk', 'Jam Pulang', 'Status Libur', 'Keterangan']);
  const gHeader = guideSheet.getRow(1);
  gHeader.height = 24;
  gHeader.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  Object.values(DEFAULT_SHIFT_CODES).forEach((sc) => {
    const r = guideSheet.addRow([
      sc.code,
      sc.name,
      sc.start_time || '-',
      sc.end_time || '-',
      sc.is_day_off ? 'Ya (Libur / OFF)' : 'Tidak (Kerja)',
      sc.description
    ]);
    r.height = 20;
    r.eachCell((cell, colNum) => {
      cell.border = thinBorder;
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: colNum === 1 || colNum >= 3 ? 'center' : 'left' };
      if (colNum === 1) {
        cell.font = { name: 'Arial', size: 10, bold: true };
      }
    });
  });

  guideSheet.getColumn(1).width = 14;
  guideSheet.getColumn(2).width = 25;
  guideSheet.getColumn(3).width = 14;
  guideSheet.getColumn(4).width = 14;
  guideSheet.getColumn(5).width = 18;
  guideSheet.getColumn(6).width = 38;

  return await workbook.xlsx.writeBuffer();
}

/**
 * Buat file Excel Matriks Roster Terisi (Siap Cetak / Bagikan)
 */
async function generateRosterMatrixXLSX(year, month, employees, schedulesByEmployee) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SedayaClick';
  workbook.created = new Date();

  const days = getDaysInMonth(year, month);
  const sheetName = `Matriks Jadwal ${year}-${String(month).padStart(2, '0')}`;
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true, state: 'frozen', xSplit: 3, ySplit: 2 }]
  });

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } }
  };

  // Header 1: Tanggal (1..N)
  // Header 2: Nama Hari (Sen, Sel, ...)
  const row1Values = ['No', 'Nama Karyawan', 'Divisi'];
  const row2Values = ['', '', ''];

  days.forEach((d) => {
    row1Values.push(d.day);
    row2Values.push(d.dayName);
  });

  sheet.addRow(row1Values);
  sheet.addRow(row2Values);

  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 20;

  for (let col = 1; col <= 3; col++) {
    sheet.mergeCells(1, col, 2, col);
    const cell = sheet.getCell(1, col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'center' : 'left' };
    cell.border = thinBorder;
  }

  days.forEach((d, idx) => {
    const colNum = 4 + idx;
    const cell1 = sheet.getCell(1, colNum);
    const cell2 = sheet.getCell(2, colNum);

    const isWeekend = d.isWeekend;
    const headerBg = isWeekend ? '991B1B' : '1E293B';

    cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } };
    cell1.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell1.alignment = { vertical: 'middle', horizontal: 'center' };
    cell1.border = thinBorder;

    cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isWeekend ? 'FEE2E2' : 'F1F5F9' } };
    cell2.font = { name: 'Arial', size: 9, bold: true, color: { argb: isWeekend ? '991B1B' : '475569' } };
    cell2.alignment = { vertical: 'middle', horizontal: 'center' };
    cell2.border = thinBorder;
  });

  employees.forEach((emp, empIdx) => {
    const userSchedules = schedulesByEmployee[emp.id] || {};
    const rowData = [
      empIdx + 1,
      emp.full_name,
      emp.division_name || '-'
    ];

    days.forEach((d) => {
      const sch = userSchedules[d.date];
      rowData.push(sch ? sch.shift_code : '');
    });

    const addedRow = sheet.addRow(rowData);
    addedRow.height = 22;

    addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { name: 'Arial', size: 10 };
      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber <= 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        const val = String(cell.value || '').trim().toUpperCase();
        if (val) {
          cell.font = { name: 'Arial', size: 10, bold: true };
          if (val === 'L' || val === 'OFF') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '991B1B' } };
          } else if (val === 'P') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '065F46' } };
          } else if (val === 'S') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '92400E' } };
          } else if (val === 'VK' || val === 'VW' || val === 'VH') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0E7FF' } };
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '3730A3' } };
          }
        }
      }
    });
  });

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 28;
  sheet.getColumn(3).width = 22;
  for (let c = 4; c <= 3 + days.length; c++) {
    sheet.getColumn(c).width = 6;
  }

  return await workbook.xlsx.writeBuffer();
}

/**
 * Parsing file Excel yang diunggah untuk mengimpor jadwal roster bulanan.
 */
async function parseRosterXLSX(buffer, targetYear, targetMonth, usersList) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Ambil sheet pertama atau sheet yang ada kata "Roster" / "Jadwal"
  let sheet = workbook.worksheets[0];
  for (const s of workbook.worksheets) {
    if (s.name.toLowerCase().includes('roster') || s.name.toLowerCase().includes('jadwal')) {
      sheet = s;
      break;
    }
  }

  if (!sheet) {
    throw new Error('Sheet jadwal tidak ditemukan di dalam file Excel.');
  }

  const daysInTargetMonth = getDaysInMonth(targetYear, targetMonth);
  const maxDay = daysInTargetMonth.length;

  // Petakan index kolom ke nomor tanggal (1..31)
  // Periksa baris 1 dan baris 2 untuk mencari header angka tanggal
  let dateColMap = {}; // { colNumber: dayNumber }
  let headerRowIndex = 1;

  for (let r = 1; r <= 3; r++) {
    const row = sheet.getRow(r);
    let foundDaysCount = 0;
    const tempMap = {};

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const val = parseInt(cell.value, 10);
      if (!isNaN(val) && val >= 1 && val <= 31) {
        tempMap[colNumber] = val;
        foundDaysCount++;
      }
    });

    if (foundDaysCount >= 5) {
      dateColMap = tempMap;
      headerRowIndex = r;
      break;
    }
  }

  if (Object.keys(dateColMap).length === 0) {
    throw new Error('Tidak dapat menemukan kolom tanggal (1 s.d. 31) di baris header Excel.');
  }

  // Buat lookup karyawan: by ID dan by Normalized Full Name
  const userById = {};
  const userByName = {};
  usersList.forEach((u) => {
    userById[u.id] = u;
    const cleanName = u.full_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    userByName[cleanName] = u;
  });

  const parsedSchedules = [];
  const unrecognizedNames = [];

  // Iterasi baris data mulai dari baris setelah header
  for (let r = headerRowIndex + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const col1Val = row.getCell(1).value;
    const col2Val = row.getCell(2).value;

    let matchedUser = null;

    // Coba cocokkan ID user dari Kolom 1
    if (col1Val && !isNaN(parseInt(col1Val, 10)) && userById[parseInt(col1Val, 10)]) {
      matchedUser = userById[parseInt(col1Val, 10)];
    }

    // Coba cocokkan Nama Karyawan dari Kolom 2 atau Kolom 1
    if (!matchedUser && col2Val) {
      const clean2 = String(col2Val).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (userByName[clean2]) {
        matchedUser = userByName[clean2];
      }
    }
    if (!matchedUser && col1Val && typeof col1Val === 'string') {
      const clean1 = String(col1Val).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (userByName[clean1]) {
        matchedUser = userByName[clean1];
      }
    }

    // Jika baris ini bukan baris karyawan (misal summary atau kosong), lewati
    if (!matchedUser) {
      if (col2Val && String(col2Val).trim().length > 3) {
        unrecognizedNames.push(String(col2Val).trim());
      }
      continue;
    }

    // Baca sel-sel tanggal untuk karyawan ini
    for (const [colNum, dayNum] of Object.entries(dateColMap)) {
      if (dayNum > maxDay) continue;

      const cellVal = row.getCell(parseInt(colNum, 10)).value;
      if (!cellVal) continue;

      const shiftCodeStr = String(cellVal).trim().toUpperCase();
      if (!shiftCodeStr) continue;

      const shiftMeta = resolveShiftCode(shiftCodeStr);
      const scheduleDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      parsedSchedules.push({
        user_id: matchedUser.id,
        user_name: matchedUser.full_name,
        schedule_date: scheduleDate,
        shift_code: shiftMeta ? shiftMeta.code : shiftCodeStr,
        start_time: shiftMeta ? shiftMeta.start_time : '08:00:00',
        end_time: shiftMeta ? shiftMeta.end_time : '17:00:00',
        is_day_off: shiftMeta ? shiftMeta.is_day_off : (shiftCodeStr === 'L' || shiftCodeStr === 'OFF' ? 1 : 0)
      });
    }
  }

  return {
    schedules: parsedSchedules,
    unrecognizedNames: [...new Set(unrecognizedNames)],
    matchedCount: new Set(parsedSchedules.map((s) => s.user_id)).size
  };
}

module.exports = {
  DEFAULT_SHIFT_CODES,
  DAY_NAMES_ID,
  resolveShiftCode,
  getDaysInMonth,
  generateRosterTemplateXLSX,
  generateRosterMatrixXLSX,
  parseRosterXLSX
};
