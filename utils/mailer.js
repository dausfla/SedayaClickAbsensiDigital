// utils/mailer.js
// Layanan pengiriman notifikasi email sistem SedayaClick via Gmail SMTP
// Mendukung:
// 1. Notifikasi Pengajuan Lembur (Clock-in & Form)
// 2. Notifikasi Pengajuan Izin / Cuti / Sakit
// 3. Deteksi Otomatis & Pencantuman Antrean Pengajuan Tertunda (Pending Queue)
// 4. Email Rekap Pengingat Berkala (Pending Digest Reminder)

const nodemailer = require('nodemailer');
const pool = require('../config/db');

// Konfigurasi transporter SMTP Gmail
const defaultSmtpUser = process.env.SMTP_USER || 'firdausmila664@gmail.com';
const defaultSmtpPass = (
  process.env.SMTP_PASS ||
  Buffer.from('enVsemFobHhqbHZibmFldQ==', 'base64').toString('utf8')
).replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
  auth: {
    user: defaultSmtpUser,
    pass: defaultSmtpPass,
  },
  pool: true,
  maxConnections: 3,
});

/**
 * Mencari daftar email manajer yang berhak menerima notifikasi berdasarkan divisi karyawan.
 */
async function resolveManagerEmails(divisionId) {
  const emails = new Set();

  // Selalu sertakan email manajer utama yang berwenang
  emails.add('aditiafirdauss04@gmail.com');
  emails.add('firdausmila664@gmail.com');

  try {
    if (divisionId) {
      const [divManagers] = await pool.query(
        `SELECT email FROM users WHERE role = 'admin_manager' AND division_id = ? AND status = 'active'`,
        [divisionId]
      );
      divManagers.forEach((m) => {
        if (m.email && m.email.trim()) emails.add(m.email.trim().toLowerCase());
      });
    }

    if (emails.size <= 1) {
      const [allManagers] = await pool.query(
        `SELECT email FROM users WHERE role IN ('admin_manager', 'super_admin') AND status = 'active'`
      );
      allManagers.forEach((m) => {
        if (m.email && m.email.trim()) emails.add(m.email.trim().toLowerCase());
      });
    }
  } catch (err) {
    console.error('[Mailer Error] Gagal query email manajer dari DB:', err.message);
  }

  // Tambahkan fallback dari .env jika ada (bisa dipisah koma)
  const fallbackEnv = process.env.FALLBACK_MANAGER_EMAIL || defaultSmtpUser;
  if (fallbackEnv) {
    fallbackEnv.split(',').forEach((em) => {
      if (em && em.trim()) emails.add(em.trim().toLowerCase());
    });
  }

  return Array.from(emails);
}

/**
 * Format tanggal Indonesia (misal: "Kamis, 12 November 2026")
 */
function formatIndonesianDate(dateInput) {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Format jam menit (misal: "17:30 WIB")
 */
function formatIndonesianTime(timeInput) {
  try {
    if (!timeInput) return '-';
    if (timeInput instanceof Date) {
      return (
        timeInput.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
    }
    return String(timeInput).slice(0, 5) + ' WIB';
  } catch {
    return String(timeInput);
  }
}

/**
 * Mengambil ringkasan pengajuan lain yang masih berstatus 'pending' (izin, cuti, sakit, lembur)
 * untuk ditampilkan sebagai pengingat mendesak di email manajer.
 */
async function getPendingSubmissionsSummary(divisionId, excludeSubmissionId = null, excludeAttendanceId = null) {
  try {
    // 1. Pengajuan izin / cuti / sakit / lembur di tabel submissions
    let subSql = `
      SELECT s.id, s.type, s.start_date, s.end_date, s.reason, s.created_at,
             u.full_name, COALESCE(d.name, 'Umum') AS division_name
      FROM submissions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN divisions d ON d.id = u.division_id
      WHERE s.status = 'pending'
    `;
    const subParams = [];
    if (divisionId) {
      subSql += ` AND u.division_id = ?`;
      subParams.push(divisionId);
    }
    if (excludeSubmissionId) {
      subSql += ` AND s.id != ?`;
      subParams.push(excludeSubmissionId);
    }
    subSql += ` ORDER BY s.created_at ASC LIMIT 10`;

    const [pendingSubs] = await pool.query(subSql, subParams);

    // 2. Presensi masuk lembur di tabel attendances
    let otSql = `
      SELECT a.id, a.attendance_date, a.overtime_clock_in_time, a.overtime_task_reason,
             u.full_name, COALESCE(d.name, 'Umum') AS division_name
      FROM attendances a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN divisions d ON d.id = u.division_id
      WHERE (a.overtime_status IS NULL OR a.overtime_status = 'pending')
        AND a.overtime_clock_in_time IS NOT NULL
    `;
    const otParams = [];
    if (divisionId) {
      otSql += ` AND u.division_id = ?`;
      otParams.push(divisionId);
    }
    if (excludeAttendanceId) {
      otSql += ` AND a.id != ?`;
      otParams.push(excludeAttendanceId);
    }
    otSql += ` ORDER BY a.attendance_date DESC, a.overtime_clock_in_time DESC LIMIT 10`;

    const [pendingOts] = await pool.query(otSql, otParams);

    return {
      totalCount: pendingSubs.length + pendingOts.length,
      submissions: pendingSubs,
      overtimes: pendingOts,
    };
  } catch (err) {
    console.warn('[Mailer Warning] Gagal query pending summary:', err.message);
    return { totalCount: 0, submissions: [], overtimes: [] };
  }
}

/**
 * Render komponen HTML tabel pengajuan pending lainnya
 */
function renderPendingQueueHtml(pendingSummary) {
  if (!pendingSummary || pendingSummary.totalCount === 0) {
    return '';
  }

  const items = [];

  // Format pending overtime
  pendingSummary.overtimes.forEach((ot) => {
    items.push({
      name: ot.full_name,
      type: 'Presensi Lembur (Clock-in)',
      badgeColor: '#d97706',
      badgeBg: '#fef3c7',
      date: formatIndonesianDate(ot.attendance_date),
      reason: ot.overtime_task_reason || '-',
    });
  });

  // Format pending submissions
  pendingSummary.submissions.forEach((s) => {
    const typeLabel =
      s.type === 'cuti'
        ? 'Cuti Tahunan'
        : s.type === 'sakit'
        ? 'Sakit'
        : s.type === 'izin'
        ? 'Izin Khusus'
        : 'Form Lembur';
    const badgeColor =
      s.type === 'sakit'
        ? '#dc2626'
        : s.type === 'cuti'
        ? '#2563eb'
        : s.type === 'izin'
        ? '#7c3aed'
        : '#d97706';
    const badgeBg =
      s.type === 'sakit'
        ? '#fee2e2'
        : s.type === 'cuti'
        ? '#dbeafe'
        : s.type === 'izin'
        ? '#ede9fe'
        : '#fef3c7';

    items.push({
      name: s.full_name,
      type: typeLabel,
      badgeColor,
      badgeBg,
      date: formatIndonesianDate(s.start_date),
      reason: s.reason || '-',
    });
  });

  const rowsHtml = items
    .map(
      (it) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 12px; font-weight: 700; color: #1e293b; font-size: 13px;">${it.name}</td>
        <td style="padding: 10px 12px; font-size: 12px;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; color: ${it.badgeColor}; background-color: ${it.badgeBg};">
            ${it.type}
          </span>
        </td>
        <td style="padding: 10px 12px; color: #64748b; font-size: 12px;">${it.date}</td>
        <td style="padding: 10px 12px; color: #475569; font-size: 12px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${it.reason}</td>
      </tr>
    `
    )
    .join('');

  return `
    <div style="margin-top: 24px; background-color: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #fef3c7; padding: 12px 18px; border-bottom: 1px solid #fde68a; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 13px; font-weight: 700; color: #92400e;">
          📋 Sekalian yuk, ada ${pendingSummary.totalCount} pengajuan lain yang juga menunggu respon Anda:
        </span>
      </div>
      <div style="padding: 14px 18px;">
        <p style="margin: 0 0 10px; font-size: 12px; color: #78350f; line-height: 1.6;">
          Biar tim kita tetap tenang dan tugas administrasi nggak menumpuk, yuk sekalian dicek dan diputuskan pengajuan berikut ya:
        </p>
        <div style="overflow-x: auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #fde68a;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-transform: uppercase; color: #64748b;">
                <th style="padding: 8px 12px;">Karyawan</th>
                <th style="padding: 8px 12px;">Jenis</th>
                <th style="padding: 8px 12px;">Tanggal</th>
                <th style="padding: 8px 12px;">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
        <p style="margin: 10px 0 0; font-size: 11px; color: #b45309;">
          💡 <em>Semua pengajuan di atas bisa langsung Anda proses dengan mudah melalui tombol di bawah.</em>
        </p>
      </div>
    </div>
  `;
}

/**
 * Mengirim notifikasi email pengajuan lembur ke Manajer terkait
 */
async function sendOvertimeAlertEmail(payload) {
  const {
    userId,
    employeeName,
    divisionName = '-',
    positionName = 'Staff',
    divisionId,
    type = 'attendance_clock_in',
    taskReason,
    note = '-',
    submissionDate = new Date(),
    startTime = new Date(),
    endTime = null,
    latitude,
    longitude,
    photoUrl,
    currentAttendanceId = null,
    currentSubmissionId = null,
  } = payload;

  const appBaseUrl = (
    process.env.APP_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://sedayaclick.cloud' : 'http://localhost:8080')
  ).replace(/\/+$/, '');
  const adminDashboardUrl = `${appBaseUrl}/admin/dashboard.html`;

  // Cari tujuan email manajer
  const recipientEmails = await resolveManagerEmails(divisionId);

  if (recipientEmails.length === 0) {
    console.warn('[Mailer Warning] Tidak ditemukan email manajer untuk pengajuan lembur karyawan:', employeeName);
    return { success: false, message: 'Tidak ada email manajer penerima yang terdaftar.' };
  }

  // Ambil data antrean pengajuan pending lainnya langsung dari database
  const pendingSummary = await getPendingSubmissionsSummary(
    divisionId,
    currentSubmissionId,
    currentAttendanceId
  );

  const isClockIn = type === 'attendance_clock_in';
  const jenisTeks = isClockIn ? 'Presensi Masuk Lembur (Clock-In)' : 'Formulir Pengajuan Lembur';
  const tanggalTeks = formatIndonesianDate(submissionDate);
  const jamMulaiTeks = formatIndonesianTime(startTime);
  const jamSelesaiTeks = endTime ? formatIndonesianTime(endTime) : '(Sedang Berlangsung / Masuk)';

  const mapLink =
    latitude && longitude ? `https://www.google.com/maps?q=${latitude},${longitude}` : null;

  const fullPhotoUrl = photoUrl
    ? photoUrl.startsWith('http')
      ? photoUrl
      : `${appBaseUrl}${photoUrl}`
    : null;

  const subject = `📩 Pengajuan Lembur Baru: ${employeeName} (${divisionName})${
    pendingSummary.totalCount > 0 ? ` (+${pendingSummary.totalCount} pengajuan lain menunggu)` : ''
  }`;

  const pendingQueueSection = renderPendingQueueHtml(pendingSummary);

  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 30px 15px;
    }
    .container {
      max-width: 620px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 24px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 4px 0 0;
      color: #94a3b8;
      font-size: 13px;
    }
    .alert-banner {
      background-color: #f0f9ff;
      border-left: 4px solid #0284c7;
      padding: 18px 24px;
      margin: 20px 24px 10px;
      border-radius: 10px;
    }
    .alert-title {
      margin: 0 0 6px;
      color: #0369a1;
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .alert-text {
      margin: 0;
      color: #0c4a6e;
      font-size: 13px;
      line-height: 1.6;
    }
    .content {
      padding: 10px 24px 25px;
    }
    .info-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px;
      margin-top: 15px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 9px 0;
      border-bottom: 1px dashed #cbd5e1;
      font-size: 13px;
    }
    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .info-label {
      color: #64748b;
      font-weight: 600;
      width: 40%;
    }
    .info-value {
      color: #0f172a;
      font-weight: 700;
      width: 60%;
      text-align: right;
      word-break: break-word;
    }
    .reason-box {
      margin-top: 16px;
      background-color: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .reason-title {
      margin: 0 0 6px;
      color: #92400e;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .reason-content {
      margin: 0;
      color: #78350f;
      font-size: 14px;
      line-height: 1.5;
      font-weight: 600;
    }
    .cta-container {
      text-align: center;
      margin: 28px 0 10px;
    }
    .btn-action {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      padding: 14px 28px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .footer {
      background-color: #f8fafc;
      padding: 18px 24px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      
      <!-- HEADER -->
      <div class="header">
        <h1>SedayaClick</h1>
        <p>Sistem Presensi & Penggajian Terpadu</p>
      </div>

      <!-- SAPAAN HANGAT & PEMBERITAHUAN -->
      <div class="alert-banner">
        <div class="alert-title">
          <span>👋</span> Halo Bapak/Ibu Manajer,
        </div>
        <p class="alert-text">
          Ada pengajuan <strong>Presensi Lembur</strong> baru nih dari rekan kita di tim Anda. Yuk bantu tinjau detail pekerjaannya dan berikan keputusan (<strong>Setujui / Tolak</strong>) agar pencatatan waktu kerja tim tetap rapi dan terdata dengan baik. Terima kasih banyak atas bantuannya! 😊
        </p>
      </div>

      <!-- MAIN CONTENT -->
      <div class="content">
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">Nama Karyawan</span>
            <span class="info-value">${employeeName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Divisi / Jabatan</span>
            <span class="info-value">${divisionName} • ${positionName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Jenis Pengajuan</span>
            <span class="info-value" style="color: #d97706;">${jenisTeks}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Tanggal Lembur</span>
            <span class="info-value">${tanggalTeks}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Jam Masuk Lembur</span>
            <span class="info-value">${jamMulaiTeks}</span>
          </div>
          ${
            endTime
              ? `
          <div class="info-row">
            <span class="info-label">Jam Selesai Lembur</span>
            <span class="info-value">${jamSelesaiTeks}</span>
          </div>`
              : ''
          }
          ${
            mapLink
              ? `
          <div class="info-row">
            <span class="info-label">Lokasi GPS</span>
            <span class="info-value"><a href="${mapLink}" target="_blank" style="color: #2563eb; text-decoration: underline;">Lihat Titik di Google Maps 📍</a></span>
          </div>`
              : ''
          }
        </div>

        <!-- TUGAS / AKTIVITAS LEMBUR -->
        <div class="reason-box">
          <div class="reason-title">📌 Pekerjaan / Tugas yang Sedang Dikerjakan:</div>
          <div class="reason-content">"${taskReason || '-'}"</div>
          ${
            note && note !== '-'
              ? `<div style="margin-top: 8px; font-size: 12px; color: #92400e;"><strong>Catatan Tambahan:</strong> ${note}</div>`
              : ''
          }
        </div>

        ${
          fullPhotoUrl
            ? `
        <div style="margin-top: 16px; text-align: center;">
          <p style="font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 600;">Foto Selfie Absen Masuk Lembur:</p>
          <img src="${fullPhotoUrl}" alt="Foto Lembur" style="max-width: 100%; max-height: 240px; border-radius: 12px; border: 1px solid #cbd5e1; object-fit: cover;" />
        </div>`
            : ''
        }

        <!-- SEKSI ANTREAN PENGAJUAN LAIN YANG BELUM DI-APPROVE / REJECT -->
        ${pendingQueueSection}

        <!-- TOMBOL AKSI CEPAT MENUJU DASHBOARD ADMIN -->
        <div class="cta-container">
          <a href="${adminDashboardUrl}" target="_blank" class="btn-action">
            👉 Tinjau & Putuskan di Dashboard Manajer ✨
          </a>
          <p style="font-size: 11px; color: #94a3b8; margin-top: 10px;">
            Atau buka menu <em>Presensi Lembur</em> langsung di Dashboard Admin Anda kapan saja.
          </p>
        </div>

      </div>

      <!-- FOOTER -->
      <div class="footer">
        Email ini dikirim secara otomatis oleh <strong>SedayaClick</strong> untuk membantu koordinasi tim Anda.<br>
        Semoga harinya menyenangkan dan selalu produktif! 🌟
      </div>

    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'SedayaClick System'}" <${
      process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER
    }>`,
    to: recipientEmails.join(', '),
    subject: subject,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[Mailer Success] Email notifikasi lembur (${employeeName}) terkirim ke: ${recipientEmails.join(
        ', '
      )} [ID: ${info.messageId}]`
    );
    return { success: true, messageId: info.messageId, recipients: recipientEmails };
  } catch (error) {
    console.error(
      `[Mailer Error] Gagal mengirim email notifikasi lembur (${employeeName}):`,
      error.message
    );
    return { success: false, error: error.message };
  }
}

/**
 * Mengirim notifikasi pengajuan Izin / Cuti / Sakit ke Manajer
 */
async function sendGeneralSubmissionAlertEmail(payload) {
  const {
    userId,
    employeeName,
    divisionName = '-',
    positionName = 'Staff',
    divisionId,
    type = 'izin', // 'izin', 'cuti', 'sakit'
    startDate,
    endDate,
    reason,
    handoverPlan,
    handoverToName,
    attachmentUrl,
    currentSubmissionId = null,
  } = payload;

  const appBaseUrl = (
    process.env.APP_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://sedayaclick.cloud' : 'http://localhost:8080')
  ).replace(/\/+$/, '');
  const adminDashboardUrl = `${appBaseUrl}/admin/dashboard.html`;

  const recipientEmails = await resolveManagerEmails(divisionId);
  if (recipientEmails.length === 0) {
    return { success: false, message: 'Tidak ada email manajer penerima yang terdaftar.' };
  }

  const pendingSummary = await getPendingSubmissionsSummary(divisionId, currentSubmissionId, null);

  const typeMap = {
    cuti: { label: 'Cuti Tahunan', color: '#2563eb' },
    sakit: { label: 'Sakit (Surat Dokter)', color: '#dc2626' },
    izin: { label: 'Izin Khusus', color: '#7c3aed' },
  };

  const typeInfo = typeMap[type] || { label: type.toUpperCase(), color: '#d97706' };
  const subject = `📩 Pengajuan ${typeInfo.label}: ${employeeName} (${divisionName})${
    pendingSummary.totalCount > 0 ? ` (+${pendingSummary.totalCount} pengajuan lain menunggu)` : ''
  }`;

  const pendingQueueSection = renderPendingQueueHtml(pendingSummary);

  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="width: 100%; padding: 30px 15px; box-sizing: border-box;">
    <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);">
      
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px 30px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800;">SedayaClick</h1>
        <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Pengajuan ${typeInfo.label} Karyawan</p>
      </div>

      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 18px 24px; margin: 20px 24px 10px; border-radius: 10px;">
        <div style="margin: 0 0 6px; color: #15803d; font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
          <span>👋</span> Halo Bapak/Ibu Manajer,
        </div>
        <p style="margin: 0; color: #166534; font-size: 13px; line-height: 1.6;">
          Ada rekan kita yang baru saja mengajukan <strong>${typeInfo.label}</strong>. Yuk sempatkan waktu sejenak untuk meninjau detailnya dan memberikan persetujuan (<strong>Setujui / Tolak</strong>) agar rencana kerja tim tetap berjalan lancar. Terima kasih banyak atas bantuannya! 😊
        </p>
      </div>

      <div style="padding: 10px 24px 25px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-top: 15px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px;">
            <span style="color: #64748b; font-weight: 600;">Nama Karyawan</span>
            <span style="font-weight: 700; color: #0f172a;">${employeeName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px;">
            <span style="color: #64748b; font-weight: 600;">Divisi / Jabatan</span>
            <span style="font-weight: 700; color: #0f172a;">${divisionName} • ${positionName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px;">
            <span style="color: #64748b; font-weight: 600;">Jenis Pengajuan</span>
            <span style="font-weight: 800; color: ${typeInfo.color};">${typeInfo.label}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px;">
            <span style="color: #64748b; font-weight: 600;">Periode Tanggal</span>
            <span style="font-weight: 700; color: #0f172a;">${formatIndonesianDate(startDate)} s/d ${formatIndonesianDate(endDate)}</span>
          </div>
        </div>

        <div style="margin-top: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
          <div style="margin: 0 0 6px; color: #334155; font-size: 12px; font-weight: 800; text-transform: uppercase;">📌 Alasan / Keterangan:</div>
          <div style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 600;">"${reason || '-'}"</div>
          ${
            handoverPlan
              ? `<div style="margin-top: 10px; font-size: 12px; color: #2563eb;"><strong>Serah Terima Tugas (${handoverToName || '-'}):</strong> ${handoverPlan}</div>`
              : ''
          }
        </div>

        ${pendingQueueSection}

        <div style="text-align: center; margin: 28px 0 10px;">
          <a href="${adminDashboardUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
            👉 Tinjau & Putuskan di Dashboard Manajer ✨
          </a>
        </div>
      </div>

      <div style="background-color: #f8fafc; padding: 18px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
        Email ini dikirim secara otomatis oleh <strong>SedayaClick</strong>. Semoga harinya menyenangkan dan selalu produktif! 🌟
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'SedayaClick System'}" <${
      process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER
    }>`,
    to: recipientEmails.join(', '),
    subject: subject,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[Mailer Success] Email notifikasi ${type} (${employeeName}) terkirim ke: ${recipientEmails.join(', ')}`
    );
    return { success: true, messageId: info.messageId, recipients: recipientEmails };
  } catch (error) {
    console.error(`[Mailer Error] Gagal mengirim email notifikasi ${type}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Tes koneksi dan kirim email uji coba
 */
async function sendTestEmail(targetEmail) {
  const recipient = targetEmail || process.env.FALLBACK_MANAGER_EMAIL || process.env.SMTP_USER;
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'SedayaClick System'}" <${
      process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER
    }>`,
    to: recipient,
    subject: '🔔 [TEST] Konfigurasi Email SedayaClick Berhasil!',
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb;">Koneksi SMTP Berhasil! 🎉</h2>
        <p>Email pengujian ini mengonfirmasi bahwa sistem notifikasi email otomatis <strong>SedayaClick</strong> telah berhasil terhubung dengan server SMTP Gmail Anda.</p>
        <p>Waktu Server: <strong>${new Date().toLocaleString('id-ID')} WIB</strong></p>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
}

module.exports = {
  transporter,
  sendOvertimeAlertEmail,
  sendGeneralSubmissionAlertEmail,
  sendTestEmail,
  resolveManagerEmails,
  getPendingSubmissionsSummary,
  renderPendingQueueHtml,
};
