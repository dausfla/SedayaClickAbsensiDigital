// server.js
// Entry point aplikasi SedayaClick.

process.on('unhandledRejection', (reason, promise) => {
  console.error('[PROCESS] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[PROCESS] Uncaught Exception:', err);
});

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const pool = require('./config/db');
const multer = require('multer');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const submissionRoutes = require('./routes/submissions');
const adminRoutes = require('./routes/admin');
const superadminRoutes = require('./routes/superadmin');
const reportRoutes = require('./routes/reports');
const secureUploadsRoutes = require('./routes/secureUploads');
const notificationRoutes = require('./routes/notifications');
const { startAttendanceReminder } = require('./utils/attendanceReminder');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Header keamanan dengan helmet (CSP dinonaktifkan agar tidak konflik dengan Tailwind CDN, CORP set to cross-origin untuk file media)
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Pastikan folder upload ada sebelum server menerima request.
['uploads/attendance', 'uploads/submissions'].forEach((dir) => {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// Konfigurasi CORS: membaca ALLOWED_ORIGIN dari environment variable
const rawOrigins = process.env.ALLOWED_ORIGIN || 'http://localhost:8080,http://127.0.0.1:8080,http://localhost:3000,http://127.0.0.1:3000,https://sedayaclick.cloud,http://sedayaclick.cloud';
const allowedOrigins = rawOrigins
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (seperti request same-origin browser, internal server, atau tools)
      if (!origin) {
        return callback(null, true);
      }
      const cleanOrigin = origin.trim().replace(/\/$/, '');
      if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*') || cleanOrigin.endsWith('sedayaclick.cloud')) {
        return callback(null, true);
      }
      console.warn(`[CORS Blocked] Request dari origin '${cleanOrigin}' tidak ada di ALLOWED_ORIGIN.`);
      return callback(null, false);
    },
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session disimpan di MySQL supaya tetap valid walau server di-restart
// (penting untuk PWA yang mungkin dibuka lagi setelah lama tidak aktif).
const sessionStore = new MySQLStore({}, pool.pool || pool);

app.use(
  session({
    key: 'sedayaclick_sid',
    secret: process.env.SESSION_SECRET || 'sedayaclick_secret_dev_only',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 12, // 12 jam
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    }
  })
);

// Rute terproteksi berkas upload (menggantikan express.static publik)
app.use('/secure-uploads', secureUploadsRoutes);

// Frontend statis (PWA).
app.use(express.static(path.join(__dirname, 'public')));

// ------------------- API ROUTES -------------------
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => res.json({ success: true, message: 'SedayaClick API aktif.' }));

// Fallback: rute non-API mengarah ke index.html (SPA-style navigation untuk PWA).
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/secure-uploads/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler terpusat (mis. error dari Multer seperti ukuran file terlalu besar).
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Ukuran file terlalu besar! Maksimal 10 MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Terjadi kesalahan saat upload file: ${err.message}`
    });
  }

  if (err.message && err.message.includes('Format file harus')) {
    return res.status(400).json({ success: false, message: err.message });
  }

  console.error(err);
  const message = process.env.NODE_ENV === 'production'
    ? 'Terjadi kesalahan pada server.'
    : (err.message || 'Terjadi kesalahan pada server.');
  res.status(err.status || 500).json({ success: false, message });
});

async function runMigrations() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM submissions LIKE 'start_time'");
    if (cols.length === 0) {
      await pool.query("ALTER TABLE submissions ADD COLUMN start_time TIME NULL AFTER end_date");
    }
    const [endCols] = await pool.query("SHOW COLUMNS FROM submissions LIKE 'end_time'");
    if (endCols.length === 0) {
      await pool.query("ALTER TABLE submissions ADD COLUMN end_time TIME NULL AFTER start_time");
    }
    await pool.query("ALTER TABLE submissions MODIFY COLUMN type ENUM('izin','cuti','sakit','lembur') NOT NULL").catch(() => {
      return pool.query("ALTER TABLE submissions MODIFY COLUMN type VARCHAR(50) NOT NULL");
    });

    // Migration for users role enum to support admin_manager
    await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('employee','admin_manager','super_admin') NOT NULL DEFAULT 'employee'").catch((err) => {
      console.warn('[MIGRATION] users role enum check:', err.message);
    });

    // Migration for shift_settings columns (shift_type, min_work_hours, is_flexible_arrival)
    const shiftColumns = [
      { name: 'shift_type', def: "ENUM('fixed','flexible_hours','roster') NOT NULL DEFAULT 'fixed'" },
      { name: 'min_work_hours', def: "DECIMAL(4,2) NOT NULL DEFAULT 9.00" },
      { name: 'is_flexible_arrival', def: "TINYINT(1) NOT NULL DEFAULT 0" }
    ];
    for (const sc of shiftColumns) {
      const [c] = await pool.query(`SHOW COLUMNS FROM shift_settings LIKE '${sc.name}'`);
      if (c.length === 0) {
        await pool.query(`ALTER TABLE shift_settings ADD COLUMN ${sc.name} ${sc.def}`);
        console.log(`[MIGRATION] Kolom '${sc.name}' berhasil ditambahkan ke tabel shift_settings.`);
      }
    }
    await pool.query("ALTER TABLE shift_settings MODIFY COLUMN shift_type ENUM('fixed','flexible_hours','roster') NOT NULL DEFAULT 'fixed'").catch(() => {});

    // Pastikan master shift 'Shift Khusus (Roster)' selalu ada di shift_settings
    const [existingKhusus] = await pool.query(
      "SELECT id FROM shift_settings WHERE name LIKE '%Khusus%' OR name LIKE '%Roster%' OR shift_type = 'roster' LIMIT 1"
    );
    if (existingKhusus.length === 0) {
      await pool.query(
        `INSERT INTO shift_settings (name, shift_type, min_work_hours, is_flexible_arrival, start_time, end_time, tolerance_minutes, is_active)
         VALUES ('Shift Khusus (Roster)', 'roster', 9.00, 1, '08:00:00', '17:00:00', 15, 1)`
      );
      console.log("[MIGRATION] Seed 'Shift Khusus (Roster)' berhasil ditambahkan ke shift_settings.");
    }

    // Auto-koreksi data absensi yang salah terdeteksi terlambat pada shift siang / roster (misal masuk jam 11:00 - 13:15 WIB)
    try {
      await pool.query(`
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
      console.warn('[MIGRATION] Auto-correct midday shift attendance warning:', e.message);
    }

    // Migration for attendances table overtime columns
    const [otInCols] = await pool.query("SHOW COLUMNS FROM attendances LIKE 'overtime_clock_in_time'");
    if (otInCols.length === 0) {
      await pool.query(`
        ALTER TABLE attendances
        ADD COLUMN overtime_clock_in_time DATETIME NULL,
        ADD COLUMN overtime_clock_out_time DATETIME NULL,
        ADD COLUMN overtime_clock_in_photo VARCHAR(255) NULL,
        ADD COLUMN overtime_clock_out_photo VARCHAR(255) NULL,
        ADD COLUMN overtime_clock_in_lat DECIMAL(10,7) NULL,
        ADD COLUMN overtime_clock_in_lng DECIMAL(10,7) NULL,
        ADD COLUMN overtime_clock_out_lat DECIMAL(10,7) NULL,
        ADD COLUMN overtime_clock_out_lng DECIMAL(10,7) NULL,
        ADD COLUMN overtime_task_reason TEXT NULL,
        ADD COLUMN overtime_clock_in_note TEXT NULL,
        ADD COLUMN overtime_clock_out_note TEXT NULL,
        ADD COLUMN overtime_duration_seconds INT DEFAULT 0
      `);
    }

    const [otStatusCols] = await pool.query("SHOW COLUMNS FROM attendances LIKE 'overtime_status'");
    if (otStatusCols.length === 0) {
      await pool.query(`
        ALTER TABLE attendances
        ADD COLUMN overtime_status ENUM('pending','under_review','approved','rejected') DEFAULT 'pending',
        ADD COLUMN overtime_review_note TEXT NULL,
        ADD COLUMN overtime_reviewed_by INT NULL,
        ADD COLUMN overtime_reviewed_at DATETIME NULL
      `);
    }

    const [otWorkCol] = await pool.query("SHOW COLUMNS FROM attendances LIKE 'overtime_work_attachment'");
    if (otWorkCol.length === 0) {
      await pool.query("ALTER TABLE attendances ADD COLUMN overtime_work_attachment VARCHAR(255) NULL AFTER overtime_task_reason");
    }

    await pool.query("ALTER TABLE submissions MODIFY COLUMN status ENUM('pending','under_review','approved','rejected') NOT NULL DEFAULT 'pending'").catch(() => {});
    await pool.query("ALTER TABLE attendances MODIFY COLUMN overtime_status ENUM('pending','under_review','approved','rejected') DEFAULT 'pending'").catch(() => {});

    await pool.query(`
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
    `).catch(() => {});

    console.log('[MIGRATION] Database schema updated for Overtime module, Under Review status, & Shift Roster.');
  } catch (err) {
    console.warn('[MIGRATION] Migration check:', err.message);
  }
}

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`SedayaClick berjalan di http://localhost:${PORT}`);
    startAttendanceReminder();
  });
});
