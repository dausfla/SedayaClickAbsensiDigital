// config/db.js
// Koneksi pool ke MySQL menggunakan mysql2/promise agar bisa memakai async/await
// di seluruh layer routes tanpa callback hell.

require('dotenv').config();
const mysql = require('mysql2/promise');

const fs = require('fs');

const xamppSocket = '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock';
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sedayaclick',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // agar DATE/DATETIME dikembalikan sebagai string, bukan objek Date UTC
};

if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
} else if (fs.existsSync(xamppSocket)) {
  poolConfig.socketPath = xamppSocket;
}

const pool = mysql.createPool(poolConfig);

// Uji koneksi saat server pertama kali start, serta pastikan kolom serah terima pekerjaan (cuti) tersedia.
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('[DB] Koneksi MySQL berhasil.');

    // Auto-migrate kolom serah terima pekerjaan untuk pengajuan Cuti
    const columns = [
      { name: 'handover_plan', type: 'TEXT NULL' },
      { name: 'handover_to_name', type: 'VARCHAR(255) NULL' },
      { name: 'handover_to_position', type: 'VARCHAR(255) NULL' }
    ];

    for (const col of columns) {
      const [exists] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'submissions' AND COLUMN_NAME = ?`,
        [col.name]
      );
      if (exists.length === 0) {
        await conn.query(`ALTER TABLE submissions ADD COLUMN ${col.name} ${col.type}`);
        console.log(`[DB] Kolom '${col.name}' berhasil ditambahkan ke tabel submissions.`);
      }
    }

    conn.release();
  } catch (err) {
    console.error('[DB] Error inisialisasi database:', err.message);
  }
})();

module.exports = pool;
