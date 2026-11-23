# FASE 0: Discovery dan Inventaris Sistem As-Built

| Metadata | Keterangan |
| :--- | :--- |
| **Nama Proyek** | SedayaClick — Sistem Absensi & Penggajian Digital (PWA) |
| **Versi Dokumen** | 1.0.0 (As-Built) |
| **Tanggal Analisis** | 23 November 2026 |
| **Sumber Analisis** | Commit `f374140` (Branch `main`) |
| **Status Dokumen** | Selesai / Terverifikasi |

---

## 1. Ringkasan Eksekutif & Struktur Repositori

Sistem **SedayaClick** merupakan aplikasi presensi berbasis web progresif (*Progressive Web Application / PWA*) dengan arsitektur monolit modular (Node.js + Express.js backend melayani client statis PWA dan REST API).

### 1.1 Struktur Direktori Utama
[TERVERIFIKASI: direktori root repositori]
```
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD pipeline deployment via SSH ke VPS
├── config/
│   ├── db.js                   # Koneksi pool MySQL (mysql2/promise) & runtime auto-migration
│   ├── schema.sql              # DDL skema database awal
│   ├── seed.js                 # Skrip seeder data awal
│   └── webpush.js              # Konfigurasi VAPID Web Push (web-push)
├── deploy/
│   ├── nginx-sedayaclick.conf  # Konfigurasi Nginx reverse proxy + Gzip
│   └── setup-vps.sh            # Skrip otomatisasi setup VPS Ubuntu
├── docs/                       # Dokumentasi sistem, pengujian, panduan pengguna
├── middleware/
│   └── auth.js                 # Middleware autentikasi sesi & RBAC (requireRole)
├── public/                     # Frontend statis PWA (HTML, Vanilla JS, PWA Assets)
│   ├── admin/                  # Dashboard Admin Manager (HTML & JS)
│   ├── assets/                 # Asset statis, avatar default
│   ├── employee/               # Dashboard Karyawan (HTML & JS)
│   ├── icons/                  # PWA Icons & Maskable Icons
│   ├── js/                     # Modul JS pembantu (camera, geo, push, api, splash)
│   ├── superadmin/             # Dashboard Super Admin (HTML & JS)
│   ├── index.html              # Halaman Login & Pendaftaran Mandiri
│   ├── manifest.json           # W3C Web App Manifest untuk PWA
│   └── sw.js                   # Service Worker (Cache App Shell & Web Push handler)
├── routes/
│   ├── admin.js                # API Modul Admin Manager (Pengajuan & Roster)
│   ├── attendance.js           # API Modul Absensi & Lembur Karyawan
│   ├── auth.js                 # API Autentikasi (Register, Login, Session, Meta)
│   ├── notifications.js        # API Push Notification & Broadcast
│   ├── reports.js              # API Pelaporan & Ekspor CSV/XLSX
│   ├── secureUploads.js        # Rute proteksi akses berkas upload
│   ├── submissions.js          # API Pengajuan Izin/Cuti/Sakit Karyawan
│   └── superadmin.js           # API Super Admin (User, Divisi, Jabatan, Shift, Dashboard)
├── services/
│   └── telegramBot.js          # Bot Telegram Maintenance & Monitoring (Long Polling)
├── utils/
│   ├── attendanceReminder.js   # Background scheduler pengingat absensi H-15 menit
│   ├── crypto.js               # Enkripsi AES-256-CBC untuk kata sandi tersimpan
│   ├── exportGenerator.js      # Generator laporan CSV (json2csv) & XLSX (exceljs)
│   ├── mailer.js               # Pengirim email antrean pengajuan via Gmail SMTP
│   ├── rosterHelper.js         # Engine parsing matriks shift & roster bulanan
│   ├── timeCalc.js             # Kalkulasi matematis waktu kerja, terlambat & lembur
│   └── uploadConfig.js         # Konfigurasi penyimpanan Multer (foto & lampiran)
├── ecosystem.config.js         # Konfigurasi PM2 Cluster Mode
├── package.json                # Metadata proyek & daftar dependensi Node.js
├── sedayaclick.sql             # SQL dump struktur database MySQL
└── server.js                   # Titik masuk utama (Express server entry point)
```

---

## 2. Bahasa, Framework, dan Runtime

| Komponen | Spesifikasi / Nilai | Rujukan Berkas | Keterangan |
| :--- | :--- | :--- | :--- |
| **Runtime Server** | Node.js (Target v20 LTS) | [TERVERIFIKASI: deploy/setup-vps.sh:53-55] | Diinstal via NodeSource `setup_20.x` |
| **Bahasa Backend** | JavaScript (Node.js ES6+ / CommonJS) | [TERVERIFIKASI: server.js:1-33] | `require()` modular |
| **Framework Web** | Express.js v4.19.2 | [TERVERIFIKASI: package.json:19] | Minimalist HTTP Web Framework |
| **Process Manager** | PM2 (Cluster Mode: `max`) | [TERVERIFIKASI: ecosystem.config.js:6-7] | Zero-downtime reload |
| **Basis Data** | MySQL / MariaDB (utf8mb4) | [TERVERIFIKASI: config/db.js:11-23] | Driver `mysql2/promise` pool |
| **Bahasa Frontend** | HTML5, Vanilla JavaScript ES6 | [TERVERIFIKASI: public/index.html] | Tanpa framework React/Vue/Angular |
| **Styling CSS** | Tailwind CSS (CDN Play CDN) | [TERVERIFIKASI: public/index.html:10] | Loaded via `https://cdn.tailwindcss.com` |
| **PWA Layer** | Service Worker + Web App Manifest | [TERVERIFIKASI: public/sw.js:1-127] | Standalone mobile-capable |

---

## 3. Daftar Dependensi & Versi

### 3.1 Production Dependencies
Berdasarkan berkas [TERVERIFIKASI: package.json:14-29]:

| Paket | Versi Terpasang | Tujuan / Fungsi Utama |
| :--- | :--- | :--- |
| `bcryptjs` | `^2.4.3` | Hashing satu arah untuk kata sandi pengguna (`users.password`) |
| `cors` | `^2.8.5` | Konfigurasi Cross-Origin Resource Sharing berbasis whitelist origin |
| `dotenv` | `^16.4.5` | Memuat konfigurasi variabel lingkungan dari berkas `.env` ke `process.env` |
| `exceljs` | `^4.4.0` | Pembuatan file Excel (.xlsx) dinamis untuk laporan absensi dan roster |
| `express` | `^4.19.2` | Core backend framework dan HTTP router |
| `express-mysql-session` | `^3.0.3` | Penyimpanan sesi Express ke tabel MySQL (`sessions`) |
| `express-rate-limit` | `^8.7.0` | Pembatasan frekuensi request HTTP (anti brute-force login & registrasi) |
| `express-session` | `^1.18.0` | Manajemen sesi cookie HTTP-only (`sedayaclick_sid`) |
| `helmet` | `^8.3.0` | Pengamanan HTTP Response Headers (HSTS, No-Sniff, XSS Protection) |
| `json2csv` | `^6.0.0-alpha.2` | Pembuatan berkas CSV untuk ekspor data laporan |
| `multer` | `^1.4.5-lts.1` | Penanganan upload multipart/form-data (swafoto & bukti lampiran) |
| `mysql2` | `^3.10.0` | Driver MySQL berkemampuan Promise dan connection pool |
| `nodemailer` | `^10.5.0` | Pengiriman notifikasi email via SMTP (Gmail) |
| `web-push` | `^3.6.7` | Protokol Web Push Notification standar VAPID ke perangkat user |

### 3.2 Development Dependencies
| Paket | Versi Terpasang | Tujuan |
| :--- | :--- | :--- |
| `nodemon` | `^3.1.0` | Live-reload otomatis pada lingkungan pengembangan lokal |

---

## 4. Titik Masuk, Routing, Middleware, dan Background Tasks

### 4.1 Titik Masuk (*Entry Point*)
- Berkas utama: `server.js` [TERVERIFIKASI: package.json:5, server.js:1]
- Alur inisialisasi:
  1. Penanganan global unhandled rejection & uncaught exception [server.js:4-9]
  2. Inisialisasi Express & middleware global (Helmet, CORS, JSON, URL-Encoded, Session MySQL) [server.js:33-93]
  3. Registrasi rute proteksi upload `/secure-uploads` [server.js:95]
  4. Penyajian aset statis PWA `/public` [server.js:98]
  5. Pendaftaran sub-router API `/api/*` [server.js:101-108]
  6. Penanganan error terpusat (Multer file limits & invalid mime-types) [server.js:118-141]
  7. Eksekusi skema auto-migration (`runMigrations()`) [server.js:143-271]
  8. Menjalankan server HTTP pada PORT dan mengaktifkan scheduler pengingat absensi [server.js:273-278]

### 4.2 Pemetaan Rute API (*Router Mapping*)
| Prefiks Path | Modul Handler | Deskripsi Fungsi |
| :--- | :--- | :--- |
| `/api/auth` | `routes/auth.js` | Autentikasi sesi, login, pendaftaran mandiri, pengecekan sesi aktif, logout |
| `/api/attendance` | `routes/attendance.js` | Clock In, Clock Out, presensi lembur, status hari ini, kalender roster bulanan |
| `/api/submissions` | `routes/submissions.js` | Pengajuan izin/cuti/sakit/lembur mandiri oleh karyawan |
| `/api/admin` | `routes/admin.js` | Manajemen pengajuan & upload/download matriks roster oleh Admin Manager |
| `/api/superadmin` | `routes/superadmin.js` | Master data (user, divisi, jabatan, shift), KPI dashboard, persetujuan user |
| `/api/reports` | `routes/reports.js` | Rekap kehadiran, analitik filter multi-dimensi, ekspor XLSX/CSV |
| `/api/notifications`| `routes/notifications.js`| VAPID public key, push subscription, uji coba notifikasi, broadcast admin |
| `/secure-uploads` | `routes/secureUploads.js`| Akses otorisasi berkas foto absensi & bukti pengajuan (non-public) |

### 4.3 Middleware Keamanan & RBAC
Didefinisikan pada [TERVERIFIKASI: middleware/auth.js]:
1. `requireAuth`: Memastikan request memiliki objek sesi aktif (`req.session.user`). Menolak request tanpa sesi dengan HTTP 401.
2. `requireRole(...allowedRoles)`: Melakukan validasi peran (*Role-Based Access Control*). Mendukung multi-role (contoh: `'admin_manager', 'super_admin'`). Menolak role tidak sesuai dengan HTTP 403.
3. `requireActiveAccount`: Memeriksa kolom `users.status === 'active'`. Akun dengan status `pending` atau `inactive` otomatis diblokir dengan HTTP 403.

### 4.4 Background Job, Scheduler & Worker
1. **Attendance Reminder Scheduler**:
   - Berkas: [TERVERIFIKASI: utils/attendanceReminder.js]
   - Dipicu oleh: [TERVERIFIKASI: server.js:276] via interval timer 60 detik (`setInterval(checkAndSendReminders, 60000)`).
   - Fungsi: Menghitung selisih waktu shift (H-15 menit sebelum Clock In dan H-15 menit sebelum Clock Out) untuk seluruh karyawan aktif dan mengirimkan Web Push Notification ke perangkat karyawan yang terdaftar.
2. **Telegram Ops & Maintenance Bot**:
   - Berkas: [TERVERIFIKASI: services/telegramBot.js]
   - Dijalankan via perintah independen: `npm run bot` [TERVERIFIKASI: package.json:10].
   - Mekanisme: Long-polling Telegram Bot API (`getUpdates`).
   - Fungsi: Monitoring beban CPU/RAM, eksekusi backup SQL, backup foto, restart PM2, dan purge database berbasis konfirmasi 2 langkah (*two-step confirmation*).

---

## 5. Variabel Lingkungan (*Environment Variables*)

Berdasarkan [TERVERIFIKASI: .env.example:1-42] (hanya nama variabel, tanpa nilai rahasia):

| Nama Variabel | Tipe Data / Format | Deskripsi & Kegunaan |
| :--- | :--- | :--- |
| `PORT` | Integer | Port listening web server Express (default: `3000`) |
| `NODE_ENV` | String (`development` / `production`) | Menentukan perilaku error trace dan mode PM2 |
| `SESSION_SECRET` | String (Hex / Text) | Kunci enkripsi cookie sesi Express dan seed enkripsi AES-256 |
| `ALLOWED_ORIGIN` | Comma-separated URL | Whitelist origin yang diizinkan untuk request CORS |
| `DB_HOST` | String (IP / Hostname) | Host server database MySQL |
| `DB_PORT` | Integer | Port database MySQL (default: `3306`) |
| `DB_USER` | String | Username otentikasi MySQL |
| `DB_PASSWORD` | String | Password user MySQL |
| `DB_NAME` | String | Nama database MySQL (default: `sedayaclick`) |
| `DB_SOCKET` | String (Path) | Path Unix socket MySQL (opsional untuk XAMPP/local socket) |
| `OFFICE_LATITUDE` | Decimal | Titik lintang geofencing kantor default |
| `OFFICE_LONGITUDE` | Decimal | Titik bujur geofencing kantor default |
| `OFFICE_RADIUS_METERS`| Integer | Radius toleransi geofencing kantor (dalam meter) |
| `VAPID_PUBLIC_KEY` | Base64 URL Safe | Public key VAPID untuk pendaftaran client browser Web Push |
| `VAPID_PRIVATE_KEY` | Base64 URL Safe | Private key VAPID untuk tanda tangan digital push payload |
| `VAPID_SUBJECT` | String (`mailto:...`) | Identitas kontak pengirim push notification |
| `SMTP_HOST` | String | Host server SMTP email (misal: `smtp.gmail.com`) |
| `SMTP_PORT` | Integer | Port SMTP email (default: `465` atau `587`) |
| `SMTP_SECURE` | Boolean (`true`/`false`) | Mengaktifkan SSL/TLS pada koneksi SMTP |
| `SMTP_USER` | String (Email) | Akun autentikasi pengirim email |
| `SMTP_PASS` | String (App Password) | Password aplikasi (App Password) pengirim email |
| `EMAIL_FROM_NAME` | String | Nama pengirim email yang tampil pada inbox |
| `EMAIL_FROM_ADDRESS` | String (Email) | Alamat email pengirim |
| `APP_BASE_URL` | String (URL) | URL dasar sistem untuk tautan aksi pada notifikasi email |
| `FALLBACK_MANAGER_EMAIL`| Comma-separated Email | Daftar email manajer penerima rekap antrean pengajuan |
| `TELEGRAM_BOT_TOKEN` | String | Token autentikasi Bot API Telegram dari @BotFather |
| `TELEGRAM_ADMIN_CHAT_ID`| String / Numeric ID | ID akun Telegram administrator pemilik hak akses kendali bot |

---

## 6. Integrasi Pihak Ketiga & Eksternal

1. **Peta & Geolocation (GPS)**:
   - Menggunakan W3C Standard Geolocation API (`navigator.geolocation.getCurrentPosition`) di sisi client [TERVERIFIKASI: public/js/geolocation.js].
   - Mengambil koordinat Lintang (`latitude`), Bujur (`longitude`), dan akurasi GPS (`accuracy`).
2. **Kamera WebRTC**:
   - Menggunakan `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })` [TERVERIFIKASI: public/js/camera.js].
   - Menghasilkan tangkapan swafoto langsung dari stream kamera tanpa upload file galeri.
3. **Web Push Notification (PWA)**:
   - Integrasi VAPID standar menggunakan pustaka `web-push` [TERVERIFIKASI: config/webpush.js].
   - Mendukung Google Firebase Cloud Messaging (FCM) dan Mozilla Autopush endpoints.
4. **Email Gateway (SMTP)**:
   - Integrasi Google Gmail SMTP melalui pustaka `nodemailer` [TERVERIFIKASI: utils/mailer.js].
5. **Telegram Bot API**:
   - Integrasi langsung ke `https://api.telegram.org` menggunakan HTTP native `fetch` [TERVERIFIKASI: services/telegramBot.js].
6. **CDN Styling**:
   - Tailwind CSS via CDN: `https://cdn.tailwindcss.com` [TERVERIFIKASI: public/index.html:10].

---

## 7. Berkas Infrastruktur & Otomasi Deployment

1. **Container / Dockerfile**:
   - `[TIDAK DITEMUKAN]` Tidak ada berkas `Dockerfile` atau `docker-compose.yml` di dalam repositori. Deployment dilakukan langsung pada Bare-Metal / Virtual Private Server (VPS).
2. **CI/CD Pipeline**:
   - Ditemukan pada [TERVERIFIKASI: .github/workflows/deploy.yml].
   - Menggunakan GitHub Actions dengan trigger `push` pada branch `main`.
   - Menggunakan action `appleboy/ssh-action@v1.0.3` untuk terhubung ke VPS target via SSH, mengeksekusi `git fetch & reset`, `npm install --production`, dan reload PM2 zero-downtime.
3. **Web Server / Reverse Proxy**:
   - Berkas konfigurasi: [TERVERIFIKASI: deploy/nginx-sedayaclick.conf].
   - Nginx bertindak sebagai reverse proxy ke port `3000`, menangani kompresi Gzip, header forwarding (`X-Forwarded-For`, `X-Forwarded-Proto`), dan batas upload `client_max_body_size 25M`.
4. **Provisioning Script**:
   - Berkas otomatisasi: [TERVERIFIKASI: deploy/setup-vps.sh].
   - Menyiapkan swap memory 2GB, dependensi OS Ubuntu, Node.js 20, PM2, MySQL Server, clone repo, import database, dan konfigurasi Let's Encrypt Certbot.

---

## 8. Berkas Pengujian (*Testing Files*)

- Pengujian Otomatis (Unit / Integration / E2E): `[TIDAK DITEMUKAN]`
  Tidak ditemukan framework testing seperti Jest, Mocha, Chai, Supertest, Vitest, maupun Cypress pada `package.json`.
- Pengujian Manual (Black-box):
  Ditemukan dokumen katalog pengujian manual pada [TERVERIFIKASI: docs/BLACK-BOX-TESTING.md].
- Berkas Uji Non-Produksi:
  Ditemukan berkas uji coba temporer [TERVERIFIKASI: scratch/test_sync.js] untuk verifikasi sinkronisasi waktu dan query SQL.

---

## 9. Riwayat Git & Kronologi Pengembangan

Berdasarkan analisis git log (`git rev-list --count HEAD`, `git log --reverse`):
- **Jumlah Total Commit**: 38 commit [TERVERIFIKASI: git rev-list]
- **Tanggal Commit Pertama**: 17 September 2026 (Commit `c28c8df`)
- **Tanggal Commit Terakhir Analisis**: 22 November 2026 (Commit `f374140`)
- **Kontributor**:
  - `Muhamad Firdaus` (30 commits)
  - `rendydev404` (8 commits)
- **Tag / Rilis Formal**: `[TIDAK DITEMUKAN]` (Tidak ada git tag versi semver yang dibuat di repositori).

### Kronologi Rilis Fitur Besar
1. **17 September 2026**: Inisialisasi awal arsitektur presensi, modul pendaftaran, login sesi, clock in/out dengan kamera dan geolokasi.
2. **18 September 2026**: Implementasi dashboard Admin Manager, perizinan lintas divisi, dan dokumentasi sistem awal.
3. **20 September 2026**: Hardening keamanan, pull-to-refresh PWA, toggle dark mode, modal layout fix.
4. **02 November 2026**: Pengamanan profil, integrasi grafik line dashboard, modal viewer attachment, dan pencegahan pinch-zoom seluler.
5. **12 November 2026**: Sistem pengingat email otomatis & manual via SMTP Gmail untuk manajer terkait antrean pengajuan pending.
6. **18 - 19 November 2026**:
   - Fitur modul presensi lembur mandiri (*direct overtime attendance*) dengan bukti kerja (*work attachment*).
   - Pengenalan status pengajuan `under_review` (Sedang Ditinjau).
   - Sistem jadwal roster dinamis & libur rolling bulanan (`employee_schedules`, shift codes: P, S, VK, VW, VH, R, PL, SAT, L).
   - Layanan SedayaClick Ops & Maintenance Telegram Bot (`services/telegramBot.js`).
7. **22 November 2026**:
   - Aksesibilitas roster pada perangkat mobile smartphone untuk Super Admin dan Karyawan.
   - Penyesuaian tampilan dashboard karyawan agar widget roster hanya muncul bagi karyawan penugasan Shift Khusus.
