// middleware/auth.js
// Middleware autentikasi berbasis session + Role-Based Access Control (RBAC).

/**
 * Memastikan user sudah login (ada session aktif).
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'Anda belum login. Silakan login terlebih dahulu.' });
  }
  next();
}

/**
 * Membatasi akses hanya untuk role tertentu.
 * Penggunaan: requireRole('super_admin') atau requireRole('super_admin', 'admin_manager')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ success: false, message: 'Anda belum login.' });
    }
    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke fitur ini.' });
    }
    next();
  };
}

/**
 * Memastikan akun berstatus 'active'. Akun 'pending' atau 'inactive' ditolak
 * walaupun kredensial login benar (dicek lagi di sini untuk jaga-jaga jika
 * status berubah setelah session dibuat).
 */
function requireActiveAccount(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'Anda belum login.' });
  }
  if (req.session.user.status !== 'active') {
    return res.status(403).json({ success: false, message: 'Akun Anda belum aktif. Hubungi Super Admin.' });
  }
  next();
}

module.exports = { requireAuth, requireRole, requireActiveAccount };
