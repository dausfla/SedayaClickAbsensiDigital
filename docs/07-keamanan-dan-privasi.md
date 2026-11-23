# 07. Audit Keamanan dan Pelindungan Data Pribadi (UU PDP) As-Built

| Metadata | Keterangan |
| :--- | :--- |
| **Sistem** | SedayaClick — Sistem Presensi & Penggajian Karyawan PWA |
| **Standar Evaluasi** | OWASP Top 10 Web Application Security & UU No. 27 Tahun 2022 (UU PDP) |
| **Versi Dokumen** | 1.0.0 (As-Built) |
| **Tanggal Analisis** | 23 November 2026 |
| **Sumber Analisis** | Seluruh kode sumber, konfigurasi middleware, dan skema database |

---

## 1. Mekanisme Keamanan yang Terimplementasi

### 1.1 Autentikasi dan Manajemen Sesi
- **Penyimpanan Sesi Server-Side**: Menggunakan `express-session` dengan persistence store di MySQL (`express-mysql-session`) [TERVERIFIKASI: server.js:76-92]. Sesi tidak hilang saat proses aplikasi di-restart oleh PM2.
- **Konfigurasi Cookie**:
  - `key: 'sedayaclick_sid'`
  - `httpOnly: true`: Mencegah pembacaan cookie oleh skrip JavaScript liar di browser (*anti-session theft via XSS*) [TERVERIFIKASI: server.js:87].
  - `sameSite: 'lax'`: Memberikan proteksi dasar terhadap pengiriman cookie pada request lintas situs (*cross-site*) [TERVERIFIKASI: server.js:88].
  - `maxAge: 12 jam`: Batas kadaluarsa sesi untuk mengurangi risiko sesi gantung pada perangkat bersama.
- **Hashing Kredensial**: Kata sandi login di-hash menggunakan algoritma `bcryptjs` dengan *salt work factor* 10 [TERVERIFIKASI: routes/auth.js:85, routes/superadmin.js:246].

### 1.2 Otorisasi & Kontrol Akses (RBAC)
- Pengamanan endpoint berbasis peran (*Role-Based Access Control*) terpusat pada middleware [TERVERIFIKASI: middleware/auth.js]:
  - `requireAuth`: Memvalidasi keberadaan sesi aktif.
  - `requireRole(...roles)`: Memastikan peran pengguna sesuai whitelist.
  - `requireActiveAccount`: Menolak akun yang belum diverifikasi (`status != 'active'`).
- **Isolasi Berkas (*Secure Uploads*)**:
  - File swafoto dan bukti surat dokter diakses melalui endpoint `/secure-uploads/*` [TERVERIFIKASI: routes/secureUploads.js].
  - Karyawan biasa hanya diizinkan mengunduh/melihat berkas miliknya sendiri. Akses terhadap berkas karyawan lain ditolak dengan `403 Forbidden`.

### 1.3 Proteksi Serangan Siber (Evaluasi OWASP Top 10)

| Vektor Ancaman | Mekanisme Pertahanan di Kode | Status Evaluasi | Rujukan Berkas |
| :--- | :--- | :---: | :--- |
| **SQL Injection** | Menggunakan *Parameterized Prepared Queries* (`?`) pada seluruh pemanggilan `mysql2/promise`. Tidak ditemukan konkatenasi string SQL mentah pada input pengguna. | **Kuat** | [TERVERIFIKASI: routes/*.js] |
| **Brute-Force Login** | Dibatasi oleh `express-rate-limit` maksimal 5 kegagalan per 15 menit per kombinasi IP + Email. Registrasi dibatasi 20 req/menit per IP. | **Kuat** | [TERVERIFIKASI: routes/auth.js:14-47] |
| **Path Traversal Upload** | Nama file upload dibersihkan menggunakan `path.basename()` dan digenerate menggunakan pola `crypto.randomBytes` / timestamp acak. | **Kuat** | [TERVERIFIKASI: utils/uploadConfig.js:18, routes/secureUploads.js:21] |
| **File Upload Malicious** | Filter ekstensi ketat (hanya gambar `.jpg, .jpeg, .png, .webp` dan dokumen `.pdf`) dengan pembatasan ukuran maksimal 10 MB. | **Kuat** | [TERVERIFIKASI: utils/uploadConfig.js:26-38] |
| **Cross-Site Scripting (XSS)** | Frontend Vanilla JS menggunakan manipulasi DOM aman (`textContent`, `innerText`) untuk merender data input pengguna. | **Sedang** | [TERVERIFIKASI: public/employee/js/employee.js] |
| **Cross-Site Request Forgery (CSRF)** | Hanya mengandalkan atribut cookie `SameSite: 'lax'` bawaan Express. Tidak ada token anti-CSRF eksplisit (`csurf` atau header anti-CSRF custom). | **Cukup / Rawan** | [TERVERIFIKASI: server.js:88] |
| **Content Security Policy (CSP)** | Header CSP **dinonaktifkan** secara eksplisit (`contentSecurityPolicy: false`) pada Helmet agar tidak memblokir Tailwind Play CDN. | **Lemah / Berisiko** | [TERVERIFIKASI: server.js:38] |

---

## 2. Register Temuan Keamanan (Security Findings / SEC-xx)

Berikut adalah daftar kerentanan keamanan yang teridentifikasi secara as-built dari analisis kode:

| ID Temuan | Tingkat Keparahan | Judul & Lokasi Temuan | Dampak Potensial | Rekomendasi Perbaikan Teknis |
| :--- | :---: | :--- | :--- | :--- |
| **SEC-01** | **Tinggi (High)** | Kredensial Email Cadangan Ter-commit di Kode Sumber<br>`[TERVERIFIKASI: utils/mailer.js:10-14]` | Variabel `defaultSmtpUser` dan `defaultSmtpPass` memuat alamat email dan string Base64 password cadangan yang dapat didekode secara bebas jika repositori bocor. | Hapus seluruh nilai fallback kredensial di kode. Wajibkan pembacaan murni dari `process.env.SMTP_USER` dan `process.env.SMTP_PASS`. Jika env kosong, nonaktifkan pengiriman email. |
| **SEC-02** | **Tinggi (High)** | Penyimpanan Kata Sandi Terdekripsi Dua Arah (`visible_password`)<br>`[TERVERIFIKASI: routes/auth.js:86, utils/crypto.js]` | Kolom `visible_password` di tabel `users` menyimpan kata sandi akun karyawan terenkripsi AES-256 yang dapat didekripsi kembali oleh Super Admin atau penyerang yang mengetahui `SESSION_SECRET`. Ini melanggar prinsip *Zero-Knowledge Authentication*. | Hapus kolom `visible_password`. Ganti kebutuhan dukungan operasional karyawan dengan alur *Reset Password / One-Time Token* mandiri. |
| **SEC-03** | **Sedang (Medium)** | Penonaktifan Content Security Policy (CSP)<br>`[TERVERIFIKASI: server.js:38]` | Penggunaan `helmet({ contentSecurityPolicy: false })` membuka celah eksekusi skrip liar jika suatu saat terdapat celah Stored XSS pada antrean pengajuan atau nama pengguna. | Pasang Tailwind CSS secara lokal via build tool (Vite/PostCSS) dan aktifkan kembali CSP Helmet dengan whitelist domain ketat. |
| **SEC-04** | **Sedang (Medium)** | Ketiadaan Token Anti-CSRF Eksplisit<br>`[TERVERIFIKASI: server.js:78-92]` | Transaksi sensitif (seperti Clock In/Out dan approval) hanya mengandalkan cookie sesi `SameSite: 'lax'`. Pada skenario navigasi top-level tertentu atau browser versi lawas, risiko CSRF masih terbuka. | Terapkan proteksi Double-Submit Cookie CSRF atau Custom HTTP Request Header (misal: `X-Requested-With` atau `X-CSRF-Token`). |
| **SEC-05** | **Rendah (Low)** | Cookie Sesi `secure: false` pada Kode Aplikasi<br>`[TERVERIFIKASI: server.js:89]` | Konfigurasi cookie diatur `secure: false`. Meskipun di production diamankan oleh proxy Nginx SSL, jika server diakses langsung tanpa proxy, cookie berisiko terkirim dalam plain HTTP. | Ubah menjadi dinamis: `secure: process.env.NODE_ENV === 'production'` dan pastikan `app.set('trust proxy', 1)` tetap aktif. |
| **SEC-06** | **Rendah (Low)** | Nilai Seed Kriptografi Cadangan Statis<br>`[TERVERIFIKASI: utils/crypto.js:9]` | Terdapat string statis `'sedayaclick_aes256_master_key_2026'` jika `SESSION_SECRET` tidak disetel di `.env`. | Buat server melempar error fatal (*crash on start*) jika `SESSION_SECRET` tidak didefinisikan saat startup di mode produksi. |

---

## 3. Analisis Kepatuhan UU Pelindungan Data Pribadi (UU No. 27 Tahun 2022)

Sebagai sistem presensi yang memproses data pribadi karyawan, SedayaClick tunduk pada ketentuan **Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**.

### 3.1 Inventaris Data Pribadi yang Dikelola Sistem

| Kategori Data PDP | Data yang Dikumpulkan | Tujuan Pemrosesan Bisnis | Lokasi Penyimpanan |
| :--- | :--- | :--- | :--- |
| **Data Pribadi Umum** (Pasal 4 ayat 3) | - Nama Lengkap<br>- Alamat Email<br>- Nomor Telepon (WhatsApp)<br>- Alamat Domisili | Identifikasi pengguna, komunikasi kedinasan, dan otentikasi login. | Tabel `users` (Database MySQL) |
| **Data Biometrik Spesifik** (Pasal 4 ayat 2 huruf b) | - Swafoto Wajah Masuk & Pulang (`clock_in_photo`, `clock_out_photo`) | Validasi kehadiran fisik asli karyawan guna mencegah titip absen. | Direktori lokal server `/uploads/attendance/` |
| **Data Lokasi Geografis Real-Time** | - Titik Koordinat GPS Satelit (Latitude & Longitude) | Verifikasi kepatuhan radius lokasi kerja saat presensi. | Tabel `attendances` (Database MySQL) |
| **Data Pribadi Spesifik / Kesehatan** (Pasal 4 ayat 2 huruf a) | - Alasan Sakit<br>- Surat Keterangan Dokter / Bukti Medis (`attachment`) | Justifikasi ketidakhadiran kerja karena kondisi kesehatan. | Tabel `submissions` & direktori `/uploads/submissions/` |

### 3.2 Analisis Kesenjangan Kepatuhan (*Gap Analysis*)

| Prinsip Pelindungan Data Pribadi | Kondisi As-Built di SedayaClick | Status Kepatuhan | Kesenjangan / Hal yang Belum Terpenuhi |
| :--- | :--- | :---: | :--- |
| **1. Persetujuan Pemrosesan Data (*Consent*)** (Pasal 20) | Calon karyawan mendaftar mandiri via `POST /api/auth/register` tanpa adanya klausul persetujuan pemrosesan data biometrik & GPS. | **Belum Terpenuhi** | Tidak ada checkbox persetujuan persyarakatan privasi (*Terms of Service & Privacy Policy*) saat pendaftaran akun. |
| **2. Pembatasan Tujuan Pemrosesan** (Pasal 27) | Data hanya diproses untuk kepentingan presensi dan peninjauan operasional SDM perusahaan. | **Terpenuhi** | Data tidak dibagikan ke pihak ketiga atau pihak komersial eksternal. |
| **3. Keamanan Data Biometrik & Medis** (Pasal 35) | Berkas foto dan surat medis disimpan dalam plain file system lokal (tanpa enkripsi disk *at-rest*), namun akses HTTP dilindungi `/secure-uploads/`. | **Sebagian** | Berkas di server `/uploads/` belum dienkripsi pada level media penyimpanan (*encryption at rest*). |
| **4. Hak Akses & Pembetulan Subjek Data** (Pasal 36-37) | Karyawan dapat melihat status absensi dan riwayat pengajuan miliknya, namun tidak dapat mengubah data profilnya sendiri secara mandiri. | **Sebagian** | Pembaruan data profil hanya bisa dilakukan melalui intervensi Super Admin via `PUT /api/superadmin/users/:id`. |
| **5. Hak Penghapusan Data (*Right to Erasure*)** (Pasal 39) | Penghapusan data akun hanya dapat dieksekusi secara manual oleh Super Admin atau via skrip pembersihan Telegram Bot. | **Sebagian** | Belum ada mekanisme mandiri bagi karyawan untuk meminta penarikan data atau penghapusan riwayat medis setelah keluar kerja (*offboarding*). |
| **6. Penunjukan DPO (*Data Protection Officer*)** (Pasal 53) | Tidak ada penunjukan resmi pejabat atau tim yang bertindak sebagai Pejabat Pelindung Data Pribadi di dalam organisasi. | **[PERLU KONFIRMASI]** | Membutuhkan penetapan kebijakan internal dari manajemen PT Rancang Bangun Sedaya. |
