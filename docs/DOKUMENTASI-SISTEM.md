# Dokumentasi Sistem SedayaClick

> **Versi Dokumen:** 1.0
> **Tanggal:** September 2026
> **Bahasa Implementasi:** Bahasa Indonesia (formal)

---

## Daftar Isi

1. [Ringkasan Sistem](#1-ringkasan-sistem)
2. [Teknologi yang Digunakan](#2-teknologi-yang-digunakan)
3. [Aktor dan Use Case](#3-aktor-dan-use-case)
4. [AlurFlow Bisnis Utama](#4-alurflow-bisnis-utama)
5. [Struktur Database](#5-struktur-database)
6. [Arsitektur Sistem](#6-arsitektur-sistem)
7. [Keamanan dan Kontrol Akses](#7-keamanan-dan-kontrol-akses)
8. [Catatan: Perbedaan dengan Spesifikasi Awal](#8-catatan-perbedaan-dengan-spesifikasi-awal)

---

## 1. Ringkasan Sistem

**SedayaClick** adalah sistem absensi dan penggajian berbasis *Progressive Web App* (PWA) yang dirancang untuk pengelolaan kehadiran karyawan secara digital. Sistem ini memungkinkan karyawan untuk melakukan *clock in* dan *clock out* menggunakan kamera dan GPS, mengajukan izin/cuti/sakit secara daring, serta memungkinkan manajemen untuk memantau kehadiran dan mengelola persetujuan pengajuan secara *real-time*.

### 1.1 Tujuan Aplikasi

- Menggantikan sistem absensi manual dengan sistem digital berbasis smartphone/browser.
- Merekam data kehadiran lengkap: waktu masuk, waktu keluar, foto wajah, koordinat GPS, durasi kerja, durasi keterlambatan, dan lembur.
- Menyediakan alur pengajuan izin/cuti/sakit yang terdokumentasi dan dapat disetujui/ditolak secara daring.
- Menghasilkan laporan rekap absensi dan pengajuan yang dapat diekspor ke format CSV maupun Excel (.xlsx).

### 1.2 Pengguna Sistem (3 Role)

| Role | Nama Teknis | Deskripsi |
|---|---|---|
| **Karyawan** | `employee` | Melakukan absensi harian (clock in/out dengan kamera + GPS), mengajukan izin/cuti/sakit, dan memantau status pengajuan miliknya sendiri. |
| **Admin Manager** | `admin_manager` | Berfokus pada Modul Pengajuan dengan hak akses lintas divisi: melihat, menyetujui, menolak, membuat, mengedit, dan menghapus pengajuan dari seluruh divisi atau difilter per divisi (setara Super Admin untuk modul pengajuan). |
| **Super Admin** | `super_admin` | Mengelola seluruh pengguna (aktivasi pendaftaran mandiri, CRUD akun), mengelola data master (divisi, jabatan, shift), memantau dashboard KPI keseluruhan organisasi, menyetujui/menolak/CRUD pengajuan lintas divisi, dan mengekspor laporan. |

### 1.3 Fitur Utama per Role

**Karyawan (`employee`)**
- Clock In harian (foto wajah + GPS wajib, validasi 1x per hari)
- Clock Out harian (foto wajah + GPS + catatan/keterangan wajib)
- Kirim pengajuan Izin / Cuti / Sakit (dengan lampiran opsional)
- Lihat riwayat pengajuan milik sendiri beserta status persetujuan

**Admin Manager (`admin_manager`)**
- Berfokus penuh pada **Modul Pengajuan (Izin / Cuti / Sakit)**
- Lihat daftar pengajuan *pending* dari seluruh divisi atau filter per divisi
- Approve / Reject pengajuan (dengan catatan alasan wajib)
- Lihat riwayat pengajuan yang sudah diproses (100 data terakhir)
- Buat pengajuan baru atas nama karyawan dari divisi manapun
- Edit dan hapus data pengajuan lintas divisi
- Form popup modal CRUD yang rapi, responsif, dan tidak tertumpuk di semua device
- Polling *real-time* 10 detik untuk sinkronisasi otomatis dengan Super Admin & Karyawan

**Super Admin (`super_admin`)**
- Dashboard KPI: jumlah hadir tepat waktu, terlambat, pending pengajuan, total karyawan aktif, pengajuan per jenis (izin/sakit/cuti), grafik distribusi absensi harian/mingguan/bulanan
- Manajemen pengguna: lihat daftar, buat akun baru, aktivasi pendaftaran mandiri, edit data, nonaktifkan/aktifkan kembali, hapus akun
- Manajemen master data: Divisi (CRUD), Jabatan (CRUD), Pengaturan Shift (CRUD)
- Lihat dan proses pengajuan lintas semua divisi (Approve/Reject/Buat/Edit/Hapus)
- Laporan rekap absensi + pengajuan lintas divisi + ekspor CSV/Excel
- Detail record absensi individual (foto, koordinat, durasi)

---

## 2. Teknologi yang Digunakan

| Kategori | Teknologi | Versi | Fungsi di Proyek |
|---|---|---|---|
| **Backend Runtime** | Node.js | — | Runtime server-side JavaScript |
| **Backend Framework** | Express.js | `^4.19.2` | Framework HTTP server, routing, middleware |
| **Database** | MySQL | — | Penyimpanan seluruh data aplikasi |
| **Driver Database** | mysql2 | `^3.10.0` | Koneksi Node.js ke MySQL, *promise-based* |
| **Autentikasi** | bcryptjs | `^2.4.3` | Hash password dengan bcrypt (cost factor 10) |
| **Manajemen Session** | express-session | `^1.18.0` | Session berbasis cookie (12 jam) |
| **Penyimpanan Session** | express-mysql-session | `^3.0.3` | Session store di MySQL agar tahan restart server |
| **Upload File** | multer | `^1.4.5-lts.1` | Menangani upload foto absensi & lampiran pengajuan (`multipart/form-data`) |
| **Ekspor Excel** | exceljs | `^4.4.0` | Menghasilkan file `.xlsx` laporan absensi & pengajuan |
| **Ekspor CSV** | json2csv | `^6.0.0-alpha.2` | Menghasilkan file `.csv` laporan absensi & pengajuan |
| **Environment Config** | dotenv | `^16.4.5` | Membaca variabel lingkungan dari file `.env` |
| **CORS** | cors | `^2.8.5` | Middleware CORS untuk mendukung *credentials* |
| **Dev Tool** | nodemon | `^3.1.0` | Auto-restart server saat kode berubah (dev only) |
| **Frontend CSS** | Tailwind CSS | CDN | Utility-first CSS untuk antarmuka dashboard |
| **Frontend JS** | Vanilla JavaScript (ES6 Modules) | — | Logika interaksi UI di browser |
| **Grafik** | Chart.js | `^4` (CDN) | Grafik batang distribusi absensi di dashboard Super Admin |
| **PWA** | `manifest.json` + `sw.js` | — | Installable app, mode *standalone*, ikon 192x512px |
| **Font** | Google Fonts — Inter | CDN | Tipografi antarmuka |

---

## 3. Aktor dan Use Case

### 3.1 Karyawan (`employee`)

| Use Case | Deskripsi |
|---|---|
| **Clock In** | Karyawan mengambil foto wajah menggunakan kamera perangkat dan mengizinkan akses GPS; sistem merekam waktu masuk, koordinat, dan menghitung keterlambatan berdasarkan shift. Hanya bisa dilakukan 1 kali per hari. |
| **Clock Out** | Karyawan mengambil foto dan mengisi catatan/keterangan wajib; sistem merekam waktu pulang, menghitung durasi kerja total dan lembur. Hanya bisa dilakukan setelah Clock In. |
| **Kirim Pengajuan** | Karyawan mengisi formulir pengajuan Izin/Cuti/Sakit (jenis, tanggal mulai-selesai, alasan, lampiran opsional). Pengajuan langsung berstatus *pending*. |
| **Lihat Riwayat Pengajuan** | Karyawan dapat melihat seluruh pengajuan miliknya beserta status (pending/approved/rejected) dan catatan alasan dari Admin. |
| **Update Profil** | Karyawan dapat memperbarui nama lengkap, nomor WhatsApp, alamat, divisi, dan jabatan via endpoint `POST /api/auth/update-profile`. |

```mermaid
flowchart TD
    K([Karyawan]) --> A[Clock In - Foto + GPS]
    K --> B[Clock Out - Foto + GPS + Catatan]
    K --> C[Kirim Pengajuan Izin/Cuti/Sakit]
    K --> D[Lihat Riwayat Pengajuan Saya]
    K --> E[Update Profil]
```

---

### 3.2 Admin Manager (`admin_manager`)

| Use Case | Deskripsi |
|---|---|
| **Lihat Pengajuan Pending** | Melihat semua pengajuan berstatus *pending* dari karyawan di divisi yang sama. |
| **Setujui / Tolak Pengajuan** | Memberikan keputusan *approved* atau *rejected* disertai catatan alasan wajib. Hanya pengajuan yang masih berstatus *pending* yang dapat diproses. |
| **Lihat Riwayat Keputusan** | Melihat 100 pengajuan terakhir yang sudah diproses (approved/rejected) dalam divisinya. |
| **Buat Pengajuan Baru** | Membuat pengajuan atas nama karyawan di divisinya dengan status awal yang bisa langsung *approved/rejected* atau tetap *pending*. |
| **Edit Pengajuan** | Mengedit data pengajuan yang ada untuk karyawan dalam divisinya. |
| **Hapus Pengajuan** | Menghapus data pengajuan secara permanen untuk karyawan dalam divisinya. |
| **Monitoring Kehadiran Tim** | Melihat status clock in/out seluruh karyawan aktif di divisinya untuk hari ini secara *real-time* (polling setiap 10 detik). |
| **Laporan & Ekspor** | Mengakses rekap absensi dan rekap pengajuan divisinya dengan filter periode, lalu mengekspor ke CSV atau Excel. |

```mermaid
flowchart TD
    AM([Admin Manager]) --> A[Lihat Pengajuan Pending Divisi]
    AM --> B[Setujui/Tolak Pengajuan]
    AM --> C[Lihat Riwayat Keputusan]
    AM --> D[Buat Pengajuan Baru atas Nama Karyawan]
    AM --> E[Edit Pengajuan]
    AM --> F[Hapus Pengajuan]
    AM --> G[Monitoring Kehadiran Tim Hari Ini]
    AM --> H[Laporan Rekap Absensi dan Pengajuan]
    AM --> I[Ekspor CSV/Excel]
```

---

### 3.3 Super Admin (`super_admin`)

| Use Case | Deskripsi |
|---|---|
| **Dashboard KPI** | Melihat ringkasan metrik organisasi: jumlah hadir, terlambat, pending, karyawan aktif, pengajuan per jenis, dan grafik batang distribusi harian/mingguan/bulanan. |
| **Aktivasi Akun Pendaftaran** | Melihat daftar akun berstatus *pending* dan mengaktifkannya, opsional menetapkan role/shift. |
| **CRUD Pengguna** | Membuat akun baru langsung berstatus *active*, mengedit data pengguna, menonaktifkan/mengaktifkan kembali, dan menghapus akun beserta data absensi dan pengajuannya. |
| **Master Data Divisi** | Menambah, mengedit, dan menghapus data divisi organisasi. |
| **Master Data Jabatan** | Menambah, mengedit, dan menghapus data jabatan. |
| **Master Data Shift** | Menambah, mengedit, dan menghapus pengaturan shift kerja (nama, jam mulai, jam selesai, toleransi keterlambatan). |
| **Pengajuan Lintas Divisi** | Melihat, menyetujui/menolak, membuat, mengedit, dan menghapus pengajuan dari seluruh divisi atau difilter per divisi. |
| **Laporan & Ekspor** | Mengakses rekap absensi dan pengajuan lintas divisi dengan filter periode dan divisi, mengunduh CSV atau Excel. |
| **Detail Absensi** | Melihat detail lengkap satu record absensi termasuk foto clock in/out, koordinat GPS, dan kalkulasi durasi. |

```mermaid
flowchart TD
    SA([Super Admin]) --> A[Dashboard KPI dan Grafik]
    SA --> B[Aktivasi Akun Pendaftaran Mandiri]
    SA --> C[CRUD Pengguna]
    SA --> D[Master Data Divisi / Jabatan / Shift]
    SA --> E[Pengajuan Lintas Divisi - Approve/Reject/CRUD]
    SA --> F[Laporan Rekap Absensi dan Pengajuan]
    SA --> G[Ekspor CSV/Excel]
    SA --> H[Detail Record Absensi Individual]
```

---

## 4. Alur/Flow Bisnis Utama

### 4a. Alur Pendaftaran Mandiri dan Aktivasi Akun

```mermaid
sequenceDiagram
    participant B as Browser (Frontend)
    participant S as Server (Express)
    participant DB as Database (MySQL)

    B->>S: GET /api/auth/meta
    S->>DB: SELECT divisions, positions
    DB-->>S: Daftar divisi dan jabatan
    S-->>B: {divisions, positions}

    B->>S: POST /api/auth/register {full_name, email, password, division_id, position_id, whatsapp, address}
    S->>DB: SELECT id FROM users WHERE email=?
    DB-->>S: [] email belum terdaftar
    S->>S: bcrypt.hash(password, 10)
    S->>DB: INSERT INTO users role=employee status=pending
    DB-->>S: insertId
    S-->>B: 201 Menunggu aktivasi

    Note over B,DB: Akun belum bisa login hingga diaktifkan Super Admin

    B->>S: GET /api/superadmin/users?status=pending
    S->>DB: SELECT users WHERE status=pending
    DB-->>S: [{id, full_name, email, ...}]
    S-->>B: Daftar akun pending

    B->>S: PATCH /api/superadmin/users/:id/activate {role?, shift_id?}
    S->>DB: UPDATE users SET status=active WHERE id=?
    DB-->>S: affectedRows 1
    S-->>B: Akun berhasil diaktifkan
```

---

### 4b. Alur Login

```mermaid
sequenceDiagram
    participant B as Browser (Frontend)
    participant S as Server (Express)
    participant DB as Database (MySQL)

    B->>S: POST /api/auth/login {email, password}
    S->>DB: SELECT users JOIN divisions JOIN positions WHERE email=?
    DB-->>S: user row

    alt Status pending
        S-->>B: 403 Akun menunggu aktivasi Super Admin
    else Status inactive
        S-->>B: 403 Akun dinonaktifkan
    else Password salah
        S->>S: bcrypt.compare() false
        S-->>B: 401 Email atau password salah
    else Login berhasil
        S->>S: bcrypt.compare() true
        S->>S: Simpan user ke req.session tanpa field password
        S-->>B: 200 {success true, user {id, role, ...}}
    end

    B->>S: GET /api/auth/session
    S-->>B: {loggedIn true, user {role, ...}}
    B->>B: Redirect sesuai role ke dashboard masing-masing
```

---

### 4c. Alur Clock In

```mermaid
sequenceDiagram
    participant B as Browser (Frontend)
    participant S as Server (Express)
    participant DB as Database (MySQL)

    B->>B: Akses kamera getUserMedia dan kunci GPS watchPosition
    B->>S: POST /api/attendance/clock-in multipart photo latitude longitude note opsional
    S->>S: Middleware requireAuth requireRole employee requireActiveAccount
    S->>S: Validasi photo ada dan GPS ada

    S->>DB: SELECT id clock_in_time FROM attendances WHERE user_id=? AND attendance_date=today
    DB-->>S: existing row

    alt Sudah clock in hari ini
        S-->>B: 409 Anda sudah Clock In hari ini
    else Belum clock in
        S->>DB: SELECT shift start_time tolerance_minutes FROM users JOIN shift_settings
        DB-->>S: shift data default 08:00:00 toleransi 0 menit
        S->>S: calculateLateDuration dan determineStatus on_time atau late
        S->>S: Simpan file foto ke /uploads/attendance/
        S->>DB: INSERT INTO attendances clock_in_time photo lat lng note late_duration_seconds status
        DB-->>S: OK
        S-->>B: 200 Clock In berhasil dengan info keterlambatan
    end
```

---

### 4d. Alur Clock Out

```mermaid
sequenceDiagram
    participant B as Browser (Frontend)
    participant S as Server (Express)
    participant DB as Database (MySQL)

    B->>B: Akses kamera dan kunci GPS
    B->>S: POST /api/attendance/clock-out multipart photo latitude longitude note wajib
    S->>S: Middleware requireAuth requireRole employee requireActiveAccount
    S->>S: Validasi photo ada GPS ada note ada

    S->>DB: SELECT id clock_in_time clock_out_time FROM attendances WHERE user_id=? AND date=today
    DB-->>S: existing row

    alt Belum clock in
        S-->>B: 400 Belum melakukan Clock In
    else Sudah clock out
        S-->>B: 409 Sudah melakukan Clock Out hari ini
    else Clock out valid
        S->>DB: SELECT shift end_time FROM users JOIN shift_settings
        DB-->>S: end_time default 17:00:00
        S->>S: calculateOvertime dan calculateWorkDuration
        S->>S: Simpan file foto ke /uploads/attendance/
        S->>DB: UPDATE attendances SET clock_out_time photo lat lng note work_duration_seconds overtime_seconds
        DB-->>S: OK
        S-->>B: 200 {work_duration_hms, overtime_hms}
    end
```

---

### 4e. Alur Pengajuan Izin/Cuti/Sakit sampai Approval

```mermaid
sequenceDiagram
    participant K as Karyawan (Browser)
    participant S as Server (Express)
    participant DB as Database (MySQL)
    participant AM as Admin/Super Admin (Browser)

    K->>S: POST /api/submissions multipart type start_date end_date reason attachment opsional
    S->>S: Middleware requireAuth requireRole employee requireActiveAccount
    S->>S: Validasi type valid tanggal valid alasan ada
    S->>S: Simpan file lampiran ke /uploads/submissions/ jika ada
    S->>DB: INSERT INTO submissions user_id type ... status=pending
    DB-->>S: insertId
    S-->>K: 201 {success true, submission_id}

    Note over AM,DB: Admin/Super Admin membuka tab Pengajuan

    AM->>S: GET /api/admin/submissions/pending ?division_id=...
    S->>S: Middleware requireAuth requireRole admin_manager atau super_admin requireActiveAccount
    S->>DB: SELECT submissions JOIN users WHERE status=pending AND division scoping
    DB-->>S: [{id, type, full_name, ...}]
    S-->>AM: {submissions: [...]}

    Note over AM,DB: Frontend polling tiap 10 detik saat tab Pengajuan aktif

    AM->>S: PATCH /api/admin/submissions/:id/decision {decision approved atau rejected, review_note}
    S->>S: Validasi decision valid review_note ada
    S->>DB: SELECT submission cek scope divisi untuk admin_manager
    DB-->>S: row ditemukan
    S->>DB: UPDATE submissions SET status review_note reviewed_by reviewed_at=NOW()
    DB-->>S: OK
    S-->>AM: {success true, message}

    K->>S: GET /api/submissions/mine
    S->>DB: SELECT submissions WHERE user_id=?
    DB-->>S: [{id, type, status, review_note, ...}]
    S-->>K: Daftar pengajuan dengan status terbaru
```

---

### 4f. Alur Generate dan Ekspor Laporan

```mermaid
sequenceDiagram
    participant B as Browser (Admin atau Super Admin)
    participant S as Server (Express)
    participant DB as Database (MySQL)

    B->>S: GET /api/reports/attendance ?period=weekly|monthly|custom &start_date &end_date &division_id &name
    S->>S: Middleware requireAuth requireRole admin_manager atau super_admin
    S->>S: buildFilter - bangun WHERE clause, Admin Manager dikunci ke division_id session
    S->>DB: SELECT attendances JOIN users JOIN divisions JOIN positions WHERE filter
    DB-->>S: rows data absensi
    S->>S: prepareRows - format durasi ke HH:mm:ss
    S-->>B: {total, data: [...]}

    B->>B: Tampilkan tabel data di UI

    B->>S: GET /api/reports/attendance/export ?format=csv|xlsx &filter sama
    S->>DB: Query data sama
    DB-->>S: rows

    alt Format CSV
        S->>S: generateCSV rows via json2csv
        S-->>B: File .csv Content-Disposition attachment
    else Format Excel
        S->>S: generateXLSX rows via ExcelJS kolom durasi format teks agar HH:mm:ss tidak dibulatkan Excel
        S-->>B: File .xlsx Content-Disposition attachment
    end

    B->>B: Browser mengunduh file
```

---

## 5. Struktur Database

> **Catatan:** File `config/schema.sql` pada proyek ini hanya berisi teks `npm start` (bukan DDL SQL). Struktur tabel di bawah direkonstruksi dari query SQL aktual yang ditemukan langsung di seluruh file `routes/*.js`.

### 5.1 Ringkasan Tabel

| Tabel | Fungsi | Kolom-Kolom yang Digunakan dalam Kode |
|---|---|---|
| `divisions` | Data master divisi/departemen | `id`, `name` |
| `positions` | Data master jabatan/posisi | `id`, `name` |
| `shift_settings` | Pengaturan jadwal shift kerja | `id`, `name`, `start_time`, `end_time`, `tolerance_minutes`, `is_active` |
| `users` | Data seluruh pengguna sistem | `id`, `full_name`, `email`, `password`, `whatsapp`, `address`, `role`, `status`, `division_id`, `position_id`, `shift_id`, `created_at` |
| `attendances` | Rekaman absensi harian | `id`, `user_id`, `attendance_date`, `clock_in_time`, `clock_out_time`, `clock_in_photo`, `clock_out_photo`, `clock_in_lat`, `clock_in_lng`, `clock_out_lat`, `clock_out_lng`, `clock_in_note`, `clock_out_note`, `late_duration_seconds`, `work_duration_seconds`, `overtime_seconds`, `status` |
| `submissions` | Pengajuan izin/cuti/sakit karyawan | `id`, `user_id`, `type`, `start_date`, `end_date`, `reason`, `attachment`, `status`, `review_note`, `reviewed_by`, `reviewed_at`, `created_at` |

### 5.2 Detail Kolom Penting

**Tabel `users`:**
- `role`: `'employee'` | `'admin_manager'` | `'super_admin'`
- `status`: `'pending'` (daftar mandiri, belum diaktifkan) | `'active'` | `'inactive'`

**Tabel `attendances`:**
- `status`: `'on_time'` | `'late'`
- `late_duration_seconds`, `work_duration_seconds`, `overtime_seconds`: disimpan dalam satuan detik integer

**Tabel `submissions`:**
- `type`: `'izin'` | `'cuti'` | `'sakit'`
- `status`: `'pending'` | `'approved'` | `'rejected'`
- `reviewed_by`: `users.id` dari Admin/Super Admin yang memproses
- `attachment`: path relatif file lampiran, misalnya `/uploads/submissions/filename.jpg`

### 5.3 Diagram ERD

```mermaid
erDiagram
    divisions {
        int id PK
        varchar name
    }
    positions {
        int id PK
        varchar name
    }
    shift_settings {
        int id PK
        varchar name
        time start_time
        time end_time
        int tolerance_minutes
        tinyint is_active
    }
    users {
        int id PK
        varchar full_name
        varchar email
        varchar password
        varchar whatsapp
        text address
        enum role
        enum status
        int division_id FK
        int position_id FK
        int shift_id FK
        datetime created_at
    }
    attendances {
        int id PK
        int user_id FK
        date attendance_date
        datetime clock_in_time
        datetime clock_out_time
        varchar clock_in_photo
        varchar clock_out_photo
        decimal clock_in_lat
        decimal clock_in_lng
        decimal clock_out_lat
        decimal clock_out_lng
        text clock_in_note
        text clock_out_note
        int late_duration_seconds
        int work_duration_seconds
        int overtime_seconds
        enum status
    }
    submissions {
        int id PK
        int user_id FK
        enum type
        date start_date
        date end_date
        text reason
        varchar attachment
        enum status
        text review_note
        int reviewed_by FK
        datetime reviewed_at
        datetime created_at
    }

    divisions ||--o{ users : "membawahi"
    positions ||--o{ users : "menjabat"
    shift_settings ||--o{ users : "ditugaskan ke"
    users ||--o{ attendances : "memiliki"
    users ||--o{ submissions : "mengajukan"
    users ||--o{ submissions : "mereview"
```

---

## 6. Arsitektur Sistem

### 6.1 Diagram Alur Request

```mermaid
flowchart TD
    subgraph Client["Browser / PWA Client"]
        PH["public/index.html - Login + Daftar"]
        ED["employee/dashboard.html"]
        AD["admin/dashboard.html"]
        SD["superadmin/dashboard.html"]
        SW["sw.js - Service Worker"]
        MF["manifest.json - PWA Config"]
    end

    subgraph Server["Express.js Server (server.js)"]
        MW["Middleware: cors, session, json, urlencoded"]
        ST["Static Files: /public + /uploads"]
        subgraph Routes["API Routes /api/..."]
            AR["/auth - auth.js"]
            ATR["/attendance - attendance.js"]
            SR["/submissions - submissions.js"]
            ADR["/admin - admin.js"]
            SAR["/superadmin - superadmin.js"]
            RPR["/reports - reports.js"]
        end
        subgraph AuthMW["Middleware Auth (middleware/auth.js)"]
            RA["requireAuth - cek session"]
            RR["requireRole - RBAC"]
            RAC["requireActiveAccount - cek status"]
        end
        subgraph Utils["Utils"]
            TC["timeCalc.js - Kalkulasi waktu"]
            UC["uploadConfig.js - Multer"]
            EG["exportGenerator.js - CSV + XLSX"]
        end
    end

    subgraph DB["MySQL Database"]
        DV[("divisions")]
        PO[("positions")]
        SH[("shift_settings")]
        US[("users")]
        AT[("attendances")]
        SB[("submissions")]
        SS[("sessions - express-mysql-session")]
    end

    subgraph Storage["File Storage"]
        UA["uploads/attendance/ - Foto Clock In/Out"]
        US2["uploads/submissions/ - Lampiran Pengajuan"]
    end

    Client -->|HTTP Request| MW
    MW --> ST
    MW --> Routes
    Routes --> AuthMW
    AuthMW --> DB
    Routes --> Utils
    Utils --> Storage
    Routes --> DB
```

### 6.2 Struktur Folder Proyek

```
sedayaclick/
├── config/
│   ├── db.js              # Pool koneksi MySQL (mysql2/promise)
│   ├── schema.sql         # DDL pembuatan database & tabel
│   └── seed.js            # Script pembuatan akun Super Admin pertama
├── middleware/
│   └── auth.js            # requireAuth, requireRole, requireActiveAccount
├── routes/
│   ├── auth.js            # Registrasi, login, logout, session, update-profile
│   ├── attendance.js      # Clock in, clock out, status hari ini
│   ├── submissions.js     # Kirim pengajuan (employee) + lihat milik sendiri
│   ├── admin.js           # Approval, monitoring tim, CRUD pengajuan (admin+super)
│   ├── superadmin.js      # Dashboard KPI, manajemen user, master data
│   └── reports.js         # Laporan rekap absensi & pengajuan + ekspor
├── utils/
│   ├── timeCalc.js        # Kalkulasi keterlambatan, lembur, durasi kerja
│   ├── uploadConfig.js    # Konfigurasi Multer untuk foto absensi & lampiran
│   └── exportGenerator.js # Generator CSV (json2csv) & Excel (exceljs)
├── uploads/
│   ├── attendance/        # File foto clock in/out (dibuat otomatis saat startup)
│   └── submissions/       # File lampiran pengajuan (dibuat otomatis saat startup)
├── public/
│   ├── index.html         # Halaman login + form pendaftaran mandiri
│   ├── manifest.json      # PWA manifest (standalone, ikon 192/512px)
│   ├── sw.js              # Service Worker (PWA installable)
│   ├── js/
│   │   ├── api.js         # Helper fetch (apiGet, apiPost, apiPatch, dll.)
│   │   ├── pwa-register.js
│   │   └── geolocation.js
│   ├── employee/
│   │   ├── dashboard.html
│   │   └── js/employee.js
│   ├── admin/
│   │   ├── dashboard.html
│   │   └── js/admin.js
│   └── superadmin/
│       ├── dashboard.html
│       └── js/superadmin.js
├── server.js
└── package.json
```

### 6.3 Penjelasan Keputusan Arsitektur

1. **Raw SQL tanpa ORM** (disebutkan eksplisit di `README.md`): Seluruh query database ditulis langsung menggunakan `mysql2` untuk kontrol penuh terhadap performa, terutama scoping divisi yang dinamis.

2. **Session di MySQL** (`express-mysql-session`): Session disimpan di tabel MySQL agar tetap valid walau server di-restart — penting untuk PWA yang mungkin dibuka kembali setelah lama tidak aktif (komentar langsung di `server.js`).

3. **RBAC via Middleware Berantai**: Setiap route menerapkan tiga middleware berurutan: `requireAuth` → `requireRole(...)` → `requireActiveAccount`. Ini memisahkan tanggung jawab: autentikasi, otorisasi, dan validasi status akun.

4. **Scoping Pengajuan Lintas Divisi**: Admin Manager dan Super Admin memiliki akses penuh untuk mengelola pengajuan dari seluruh divisi atau memfilter per divisi via query string `division_id` di `routes/admin.js`.

5. **Upload File Terpisah**: Foto absensi di `uploads/attendance/` dan lampiran pengajuan di `uploads/submissions/`, diakses via `/uploads/...`. Folder dibuat otomatis saat server pertama kali berjalan.

6. **Frontend ES6 Modules**: Setiap dashboard menggunakan Script JS modern, memungkinkan modularisasi kode JS tanpa bundler.

7. **PWA Real-Time Polling**: Tidak menggunakan WebSocket. Data *real-time* dicapai dengan `setInterval` polling setiap 10 detik yang aktif di dashboard Admin Manager dan Super Admin untuk menjaga konsistensi data pengajuan.

---

## 7. Keamanan dan Kontrol Akses

| Role | Endpoint yang Dapat Diakses | Pembatasan Tambahan |
|---|---|---|
| **Publik (tanpa login)** | `GET /api/auth/meta`, `POST /api/auth/register`, `POST /api/auth/login` | Register langsung berstatus `pending`. Login ditolak jika `pending` atau `inactive`. |
| **Semua yang login** | `GET /api/auth/session`, `POST /api/auth/logout` | Hanya perlu session aktif |
| **Karyawan** (`employee`) | `POST /api/attendance/clock-in`, `POST /api/attendance/clock-out`, `GET /api/attendance/today`, `POST /api/submissions`, `GET /api/submissions/mine`, `POST /api/auth/update-profile` | Hanya data milik sendiri. **Tidak ada** akses ke rekap/riwayat absensi. |
| **Admin Manager** (`admin_manager`) | `GET /api/admin/submissions/pending`, `GET /api/admin/submissions/history`, `PATCH /api/admin/submissions/:id/decision`, `POST /api/admin/submissions`, `PUT /api/admin/submissions/:id`, `DELETE /api/admin/submissions/:id`, `GET /api/admin/employees` | **Modul Pengajuan Lintas Divisi** — Dapat melihat, memproses, membuat, mengedit, dan menghapus pengajuan dari seluruh atau filter divisi. |
| **Super Admin** (`super_admin`) | Semua endpoint `/api/admin/*`, `/api/reports/*`, dan semua `/api/superadmin/*` | Akses penuh seluruh sistem lintas divisi. Tidak dapat menghapus akun dirinya sendiri. |

### 7.1 Mekanisme Keamanan Tambahan

| Mekanisme | Detail |
|---|---|
| **Hash Password** | bcryptjs dengan cost factor 10. Password tidak pernah disimpan sebagai plaintext. |
| **Session Cookie** | `httpOnly: true`, `sameSite: 'lax'`, `maxAge: 12 jam`. Tidak dapat diakses JavaScript browser. |
| **Session Store MySQL** | `express-mysql-session` — session tetap valid walau server restart. |
| **Validasi Status Akun** | `requireActiveAccount` memeriksa ulang status dari session setiap request. Jika status berubah jadi `inactive`, akses ditolak walaupun session masih ada. |
| **CORS** | `origin: true, credentials: true` — perlu dikonfigurasi ulang untuk produksi. |
| **Validasi Input Server-Side** | Semua field wajib divalidasi di server sebelum operasi database dilakukan. |

---

## 8. Catatan: Perbedaan dengan Spesifikasi Awal

### 8.1 Hal yang Ada di Kode Tetapi Tidak Disebutkan di Spesifikasi Awal Dokumen Ini

1. **`POST /api/auth/update-profile`**: Endpoint pembaruan profil karyawan (nama, WhatsApp, alamat, divisi, jabatan) tersedia di `routes/auth.js` dan dikonsumsi oleh frontend.

2. **`GET /api/reports/attendance/:id`** dan **`GET /api/reports/attendance/by-user/:userId`**: Dua endpoint detail laporan di `routes/reports.js` dikonsumsi oleh modal detail absensi di frontend Super Admin.

3. **`GET /api/admin/monitoring/today`**: Endpoint monitoring tim real-time tersedia di `routes/admin.js` dan berfungsi di dashboard Admin Manager.

4. **`GET /api/admin/employees`**: Endpoint daftar karyawan untuk dropdown pembuatan pengajuan baru oleh Admin Manager/Super Admin.

5. **`GET /api/health`**: Endpoint health check sederhana di `server.js`.

### 8.2 Hal yang Perlu Perhatian

1. **`config/schema.sql`**: File ini berisi teks `npm start`, bukan DDL SQL. Struktur tabel di Bagian 5 direkonstruksi dari query SQL aktual di `routes/*.js`. Untuk dokumentasi resmi, file `schema.sql` perlu diperbarui dengan DDL yang akurat.

2. **Validasi Radius GPS**: `README.md` menyebutkan bahwa validasi pembatasan radius kantor (haversine) belum diimplementasikan — sistem saat ini hanya menyimpan koordinat tanpa memvalidasi apakah karyawan benar-benar berada di lokasi kantor.

3. **Ikon PWA**: `README.md` menyebutkan ikon di `public/icons/` adalah *placeholder* dan perlu diganti logo resmi sebelum rilis produksi.

---

*Dokumen ini dihasilkan berdasarkan pembacaan langsung dari kode sumber proyek SedayaClick: `routes/`, `middleware/`, `utils/`, `server.js`, `package.json`, `public/manifest.json`, `README.md`.*
