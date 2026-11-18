// utils/mailer.js
// Layanan pengiriman email pengingat manual sistem SedayaClick via Gmail SMTP
// Digunakan melalui Modul Notifikasi Super Admin / Admin untuk mengingatkan Manajer
// mengenai antrean pengajuan karyawan (Lembur, Izin, Cuti, Sakit) yang masih berstatus Pending.

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
 * Mengambil ringkasan pengajuan yang masih berstatus 'pending' (izin, cuti, sakit, lembur)
 * dari database MySQL Production.
 */
async function getPendingSubmissionsSummary(divisionId = null) {
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
    subSql += ` ORDER BY s.created_at ASC LIMIT 25`;

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
    otSql += ` ORDER BY a.attendance_date DESC, a.overtime_clock_in_time DESC LIMIT 25`;

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
 * Render komponen tabel HTML antrean pengajuan pending
 */
function renderPendingQueueHtml(pendingSummary) {
  if (!pendingSummary || pendingSummary.totalCount === 0) {
    return `
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; text-align: center; margin: 15px 0;">
        <span style="font-size: 24px;">🎉</span>
        <h4 style="margin: 8px 0 4px; color: #166534; font-size: 14px; font-weight: 700;">Semua Pengajuan Sudah Beres!</h4>
        <p style="margin: 0; color: #15803d; font-size: 12px;">Saat ini tidak ada antrean pengajuan yang berstatus Pending di sistem.</p>
      </div>
    `;
  }

  const items = [];

  // Format pending overtime
  pendingSummary.overtimes.forEach((ot) => {
    items.push({
      name: ot.full_name,
      division: ot.division_name,
      type: 'Presensi Lembur',
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
      division: s.division_name,
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
        <td style="padding: 10px 12px; color: #64748b; font-size: 12px;">${it.division}</td>
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
    <div style="margin-top: 15px; background-color: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #fef3c7; padding: 12px 18px; border-bottom: 1px solid #fde68a; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 13px; font-weight: 700; color: #92400e;">
          📋 Terdapat ${pendingSummary.totalCount} Pengajuan Menunggu Respon:
        </span>
      </div>
      <div style="padding: 14px 18px;">
        <p style="margin: 0 0 10px; font-size: 12px; color: #78350f; line-height: 1.6;">
          Berikut rincian pengajuan karyawan yang saat ini masih berstatus <strong>Pending</strong> (menunggu persetujuan):
        </p>
        <div style="overflow-x: auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #fde68a;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-transform: uppercase; color: #64748b;">
                <th style="padding: 8px 12px;">Karyawan</th>
                <th style="padding: 8px 12px;">Divisi</th>
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
      </div>
    </div>
  `;
}

/**
 * Mengirim email pengingat rekap pengajuan secara manual ke daftar email kustom yang diinput
 */
async function sendManualReminderEmail({
  targetEmails = '',
  divisionId = null,
  customSubject = '',
  customNote = '',
}) {
  const recipients = new Set();

  // Parsing daftar email tujuan yang diinput admin (bisa dipisah koma)
  if (targetEmails && typeof targetEmails === 'string') {
    targetEmails.split(',').forEach((em) => {
      if (em && em.trim() && em.includes('@')) {
        recipients.add(em.trim().toLowerCase());
      }
    });
  }

  // Fallback default jika form email dikosongkan
  if (recipients.size === 0) {
    recipients.add('aditiafirdauss04@gmail.com');
    recipients.add('firdausmila664@gmail.com');
  }

  const recipientList = Array.from(recipients);

  // Ambil data pengajuan pending langsung dari database
  const summary = await getPendingSubmissionsSummary(divisionId);

  const appBaseUrl = (
    process.env.APP_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://sedayaclick.cloud' : `http://localhost:${process.env.PORT || 3000}`)
  ).replace(/\/+$/, '');

  const adminDashboardUrl = `${appBaseUrl}/admin/dashboard.html`;
  const pendingHtml = renderPendingQueueHtml(summary);

  const subject =
    customSubject && customSubject.trim()
      ? customSubject.trim()
      : `📩 Pengajuan Menunggu Persetujuan: Ada ${summary.totalCount} Pengajuan Karyawan Menunggu Tindakan Anda`;

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
    .note-box {
      margin-top: 15px;
      background-color: #f8fafc;
      border-left: 4px solid #64748b;
      border-radius: 8px;
      padding: 14px 16px;
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
          Ini adalah rekap pengingat bahwa saat ini terdapat <strong>${summary.totalCount} pengajuan karyawan</strong> (Lembur, Izin, Cuti, atau Sakit) yang masih berstatus <strong>Pending</strong> dan membutuhkan tinjauan serta persetujuan Anda (<strong>Setujui / Tolak</strong>). Terima kasih banyak atas kerja samanya! 😊
        </p>
      </div>

      <!-- MAIN CONTENT -->
      <div class="content">
        ${
          customNote && customNote.trim()
            ? `
        <div class="note-box">
          <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 4px;">💬 Catatan Tambahan dari Admin:</div>
          <div style="font-size: 13px; color: #1e293b; line-height: 1.5; font-style: italic;">"${customNote.trim()}"</div>
        </div>`
            : ''
        }

        <!-- TABEL ANTREAN PENGAJUAN -->
        ${pendingHtml}

        <!-- TOMBOL AKSI CEPAT -->
        <div class="cta-container">
          <a href="${adminDashboardUrl}" target="_blank" class="btn-action">
            👉 Buka Dashboard Manajer untuk Memproses ✨
          </a>
          <p style="font-size: 11px; color: #94a3b8; margin-top: 10px;">
            Akses menu <em>Pengajuan</em> atau <em>Presensi Lembur</em> pada Dashboard Admin Manager.
          </p>
        </div>

      </div>

      <!-- FOOTER -->
      <div class="footer">
        Email ini dikirim secara resmi oleh sistem <strong>SedayaClick</strong>.<br>
        Semoga harinya menyenangkan dan selalu produktif! 🌟
      </div>

    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'SedayaClick System'}" <${
      process.env.EMAIL_FROM_ADDRESS || defaultSmtpUser
    }>`,
    to: recipientList.join(', '),
    subject: subject,
    html: htmlContent,
  };

  const info = await transporter.sendMail(mailOptions);
  return {
    success: true,
    recipients: recipientList,
    pendingCount: summary.totalCount,
    messageId: info.messageId,
  };
}

/**
 * Kirim email pengujian koneksi SMTP
 */
async function sendTestEmail(targetEmail) {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'SedayaClick System'}" <${
      process.env.EMAIL_FROM_ADDRESS || defaultSmtpUser
    }>`,
    to: targetEmail,
    subject: 'Tes Pengiriman Email Sistem SedayaClick',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 500px; margin: 20px auto;">
        <h2 style="color: #0f172a; margin-top: 0;">Uji Coba Email Berhasil! 🎉</h2>
        <p style="font-size: 14px; color: #334155; line-height: 1.5;">Koneksi SMTP Gmail sistem <strong>SedayaClick</strong> berfungsi dengan baik dan siap digunakan untuk pengiriman pengingat pengajuan ke manajer.</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 20px;">Waktu kirim: ${new Date().toLocaleString('id-ID')}</p>
      </div>
    `,
  };
  return await transporter.sendMail(mailOptions);
}

module.exports = {
  transporter,
  getPendingSubmissionsSummary,
  renderPendingQueueHtml,
  sendManualReminderEmail,
  sendTestEmail,
};
