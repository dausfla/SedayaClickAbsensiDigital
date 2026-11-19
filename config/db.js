// config/db.js
// Koneksi pool ke MySQL menggunakan mysql2/promise agar bisa memakai async/await
// di seluruh layer routes tanpa callback hell.

require('dotenv').config();
const mysql = require('mysql2/promise');

const fs = require('fs');

const xamppSocket = '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock';
const poolConfig = {
  host: (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST) ? '127.0.0.1' : process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sedayaclick',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true // agar DATE/DATETIME dikembalikan sebagai string, bukan objek Date UTC
};

// Hanya gunakan unix socket jika user mengonfigurasikannya secara eksplisit
if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
}

const pool = mysql.createPool(poolConfig);

// Tangani error koneksi tak terduga pada pool agar proses tidak crash fatal
pool.on('connection', (connection) => {
  connection.on('error', (err) => {
    console.error('[DB Connection Error]:', err.message);
  });
});

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

    // Auto-migrate kolom visible_password untuk tabel users
    const [userColExists] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'visible_password'`
    );
    if (userColExists.length === 0) {
      await conn.query(`ALTER TABLE users ADD COLUMN visible_password TEXT NULL AFTER password`);
      console.log(`[DB] Kolom 'visible_password' berhasil ditambahkan ke tabel users.`);
    }

    // Auto-migrate kolom shift_settings untuk shift fleksibel & roster
    const shiftCols = [
      { name: 'shift_type', type: "ENUM('fixed','flexible_hours','roster') NOT NULL DEFAULT 'fixed'" },
      { name: 'min_work_hours', type: "DECIMAL(4,2) NOT NULL DEFAULT 9.00" },
      { name: 'is_flexible_arrival', type: "TINYINT(1) NOT NULL DEFAULT 0" }
    ];
    for (const sc of shiftCols) {
      const [exists] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shift_settings' AND COLUMN_NAME = ?`,
        [sc.name]
      );
      if (exists.length === 0) {
        await conn.query(`ALTER TABLE shift_settings ADD COLUMN ${sc.name} ${sc.type}`);
        console.log(`[DB] Kolom '${sc.name}' berhasil ditambahkan ke tabel shift_settings.`);
      }
    }

    // Pastikan ENUM shift_type memuat 'roster'
    await conn.query(`ALTER TABLE shift_settings MODIFY COLUMN shift_type ENUM('fixed','flexible_hours','roster') NOT NULL DEFAULT 'fixed'`).catch(() => {});

    // Pastikan master shift 'Shift Khusus (Roster)' selalu ada di shift_settings
    const [existingKhusus] = await conn.query(
      "SELECT id FROM shift_settings WHERE name LIKE '%Khusus%' OR name LIKE '%Roster%' OR shift_type = 'roster' LIMIT 1"
    );
    if (existingKhusus.length === 0) {
      await conn.query(
        `INSERT INTO shift_settings (name, shift_type, min_work_hours, is_flexible_arrival, start_time, end_time, tolerance_minutes, is_active)
         VALUES ('Shift Khusus (Roster)', 'roster', 9.00, 1, '08:00:00', '17:00:00', 15, 1)`
      );
      console.log("[DB] 'Shift Khusus (Roster)' berhasil dibuat di shift_settings.");
    }

    // Auto-koreksi data absensi yang salah terdeteksi terlambat pada shift siang / roster (misal masuk jam 11:00 - 13:15 WIB)
    try {
      await conn.query(`
        UPDATE attendances a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN shift_settings s ON s.id = u.shift_id
        LEFT JOIN employee_schedules es ON es.user_id = a.user_id AND es.schedule_date = a.attendance_date
        SET a.status = 'on_time', a.late_duration_seconds = 0
        WHERE a.status = 'late'
          AND (
            es.shift_code IN ('S', 'R') 
            OR s.shift_type = 'roster' 
            OR s.name LIKE '%Khusus%' 
            OR s.name LIKE '%Roster%'
          )
          AND TIME(a.clock_in_time) BETWEEN '11:00:00' AND '13:15:00'
      `);
    } catch (e) {
      console.warn('[DB] Auto-correct midday shift attendance warning:', e.message);
    }

    // Auto-migrate kolom overtime_work_attachment di tabel attendances
    const [otWorkCol] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendances' AND COLUMN_NAME = 'overtime_work_attachment'`
    );
    if (otWorkCol.length === 0) {
      await conn.query(`ALTER TABLE attendances ADD COLUMN overtime_work_attachment VARCHAR(255) NULL AFTER overtime_task_reason`);
      console.log(`[DB] Kolom 'overtime_work_attachment' berhasil ditambahkan ke tabel attendances.`);
    }

    // Auto-migrate ENUM status untuk mendukung 'under_review' (Sedang Ditinjau)
    await conn.query(`ALTER TABLE submissions MODIFY COLUMN status ENUM('pending','under_review','approved','rejected') NOT NULL DEFAULT 'pending'`).catch(err => {
      console.warn('[DB] Migration submissions.status enum:', err.message);
    });
    await conn.query(`ALTER TABLE attendances MODIFY COLUMN overtime_status ENUM('pending','under_review','approved','rejected') DEFAULT 'pending'`).catch(err => {
      console.warn('[DB] Migration attendances.overtime_status enum:', err.message);
    });

    // Auto-migrate tabel employee_schedules untuk sistem roster shift & libur rolling
    await conn.query(`
      CREATE TABLE IF NOT EXISTS employee_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        schedule_date DATE NOT NULL,
        shift_code VARCHAR(20) NOT NULL,
        start_time TIME NULL,
        end_time TIME NULL,
        is_day_off TINYINT(1) NOT NULL DEFAULT 0,
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_date (user_id, schedule_date),
        KEY idx_schedule_date (schedule_date),
        KEY idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(err => {
      console.warn('[DB] Migration employee_schedules:', err.message);
    });

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
