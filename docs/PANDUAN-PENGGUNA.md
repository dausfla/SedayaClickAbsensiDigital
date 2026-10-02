# Panduan Pengguna (User Manual) — SedayaClick
> **Sistem Absensi & Penggajian Digital Berbasis PWA**

---

## 📋 Daftar Isi

1. [Pendahuluan & Akses Aplikasi](#1-pendahuluan--akses-aplikasi)
2. [Cara Install Aplikasi (PWA)](#2-cara-install-aplikasi-pwa)
3. [Panduan untuk Karyawan (Employee)](#3-panduan-untuk-karyawan-employee)
   - [3.1. Pendaftaran Mandiri & Login](#31-pendaftaran-mandiri--login)
   - [3.2. Absensi Masuk (Clock In)](#32-absensi-masuk-clock-in)
   - [3.3. Absensi Pulang (Clock Out)](#33-absensi-pulang-clock-out)
   - [3.4. Mengajukan Izin / Cuti / Sakit](#34-mengajukan-izin--cuti--sakit)
   - [3.5. Melihat Status Pengajuan](#35-melihat-status-pengajuan)
4. [Panduan untuk Admin Manager](#4-panduan-untuk-admin-manager)
   - [4.1. Monitoring Kehadiran Real-Time](#41-monitoring-kehadiran-real-time)
   - [4.2. Approval / Rejection Pengajuan Tim](#42-approval--rejection-pengajuan-tim)
   - [4.3. Membuat / Mengedit / Menghapus Pengajuan](#43-membuat--mengedit--menghapus-pengajuan)
5. [Panduan untuk Super Admin](#5-panduan-untuk-super-admin)
   - [5.1. Dashboard KPI & Statistik Kehadiran](#51-dashboard-kpi--statistik-kehadiran)
   - [5.2. Manajemen User & Aktivasi Akun Barunya](#52-manajemen-user--aktivasi-akun-barunya)
   - [5.3. Manajemen Master Data (Divisi, Jabatan, Shift)](#53-manajemen-master-data-divisi-jabatan-shift)
   - [5.4. Laporan Kehadiran & Penggajian](#54-laporan-kehadiran--penggajian)
   - [5.5. Ekspor Data (Excel & CSV)](#55-ekspor-data-excel--csv)
6. [Tanya Jawab & Penyelesaian Masalah (FAQ & Troubleshooting)](#6-tanya-jawab--penyelesaian-masalah-faq--troubleshooting)

---

## 1. Pendahuluan & Akses Aplikasi

**SedayaClick** adalah aplikasi sistem absensi dan manajemen kehadiran digital berbasis *Progressive Web App (PWA)*. Aplikasi ini dapat diakses langsung dari web browser perangkat smartphone (Android / iOS) maupun komputer (Desktop / Laptop).

* **URL Akses:** `http://localhost:3000` *(atau URL server domain yang ditentukan oleh perusahaan)*
* **Perangkat yang Didukung:** Android, iOS, Windows, macOS, Linux.
* **Persyaratan Utama Perangkat:**
  1. Memiliki **Kamera Web / Kamera HP** aktif.
  2. Memiliki **GPS / Layanan Lokasi** yang diaktifkan di browser.
  3. Koneksi internet stabil.

---

## 2. Cara Install Aplikasi (PWA)

SedayaClick dapat di-install layaknya aplikasi native tanpa perlu mengunduh dari Play Store atau App Store.

### 📱 Pada Smartphone (Android / Chrome)
1. Buka browser **Google Chrome** dan masuk ke alamat website SedayaClick.
2. Pada halaman login, klik tombol **"Install SedayaClick ke Perangkat Ini"** (atau tekan titik tiga di pojok kanan atas browser).
3. Pilih **"Tambah ke Layar Utama" / "Install App"**.
4. Ikon **SedayaClick** akan muncul di layar utama smartphone Anda.

### 🍎 Pada iPhone (iOS / Safari)
1. Buka browser **Safari** dan masuk ke alamat website SedayaClick.
2. Tekan tombol **Share** (ikon persegi dengan panah ke atas) di bagian bawah browser.
3. Gulir ke bawah dan pilih **"Add to Home Screen" (Tambah ke Layar Utama)**.
4. Tekan **"Add"** di pojok kanan atas.

### 💻 Pada Komputer / Desktop (Chrome / Edge)
1. Buka browser **Google Chrome** atau **Microsoft Edge**.
2. Klik ikon instalasi aplikasi di sebelah kanan address bar browser.
3. Klik **"Install"**. Aplikasi akan terbuka dalam jendela tersendiri tanpa address bar.

---

## 3. Panduan untuk Karyawan (Employee)

### 3.1. Pendaftaran Mandiri & Login
1. **Pendaftaran Akun Baru:**
   - Di halaman utama, klik tab **"Daftar Mandiri"**.
   - Isi NIK, Nama Lengkap, Email, Password, Pilih Divisi & Jabatan.
   - Klik **"Daftar Sekarang"**.
   - *Catatan:* Akun baru memerlukan **aktivasi oleh Super Admin** sebelum dapat digunakan untuk login.
2. **Login:**
   - Masukkan Email dan Password Anda.
   - Klik **"Masuk"**. Sistem akan secara otomatis mengarahkan ke Dashboard Karyawan.

### 3.2. Absensi Masuk (Clock In)
1. Masuk ke halaman **Dashboard Karyawan**.
2. Pastikan browser sudah diberikan izin (*Allow*) untuk meng-akses **Kamera** dan **GPS Lokasi**.
3. Di panel **Absensi Masuk**:
   - Wajah Anda akan terlihat di jendela pratinjau kamera.
   - Lokasi GPS (Koordinat Lintang & Bujur) akan terdeteksi otomatis.
4. Klik tombol **"Clock In Masuk"**.
5. Sistem akan menyimpan foto presensi, waktu jam masuk, koordinat lokasi, dan menghitung keterlambatan (jika ada).
6. *Perhatian:* Presensi masuk hanya dapat dilakukan **1 kali per hari**.

### 3.3. Absensi Pulang (Clock Out)
1. Buka kembali dashboard menjelang / setelah jam kerja selesai.
2. Di panel **Absensi Pulang**:
   - Pastikan pratinjau kamera & GPS aktif.
   - Isi **Keterangan / Laporan Pekerjaan Hari Ini** di kolom teks yang disediakan (wajib diisi).
3. Klik tombol **"Clock Out Pulang"**.
4. Sistem akan merekam jam pulang, kalkulasi total durasi jam kerja, serta kalkulasi jam lembur (jika melebihi batas jam kerja shift).

### 3.3.1. Lembur (Overtime)

1. **Perhitungan Otomatis** – Lembur dihitung otomatis bila jam pulang melebihi jam selesai shift yang didefinisikan pada master data *Shift*.
2. **Format Durasi** – Durasi lembur disimpan dalam detik dan ditampilkan pada UI dalam format `HH:mm:ss`.
3. **Laporan & Ekspor** – Lembur termasuk dalam laporan rekap serta dapat diekspor ke CSV/Excel bersama data kehadiran.
4. **Batas Lembur** – Jika lembur melebihi 8 jam dalam satu hari, sistem menandai sebagai **Lembur Ekstra** dan memerlukan persetujuan admin melalui modul pengajuan.

### 3.4. Mengajukan Izin / Cuti / Sakit
Jika Anda berhalangan hadir atau memerlukan cuti:
1. Gulir ke bagian **Form Pengajuan (Izin / Cuti / Sakit)**.
2. Pilih **Jenis Pengajuan**:
   - `Izin` (misal: keperluan mendesak/keluarga)
   - `Cuti` (misal: cuti tahunan)
   - `Sakit` (misal: kondisi kurang sehat)
3. Tentukan **Tanggal Mulai** dan **Tanggal Selesai**.
4. Isi **Alasan Pengajuan** secara jelas.
5. Unggah **Lampiran File** (PDF / JPG / PNG), misalnya surat keterangan dokter untuk pengajuan Sakit (opsional/sesuai regulasi).
6. Klik **"Kirim Pengajuan"**.

### 3.5. Melihat Status Pengajuan
* Pada bagian **Riwayat Pengajuan Saya**, Anda dapat memantau status setiap formulir pengajuan:
  - 🟡 **Pending:** Sedang menunggu verifikasi dari Admin Manager / Super Admin.
  - 🟢 **Approved:** Pengajuan disetujui.
  - 🔴 **Rejected:** Pengajuan ditolak (dapat melihat alasan penolakan jika dicantumkan oleh atasan).

---

## 4. Panduan untuk Admin Manager

Admin Manager bertanggung jawab untuk memantau kehadiran anggota tim dan memproses pengajuan izin/cuti/sakit.

### 4.1. Monitoring Kehadiran Real-Time
1. Login dengan akun bertipe **Admin Manager**.
2. Anda akan disajikan tabel **Monitoring Kehadiran Anggota Tim**.
3. Sistem secara otomatis memperbarui data (*polling*) setiap 10 detik tanpa perlu merefresh halaman.
4. Anda dapat melihat siapa saja karyawan yang:
   - Sudah Clock In (termasuk status Tepat Waktu atau Terlambat).
   - Sudah Clock Out beserta durasi kerja dan lembur.
   - Belum melakukan presensi.

### 4.2. Approval / Rejection Pengajuan Tim
1. Pilih menu / tab **Verifikasi Pengajuan**.
2. Cari pengajuan yang berstatus **Pending**.
3. Klik tombol **"Approve"** (Setujui) atau **"Reject"** (Tolak).
4. Jika menolak pengajuan, masukkan **Alasan Penolakan** pada pop-up modal yang muncul, lalu tekan simpan.

### 4.3. Membuat / Mengedit / Menghapus Pengajuan
* **Tambah Pengajuan:** Admin Manager dapat membantu menginputkan izin/cuti untuk karyawan yang berhalangan menginput sendiri.
* **Edit & Hapus:** Gunakan tombol opsi pada tabel pengajuan jika terdapat kekeliruan data pengajuan.

---

## 5. Panduan untuk Super Admin

Super Admin memiliki kendali penuh atas konfigurasi sistem, data master, manajemen user, serta laporan penggajian.

### 5.1. Dashboard KPI & Statistik Kehadiran
* **Kartu Ringkasan KPI:** Menampilkan total karyawan aktif, jumlah hadir tepat waktu hari ini, jumlah terlambat, dan pengajuan pending.
* **Grafik Tren Kehadiran:** Menampilkan visualisasi batang untuk kehadiran harian, mingguan, atau bulanan.

### 5.2. Manajemen User & Aktivasi Akun Barunya
1. Buka menu **Manajemen User**.
2. **Aktivasi Akun Baru (Pendaftaran Mandiri):**
   - Cari karyawan yang mendaftar mandiri dengan status *Non-Aktif / Pending*.
   - Klik **"Aktivasi"** agar karyawan tersebut bisa login dan presensi.
3. **Tambah Karyawan Baru:** Klik tombol **"+ Tambah User Baru"**, isi form profil, role (`employee`, `admin_manager`, `super_admin`), serta assign ke divisi & jabatan.
4. **Edit / Reset Password / Hapus User:** Gunakan aksi pada baris tabel user terkait.

### 5.3. Manajemen Master Data (Divisi, Jabatan, Shift)
* **Divisi:** Menambah/mengubah unit kerja (contoh: IT, HRD, Finance, Operasional).
* **Jabatan:** Menambah/mengubah jenjang jabatan (contoh: Staff, Lead, Manager).
* **Shift Kerja:**
  - Atur **Jam Masuk** dan **Jam Pulang** default.
  - Atur **Toleransi Terlambat (dalam menit)** — karyawan yang clock in setelah jam masuk + toleransi akan ditandai terlambat.

### 5.4. Laporan Kehadiran & Penggajian
1. Buka menu **Pelaporan & Rekap**.
2. Gunakan Filter yang fleksibel:
   - **Periode:** Hari ini, Mingguan, Bulanan, atau Rentang Tanggal Custom.
   - **Divisi:** Semua Divisi atau Divisi tertentu.
3. Tabel akan menyajikan rekap lengkap: Total Hadir, Total Terlambat, Total Jam Kerja, Total Jam Lembur, dan Total Izin/Cuti/Sakit.

### 5.5. Ekspor Data (Excel & CSV)
1. Setelah mengatur filter laporan yang diinginkan:
2. Klik tombol **"Ekspor Excel (.xlsx)"** atau **"Ekspor CSV (.csv)"**.
3. File laporan akan otomatis terunduh dengan format durasi `HH:mm:ss` yang presisi.

---

## 6. Tanya Jawab & Penyelesaian Masalah (FAQ & Troubleshooting)

### ❓ Q1: Mengapa Kamera / Video Pratinjau Tidak Muncul?
* **Penyebab:** Browser belum diizinkan mengakses kamera, atau kamera sedang digunakan aplikasi lain.
* **Solusi:**
  1. Klik ikon kunci gembok / ikon setelan di sebelah kiri URL browser (`http://...`).
  2. Pastikan pilihan **Camera** dalam posisi **Allow (Izinkan)**.
  3. Refresh halaman web.
  4. Tutup aplikasi lain (seperti Zoom, Google Meet, WhatsApp Web) yang mungkin sedang menggunakan kamera.

### ❓ Q2: Mengapa GPS / Lokasi Tidak Terdeteksi atau Error?
* **Penyebab:** Fitur Lokasi/GPS di smartphone belum aktif, atau browser tidak diizinkan membaca lokasi.
* **Solusi:**
  1. Pastikan **Location / GPS** smartphone dalam keadaan ON.
  2. Buka izin situs browser -> setel **Location** menjadi **Allow**.
  3. Jika mengakses lewat LAN / IP lokal, pastikan koneksi dalam jaringan lokal yang sama atau menggunakan konteks aman (`localhost` / `HTTPS`).

### ❓ Q3: Mengapa Setelah Mendaftar Mandiri Akun Tidak Bisa Login?
* **Penyebab:** Akun yang didaftarkan secara mandiri memerlukan persetujuan/aktivasi awal dari Super Admin untuk keamanan organisasi.
* **Solusi:** Hubungi HRD / Super Admin untuk mengaktifkan akun Anda melalui menu *Manajemen User*.

### ❓ Q4: Bagaimana Jika Lupa Password?
* **Solusi:** Hubungi Super Admin atau Admin Manager untuk melakukan **Reset Password** pada profil akun Anda.

---

> *Dokumen ini dibuat untuk memudahkan seluruh pengguna dalam mengoperasikan aplikasi SedayaClick secara optimal.*

---

## 7. Lampiran

### 7.1. Daftar Istilah (Glossary)

- **PWA**: Progressive Web App, aplikasi web yang dapat di‑install seperti aplikasi native.
- **Clock In / Clock Out**: Proses mencatat waktu masuk dan keluar kerja.
- **GPS**: Global Positioning System, layanan lokasi geospasial.
- **Shift**: Jadwal kerja dengan jam masuk dan jam keluar yang ditetapkan.
- **Admin Manager**: Peran yang mengelola pengajuan dan memantau kehadiran tim.
- **Super Admin**: Peran dengan kontrol penuh atas seluruh sistem.

### 7.2. Kontak Dukungan Teknis

- **Email**: support@sedayaclick.com
- **WhatsApp**: +62 812‑3456‑7890 (opsional 24/7)
- **Jam Operasional**: Senin–Jumat 09:00‑17:00 WIB

### 7.3. Riwayat Versi (Changelog)

| Versi | Tanggal | Perubahan |
|------|----------|-----------|
| 1.0 | Sep 2026 | Rilis awal sistem Absensi & Penggajian |
| 1.1 | Okt 2026 | Penambahan modul Laporan KPI, perbaikan bug GPS |
| 1.2 | Nov 2026 | Optimalisasi performa halaman Dashboard, penambahan export CSV/Excel |

---

## 8. Ringkasan Penggunaan untuk Semua Aktor

Berikut adalah langkah‑langkah singkat bagi masing‑masing peran untuk mengoperasikan **SedayaClick**.

| Aktor | Langkah Utama |
|------|---------------|
| **Karyawan** | 1. Daftar mandiri → Aktifkan oleh Super Admin.<br>2. Login → Clock In → Clock Out.<br>3. Ajukan Izin/Cuti/Sakit → Lihat status. |
| **Admin Manager** | 1. Login → Monitor kehadiran tim (polling tiap 10 detik).<br>2. Approve/Reject pengajuan.<br>3. Tambah/Edit/Hapus pengajuan jika diperlukan. |
| **Super Admin** | 1. Aktifkan akun baru.<br>2. Kelola master data (Divisi, Jabatan, Shift).<br>3. Lihat dashboard KPI.<br>4. Export laporan CSV/Excel.<br>5. Reset password / hapus user. |

Gunakan **PWA** untuk akses mobile, atau **Desktop** untuk tampilan lebih lebar. Pastikan kamera & GPS di‑izinkan setiap kali melakukan Clock In/Out.

---


