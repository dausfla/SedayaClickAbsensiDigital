// routes/auth.js
// Step 2: Pendaftaran mandiri (status pending) + Login/Logout dengan session.

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/auth/meta
 * Data pendukung untuk form pendaftaran (daftar divisi & jabatan aktif).
 */
router.get('/meta', async (req, res) => {
  try {
    const [divisions] = await pool.query('SELECT id, name FROM divisions ORDER BY name');
    const [positions] = await pool.query('SELECT id, name FROM positions ORDER BY name');
    res.json({ success: true, divisions, positions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memuat data master.' });
  }
});

/**
 * POST /api/auth/register
 * Pendaftaran mandiri karyawan. Akun langsung dibuat dengan status 'pending'
 * dan baru bisa login setelah diverifikasi/diaktifkan oleh Super Admin.
 */
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password, division_id, position_id, whatsapp, address } = req.body;

    if (!full_name || !email || !password || !division_id || !position_id || !whatsapp || !address) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });
    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (full_name, email, password, whatsapp, address, division_id, position_id, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'employee', 'pending')`,
      [full_name, email, hashed, whatsapp, address, division_id, position_id]
    );

    res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil. Akun Anda menunggu aktivasi dari Super Admin sebelum bisa login.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mendaftar.' });
  }
});

/**
 * POST /api/auth/login
 * Login dengan email + password. Menolak akun yang belum 'active'.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    }

    const [rows] = await pool.query(
      `SELECT u.*, d.name AS division_name, p.name AS position_name
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       WHERE u.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const user = rows[0];

    if (user.status === 'pending') {
      return res.status(403).json({ success: false, message: 'Akun Anda masih menunggu aktivasi Super Admin.' });
    }
    if (user.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan. Hubungi Super Admin.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    // Simpan data minimal & aman di session (tanpa password).
    req.session.user = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status,
      division_id: user.division_id,
      division_name: user.division_name,
      position_name: user.position_name
    };

    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal login.' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false, message: 'Gagal logout.' });
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Berhasil logout.' });
  });
});

/**
 * GET /api/auth/session & GET /api/auth/me
 * Dipakai oleh frontend untuk cek status login saat halaman dimuat,
 * dan untuk menentukan redirect ke dashboard sesuai role.
 */
const getSessionHandler = (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ success: true, loggedIn: true, user: req.session.user });
  }
  res.json({ success: true, loggedIn: false });
};

router.get('/session', getSessionHandler);
router.get('/me', getSessionHandler);


/**
 * POST /api/auth/update-profile
 * Update profil karyawan yang sedang login.
 * Hanya bisa update field yang diizinkan (nama, whatsapp, address, position, division).
 * Position dan division diberikan sebagai nama, lalu akan dikonversi ke ID.
 */
router.post('/update-profile', requireAuth, async (req, res) => {
  try {
    const { full_name, position, division, whatsapp, address } = req.body;
    const userId = req.session.user.id;

    // Validasi input dasar
    if (!full_name) {
      return res.status(400).json({ success: false, message: 'Nama lengkap wajib diisi.' });
    }

    // Konversi nama position dan division menjadi ID
    let positionId = null;
    let divisionId = null;

    if (position) {
      const [positionRows] = await pool.query('SELECT id FROM positions WHERE name = ?', [position]);
      if (positionRows.length > 0) {
        positionId = positionRows[0].id;
      } else {
        return res.status(400).json({ success: false, message: 'Position tidak valid.' });
      }
    }

    if (division) {
      const [divisionRows] = await pool.query('SELECT id FROM divisions WHERE name = ?', [division]);
      if (divisionRows.length > 0) {
        divisionId = divisionRows[0].id;
      } else {
        return res.status(400).json({ success: false, message: 'Division tidak valid.' });
      }
    }

    // Update data pengguna
    await pool.query(
      `UPDATE users SET full_name = ?, whatsapp = ?, address = ?, position_id = ?, division_id = ?
       WHERE id = ?`,
      [full_name || null, whatsapp || null, address || null, positionId, divisionId, userId]
    );

    // Update session data agar segera terlihat perubahan
    const [updatedRows] = await pool.query(
      `SELECT u.*, d.name AS division_name, p.name AS position_name
       FROM users u
       LEFT JOIN divisions d ON d.id = u.division_id
       LEFT JOIN positions p ON p.id = u.position_id
       WHERE u.id = ?`,
      [userId]
    );

    if (updatedRows.length > 0) {
      const updatedUser = updatedRows[0];
      req.session.user = {
        id: updatedUser.id,
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        division_id: updatedUser.division_id,
        division_name: updatedUser.division_name,
        position_id: updatedUser.position_id,
        position_name: updatedUser.position_name
      };
    }

    res.json({ success: true, message: 'Profil berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui profil.' });
  }
});

module.exports = router;
