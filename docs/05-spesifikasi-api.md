# 05. Spesifikasi REST API As-Built

| Metadata | Keterangan |
| :--- | :--- |
| **Sistem** | SedayaClick — Sistem Presensi & Penggajian Karyawan PWA |
| **Protokol** | HTTPS / RESTful JSON & Multipart Form Data |
| **Versi Dokumen** | 1.0.0 (As-Built) |
| **Tanggal Analisis** | 23 November 2026 |
| **Sumber Analisis** | Seluruh berkas pada direktori `routes/*.js` |

---

## 1. Standar Respons & Penanganan Kesalahan

Seluruh endpoint API mengembalikan format JSON konsisten:
- **Format Respons Sukses**:
  ```json
  {
    "success": true,
    "message": "Operasi berhasil diselesaikan.",
    "data": { ... }
  }
  ```
- **Format Respons Error**:
  ```json
  {
    "success": false,
    "message": "Pesan deskripsi kesalahan berbahasa Indonesia."
  }
  ```

| HTTP Status Code | Keterangan dalam SedayaClick |
| :--- | :--- |
| `200 OK` | Permintaan berhasil diproses dan mengembalikan data yang diminta. |
| `201 Created` | Sumber daya baru berhasil dibuat (registrasi, presensi, pengajuan). |
| `400 Bad Request` | Parameter wajib tidak lengkap, format data tidak valid, atau melanggar aturan bisnis (misal: pengajuan cuti < H-3). |
| `401 Unauthorized` | Belum login atau sesi telah berakhir / tidak valid. |
| `403 Forbidden` | Akun pengguna belum aktif (`status != 'active'`) atau peran pengguna tidak memiliki izin ke endpoint tersebut. |
| `404 Not Found` | Entitas yang diminta (user, pengajuan, absensi, atau berkas) tidak ditemukan. |
| `409 Conflict` | Terjadi duplikasi data (email sudah terdaftar atau karyawan sudah Clock In hari ini). |
| `429 Too Many Requests` | Frekuensi request melampaui batas rate limit (maksimal 5 percobaan login gagal per 15 menit). |
| `500 Internal Server Error` | Terjadi kesalahan eksekusi pada server atau kegagalan query database. |

---

## 2. Modul Autentikasi (`routes/auth.js`)

### 2.1 `GET /api/auth/meta`
- **Deskripsi**: Mengambil data master pendukung untuk formulir pendaftaran mandiri (daftar divisi dan jabatan aktif).
- **Autentikasi**: Publik (Tanpa Sesi).
- **Peran**: Siapa saja.
- **Konsumsi Klien**: PWA Mobile & Web (`public/js/auth-page.js`).
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "divisions": [{ "id": 1, "name": "Head Office" }, { "id": 2, "name": "Operasional" }],
    "positions": [{ "id": 1, "name": "Housekeeping" }, { "id": 2, "name": "Staff IT" }]
  }
  ```

### 2.2 `POST /api/auth/register`
- **Deskripsi**: Pendaftaran mandiri akun karyawan baru dengan status awal `pending`.
- **Autentikasi**: Publik (Dibatasi `registerLimiter`: max 20 req/menit).
- **Body Parameter (JSON / Form-Encoded)**:
  - `full_name` (string, required): Nama lengkap karyawan.
  - `email` (string, required): Alamat email unik.
  - `password` (string, required, min 6 char): Kata sandi akun.
  - `division_id` (integer, required): ID Divisi.
  - `position_id` (integer, required): ID Jabatan.
  - `whatsapp` (string, required): Nomor kontak WhatsApp.
  - `address` (string, required): Alamat domisili.
- **Contoh Respons (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Pendaftaran berhasil. Akun Anda menunggu aktivasi dari Super Admin sebelum bisa login."
  }
  ```

### 2.3 `POST /api/auth/login`
- **Deskripsi**: Otentikasi masuk pengguna, verifikasi kata sandi bcrypt, dan inisialisasi sesi Express.
- **Autentikasi**: Publik (Dibatasi `loginLimiter`: max 5 gagal/15 menit per IP + email).
- **Body Parameter**:
  - `email` (string, required): Email terdaftar.
  - `password` (string, required): Kata sandi akun.
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login berhasil.",
    "user": {
      "id": 10,
      "full_name": "Adi Sanjaya",
      "email": "adi@sedayaclick.cloud",
      "role": "employee",
      "status": "active"
    }
  }
  ```

### 2.4 `GET /api/auth/me`
- **Deskripsi**: Memeriksa sesi login aktif saat ini dan mengembalikan profil pengguna.
- **Autentikasi**: Sesi Aktif (`requireAuth`).
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "user": {
      "id": 10,
      "full_name": "Adi Sanjaya",
      "email": "adi@sedayaclick.cloud",
      "role": "employee",
      "division_name": "Operasional",
      "position_name": "Housekeeping"
    }
  }
  ```

### 2.5 `POST /api/auth/logout`
- **Deskripsi**: Menghancurkan sesi pengguna di server dan menghapus cookie `sedayaclick_sid`.
- **Autentikasi**: Sesi Aktif (`requireAuth`).
- **Contoh Respons (200 OK)**:
  ```json
  { "success": true, "message": "Logout berhasil." }
  ```

---

## 3. Modul Absensi & Lembur Karyawan (`routes/attendance.js`)

### 3.1 `GET /api/attendance/today`
- **Deskripsi**: Mengambil status absensi hari ini milik karyawan yang sedang login beserta penentuan shift harian.
- **Autentikasi**: `requireAuth, requireRole('employee'), requireActiveAccount`.
- **Konsumsi Klien**: PWA Mobile (`public/employee/js/employee.js`).
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "attendance": {
      "id": 1039,
      "clock_in_time": "2026-11-23 07:55:00",
      "clock_out_time": null,
      "status": "on_time"
    },
    "is_roster_employee": true,
    "schedule": {
      "shift_code": "VK",
      "shift_name": "Kantor - SSV",
      "start_time": "08:00:00",
      "end_time": "17:00:00",
      "is_day_off": 0,
      "is_roster_employee": true
    }
  }
  ```

### 3.2 `POST /api/attendance/clock-in`
- **Deskripsi**: Melakukan transaksi absensi masuk karyawan.
- **Autentikasi**: `requireAuth, requireRole('employee'), requireActiveAccount`.
- **Content-Type**: `multipart/form-data`.
- **Parameter Body**:
  - `photo` (file image, required): File swafoto WebRTC (maks. 10 MB).
  - `latitude` (numeric string, required): Titik koordinat latitude GPS.
  - `longitude` (numeric string, required): Titik koordinat longitude GPS.
  - `note` (string, optional): Catatan kedatangan.
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Clock In berhasil tercatat pada 07:55:12 WIB.",
    "attendance_id": 1057
  }
  ```

### 3.3 `POST /api/attendance/clock-out`
- **Deskripsi**: Melakukan transaksi absensi pulang karyawan dan memicu kalkulasi durasi kerja serta lembur.
- **Autentikasi**: `requireAuth, requireRole('employee'), requireActiveAccount`.
- **Content-Type**: `multipart/form-data`.
- **Parameter Body**:
  - `photo` (file image, required): Swafoto kepulangan.
  - `latitude` (numeric string, required): Titik GPS.
  - `longitude` (numeric string, required): Titik GPS.
  - `note` (string, optional): Catatan kepulangan.
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Clock Out berhasil. Durasi kerja: 09:05:00. Lembur: 00:05:00."
  }
  ```

### 3.4 `POST /api/attendance/overtime/clock-in`
- **Deskripsi**: Melakukan transaksi masuk lembur mandiri di luar shift reguler.
- **Autentikasi**: `requireAuth, requireRole('employee'), requireActiveAccount`.
- **Parameter**: `photo` (file), `latitude`, `longitude`, `reason` (alasan penugasan), `note`.
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Presensi masuk lembur berhasil dicatat dan menunggu Clock Out lembur."
  }
  ```

### 3.5 `POST /api/attendance/overtime/clock-out`
- **Deskripsi**: Melakukan transaksi keluar lembur mandiri dengan kewajiban melampirkan berkas hasil kerja.
- **Autentikasi**: `requireAuth, requireRole('employee'), requireActiveAccount`.
- **Parameter**: `photo` (file swafoto), `work_attachment` (file hasil kerja, required), `latitude`, `longitude`, `note`.
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Presensi lembur selesai. Menunggu persetujuan Admin Manager."
  }
  ```

### 3.6 `GET /api/attendance/my-roster`
- **Deskripsi**: Mengambil jadwal roster bulanan milik karyawan yang sedang login untuk kalender visual.
- **Query Parameter**: `month` (string YYYY-MM, optional, default: bulan berjalan).
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "month": "2026-11",
    "schedules": [
      { "schedule_date": "2026-11-01", "shift_code": "P", "start_time": "06:00:00", "end_time": "15:00:00", "is_day_off": 0 },
      { "schedule_date": "2026-11-02", "shift_code": "L", "start_time": null, "end_time": null, "is_day_off": 1 }
    ]
  }
  ```

---

## 4. Modul Pengajuan Karyawan (`routes/submissions.js`)

### 4.1 `POST /api/submissions`
- **Deskripsi**: Mengajukan permohonan izin, cuti, sakit, atau lembur.
- **Autentikasi**: `requireAuth, requireRole('employee'), requireActiveAccount`.
- **Content-Type**: `multipart/form-data`.
- **Parameter Body**:
  - `type` (enum: `'izin'`, `'cuti'`, `'sakit'`, `'lembur'`, required)
  - `start_date` (date YYYY-MM-DD, required)
  - `end_date` (date YYYY-MM-DD, required)
  - `start_time` & `end_time` (time HH:mm, required jika type == `'lembur'`)
  - `reason` (string, required): Alasan lengkap.
  - `attachment` (file, optional): Surat dokter / bukti pendukung.
  - `handover_plan`, `handover_to_name`, `handover_to_position` (string, wajib jika type == `'cuti'`).
- **Aturan Validasi**:
  - Ditolak dengan `400 Bad Request` jika tipe `cuti` atau `izin` diajukan < 3 hari dari hari ini (`diffDays < 3`).
- **Contoh Respons (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Pengajuan berhasil dikirim dan menunggu persetujuan Admin Manager.",
    "submission_id": 45
  }
  ```

### 4.2 `GET /api/submissions/mine`
- **Deskripsi**: Mengambil riwayat pengajuan milik karyawan yang sedang login.
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "submissions": [
      {
        "id": 45,
        "type": "cuti",
        "start_date": "2026-12-01",
        "end_date": "2026-12-03",
        "status": "pending",
        "review_note": null
      }
    ]
  }
  ```

---

## 5. Modul Admin Manager & Persetujuan (`routes/admin.js`)

### 5.1 `GET /api/admin/submissions/pending`
- **Deskripsi**: Mengambil antrean pengajuan yang berstatus `pending` atau `under_review`.
- **Autentikasi**: `requireRole('admin_manager', 'super_admin')`.
- **Query Parameter**: `division_id` (optional).
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "submissions": [
      {
        "id": 45,
        "user_id": 10,
        "full_name": "Adi Sanjaya",
        "division_name": "Operasional",
        "type": "cuti",
        "start_date": "2026-12-01",
        "reason": "Acara keluarga",
        "status": "pending"
      }
    ]
  }
  ```

### 5.2 `PATCH /api/admin/submissions/:id/decision`
- **Deskripsi**: Memberikan keputusan persetujuan atas pengajuan.
- **Parameter Path**: `id` (submission ID).
- **Parameter Body**:
  - `decision` (enum: `'approved'`, `'rejected'`, `'under_review'`, required).
  - `review_note` (string, required untuk approved/rejected).
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Pengajuan berhasil disetujui."
  }
  ```

### 5.3 `GET /api/admin/roster/template` & `GET /api/admin/roster/export`
- **Deskripsi**: Mengunduh template formulir roster kosong atau mengekspor matriks roster bulanan ke format Excel `.xlsx`.
- **Query Parameter**: `month` (YYYY-MM), `division_id`.

### 5.4 `POST /api/admin/roster/upload`
- **Deskripsi**: Mengunggah berkas Excel matriks roster bulanan untuk disimpan ke tabel `employee_schedules`.
- **Content-Type**: `multipart/form-data` (`file`).
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Jadwal roster berhasil diproses. 250 entri jadwal berhasil diperbarui."
  }
  ```

---

## 6. Modul Super Admin (`routes/superadmin.js`)

### 6.1 `GET /api/superadmin/dashboard/summary`
- **Deskripsi**: Ringkasan metrik KPI dan data grafik distribusi absensi organisasi.
- **Query Parameter**: `period` (`'daily'`, `'weekly'`, `'monthly'`).
- **Contoh Respons (200 OK)**:
  ```json
  {
    "success": true,
    "period": "daily",
    "metrics": {
      "on_time": 42,
      "late": 3,
      "pending_submissions": 5,
      "total_active_employees": 45,
      "izin": 1,
      "sakit": 0,
      "cuti": 1
    },
    "chart": [
      { "attendance_date": "2026-11-23", "on_time_count": 42, "late_count": 3 }
    ]
  }
  ```

### 6.2 `GET /api/superadmin/users` & `POST /api/superadmin/users`
- **Deskripsi**: Mengambil daftar seluruh pengguna (termasuk kata sandi terdekripsi untuk superadmin) dan pendaftaran user manual.

### 6.3 `PATCH /api/superadmin/users/:id/status`
- **Deskripsi**: Menyetujui pendaftaran mandiri (mengubah status dari `pending` ke `active`).
- **Parameter Body**: `{ "status": "active" }`.

### 6.4 `GET /api/superadmin/shifts` & `POST /api/superadmin/shifts`
- **Deskripsi**: Manajemen master shift kerja (Fixed, Flexible, Roster).

---

## 7. Modul Pelaporan & Ekspor (`routes/reports.js`)

### 7.1 `GET /api/reports/attendance`
- **Deskripsi**: Mengambil tabel rekapitulasi absensi dengan filter multi-dimensi.
- **Query Parameter**: `period` (`'today'`, `'weekly'`, `'monthly'`, `'custom'`), `start_date`, `end_date`, `division_id`, `name`.

### 7.2 `GET /api/reports/export/csv` & `GET /api/reports/export/excel`
- **Deskripsi**: Mengunduh berkas laporan kehadiran terfilter dalam format `.csv` atau `.xlsx`.

---

## 8. Modul Notifikasi & Berkas Terproteksi

### 8.1 `GET /api/notifications/vapid-public-key`
- **Deskripsi**: Mengambil kunci publik VAPID server untuk inisialisasi push subscription di browser.

### 8.2 `POST /api/notifications/subscribe`
- **Deskripsi**: Mendaftarkan endpoint dan kunci kriptografi perangkat karyawan ke tabel `push_subscriptions`.

### 8.3 `POST /api/notifications/broadcast`
- **Deskripsi**: Mengirim siaran pesan Web Push ke perangkat seluruh karyawan atau divisi tertentu.

### 8.4 `GET /secure-uploads/attendance/:filename` & `/secure-uploads/submissions/:filename`
- **Deskripsi**: Mengunduh / menampilkan file swafoto absensi dan bukti surat dokter secara terproteksi.
- **Otorisasi**: Memeriksa kepemilikan user ID atau peran manajer sebelum menyajikan berkas. Mengembalikan `403 Forbidden` jika pengguna tidak berhak.
