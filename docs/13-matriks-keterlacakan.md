# 13. Matriks Keterlacakan Kebutuhan (Requirements Traceability Matrix / RTM) As-Built

| Metadata | Keterangan |
| :--- | :--- |
| **Sistem** | SedayaClick — Sistem Presensi & Penggajian Karyawan PWA |
| **Versi Dokumen** | 1.0.0 (As-Built) |
| **Tanggal Analisis** | 23 November 2026 |
| **Status Pemetaan** | 100% Terlacak ke Kode Sumber, Database, API, dan Kasus Uji |

---

## Tabel Matriks Keterlacakan Penuh (FR -> Kode -> Database -> Endpoint -> TC)

| ID Kebutuhan (FR) | Deskripsi Ringkas Kebutuhan | Berkas Sumber Implementasi | Tabel Basis Data Terkait | Endpoint REST API | ID Kasus Uji (TC) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-01** | Pendaftaran Mandiri Karyawan Baru | `routes/auth.js:65-98`<br>`public/js/auth-page.js` | `users` | `POST /api/auth/register` | **TC-01**, **TC-02**, **TC-03** |
| **FR-02** | Otentikasi Login & Pembuatan Sesi | `routes/auth.js:108-160`<br>`server.js:76-92` | `users`, `sessions` | `POST /api/auth/login`<br>`GET /api/auth/me` | **TC-04**, **TC-05** |
| **FR-03** | Rate Limiting Anti-Brute Force Login | `routes/auth.js:14-32` | *(In-Memory Store)* | `POST /api/auth/login` | **TC-06** |
| **FR-04** | Presensi Masuk (Clock In) Swafoto & GPS | `routes/attendance.js:127-245`<br>`public/js/camera.js`<br>`public/js/geolocation.js` | `attendances` | `POST /api/attendance/clock-in` | **TC-07**, **TC-08**, **TC-09**, **TC-11**, **TC-12** |
| **FR-05** | Pembatasan Maksimal 1 Clock In / Hari | `routes/attendance.js:150-152` | `attendances` (`uniq_user_date`) | `POST /api/attendance/clock-in` | **TC-10** |
| **FR-06** | Presensi Pulang & Kalkulasi Durasi | `routes/attendance.js:247-310`<br>`utils/timeCalc.js` | `attendances` | `POST /api/attendance/clock-out` | **TC-14**, **TC-15** |
| **FR-07** | Presensi Masuk & Keluar Lembur Mandiri | `routes/attendance.js:312-460` | `attendances` | `POST /api/attendance/overtime/clock-in`<br>`POST /api/attendance/overtime/clock-out` | **TC-16**, **TC-17**, **TC-18** |
| **FR-08** | Resolusi Roster & Shift Khusus Harian | `routes/attendance.js:45-74`<br>`utils/rosterHelper.js` | `employee_schedules`, `shift_settings` | `GET /api/attendance/today`<br>`GET /api/attendance/my-roster` | **TC-13**, **TC-27** |
| **FR-09** | Formulir Pengajuan Izin/Cuti/Sakit | `routes/submissions.js:16-85` | `submissions` | `POST /api/submissions`<br>`GET /api/submissions/mine` | **TC-19**, **TC-21**, **TC-23** |
| **FR-10** | Validasi H-3 Pengajuan Cuti & Izin | `routes/submissions.js:46-59` | `submissions` | `POST /api/submissions` | **TC-20** |
| **FR-11** | Kewajiban Rencana Serah Terima Cuti | `routes/submissions.js:63-65` | `submissions` | `POST /api/submissions` | **TC-22** |
| **FR-12** | Keputusan Approval Pengajuan Manajer | `routes/admin.js:128-167` | `submissions` | `GET /api/admin/submissions/pending`<br>`PATCH /api/admin/submissions/:id/decision` | **TC-24**, **TC-25**, **TC-26** |
| **FR-13** | Impor & Ekspor Matriks Roster Excel | `routes/admin.js:390-550`<br>`utils/rosterHelper.js` | `employee_schedules`, `shift_settings` | `GET /api/admin/roster/template`<br>`POST /api/admin/roster/upload`<br>`GET /api/admin/roster/export` | **TC-27**, **TC-28** |
| **FR-14** | Manajemen Pengguna & Intip Password | `routes/superadmin.js:150-315`<br>`utils/crypto.js` | `users`, `attendances`, `submissions` | `GET /api/superadmin/users`<br>`POST /api/superadmin/users`<br>`PATCH /api/superadmin/users/:id/status` | **TC-01**, **TC-04** |
| **FR-15** | Master Divisi, Jabatan, dan Shift | `routes/superadmin.js:322-448` | `divisions`, `positions`, `shift_settings` | `GET/POST /api/superadmin/divisions`<br>`GET/POST /api/superadmin/positions`<br>`GET/POST /api/superadmin/shifts` | *(Admin Functional)* |
| **FR-16** | Dashboard KPI & Grafik Kehadiran | `routes/superadmin.js:21-101`<br>`public/superadmin/js/superadmin.js` | `attendances`, `submissions`, `users` | `GET /api/superadmin/dashboard/summary` | *(Analytics Functional)* |
| **FR-17** | Ekspor Laporan Absensi & Payroll | `routes/reports.js:63-125`<br>`utils/exportGenerator.js` | `attendances`, `users`, `divisions` | `GET /api/reports/attendance`<br>`GET /api/reports/export/excel`<br>`GET /api/reports/export/csv` | *(Reporting Functional)* |
| **FR-18** | Pengingat Absensi H-15 Menit (Push) | `utils/attendanceReminder.js`<br>`config/webpush.js` | `push_subscriptions`, `employee_schedules` | *(Background Cron Scheduler)* | *(Daemon Testing)* |
| **FR-19** | Broadcast Web Push Notification | `routes/notifications.js:125-225`<br>`public/sw.js` | `broadcast_notifications`, `push_subscriptions` | `POST /api/notifications/broadcast` | *(Push Notification)* |
| **FR-20** | Notifikasi Email Antrean Pengajuan | `utils/mailer.js`<br>`routes/admin.js:988` | `submissions`, `attendances` | `POST /api/admin/notifications/remind-manager` | *(SMTP Gateway)* |
| **FR-21** | Maintenance Remote Server via Telegram | `services/telegramBot.js` | `attendances`, `users`, File System | *(Telegram Long-Polling Bot)* | *(DevOps Operational)* |
| **NFR-04**| Proteksi Akses Berkas Swafoto & Dokumen| `routes/secureUploads.js:18-100` | `attendances`, `submissions` | `GET /secure-uploads/attendance/:file`<br>`GET /secure-uploads/submissions/:file` | **TC-29**, **TC-30**, **TC-31** |
