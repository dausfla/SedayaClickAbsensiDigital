# 03. Software Design Document (SDD) As-Built

| Metadata | Keterangan |
| :--- | :--- |
| **Sistem** | SedayaClick — Sistem Presensi & Penggajian Karyawan PWA |
| **Versi Dokumen** | 1.0.0 (As-Built) |
| **Tanggal Analisis** | 23 November 2026 |
| **Sumber Analisis** | Commit `f374140` (Branch `main`) |
| **Status Dokumen** | Terverifikasi Berdasarkan Kode Sumber |

---

## 1. Arsitektur Sistem & Pola Desain

### 1.1 Pola Arsitektur (*Architectural Pattern*)
Aplikasi SedayaClick mengadopsi pola **Modular Monolith** dengan pendekatan **Layered Architecture** (Presentation, Routing & Middleware, Business Utilities & Service, dan Persistence).
- **Presentation Layer**: Static Progressive Web App (PWA) yang dilayani oleh Express static middleware dan Service Worker (`public/sw.js`). Client berkomunikasi dengan server murni melalui asynchronous JSON REST API menggunakan `fetch()`.
- **Routing & Middleware Layer**: Express Router modular (`routes/*.js`) yang dipagari oleh middleware autentikasi dan RBAC (`middleware/auth.js`) serta rate limiter (`express-rate-limit`).
- **Business Logic & Service Layer**: Kumpulan fungsi pembantu (*pure helper modules*) di `utils/` (`timeCalc.js`, `rosterHelper.js`, `exportGenerator.js`, `mailer.js`, `crypto.js`, `attendanceReminder.js`) serta background worker `services/telegramBot.js`.
- **Persistence Layer**: Basis data relasional MySQL diakses menggunakan connection pool `mysql2/promise` dengan *parameterized queries* murni (`?`) tanpa ORM berat, menghasilkan overhead komputasi yang sangat rendah.

### 1.2 Diagram Komponen Perangkat Lunak (Mermaid)

```mermaid
flowchart TD
    subgraph Client ["Client Browser / Mobile PWA"]
        UI_Login["Auth UI (index.html)"]
        UI_Emp["Employee Dashboard (employee/dashboard.html)"]
        UI_Adm["Admin Dashboard (admin/dashboard.html)"]
        UI_SA["Super Admin Dashboard (superadmin/dashboard.html)"]
        SW["Service Worker (sw.js - Cache & Push Receiver)"]
    end

    subgraph ServerApp ["Node.js + Express Application Engine"]
        EntryPoint["server.js (App Entry, Helmet, CORS, Error Handler)"]
        AuthMid["middleware/auth.js (requireAuth, requireRole, requireActiveAccount)"]
        
        subgraph APIRoutes ["REST API Routers"]
            R_Auth["routes/auth.js"]
            R_Att["routes/attendance.js"]
            R_Sub["routes/submissions.js"]
            R_Adm["routes/admin.js"]
            R_SA["routes/superadmin.js"]
            R_Rep["routes/reports.js"]
            R_Notif["routes/notifications.js"]
            R_Sec["routes/secureUploads.js"]
        end

        subgraph CoreHelpers ["Domain Logic & Utility Engine"]
            H_Time["utils/timeCalc.js (Durasi, Terlambat, Lembur)"]
            H_Roster["utils/rosterHelper.js (Matrix Parser & Codes)"]
            H_Mail["utils/mailer.js (SMTP Gmail Queue Sender)"]
            H_Crypto["utils/crypto.js (AES-256-CBC Two-Way Encrypt)"]
            H_Export["utils/exportGenerator.js (ExcelJS & CSV)"]
            H_Upload["utils/uploadConfig.js (Multer Storage & Whitelist)"]
        end

        subgraph Daemons ["Background Schedulers"]
            Sched_Att["utils/attendanceReminder.js (Cron 60s H-15 Min)"]
            Bot_Tele["services/telegramBot.js (Long Polling Bot)"]
        end
    end

    subgraph DataStorage ["Storage Engine"]
        MySQL_DB[("MySQL Database: sedayaclick")]
        MySQL_Sessions[("Table: sessions (Persistent Express Session)")]
        Local_FS[("File System: /uploads/ (attendance, submissions)")]
    end

    UI_Emp -->|API Requests| EntryPoint
    UI_Adm -->|API Requests| EntryPoint
    UI_SA -->|API Requests| EntryPoint
    UI_Login -->|API Requests| EntryPoint

    EntryPoint --> AuthMid
    AuthMid --> APIRoutes

    R_Att --> H_Time
    R_Att --> H_Roster
    R_Att --> H_Upload
    R_Adm --> H_Roster
    R_Adm --> H_Mail
    R_SA --> H_Crypto
    R_SA --> H_Mail
    R_Rep --> H_Export
    R_Sec --> Local_FS

    APIRoutes --> MySQL_DB
    EntryPoint --> MySQL_Sessions
    Sched_Att --> MySQL_DB
    Bot_Tele --> MySQL_DB
    Bot_Tele --> Local_FS
```

---

## 2. Sequence Diagram Alur Kunci Sistem

### 2.1 Alur Autentikasi & Login Sesi
[TERVERIFIKASI: routes/auth.js:108-160]

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna (Karyawan/Admin)
    participant Client as Browser PWA (auth-page.js)
    participant RateLimiter as Login Rate Limiter (express-rate-limit)
    participant AuthRoute as routes/auth.js (POST /api/auth/login)
    participant DB as MySQL Database (users & sessions)

    User->>Client: Input Email & Password, Klik "Masuk"
    Client->>RateLimiter: POST /api/auth/login { email, password }
    alt Percobaan Melebihi 5x / 15 Menit
        RateLimiter-->>Client: HTTP 429 Too Many Requests
        Client-->>User: Tampilkan error: "Terlalu banyak percobaan login"
    else Rate Limit Valid
        RateLimiter->>AuthRoute: Forward request
        AuthRoute->>DB: SELECT * FROM users WHERE email = ?
        DB-->>AuthRoute: User Row (Hash password, role, status)
        alt User Tidak Ditemukan
            AuthRoute-->>Client: HTTP 401: "Email atau password salah."
        else User Ditemukan
            AuthRoute->>AuthRoute: bcrypt.compare(inputPassword, user.password)
            alt Password Tidak Cocok
                AuthRoute-->>Client: HTTP 401: "Email atau password salah."
            else Password Valid
                alt Akun Berstatus Non-Aktif (status != 'active')
                    AuthRoute-->>Client: HTTP 403: "Akun belum aktif. Hubungi Super Admin."
                else Akun Aktif
                    AuthRoute->>DB: Simpan sesi ke tabel sessions (user.id, role, name)
                    AuthRoute-->>Client: HTTP 200 OK + Set-Cookie sedayaclick_sid
                    Client->>Client: Redirect ke dashboard sesuai peran (/employee, /admin, /superadmin)
                end
            end
        end
    end
```

### 2.2 Alur Presensi Masuk (Clock In) dengan Swafoto & GPS
[TERVERIFIKASI: routes/attendance.js:127-245]

```mermaid
sequenceDiagram
    autonumber
    actor Emp as Karyawan (employee)
    participant UI as Employee Dashboard (employee.js)
    participant Cam as Kamera WebRTC (camera.js)
    participant GPS as Geolocation API (geolocation.js)
    participant API as routes/attendance.js (POST /clock-in)
    participant Multer as Multer Storage (uploadConfig.js)
    participant TimeHelper as utils/timeCalc.js
    participant DB as MySQL Database (attendances & employee_schedules)

    Emp->>UI: Klik "Aktifkan Kamera Presensi"
    UI->>Cam: navigator.mediaDevices.getUserMedia()
    Cam-->>UI: Video Stream Preview Aktif
    UI->>GPS: navigator.geolocation.getCurrentPosition()
    GPS-->>UI: Latitude, Longitude Terkunci
    Emp->>UI: Klik "Absen Masuk (Capture & Submit)"
    UI->>UI: Render canvas to Blob (JPEG)
    UI->>API: POST /api/attendance/clock-in (multipart: photo, lat, lng, note)
    API->>Multer: Simpan foto ke /uploads/attendance/attendance-*.jpg
    Multer-->>API: File Path Tersimpan
    API->>DB: Cek apakah sudah ada clock_in_time hari ini
    alt Sudah Clock In Hari Ini
        API-->>UI: HTTP 409 Conflict: "Anda sudah melakukan Clock In hari ini."
    else Belum Clock In
        API->>DB: Query jadwal hari ini di employee_schedules atau shift_settings
        DB-->>API: Detail Shift (Jam Masuk, Toleransi, Tipe Shift)
        API->>TimeHelper: calculateLateDuration(today, nowWIB, startTime, tolerance)
        TimeHelper-->>API: lateDurationSeconds
        API->>API: determineStatus(lateSeconds) -> 'on_time' atau 'late'
        API->>DB: INSERT INTO attendances (user_id, date, clock_in_time, photo, lat, lng, late_duration_seconds, status)
        DB-->>API: Insert Success (ID Absensi)
        API-->>UI: HTTP 200 OK: Status Presensi Masuk Berhasil
        UI-->>Emp: Perbarui Badge Status ("Sudah Clock In" / "Terlambat") & Tampilkan Jam Masuk
    end
```

### 2.3 Alur Pengajuan Izin / Cuti & Persetujuan Manajer
[TERVERIFIKASI: routes/submissions.js:16-85, routes/admin.js:128-167]

```mermaid
sequenceDiagram
    autonumber
    actor Emp as Karyawan (employee)
    participant SubAPI as routes/submissions.js (POST /)
    participant AdminUI as Admin Dashboard (admin.js)
    participant AdmAPI as routes/admin.js (PATCH /submissions/:id/decision)
    participant DB as MySQL Database (submissions)
    actor Mgr as Admin Manager

    Emp->>SubAPI: POST /api/submissions (type, start_date, end_date, reason, attachment, handover_plan)
    alt Tipe Cuti / Izin dan Tanggal < H-3
        SubAPI-->>Emp: HTTP 400: "Wajib diajukan minimal H-3 sebelum tanggal pelaksanaan."
    else Validasi H-3 Terpenuhi (atau Tipe Sakit)
        SubAPI->>DB: INSERT INTO submissions (status = 'pending')
        DB-->>SubAPI: Insert ID
        SubAPI-->>Emp: HTTP 201 Created: "Pengajuan berhasil dikirim dan menunggu persetujuan."
    end

    Note over AdminUI,Mgr: Polling real-time 10 detik atau buka dashboard
    Mgr->>AdminUI: Buka antrean pengajuan pending
    AdminUI->>AdmAPI: GET /api/admin/submissions/pending
    AdmAPI->>DB: SELECT * FROM submissions WHERE status IN ('pending', 'under_review')
    DB-->>AdmAPI: Data pengajuan antrean
    AdmAPI-->>AdminUI: Render daftar pengajuan
    Mgr->>AdminUI: Klik Setuju / Tolak / Tinjau & isi catatan
    AdminUI->>AdmAPI: PATCH /api/admin/submissions/:id/decision { decision: 'approved', review_note: 'Disetujui' }
    AdmAPI->>DB: UPDATE submissions SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?
    DB-->>AdmAPI: Update Success
    AdmAPI-->>AdminUI: HTTP 200 OK: "Pengajuan berhasil disetujui."
    AdminUI-->>Mgr: Hapus dari antrean pending & masukkan ke riwayat pengajuan selesai
```

---

## 3. State Transition Diagrams

### 3.1 Siklus Status Absensi Harian (`attendances.status`)
[TERVERIFIKASI: config/schema.sql:47, routes/attendance.js:180-235]

```mermaid
stateDiagram-v2
    [*] --> Incomplete: Jadwal Terbentuk / Inisialisasi
    Incomplete --> OnTime: Clock In tepat waktu (<= start_time + tolerance) atau Shift Fleksibel / Siang
    Incomplete --> Late: Clock In terlambat (> start_time + tolerance) pada shift reguler
    OnTime --> AbsensiSelesai: Clock Out berhasil (work_duration_seconds dihitung)
    Late --> AbsensiSelesai: Clock Out berhasil (work_duration_seconds & overtime dihitung)
    AbsensiSelesai --> [*]
```

### 3.2 Siklus Status Pengajuan (`submissions.status` & `attendances.overtime_status`)
[TERVERIFIKASI: server.js:246-247, routes/admin.js:128-167]

```mermaid
stateDiagram-v2
    [*] --> Pending: Karyawan Mengirim Pengajuan
    Pending --> UnderReview: Ditandai 'Sedang Ditinjau' oleh Manajemen
    Pending --> Approved: Disetujui Manajer (Wajib Catatan)
    Pending --> Rejected: Ditolak Manajer (Wajib Alasan Penolakan)
    UnderReview --> Approved: Disetujui Setelah Klarifikasi
    UnderReview --> Rejected: Ditolak Setelah Klarifikasi
    Approved --> [*]
    Rejected --> [*]
```

### 3.3 Siklus Status Akun Pengguna (`users.status`)
[TERVERIFIKASI: routes/auth.js:90, routes/superadmin.js:174-200]

```mermaid
stateDiagram-v2
    [*] --> Pending: Pendaftaran Mandiri Karyawan
    Pending --> Active: Diverifikasi & Diaktifkan Super Admin
    Pending --> Deleted: Ditolak / Dihapus Super Admin
    Active --> Inactive: Dinonaktifkan Super Admin
    Inactive --> Active: Diaktifkan Kembali
    Active --> Deleted: Dihapus dari Database
    Deleted --> [*]
```

---

## 4. Algoritma Inti Sistem

### 4.1 Algoritma Kalkulasi Durasi Kerja, Keterlambatan, dan Lembur
Didefinisikan pada modul murni [TERVERIFIKASI: utils/timeCalc.js]:

1. **Durasi Keterlambatan (`calculateLateDuration`)**:
   - Input: `attendanceDate` (YYYY-MM-DD), `clockInTime` (Date), `shiftStartTime` (HH:mm:ss), `toleranceMinutes` (Integer).
   - Langkah:
     1. Bentuk objek `scheduledStart = Date(attendanceDate + "T" + shiftStartTime)`.
     2. Tambahkan menit toleransi: `scheduledStart.setMinutes(scheduledStart.getMinutes() + toleranceMinutes)`.
     3. Konversi selisih ke detik: `diff = (clockInTime.getTime() - scheduledStart.getTime()) / 1000`.
     4. Jika `diff > 0`, return `Math.floor(diff)` (durasi detik terlambat); jika tidak, return `0`.
2. **Durasi Lembur Shift Reguler (`calculateOvertime`)**:
   - Input: `attendanceDate`, `clockOutTime` (Date), `shiftEndTime` (HH:mm:ss).
   - Langkah:
     1. Bentuk objek `scheduledEnd = Date(attendanceDate + "T" + shiftEndTime)`.
     2. Hitung selisih: `diff = (clockOutTime.getTime() - scheduledEnd.getTime()) / 1000`.
     3. Jika `diff > 0`, return `Math.floor(diff)` (durasi lembur detik); jika tidak, return `0`.
3. **Format Durasi ke HH:mm:ss (`secondsToHMS`)**:
   - Input: `totalSeconds` (Numeric).
   - Hitung jam: `h = Math.floor(absSeconds / 3600)`.
   - Hitung menit: `m = Math.floor((absSeconds % 3600) / 60)`.
   - Hitung detik: `s = absSeconds % 60`.
   - Return string pad 2 digit: `HH:mm:ss`.

### 4.2 Algoritma Resolusi Shift Karyawan Roster
Didefinisikan pada [TERVERIFIKASI: utils/rosterHelper.js, routes/attendance.js:165-240]:

1. **Langkah 1**: Periksa tabel `employee_schedules` berdasarkan `user_id` dan `attendance_date`.
2. **Langkah 2**: Jika ada rekaman roster (`scheduleRows[0]`):
   - Ambil `shift_code`.
   - Cari metadata pada `DEFAULT_SHIFT_CODES[shift_code]`.
   - Terapkan `start_time`, `end_time`, `is_day_off`.
3. **Langkah 3**: Jika rekaman roster harian tidak ditemukan di database:
   - Periksa profil `shift_settings` pengguna.
   - Jika tipe shift pengguna adalah `roster` atau nama shift mengandung kata `"Khusus"` / `"Roster"`:
     - Periksa jam kedatangan saat ini (`nowWIB`):
       - Jika jam masuk < 07:00 WIB: Dipetakan ke Shift Pagi (P, 06:00 - 15:00 WIB).
       - Jika jam masuk 07:00 - 11:00 WIB: Dipetakan ke Shift Kantor SSV (VK, 08:00 - 17:00 WIB).
       - Jika jam masuk 11:00 - 14:00 WIB: Dipetakan ke Shift Siang (S, 13:00 - 22:00 WIB) tanpa keterlambatan.
       - Jika jam masuk >= 14:00 WIB: Dipetakan ke Shift Sore (R, 14:00 - 23:00 WIB).
   - Jika bukan shift roster: Gunakan jadwal shift tetap (*Fixed Shift*) default (08:00 - 17:00 WIB).

### 4.3 Algoritma Enkripsi Kata Sandi Dua Arah (AES-256-CBC)
Didefinisikan pada [TERVERIFIKASI: utils/crypto.js:8-60]:

1. **Pembangkitan Kunci Enkripsi**:
   - Ambil string rahasia `SECRET_SEED = process.env.SESSION_SECRET`.
   - Hasilkan kunci biner 32-byte (256 bit) menggunakan SHA-256: `KEY = crypto.createHash('sha256').update(SECRET_SEED).digest()`.
2. **Proses Enkripsi (`encryptPassword`)**:
   - Bangkitkan Initialization Vector (IV) acak sepanjang 16 byte: `iv = crypto.randomBytes(16)`.
   - Buat cipher: `cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv)`.
   - Enkripsi plain text UTF-8 menjadi heksadesimal.
   - Kembalikan format gabungan string: `${iv.toString('hex')}:${encryptedHex}`.
3. **Proses Dekripsi (`decryptPassword`)**:
   - Pisahkan string tersimpan berdasarkan pemisah titik dua (`:`).
   - Konversi `ivHex` menjadi Buffer IV biner.
   - Buat decipher: `decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv)`.
   - Dekripsi cipher hex menjadi teks asli UTF-8.
