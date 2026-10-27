// config/webpush.js
// Konfigurasi Web Push Notification menggunakan VAPID Keys

require('dotenv').config();
const webpush = require('web-push');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@sedayaclick.cloud';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('[WebPush] Peringatan: VAPID_PUBLIC_KEY atau VAPID_PRIVATE_KEY belum diatur di .env');
}

module.exports = {
  webpush,
  vapidPublicKey
};
