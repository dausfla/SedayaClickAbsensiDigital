// server.js
// Entry point aplikasi SedayaClick.

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const pool = require('./config/db');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const submissionRoutes = require('./routes/submissions');
const adminRoutes = require('./routes/admin');
const superadminRoutes = require('./routes/superadmin');
const reportRoutes = require('./routes/reports');
const secureUploadsRoutes = require('./routes/secureUploads');

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

// Konfigurasi CORS: membaca ALLOWED_ORIGIN dari environment variable (default: http://localhost:3000)
const rawOrigins = process.env.ALLOWED_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000';
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
      if (allowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }
      // Tolak origin yang tidak terdaftar dengan callback(null, false) (mencegah error log di console server)
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
      secure: process.env.NODE_ENV === 'production'
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

app.get('/api/health', (req, res) => res.json({ success: true, message: 'SedayaClick API aktif.' }));

// Fallback: rute non-API mengarah ke index.html (SPA-style navigation untuk PWA).
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/secure-uploads/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler terpusat (mis. error dari Multer seperti ukuran file terlalu besar).
app.use((err, req, res, next) => {
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
        ADD COLUMN overtime_status ENUM('pending','approved','rejected') DEFAULT 'pending',
        ADD COLUMN overtime_review_note TEXT NULL,
        ADD COLUMN overtime_reviewed_by INT NULL,
        ADD COLUMN overtime_reviewed_at DATETIME NULL
      `);
    }

    console.log('[MIGRATION] Database schema updated for Overtime module.');
  } catch (err) {
    console.warn('[MIGRATION] Migration check:', err.message);
  }
}

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`SedayaClick berjalan di http://localhost:${PORT}`);
  });
});
