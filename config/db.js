// config/db.js
// Koneksi pool ke MySQL menggunakan mysql2/promise agar bisa memakai async/await
// di seluruh layer routes tanpa callback hell.

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sedayaclick',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // agar DATE/DATETIME dikembalikan sebagai string, bukan objek Date UTC
});

// Uji koneksi saat server pertama kali start, supaya error konfigurasi
// langsung terlihat di log alih-alih baru gagal ketika ada request pertama.
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('[DB] Koneksi MySQL berhasil.');
    conn.release();
  } catch (err) {
    console.error('[DB] Gagal konek ke MySQL:', err.message);
  }
})();

module.exports = pool;
