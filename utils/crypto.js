// utils/crypto.js
// Utilitas enkripsi dan dekripsi dua arah menggunakan AES-256-CBC
// Digunakan untuk mengamankan penyimpanan visible_password di database
// sehingga hanya Super Admin (atau pemilik akun berhak) yang dapat melihatnya.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const SECRET_SEED = process.env.SESSION_SECRET || 'sedayaclick_aes256_master_key_2026';

// Hasilkan key 32 bytes (256 bits) secara konsisten dari SECRET_SEED
const KEY = crypto.createHash('sha256').update(SECRET_SEED).digest();

/**
 * Mengenkripsi teks string menjadi format iv:encryptedHex
 * @param {string} text Teks yang akan dienkripsi
 * @returns {string|null} Teks terenkripsi atau null jika input kosong
 */
function encryptPassword(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('[Crypto Error] Gagal mengenkripsi:', err);
    return null;
  }
}

/**
 * Mendekripsi string format iv:encryptedHex menjadi teks asli
 * @param {string} cipherText Teks terenkripsi (format iv:hex)
 * @returns {string|null} Teks asli atau null jika gagal/kosong
 */
function decryptPassword(cipherText) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.includes(':')) {
    return null;
  }
  try {
    const [ivHex, encryptedHex] = cipherText.split(':');
    if (!ivHex || !encryptedHex) return null;

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // Jika data tidak cocok dengan key atau korup, return null
    return null;
  }
}

module.exports = {
  encryptPassword,
  decryptPassword
};
