// config/seed.js
// Membuat akun Super Admin default jika belum ada.
// Jalankan: npm run seed

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
  const email = 'admin@gmail.com';
  const plainPassword = 'SuperAdmin123!';

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    console.log('[SEED] Super Admin sudah ada, dilewati.');
    process.exit(0);
  }

  const hashed = await bcrypt.hash(plainPassword, 10);

  await pool.query(
    `INSERT INTO users (full_name, email, password, role, status)
     VALUES (?, ?, ?, 'super_admin', 'active')`,
    ['Super Admin', email, hashed]
  );

  console.log('[SEED] Super Admin berhasil dibuat.');
  console.log(`        Email    : ${email}`);
  console.log(`        Password : ${plainPassword}`);
  console.log('        Segera ganti password setelah login pertama.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[SEED] Gagal:', err);
  process.exit(1);
});
