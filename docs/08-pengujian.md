# 08. Rencana dan Katalog Pengujian Sistem As-Built

| Metadata | Keterangan |
| :--- | :--- |
| **Sistem** | SedayaClick — Sistem Presensi & Penggajian Karyawan PWA |
| **Metode Evaluasi** | Rekayasa Balik Black-Box Testing & Code Path Analysis |
| **Versi Dokumen** | 1.0.0 (As-Built) |
| **Tanggal Analisis** | 23 November 2026 |
| **Sumber Analisis** | Kode implementasi `routes/*.js`, `utils/*.js`, dan `docs/BLACK-BOX-TESTING.md` |

---

## 1. Inventaris Pengujian yang Ada & Kesenjangan Pengujian

### 1.1 Kondisi As-Built Pengujian di Repositori
- **Pengujian Otomatis (*Automated Unit / Integration / E2E Tests*)**: `[TIDAK DITEMUKAN]`
  Tidak ditemukan pustaka pengujian otomatis (seperti Jest, Mocha, Supertest, Cypress, Playwright) dalam berkas `package.json`. Tidak ada folder `test/` atau `__tests__/` di repositori.
- **Pengujian Manual Terverifikasi**:
  Ditemukan dokumen rekam jejak pengujian fungsional manual berbasis skenario pengguna pada [TERVERIFIKASI: docs/BLACK-BOX-TESTING.md].
- **Skrip Verifikasi Parsial**:
  Terdapat berkas pengujian lokal sederhana [TERVERIFIKASI: scratch/test_sync.js] untuk memverifikasi query database dan format waktu.

### 1.2 Analisis Kesenjangan Pengujian (*Test Gap Analysis*)

| Area Fungsional | Cakupan Saat Ini | Kesenjangan Pengujian (Gap) | Risiko Operasional |
| :--- | :---: | :--- | :---: |
| **Kalkulasi Waktu Matematis (`timeCalc.js`)** | Manual | Tidak ada unit test untuk skenario batas (misal: lembur lintas hari tengah malam, pergantian timezone, toleransi 0 menit). | **Tinggi** (Berisiko salah hitung lembur payroll) |
| **Parser Matriks Excel Roster (`rosterHelper.js`)** | Manual | Tidak ada automated test untuk variasi format sel Excel (huruf kecil/besar, spasi berlebih, format tanggal teks vs number). | **Tinggi** (Import roster gagal saat hari H) |
| **Autentikasi & RBAC Middleware** | Manual | Tidak ada integration test otomatis untuk memastikan endpoint tertutup rapat jika ada rute baru. | **Kritis** (Potensi kebocoran data jika ada rute tanpa guard) |
| **Ketahanan Jaringan PWA (Offline/Re-sync)** | Manual | Tidak ada pengujian simulasi network throttle (2G/3G lambat atau koneksi terputus saat upload swafoto). | **Sedang** (UI freeze atau gantung pada sinyal buruk) |

---

## 2. Katalog Kasus Uji As-Built (Test Cases / TC-xx)

Katalog kasus uji diturunkan secara komprehensif dari Aturan Bisnis (**BR-xx**) dan Use Case (**UC-xx**):

### 2.1 Modul Autentikasi & Akun

| ID TC | Deskripsi Kasus Uji | Skenario Uji | Input Data / Kondisi | Ekspektasi Hasil Uji | Rujukan BR / UC |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **TC-01** | Registrasi Karyawan Berhasil | Positif | Form lengkap, email baru, password >= 6 karakter | HTTP 201, baris tersimpan di `users` dengan `status = 'pending'` | BR-01, UC-01 |
| **TC-02** | Registrasi Email Duplikat Ditolak | Negatif | Menggunakan email yang sudah ada di database | HTTP 409 Conflict, pesan: "Email sudah terdaftar." | FR-01, UC-01 |
| **TC-03** | Registrasi Password Pendek Ditolak | Batas | Password < 6 karakter (misal: `12345`) | HTTP 400 Bad Request, pesan: "Password minimal 6 karakter." | FR-01, UC-01 |
| **TC-04** | Login Akun Pending Ditolak | Negatif | Kredensial benar, namun `status = 'pending'` | HTTP 403 Forbidden, pesan: "Akun belum aktif. Hubungi Super Admin." | BR-11, UC-02 |
| **TC-05** | Login Kredensial Valid Sukses | Positif | Email terdaftar dan password benar (`status = 'active'`) | HTTP 200 OK, cookie `sedayaclick_sid` dibuat, redirect ke dashboard | FR-02, UC-02 |
| **TC-06** | Rate Limiter Percobaan Login Gagal | Batas | Percobaan login salah 5 kali berturut-turut dalam 15 menit | Percobaan ke-6 ditolak HTTP 429 Too Many Requests | FR-03, SEC-01 |

### 2.2 Modul Presensi Masuk & Pulang (Attendance)

| ID TC | Deskripsi Kasus Uji | Skenario Uji | Input Data / Kondisi | Ekspektasi Hasil Uji | Rujukan BR / UC |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **TC-07** | Clock In Tepat Waktu (Shift Reguler) | Positif | Datang jam 07:55 WIB (Shift masuk 08:00, toleransi 15 mnt), swafoto valid, GPS valid | HTTP 200 OK, `status = 'on_time'`, `late_duration_seconds = 0` | BR-02, BR-03 |
| **TC-08** | Clock In Batas Toleransi | Batas | Datang tepat jam 08:15:00 WIB (Toleransi 15 menit) | HTTP 200 OK, `status = 'on_time'`, `late_duration_seconds = 0` | BR-03, TC-07 |
| **TC-09** | Clock In Terlambat | Batas | Datang jam 08:16:00 WIB (> toleransi 15 menit) | HTTP 200 OK, `status = 'late'`, `late_duration_seconds = 60` (1 menit) | BR-03, BR-06 |
| **TC-10** | Clock In Duplikat Hari yang Sama Ditolak | Negatif | Melakukan Clock In kedua kali pada tanggal yang sama | HTTP 409 Conflict: "Anda sudah melakukan Clock In hari ini." | BR-01, FR-05 |
| **TC-11** | Clock In Tanpa Swafoto Ditolak | Negatif | Mengirim request multipart tanpa melampirkan file foto | HTTP 400 Bad Request: "Foto Clock In wajib diambil." | BR-02, FR-04 |
| **TC-12** | Clock In Tanpa Koordinat GPS Ditolak | Negatif | Lokasi GPS dinonaktifkan di browser (`lat/lng = null`) | HTTP 400 Bad Request: "Lokasi GPS wajib aktif dan terkunci." | BR-02, FR-04 |
| **TC-13** | Clock In Shift Siang Roster Kedatangan Awal | Positif | Karyawan roster shift siang (13:00 - 22:00) masuk jam 11:30 WIB | HTTP 200 OK, sistem mendeteksi shift siang, `status = 'on_time'` (tidak terlambat) | BR-04, FR-08 |
| **TC-14** | Clock Out & Perhitungan Durasi Kerja | Positif | Clock Out jam 17:05 WIB (Masuk 08:00 WIB) | HTTP 200 OK, `work_duration_seconds = 32700` (9 jam 5 menit), `overtime_seconds = 300` | BR-06, FR-06 |
| **TC-15** | Clock Out Sebelum Clock In Ditolak | Negatif | Mengirim request Clock Out saat belum ada transaksi Clock In | HTTP 400 Bad Request: "Anda belum melakukan Clock In hari ini." | BR-01, FR-06 |

### 2.3 Modul Presensi Lembur Mandiri (Direct Overtime)

| ID TC | Deskripsi Kasus Uji | Skenario Uji | Input Data / Kondisi | Ekspektasi Hasil Uji | Rujukan BR / UC |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **TC-16** | Clock In Lembur Mandiri Sukses | Positif | Mengirim foto swafoto, titik GPS, dan uraian tugas lembur | HTTP 200 OK, `overtime_status = 'pending'`, waktu masuk lembur tercatat | BR-07, FR-07 |
| **TC-17** | Clock Out Lembur Tanpa Bukti Kerja Ditolak | Negatif | Clock Out lembur tanpa menyertakan `work_attachment` | HTTP 400 Bad Request: "Lampiran bukti hasil pekerjaan lembur wajib diunggah." | BR-07, FR-07 |
| **TC-18** | Clock Out Lembur dengan Bukti Sukses | Positif | Melampirkan foto hasil kerja, swafoto, dan GPS | HTTP 200 OK, durasi lembur dihitung otomatis, menunggu persetujuan manajer | BR-07, FR-07 |

### 2.4 Modul Pengajuan Izin, Cuti, dan Sakit (Submissions)

| ID TC | Deskripsi Kasus Uji | Skenario Uji | Input Data / Kondisi | Ekspektasi Hasil Uji | Rujukan BR / UC |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **TC-19** | Pengajuan Cuti Memenuhi Syarat H-3 | Positif | Diajukan H-5 sebelum tanggal mulai, menyertakan rencana serah terima lengkap | HTTP 201 Created, pengajuan masuk ke antrean pending | BR-08, BR-10 |
| **TC-20** | Pengajuan Cuti Mendadak (< H-3) Ditolak | Batas | Mengajukan cuti untuk lusa (selisih 2 hari kalender) | HTTP 400 Bad Request: "Wajib diajukan minimal H-3 sebelum tanggal pelaksanaan." | BR-08, FR-10 |
| **TC-21** | Pengajuan Sakit Hari-H Diterima | Positif | Mengajukan sakit pada hari H dengan lampiran surat dokter | HTTP 201 Created (dikecualikan dari aturan H-3) | BR-09, FR-09 |
| **TC-22** | Pengajuan Cuti Tanpa Serah Terima Ditolak | Negatif | Mengajukan cuti dengan mengosongkan `handover_plan` | Formulir dicegah submit di UI / ditolak validasi bisnis | BR-10, FR-11 |
| **TC-23** | Tanggal Selesai Sebelum Tanggal Mulai Ditolak | Negatif | `start_date = 2026-12-05`, `end_date = 2026-12-02` | HTTP 400 Bad Request: "Tanggal selesai tidak boleh sebelum tanggal mulai." | FR-09, UC-06 |

### 2.5 Modul Persetujuan & Roster (Admin Manager)

| ID TC | Deskripsi Kasus Uji | Skenario Uji | Input Data / Kondisi | Ekspektasi Hasil Uji | Rujukan BR / UC |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **TC-24** | Persetujuan Pengajuan Disetujui | Positif | Keputusan `approved` dengan catatan: "Disetujui" | HTTP 200 OK, `status = 'approved'`, `reviewed_by` dan timestamp tercatat | BR-11, FR-12 |
| **TC-25** | Penolakan Pengajuan Tanpa Alasan Ditolak | Negatif | Keputusan `rejected` tetapi `review_note` kosong | HTTP 400 Bad Request: "Catatan alasan wajib diisi." | BR-11, FR-12 |
| **TC-26** | Penandaan Pengajuan `under_review` | Positif | Keputusan `under_review` untuk menunggu klarifikasi karyawan | HTTP 200 OK, `status = 'under_review'`, pengajuan tetap di antrean | BR-11, FR-12 |
| **TC-27** | Impor File Excel Roster Valid | Positif | Mengunggah matriks Excel sesuai template resmi | HTTP 200 OK, tabel `employee_schedules` terisi sesuai kode shift | BR-04, FR-13 |
| **TC-28** | Impor File Format Non-Excel Ditolak | Negatif | Mengunggah file berekstensi `.pdf` atau `.txt` | HTTP 400 Bad Request / Multer file format rejection | NFR-05, FR-13 |

### 2.6 Modul Keamanan Berkas Terproteksi (Secure Uploads)

| ID TC | Deskripsi Kasus Uji | Skenario Uji | Input Data / Kondisi | Ekspektasi Hasil Uji | Rujukan BR / UC |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **TC-29** | Akses Foto Absensi Milik Sendiri Diizinkan | Positif | Karyawan login mengakses URL `/secure-uploads/attendance/foto-milik-sendiri.jpg` | HTTP 200 OK, file citra dikirimkan | NFR-04, SEC-04 |
| **TC-30** | Akses Foto Absensi Karyawan Lain Ditolak | Negatif | Karyawan A login mengakses URL `/secure-uploads/attendance/foto-milik-karyawan-B.jpg` | HTTP 403 Forbidden: "Anda tidak memiliki akses ke berkas ini." (atau fallback default photo) | NFR-04, SEC-04 |
| **TC-31** | Akses Berkas Oleh Admin Manager Diizinkan | Positif | Admin Manager mengakses foto absensi karyawan divisi manapun | HTTP 200 OK, akses diberikan secara penuh | NFR-04, RBAC |

---

## 3. Daftar Periksa UAT (User Acceptance Testing Checklist)

Berikut adalah daftar periksa pengujian penerimaan pengguna (*User Acceptance Test*) yang wajib diverifikasi bersama perwakilan operasional dan HRD sebelum rilis major:

- [ ] **Alur Karyawan Baru**: Karyawan dapat mendaftar mandiri, muncul di tabel verifikasi Super Admin, dan dapat login setelah diaktifkan.
- [ ] **Presensi Lapangan PWA**: Kamera membuka langsung tanpa dialog izin berulang di PWA Android/iOS, GPS mengunci akurat, dan tombol Clock In berhasil mencatat data.
- [ ] **Karyawan Reguler vs Roster**: Dashboard akun reguler (seperti Adi Sanjaya) bersih tanpa banner roster; akun shift khusus (seperti tim Casa Nawasena/SSV) menampilkan kode shift dan tombol kalender.
- [ ] **Validasi H-3 Izin & Cuti**: Pengajuan cuti h-1 ditolak sistem dengan pesan informatif; pengajuan cuti h-4 diterima dan mewajibkan serah terima pekerjaan.
- [ ] **Presensi Lembur Mandiri**: Karyawan lembur dapat mengunggah bukti pekerjaan dan data langsung tampil di tab persetujuan lembur Admin Manager.
- [ ] **Persetujuan Manajer Real-Time**: Admin Manager dapat menyetujui pengajuan, dan status langsung berubah di layar karyawan tanpa reload manual.
- [ ] **Ekspor Laporan Payroll**: Super Admin dapat mengunduh berkas Excel `.xlsx` dan memeriksa kesesuaian total durasi jam kerja, keterlambatan, dan lembur.

---

## 4. Rekomendasi Strategi Pengujian Otomatis Masa Depan

Berdasarkan analisis kesenjangan, direkomendasikan rencana adopsi automated test berjenjang:
1. **Fase 1 (Unit Testing Pure Logic)**:
   - Pasang framework `jest`.
   - Buat unit test untuk modul kalkulasi waktu [TERVERIFIKASI: utils/timeCalc.js] dan helper roster [TERVERIFIKASI: utils/rosterHelper.js] untuk menguji 100% jalur logika matematis dan skenario pergantian tanggal.
2. **Fase 2 (API Integration Testing)**:
   - Pasang pustaka `supertest`.
   - Buat skrip automated test pada endpoint kritis (`/api/auth/login`, `/api/attendance/clock-in`, `/api/submissions`) dengan database pengujian terisolasi (MySQL Docker test instance) untuk mencegah regresi hak akses RBAC.
3. **Fase 3 (End-to-End PWA Testing)**:
   - Pasang framework `playwright` untuk menguji simulasi navigasi PWA browser seluler (mocking kamera dan geolocation GPS).
