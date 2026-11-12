// routes/admin.js
// Modul Pengajuan (Admin Manager & Super Admin)
// Admin Manager & Super Admin dapat melihat, memproses, membuat, mengedit, dan menghapus pengajuan
// dari seluruh divisi atau memfilter per divisi.

const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole, requireActiveAccount } = require('../middleware/auth');

const router = express.Router();

const scoped = [requireAuth, requireRole('admin_manager', 'super_admin'), requireActiveAccount];

/**
 * GET /api/admin/divisions
 * Daftar divisi langsung dari database untuk filter dropdown.
 */
router.get('/divisions', ...scoped, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM divisions ORDER BY name ASC');
    res.json({ success: true, divisions: rows });
  } catch (err) {
    console.error('Gagal mengambil daftar divisi:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar divisi.' });
  }
});

/**
 * GET /api/admin/submissions/pending
 * Daftar pengajuan izin/cuti/sakit yang berstatus 'pending'.
 */
router.get('/submissions/pending', ...scoped, async (req, res) => {
  try {
    const { division_id } = req.query;

    const conditions = ["s.status = 'pending'"];
    const params = [];

    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT s.id, s.type, s.start_date, s.end_date, s.start_time, s.end_time, s.reason, s.attachment, s.handover_plan, s.handover_to_name, s.handover_to_position, s.status, s.created_at,
              u.full_name, u.id AS user_id, p.name AS position_name, d.name AS division_name
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN divisions d ON d.id = u.division_id
       ${where}
       ORDER BY s.created_at ASC`,
      params
    );
    res.json({ success: true, submissions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat pengajuan pending.' });
  }
});

/**
 * GET /api/admin/submissions/history
 * Riwayat pengajuan yang sudah dipproses (approved/rejected).
 */
router.get('/submissions/history', ...scoped, async (req, res) => {
  try {
    const { division_id } = req.query;

    const conditions = ["s.status IN ('approved','rejected')"];
    const params = [];

    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT s.id, s.type, s.start_date, s.end_date, s.start_time, s.end_time, s.reason, s.handover_plan, s.handover_to_name, s.handover_to_position, s.status, s.review_note, s.reviewed_at,
              u.full_name, d.name AS division_name
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       ${where}
       ORDER BY s.reviewed_at DESC LIMIT 100`,
      params
    );
    res.json({ success: true, submissions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat riwayat pengajuan.' });
  }
});

/**
 * PATCH /api/admin/submissions/:id/decision
 * body: { decision: 'approved' | 'rejected', review_note: string (wajib) }
 */
router.patch('/submissions/:id/decision', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, review_note } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Keputusan tidak valid.' });
    }
    if (!review_note || !review_note.trim()) {
      return res.status(400).json({ success: false, message: 'Catatan alasan wajib diisi.' });
    }

    const [rows] = await pool.query(
      `SELECT s.id FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.status = 'pending'`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan atau sudah diproses.' });
    }

    await pool.query(
      `UPDATE submissions SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
      [decision, review_note, req.session.user.id, id]
    );

    res.json({ success: true, message: `Pengajuan berhasil di-${decision === 'approved' ? 'setujui' : 'tolak'}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memproses keputusan.' });
  }
});

/**
 * GET /api/admin/monitoring/today
 * Monitoring kehadiran tim secara real-time (hari ini) untuk divisi Admin Manager.
 */
router.get('/monitoring/today', ...scoped, async (req, res) => {
  try {
    const divisionId = req.session.user.division_id;
    const [rows] = await pool.query(
      `SELECT u.id AS user_id, u.full_name, p.name AS position_name,
              a.clock_in_time, a.clock_out_time, a.status,
              a.late_duration_seconds, a.overtime_seconds
       FROM users u
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN attendances a ON a.user_id = u.id AND a.attendance_date = CURDATE()
       WHERE u.division_id = ? AND u.role = 'employee' AND u.status = 'active'
       ORDER BY u.full_name ASC`,
      [divisionId]
    );
    res.json({ success: true, team: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat data monitoring.' });
  }
});

/**
 * GET /api/admin/employees
 * Daftar karyawan untuk dropdown pembuatan pengajuan baru.
 */
router.get('/employees', ...scoped, async (req, res) => {
  try {
    const { division_id } = req.query;

    const conditions = ["u.role = 'employee'", "u.status = 'active'"];
    const params = [];

    if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, d.name AS division_name, p.name AS position_name
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       ${where}
       ORDER BY u.full_name ASC`,
      params
    );
    res.json({ success: true, employees: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat daftar karyawan.' });
  }
});

/**
 * POST /api/admin/submissions
 * Buat pengajuan baru atas nama karyawan.
 */
router.post('/submissions', ...scoped, async (req, res) => {
  try {
    const { user_id, type, start_date, end_date, start_time, end_time, reason, handover_plan, handover_to_name, handover_to_position, status = 'pending', review_note = '' } = req.body;

    if (!user_id || !type || !start_date || !end_date || !reason) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }

    const reviewedBy = status !== 'pending' ? req.session.user.id : null;
    const reviewedAt = status !== 'pending' ? new Date() : null;

    const finalHandoverPlan = type === 'cuti' && handover_plan ? handover_plan.trim() : null;
    const finalHandoverToName = type === 'cuti' && handover_to_name ? handover_to_name.trim() : null;
    const finalHandoverToPos = type === 'cuti' && handover_to_position ? handover_to_position.trim() : null;

    const [result] = await pool.query(
      `INSERT INTO submissions (user_id, type, start_date, end_date, start_time, end_time, reason, handover_plan, handover_to_name, handover_to_position, status, review_note, reviewed_by, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, type, start_date, end_date, start_time || null, end_time || null, reason, finalHandoverPlan, finalHandoverToName, finalHandoverToPos, status, review_note || null, reviewedBy, reviewedAt]
    );

    res.json({ success: true, message: 'Pengajuan berhasil dibuat.', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal membuat pengajuan.' });
  }
});

/**
 * PUT /api/admin/submissions/:id
 * Edit / Update pengajuan.
 */
router.put('/submissions/:id', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, start_date, end_date, start_time, end_time, reason, handover_plan, handover_to_name, handover_to_position, status, review_note } = req.body;

    const [check] = await pool.query(
      `SELECT s.id FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan.' });
    }

    const reviewedBy = status && status !== 'pending' ? req.session.user.id : null;

    const finalHandoverPlan = type === 'cuti' ? (handover_plan ? handover_plan.trim() : null) : null;
    const finalHandoverToName = type === 'cuti' ? (handover_to_name ? handover_to_name.trim() : null) : null;
    const finalHandoverToPos = type === 'cuti' ? (handover_to_position ? handover_to_position.trim() : null) : null;

    await pool.query(
      `UPDATE submissions 
       SET type = COALESCE(?, type),
           start_date = COALESCE(?, start_date),
           end_date = COALESCE(?, end_date),
           start_time = COALESCE(?, start_time),
           end_time = COALESCE(?, end_time),
           reason = COALESCE(?, reason),
           handover_plan = ?,
           handover_to_name = ?,
           handover_to_position = ?,
           status = COALESCE(?, status),
           review_note = COALESCE(?, review_note),
           reviewed_by = IF(? IS NOT NULL AND ? != 'pending', ?, reviewed_by),
           reviewed_at = IF(? IS NOT NULL AND ? != 'pending', NOW(), reviewed_at)
       WHERE id = ?`,
      [type, start_date, end_date, start_time, end_time, reason, finalHandoverPlan, finalHandoverToName, finalHandoverToPos, status, review_note, status, status, reviewedBy, status, status, id]
    );

    res.json({ success: true, message: 'Pengajuan berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui pengajuan.' });
  }
});

/**
 * DELETE /api/admin/submissions/:id
 * Hapus data pengajuan.
 */
router.delete('/submissions/:id', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;

    const [check] = await pool.query(
      `SELECT s.id FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan.' });
    }

    await pool.query('DELETE FROM submissions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pengajuan berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghapus pengajuan.' });
  }
});

/* ============================================================
   MANAJEMEN PRESENSI LEMBUR (OVERTIME ATTENDANCE APPROVAL)
   ============================================================ */

/**
 * GET /api/admin/overtime/pending
 * Daftar presensi lembur karyawan berstatus 'pending'.
 */
router.get('/overtime/pending', ...scoped, async (req, res) => {
  try {
    const { division_id, period } = req.query;
    const conditions = ["a.overtime_clock_in_time IS NOT NULL", "(a.overtime_status IS NULL OR a.overtime_status = 'pending')"];
    const params = [];

    // Filter periode tanggal
    if (period === 'today') {
      conditions.push('a.attendance_date = CURDATE()');
    } else if (period === 'weekly') {
      conditions.push('a.attendance_date >= CURDATE() - INTERVAL 7 DAY');
    } else if (period === 'monthly') {
      conditions.push('a.attendance_date >= CURDATE() - INTERVAL 30 DAY');
    }

    // Filter divisi: jika admin_manager, batasi ke divisinya sendiri
    if (req.session.user.role === 'admin_manager' && req.session.user.division_id) {
      conditions.push('u.division_id = ?');
      params.push(req.session.user.division_id);
    } else if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.query(
      `SELECT a.id, a.user_id, a.attendance_date, a.overtime_clock_in_time, a.overtime_clock_out_time,
              a.overtime_clock_in_photo, a.overtime_clock_out_photo, a.overtime_clock_in_lat, a.overtime_clock_in_lng,
              a.overtime_clock_out_lat, a.overtime_clock_out_lng, a.overtime_task_reason, a.overtime_clock_in_note,
              a.overtime_clock_out_note, a.overtime_duration_seconds, COALESCE(a.overtime_status, 'pending') AS overtime_status,
              u.full_name, d.name AS division_name, p.name AS position_name
       FROM attendances a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       ${where}
       ORDER BY a.attendance_date DESC, a.overtime_clock_in_time DESC`,
      params
    );
    res.json({ success: true, overtimes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat presensi lembur pending.' });
  }
});

/**
 * GET /api/admin/overtime/history
 * Riwayat presensi lembur yang sudah diproses (approved/rejected).
 */
router.get('/overtime/history', ...scoped, async (req, res) => {
  try {
    const { division_id, period } = req.query;
    const conditions = ["a.overtime_status IN ('approved','rejected')"];
    const params = [];

    // Filter periode tanggal
    if (period === 'today') {
      conditions.push('a.attendance_date = CURDATE()');
    } else if (period === 'weekly') {
      conditions.push('a.attendance_date >= CURDATE() - INTERVAL 7 DAY');
    } else if (period === 'monthly') {
      conditions.push('a.attendance_date >= CURDATE() - INTERVAL 30 DAY');
    }

    // Filter divisi: jika admin_manager, batasi ke divisinya sendiri
    if (req.session.user.role === 'admin_manager' && req.session.user.division_id) {
      conditions.push('u.division_id = ?');
      params.push(req.session.user.division_id);
    } else if (division_id) {
      conditions.push('u.division_id = ?');
      params.push(division_id);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.query(
      `SELECT a.id, a.user_id, a.attendance_date, a.overtime_clock_in_time, a.overtime_clock_out_time,
              a.overtime_clock_in_photo, a.overtime_clock_out_photo, a.overtime_clock_in_lat, a.overtime_clock_in_lng,
              a.overtime_clock_out_lat, a.overtime_clock_out_lng, a.overtime_task_reason,
              a.overtime_clock_in_note, a.overtime_clock_out_note, a.overtime_duration_seconds,
              a.overtime_status, a.overtime_review_note, a.overtime_reviewed_at,
              u.full_name, d.name AS division_name, p.name AS position_name,
              reviewer.full_name AS reviewed_by_name
       FROM attendances a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN users reviewer ON reviewer.id = a.overtime_reviewed_by
       ${where}
       ORDER BY a.overtime_reviewed_at DESC LIMIT 500`,
      params
    );
    res.json({ success: true, overtimes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat riwayat presensi lembur.' });
  }
});

/**
 * PATCH /api/admin/overtime/:id/decision
 * body: { decision: 'approved' | 'rejected', review_note: string (wajib) }
 */
router.patch('/overtime/:id/decision', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, review_note } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Keputusan tidak valid.' });
    }
    if (!review_note || !review_note.trim()) {
      return res.status(400).json({ success: false, message: 'Catatan alasan wajib diisi.' });
    }

    const [rows] = await pool.query(
      `SELECT a.id FROM attendances a JOIN users u ON u.id = a.user_id WHERE a.id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Presensi lembur tidak ditemukan.' });
    }

    await pool.query(
      `UPDATE attendances 
       SET overtime_status = ?, overtime_review_note = ?, overtime_reviewed_by = ?, overtime_reviewed_at = NOW() 
       WHERE id = ?`,
      [decision, review_note.trim(), req.session.user.id, id]
    );

    res.json({ success: true, message: `Presensi lembur berhasil di-${decision === 'approved' ? 'setujui' : 'tolak'}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memproses keputusan lembur.' });
  }
});

/**
 * DELETE /api/admin/overtime/:id
 * Hapus / reset data presensi lembur.
 */
router.delete('/overtime/:id', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query('SELECT * FROM attendances WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Presensi lembur tidak ditemukan.' });
    }

    const row = rows[0];
    if (row.clock_in_time) {
      // Jika ada presensi harian biasa, bersihkan data lembur saja
      await pool.query(
        `UPDATE attendances SET 
          overtime_clock_in_time = NULL, overtime_clock_out_time = NULL,
          overtime_clock_in_photo = NULL, overtime_clock_out_photo = NULL,
          overtime_clock_in_lat = NULL, overtime_clock_in_lng = NULL,
          overtime_clock_out_lat = NULL, overtime_clock_out_lng = NULL,
          overtime_task_reason = NULL, overtime_clock_in_note = NULL,
          overtime_clock_out_note = NULL, overtime_duration_seconds = 0,
          overtime_status = NULL, overtime_review_note = NULL,
          overtime_reviewed_by = NULL, overtime_reviewed_at = NULL
         WHERE id = ?`,
        [id]
      );
    } else {
      // Jika baris murni lembur tanpa jam kerja shift, hapus baris dari attendances
      await pool.query('DELETE FROM attendances WHERE id = ?', [id]);
    }

    res.json({ success: true, message: 'Presensi lembur berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghapus presensi lembur.' });
  }
});

/**
 * DELETE /api/admin/attendance/:id
 * Hapus data absensi dari tabel attendances.
 */
router.delete('/attendance/:id', ...scoped, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id FROM attendances WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan.' });
    }

    await pool.query('DELETE FROM attendances WHERE id = ?', [id]);
    res.json({ success: true, message: 'Data absensi berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghapus data absensi.' });
  }
});

/**
 * POST /api/admin/test-email
 * Endpoint pengujian pengiriman email SMTP oleh Super Admin / Admin Manager
 */
router.post('/test-email', ...scoped, async (req, res) => {
  try {
    const targetEmail = req.body.email || req.session.user.email;
    const { sendTestEmail } = require('../utils/mailer');
    const info = await sendTestEmail(targetEmail);
    res.json({
      success: true,
      message: `Email pengujian berhasil dikirim ke ${targetEmail}`,
      messageId: info.messageId,
    });
  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengirim email pengujian: ' + err.message });
  }
});

/**
 * POST /api/admin/send-pending-reminder
 * Mengirimkan email pengingat rekap antrean pengajuan tertunda (Lembur, Izin, Cuti, Sakit)
 * secara manual melalui tombol di dashboard Admin / Super Admin
 */
router.post('/send-pending-reminder', ...scoped, async (req, res) => {
  try {
    const { division_id } = req.body;
    const {
      getPendingSubmissionsSummary,
      resolveManagerEmails,
      renderPendingQueueHtml,
      transporter,
    } = require('../utils/mailer');

    const targetDivision =
      req.session.user.role === 'admin_manager' && req.session.user.division_id
        ? req.session.user.division_id
        : division_id || null;

    const summary = await getPendingSubmissionsSummary(targetDivision);
    const recipients = await resolveManagerEmails(targetDivision);

    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ditemukan email manajer tujuan.' });
    }

    const appBaseUrl = (
      process.env.APP_BASE_URL ||
      (process.env.NODE_ENV === 'production' ? 'https://sedayaclick.cloud' : 'http://localhost:8080')
    ).replace(/\/+$/, '');

    const adminDashboardUrl = `${appBaseUrl}/admin/dashboard.html`;
    const pendingHtml = renderPendingQueueHtml(summary);

    const subject = `⏰ [PENGINGAT MANAJER] Rekap ${summary.totalCount} Pengajuan Karyawan Menunggu Persetujuan`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="width: 100%; padding: 30px 15px; box-sizing: border-box;">
    <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);">
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px 30px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800;">SedayaClick</h1>
        <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Pengingat Antrean Persetujuan Pengajuan</p>
      </div>
      <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 18px 24px; margin: 20px 24px 10px; border-radius: 10px;">
        <div style="margin: 0 0 6px; color: #0369a1; font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
          <span>👋</span> Halo Bapak/Ibu Manajer,
        </div>
        <p style="margin: 0; color: #0c4a6e; font-size: 13px; line-height: 1.6;">
          Ini adalah pengingat bahwa saat ini terdapat <strong>${summary.totalCount} pengajuan karyawan</strong> (Lembur, Izin, Cuti, atau Sakit) yang masih berstatus <strong>Pending</strong> dan menunggu persetujuan Anda.
        </p>
      </div>
      <div style="padding: 10px 24px 25px;">
        ${pendingHtml || '<p style="color: #64748b; font-size: 13px; text-align: center; padding: 20px 0;">Saat ini tidak ada antrean pengajuan yang berstatus pending. Semua pengajuan sudah diproses! 🎉</p>'}
        <div style="text-align: center; margin: 28px 0 10px;">
          <a href="${adminDashboardUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
            👉 Buka Dashboard Manajer untuk Memproses ✨
          </a>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 18px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
        Email ini dikirim otomatis oleh <strong>SedayaClick</strong>. Semoga harinya menyenangkan dan produktif! 🌟
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'SedayaClick System'}" <${
        process.env.EMAIL_FROM_ADDRESS || 'firdausmila664@gmail.com'
      }>`,
      to: recipients.join(', '),
      subject: subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    res.json({
      success: true,
      message: `Email pengingat berhasil dikirim ke: ${recipients.join(', ')}`,
      recipients,
      pendingCount: summary.totalCount,
      messageId: info.messageId,
    });
  } catch (err) {
    console.error('Send pending reminder error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengirim email pengingat: ' + err.message });
  }
});

module.exports = router;

