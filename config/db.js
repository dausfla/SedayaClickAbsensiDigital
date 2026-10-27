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

    // Auto-migrate tabel push_subscriptions untuk Web Push PWA
    await conn.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh VARCHAR(255) NOT NULL,
        auth VARCHAR(255) NOT NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_push_user_id (user_id),
        UNIQUE KEY idx_push_endpoint (endpoint(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Auto-migrate tabel broadcast_notifications untuk riwayat pengiriman notifikasi
    await conn.query(`
      CREATE TABLE IF NOT EXISTS broadcast_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        target_role VARCHAR(50) NOT NULL DEFAULT 'all',
        target_division_id INT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('info', 'warning', 'urgent') NOT NULL DEFAULT 'info',
        target_url VARCHAR(255) DEFAULT '/employee/dashboard.html',
        total_sent INT NOT NULL DEFAULT 0,
        total_success INT NOT NULL DEFAULT 0,
        total_failed INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_broadcast_sender (sender_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    conn.release();
  } catch (err) {
    console.error('[DB] Error inisialisasi database:', err.message);
  }
})();

module.exports = pool;
