# 11. Panduan Pengguna (User Manual) As-Built

| Metadata | Keterangan |
| :--- | :--- |
| **Sistem** | SedayaClick — Sistem Presensi & Penggajian Karyawan PWA |
| **Target Pengguna** | Karyawan, Admin Manager Divisi, Super Admin HRD |
| **Platform Akses** | Browser Smartphone (PWA Standalone) & Desktop Web |
| **Versi Dokumen** | 1.0.0 (As-Built) |
| **Tanggal Analisis** | 23 November 2026 |
| **Sumber Analisis** | Alur navigasi `public/*.html` dan interaksi `public/*/js/*.js` |

---

## 1. Panduan Pengguna: Peran Karyawan (`employee`)

Karyawan mengakses sistem melalui smartphone menggunakan peramban modern (Google Chrome di Android atau Safari di iOS) pada alamat `https://sedayaclick.cloud`.

### 1.1 Cara Memasang Aplikasi di Layar Utama HP (Install PWA)
Aplikasi SedayaClick berjalan optimal jika diinstal sebagai Progressive Web App (PWA):
1. **Di Android (Google Chrome)**:
   - Buka alamat `https://sedayaclick.cloud`.
   - Ketuk ikon titik tiga di pojok kanan atas, lalu pilih **"Tambahkan ke Layar Utama" (Add to Home screen)** atau **"Instal Aplikasi"**.
   - Ikon SedayaClick akan muncul di menu aplikasi HP Anda dan dapat dibuka layaknya aplikasi native tanpa address bar browser.
2. **Di iPhone / iPad (Safari)**:
   - Buka alamat `https://sedayaclick.cloud` di peramban **Safari** (wajib Safari).
   - Ketuk ikon **Bagikan (Share)** di bagian bawah layar.
   - Gulir ke bawah dan pilih **"Tambahkan ke Layar Utama" (Add to Home Screen)**.
   - Ketuk **Tambah** di pojok kanan atas.

### 1.2 Pendaftaran Akun Baru & Login
1. Buka aplikasi, lalu ketuk tautan **"Daftar Akun Baru"**.
2. Isi formulir pendaftaran: Nama Lengkap, Email Kantor, Kata Sandi (minimal 6 karakter), Divisi, Jabatan, Nomor WhatsApp aktif, dan Alamat Domisili.
3. Ketuk **"Kirim Pendaftaran"**.
4. Akun Anda akan berstatus `Pending`. Hubungi Super Admin / HRD untuk melakukan aktivasi sebelum Anda dapat masuk ke sistem.
5. Setelah diaktifkan, masukkan email dan password pada halaman login, lalu ketuk **"Masuk ke Sistem"**.

### 1.3 Cara Melakukan Absen Masuk (Clock In)
1. Pada tab **Beranda**, perhatikan jam server WIB dan kartu **Status Kehadiran**.
2. Ketuk tombol biru **"ABSEN MASUK (Aktifkan Kamera)"**.
3. Berikan izin saat browser meminta akses **Kamera** dan **Lokasi (GPS)**.
4. Pastikan indikator GPS berubah hijau bertuliskan lokasi terkunci.
5. Posisikan wajah Anda tegak menghadap kamera viewfinder (dapat mengganti kamera depan/belakang via ikon kamera).
6. Tulis catatan jika diperlukan (opsional).
7. Ketuk tombol **"Ambil Foto & Clock In"**.
8. Sistem akan mengonfirmasi presensi masuk berhasil dan menampilkan jam kedatangan Anda.

### 1.4 Cara Melakukan Absen Pulang (Clock Out)
1. Setelah jam kerja Anda berakhir, buka kembali tab **Beranda**.
2. Tombol akan otomatis berubah warna menjadi merah bertuliskan **"ABSEN PULANG (Aktifkan Kamera)"**.
3. Ketuk tombol untuk menyalakan kamera dan mengunci GPS.
4. Tulis catatan ringkas pekerjaan hari ini (opsional).
5. Ketuk **"Ambil Foto & Clock Out"**.
6. Sistem akan menghitung durasi kerja total dan lembur Anda. Badge kehadiran akan berubah menjadi **"Absensi Selesai"**.

### 1.5 Cara Mengajukan Izin, Cuti, Sakit, atau Lembur
1. Ketuk tab **Pengajuan** di bilah navigasi bawah.
2. Ketuk tombol **"Buat Pengajuan Baru"**.
3. Pilih **Jenis Pengajuan**:
   - **Izin / Cuti**: Wajib diajukan minimal **3 hari kalender (H-3)** sebelum tanggal pelaksanaan.
   - **Cuti Tahunan**: Wajib mengisi formulir **Serah Terima Tugas (Handover)** yang mencakup rincian rencana serah terima, nama rekan pengganti, dan jabatannya.
   - **Sakit**: Bebas aturan H-3 (dapat diajukan hari H), namun wajib mengunggah foto surat keterangan dokter.
   - **Lembur**: Wajib mengisi jam mulai dan jam selesai lembur.
4. Ketuk **"Kirim Pengajuan"**. Pantau status pengajuan Anda (*Pending*, *Sedang Ditinjau*, *Disetujui*, atau *Ditolak*) pada daftar riwayat pengajuan.

### 1.6 Cara Presensi Lembur Langsung Mandiri
1. Ketuk tab **Lembur** di bilah navigasi bawah.
2. Saat mulai lembur, ketuk **"Presensi Masuk Lembur"**, ambil swafoto, dan tulis uraian tugas lembur.
3. Saat selesai lembur, ketuk **"Presensi Keluar Lembur"**, ambil swafoto, dan **wajib mengunggah berkas bukti penyelesaian kerja** (foto/dokumen).

### 1.7 Cara Melihat Kalender Roster Sebulan Penuh
*(Khusus bagi karyawan yang mendapatkan penugasan Shift Khusus / Roster seperti unit Casa Nawasena & SSV)*:
1. Pada tab Beranda, perhatikan banner jadwal shift hari ini (P, S, VK, VW, VH, R, atau Libur/OFF).
2. Ketuk tombol **"Lihat Jadwal Roster Sebulan Penuh"** atau buka kartu **"Jadwal Roster & Shift Kerja"**.
3. Pop-up kalender bulanan akan terbuka menampilkan kode shift dan tanggal libur rolling Anda selama satu bulan penuh.

---

## 2. Panduan Pengguna: Peran Admin Manager (`admin_manager`)

Admin Manager mengelola persetujuan perizinan tim dan jadwal operasional divisi melalui alamat `/admin/dashboard.html`.

### 2.1 Meninjau dan Memutuskan Pengajuan Tim
1. Masuk ke dashboard Admin Manager.
2. Gunakan dropdown **Filter Divisi** di bagian atas jika ingin memfokuskan tampilan pada divisi tertentu.
3. Pada tab **Antrean Pengajuan Pending**, periksa nama karyawan, jenis pengajuan, tanggal, alasan, dan lampiran bukti surat dokter (jika sakit).
4. Klik tombol aksi pada baris pengajuan:
   - **Setujui (Approve)**: Masukkan catatan persetujuan (opsional).
   - **Tolak (Reject)**: Masukkan alasan penolakan (wajib diisi agar karyawan mengetahui penyebabnya).
   - **Tinjau (Under Review)**: Klik jika permohonan membutuhkan koordinasi internal lebih lanjut sebelum diputuskan.

### 2.2 Meninjau Presensi Lembur Mandiri
1. Buka tab **Presensi Lembur Langsung**.
2. Periksa jam mulai, jam selesai, durasi lembur, dan klik berkas lampiran **Bukti Hasil Kerja** karyawan.
3. Berikan keputusan *Setujui* atau *Tolak*.

### 2.3 Mengunggah dan Mengelola Matriks Roster Bulanan
1. Buka tab **Manajemen Roster Shift**.
2. Pilih bulan penugasan target (misal: `2026-12`).
3. Klik tombol **"Unduh Template Roster Excel"**. Sistem akan mengunduh file `.xlsx` berisi daftar karyawan divisi dan tanggal hari dalam bulan tersebut.
4. Buka file Excel tersebut, lalu isi kode shift pada setiap kolom tanggal untuk masing-masing karyawan:
   - `P` : Shift Pagi (06:00 - 15:00 WIB)
   - `S` : Shift Siang (13:00 - 22:00 WIB)
   - `VK`: Kantor SSV (08:00 - 17:00 WIB)
   - `VW`: Kantor SSV + PIC WA (08:00 - 17:00 WIB)
   - `VH`: Setengah Hari SSV (08:00 - 13:00 WIB)
   - `R` : Shift Sore (14:00 - 23:00 WIB)
   - `L` atau `OFF`: Libur Terjadwal (*Rolling Day Off*)
5. Simpan file Excel, lalu seret dan letakkan (*drag-and-drop*) file tersebut ke area upload di dashboard Admin.
6. Klik **"Unggah Jadwal Roster"**. Sistem akan memvalidasi dan memperbarui jadwal seluruh karyawan secara otomatis.

---

## 3. Panduan Pengguna: Peran Super Admin (`super_admin`)

Super Admin memiliki kendali penuh atas konfigurasi sistem, hak akses, dan pelaporan eksekutif di `/superadmin/dashboard.html`.

### 3.1 Verifikasi & Aktivasi Karyawan Baru
1. Buka menu **Persetujuan Pengguna Pending**.
2. Anda akan melihat daftar pendaftaran mandiri karyawan baru.
3. Periksa kesesuaian identitas, divisi, dan jabatan karyawan.
4. Klik tombol hijau **"Aktifkan Akun"** agar karyawan tersebut dapat mulai login dan melakukan absensi.

### 3.2 Manajemen Akun & Bantuan Lupa Kata Sandi
1. Buka menu **Manajemen Pengguna**.
2. Gunakan kolom pencarian untuk menemukan nama atau email karyawan.
3. Untuk membantu karyawan yang lupa kata sandi tanpa perlu mereset:
   - Klik ikon **Mata (Show Password)** pada baris karyawan terkait.
   - Sistem akan mendekripsi kata sandi asli secara instan untuk diinformasikan kepada karyawan bersangkutan.
4. Anda juga dapat mengubah profil, mengatur ulang kata sandi baru secara manual, atau menonaktifkan akun karyawan yang telah keluar (*offboarding*).

### 3.3 Mengunduh Rekap Laporan untuk Payroll
1. Buka menu **Laporan & Rekapitulasi**.
2. Tentukan kriteria filter:
   - Periode: *Hari Ini*, *Minggu Ini*, *Bulan Ini*, atau *Rentang Tanggal Kustom*.
   - Divisi: Pilih divisi tertentu atau seluruh divisi.
3. Klik tombol hijau **"Ekspor Excel (.xlsx)"** untuk mengunduh laporan rekapitulasi lengkap dengan durasi jam kerja, keterlambatan, dan lembur dalam format spreadsheet siap olah payroll.

---

## 4. Tanya Jawab Umum & Pemecahan Masalah (FAQ & Troubleshooting)

| Masalah yang Sering Terjadi | Penyebab Utama | Solusi Penanganan Langkah demi Langkah |
| :--- | :--- | :--- |
| **Lokasi GPS tidak terdeteksi / tombol Absen Masuk macet** | Izin lokasi diblokir di browser HP atau GPS HP dalam keadaan mati. | 1. Pastikan fitur **Lokasi / GPS** di HP Anda dalam status aktif (High Accuracy).<br>2. Buka pengaturan browser (Chrome/Safari) -> Pengaturan Situs -> Lokasi -> Izinkan `sedayaclick.cloud`.<br>3. Muat ulang (*refresh*) halaman PWA. |
| **Kamera tidak mau terbuka / layar viewfinder hitam** | Izin kamera diblokir atau kamera sedang dipakai aplikasi lain. | 1. Tutup aplikasi lain yang mungkin mengakses kamera (misal WhatsApp, Instagram).<br>2. Periksa izin kamera pada browser dan pastikan berstatus "Izinkan".<br>3. Ketuk tombol ganti kamera (depan/belakang) untuk mereset stream WebRTC. |
| **Muncul pesan "Anda sudah melakukan Clock In hari ini"** | Sesuai aturan bisnis, karyawan hanya boleh melakukan Clock In satu kali per tanggal kalender. | Jika Anda sebelumnya sudah Clock In, status Anda saat ini adalah menunggu kepulangan. Silakan gunakan tombol **Clock Out** saat jam pulang tiba. |
| **Pengajuan Cuti / Izin ditolak saat klik Kirim** | Tanggal pengajuan kurang dari 3 hari dari hari ini. | Sesuai aturan perusahaan, cuti dan izin wajib diajukan minimal H-3. Hubungi Admin Manager divisi Anda secara langsung jika terdapat kondisi darurat yang mendesak. |
| **Widget jadwal roster tidak muncul di dashboard saya** | Akun Anda terdaftar pada Shift Reguler (Fixed), bukan Shift Khusus. | Karyawan shift reguler sengaja disajikan tampilan bersih tanpa jadwal roster karena jam kerja Anda tetap (08:00 - 17:00 WIB). Komponen roster hanya aktif bagi divisi operasional shift bergilir. |
