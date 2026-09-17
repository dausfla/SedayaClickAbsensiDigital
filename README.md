# SedayaClick — Sistem Absensi & Penggajian (PWA)

Aplikasi absensi dan penggajian berbasis Progressive Web App, dibangun mengikuti
6 tahap spesifikasi: Setup PWA, Autentikasi & RBAC, Absensi Karyawan, Approval
Admin Manager, Dashboard Super Admin, dan Penggajian/Pelaporan.

## Stack

- **Backend:** Node.js + Express.js (raw SQL via `mysql2`, tanpa ORM)
- **Database:** MySQL
- **Frontend:** HTML5 + Tailwind CSS (CDN) + Vanilla JavaScript (ES6 Modules)
- **PWA:** `manifest.json` + `sw.js`, mode `standalone` (tanpa address bar)
- **Ekspor Laporan:** CSV (`json2csv`) & Excel (`exceljs`), format durasi `HH:mm:ss`

## Struktur Folder

```
sedayaclick/
├── config/         # koneksi DB, schema.sql, seed super admin
├── middleware/      # auth & RBAC
├── routes/          # auth, attendance, submissions, admin, superadmin, reports
├── utils/           # kalkulasi waktu, upload, generator ekspor
├── uploads/          # foto absensi & lampiran pengajuan (runtime)
├── public/           # frontend PWA
│   ├── index.html            # login + pendaftaran mandiri
│   ├── employee/dashboard.html
│   ├── admin/dashboard.html
│   ├── superadmin/dashboard.html
│   ├── manifest.json, sw.js
│   └── js/, employee/js/, admin/js/, superadmin/js/
└── server.js
```

## Instalasi

1. **Clone / salin folder ini**, lalu install dependency:
   ```bash
   npm install
   ```

2. **Siapkan database MySQL:**
   ```bash
   mysql -u root -p < config/schema.sql
   ```
   Perintah ini otomatis membuat database `sedayaclick`, seluruh tabel
   (`divisions`, `positions`, `users`, `shift_settings`, `attendances`,
   `submissions`), view rekap (`view_attendance_report`,
   `view_submission_report`), dan beberapa master data contoh.

3. **Konfigurasi environment:**
   ```bash
   cp .env.example .env
   ```
   Sesuaikan `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, dan `SESSION_SECRET`.

4. **Buat akun Super Admin pertama:**
   ```bash
   npm run seed
   ```
   Akan menampilkan email & password default di terminal — segera login lalu
   buat akun Super Admin lain / ganti password melalui menu Manajemen User.

5. **Jalankan server:**
   ```bash
   npm start
   # atau untuk development dengan auto-reload:
   npm run dev
   ```
   Buka `http://localhost:3000`.

6. **Install sebagai PWA:** buka aplikasi di Chrome/Edge (desktop atau
   Android), lalu gunakan tombol "Install SedayaClick ke perangkat ini" pada
   halaman login, atau menu "Install App" bawaan browser.

   > Kamera & GPS pada browser modern mensyaratkan konteks aman (HTTPS atau
   > `localhost`). Saat deploy ke domain produksi, pastikan mengaktifkan HTTPS
   > agar fitur Clock In/Out berfungsi.

## Alur Peran (Role)

| Role | Akses |
|---|---|
| **Karyawan** | Clock In/Out (kamera + GPS wajib), form Izin/Cuti/Sakit, riwayat pengajuan milik sendiri. **Tidak** bisa melihat rekap/riwayat absensi. |
| **Admin Manager** | Approve/Reject pengajuan divisinya, monitoring kehadiran tim real-time (polling 10 detik). |
| **Super Admin** | Manajemen user & aktivasi akun pendaftaran mandiri, master data (Divisi/Jabatan/Shift), dashboard KPI, penggajian & pelaporan multi-filter + ekspor CSV/Excel. |

## Logika Kalkulasi Waktu (`utils/timeCalc.js`)

- **Durasi Terlambat** = waktu Clock In aktual − (jam mulai shift + toleransi).
- **Lembur** = waktu Clock Out aktual − jam selesai shift.
- **Durasi Kerja** = waktu Clock Out − waktu Clock In.
- Semua durasi disimpan sebagai **detik** di database, lalu diformat ke
  `HH:mm:ss` saat ditampilkan atau diekspor (lihat `secondsToHMS`).

## Ekspor Laporan

`GET /api/reports/attendance/export?format=csv|xlsx&period=weekly|monthly|custom&division_id=...`

- Kolom durasi pada file `.xlsx` diberi `numFmt: '@'` (format teks) agar nilai
  `HH:mm:ss` tampil presisi tanpa dibulatkan/dikonversi oleh Excel, termasuk
  untuk lembur yang melebihi 24 jam akumulasi.

## Catatan Keamanan & Pengembangan Lanjutan

- Session disimpan di MySQL (`express-mysql-session`) agar tahan restart server.
- Semua endpoint sensitif dilindungi middleware `requireAuth` + `requireRole`.
- Validasi GPS saat ini hanya mengunci & menyimpan koordinat; jika dibutuhkan
  pembatasan radius kantor, gunakan `OFFICE_LATITUDE`/`OFFICE_LONGITUDE`/
  `OFFICE_RADIUS_METERS` di `.env` sebagai referensi untuk menambahkan validasi
  jarak (haversine) di `routes/attendance.js`.
- Ikon PWA di `public/icons/` adalah placeholder — ganti dengan logo resmi
  perusahaan sebelum rilis produksi.
