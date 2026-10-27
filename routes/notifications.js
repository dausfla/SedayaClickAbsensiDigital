// routes/notifications.js
// Rute API untuk Web Push Notification dan Broadcast Notifikasi Super Admin

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { webpush, vapidPublicKey } = require('../config/webpush');

// 1. Ambil VAPID Public Key untuk pendaftaran di client browser
router.get('/vapid-public-key', (req, res) => {
  if (!vapidPublicKey) {
    return res.status(500).json({ success: false, message: 'VAPID Public Key belum disetel di server.' });
  }
  return res.json({ success: true, publicKey: vapidPublicKey });
});

// 2. Simpan Subscription (token perangkat HP/PC user)
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const { subscription, userAgent } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ success: false, message: 'Data subscription push tidak lengkap.' });
    }

    const userId = req.session.user.id;
    const { endpoint, keys } = subscription;
    const p256dh = keys.p256dh;
    const auth = keys.auth;
    const clientUserAgent = (userAgent || req.headers['user-agent'] || '').slice(0, 250);

    // Gunakan INSERT ... ON DUPLICATE KEY UPDATE berdasarkan endpoint
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent), updated_at = CURRENT_TIMESTAMP`,
      [userId, endpoint, p256dh, auth, clientUserAgent]
    );

    return res.json({ success: true, message: 'Perangkat berhasil didaftarkan untuk notifikasi.' });
  } catch (err) {
    console.error('[WebPush Error - Subscribe]:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan subscription notifikasi.' });
  }
});

// 3. Batalkan Subscription (Unsubscribe)
router.post('/unsubscribe', requireAuth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, message: 'Endpoint diperlukan.' });
    }

    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    return res.json({ success: true, message: 'Subscription berhasil dihapus.' });
  } catch (err) {
    console.error('[WebPush Error - Unsubscribe]:', err);
    return res.status(500).json({ success: false, message: 'Gagal membatalkan subscription.' });
  }
});

// 4. Tes Kirim Notifikasi ke Perangkat User yang Sedang Login
router.post('/test', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [subs] = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);

    if (subs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Perangkat ini belum terdaftar untuk menerima notifikasi. Silakan klik tombol "Aktifkan Notifikasi" terlebih dahulu.'
      });
    }

    const payload = JSON.stringify({
      title: 'Halo dari SedayaClick! 🔔',
      body: `Tes notifikasi berhasil diterima pada ${new Date().toLocaleTimeString('id-ID')} WIB. PWA siap menerima update!`,
      icon: '/icons/icon-192.png',
      badge: '/favicon.png',
      url: '/employee/dashboard.html',
      type: 'info',
      tag: `test-${Date.now()}`
    });

    let successCount = 0;
    const deadSubs = [];

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
          successCount++;
        } catch (pushErr) {
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            // Subscription sudah tidak valid / di-uninstall oleh user
            deadSubs.push(sub.endpoint);
          }
        }
      })
    );

    // Hapus subscription yang sudah mati
    if (deadSubs.length > 0) {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint IN (?)', [deadSubs]);
    }

    return res.json({
      success: true,
      message: `Notifikasi percobaan terkirim ke ${successCount} perangkat Anda.`,
      successCount
    });
  } catch (err) {
    console.error('[WebPush Error - Test]:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengirim notifikasi tes.' });
  }
});

// 5. Kirim Broadcast Notifikasi (Hanya Super Admin)
router.post('/broadcast', requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    const { target_role, target_division_id, title, message, type, target_url } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Judul dan isi pesan notifikasi wajib diisi.' });
    }

    const senderId = req.session.user.id;
    const finalType = ['info', 'warning', 'urgent'].includes(type) ? type : 'info';
    const finalUrl = target_url && target_url.trim() ? target_url.trim() : '/employee/dashboard.html';

    // Susun Query Penerima berdasarkan Target Role & Divisi
    let query = `
      SELECT ps.endpoint, ps.p256dh, ps.auth, u.id AS user_id, u.full_name, u.role
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      WHERE u.status = 'active'
    `;
    const params = [];

    if (target_role === 'employee') {
      query += ` AND u.role = 'employee'`;
    } else if (target_role === 'admin_manager') {
      query += ` AND u.role = 'admin_manager'`;
    } else if (target_role === 'division' && target_division_id) {
      query += ` AND u.division_id = ?`;
      params.push(target_division_id);
    }

    const [subscribers] = await pool.query(query, params);

    if (subscribers.length === 0) {
      return res.json({
        success: true,
        message: 'Tidak ada perangkat aktif yang terdaftar untuk target audiens yang dipilih.',
        stats: { totalSent: 0, totalSuccess: 0, totalFailed: 0 }
      });
    }

    // Buat ikon/tag berbeda berdasarkan tipe
    let prefix = '📢 ';
    if (finalType === 'warning') prefix = '⚠️ ';
    if (finalType === 'urgent') prefix = '🚨 ';

    const payload = JSON.stringify({
      title: `${prefix}${title}`,
      body: message,
      icon: '/icons/icon-192.png',
      badge: '/favicon.png',
      url: finalUrl,
      type: finalType,
      tag: `broadcast-${Date.now()}`
    });

    let successCount = 0;
    let failCount = 0;
    const deadSubs = [];

    await Promise.all(
      subscribers.map(async (sub) => {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushConfig, payload);
          successCount++;
        } catch (pushErr) {
          failCount++;
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            deadSubs.push(sub.endpoint);
          }
        }
      })
    );

    // Bersihkan token yang kedaluwarsa
    if (deadSubs.length > 0) {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint IN (?)', [deadSubs]);
    }

    // Catat ke riwayat broadcast_notifications
    await pool.query(
      `INSERT INTO broadcast_notifications 
       (sender_id, target_role, target_division_id, title, message, type, target_url, total_sent, total_success, total_failed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        senderId,
        target_role || 'all',
        target_division_id || null,
        title,
        message,
        finalType,
        finalUrl,
        subscribers.length,
        successCount,
        failCount
      ]
    );

    return res.json({
      success: true,
      message: `Broadcast berhasil dikirim ke ${successCount} perangkat. (${failCount} gagal/tidak aktif).`,
      stats: {
        totalSent: subscribers.length,
        totalSuccess: successCount,
        totalFailed: failCount
      }
    });
  } catch (err) {
    console.error('[WebPush Error - Broadcast]:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengirim broadcast notifikasi.' });
  }
});

// 6. Ambil Riwayat Broadcast Notifikasi Terakhir (Hanya Super Admin)
router.get('/history', requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    const [history] = await pool.query(`
      SELECT bn.*, u.full_name AS sender_name, d.name AS division_name
      FROM broadcast_notifications bn
      JOIN users u ON bn.sender_id = u.id
      LEFT JOIN divisions d ON bn.target_division_id = d.id
      ORDER BY bn.created_at DESC
      LIMIT 20
    `);

    return res.json({ success: true, history });
  } catch (err) {
    console.error('[WebPush Error - History]:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat broadcast.' });
  }
});

module.exports = router;
