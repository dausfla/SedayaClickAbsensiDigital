# 14. Register Risiko, Asumsi, dan Glosarium As-Built

| Metadata | Keterangan |
| :--- | :--- |
| **Sistem** | SedayaClick — Sistem Presensi & Penggajian Karyawan PWA |
| **Versi Dokumen** | 1.0.0 (As-Built) |
| **Tanggal Analisis** | 23 November 2026 |
| **Status Dokumen** | Terverifikasi Berdasarkan Kode & Infrastruktur |

---

## 1. Register Risiko Sistem (Risk Register / RSK-xx)

Berikut adalah daftar risiko teknis, operasional, dan kepatuhan yang diidentifikasi dari evaluasi as-built sistem:

| ID Risiko | Deskripsi Kejadian Risiko | Probabilitas | Dampak | Tingkat Risiko | Strategi Mitigasi Teknis & Operasional |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **RSK-01** | **Kepenuhan Disk VPS Akibat File Foto Presensi**<br>Setiap clock-in/out dan lembur menghasilkan berkas gambar di disk lokal (`/uploads/`). Tanpa object storage, disk 40 GB dapat terisi penuh dalam 12–18 bulan. | **Tinggi** | **Kritis** | **Tinggi** | 1. Operasikan purge berkala foto > 90 hari via Telegram Bot (`/purge_old_data`).<br>2. Migrasikan penyimpanan ke Cloudflare R2 / AWS S3 terpisah dari VPS. |
| **RSK-02** | **Kegagalan Pengiriman Email Antrean Pengajuan**<br>Mengandalkan akun Gmail SMTP personal dengan App Password. Google sewaktu-waktu dapat mencabut App Password atau menerapkan kuota harian (max 500 email/hari). | **Sedang** | **Sedang** | **Sedang** | Beralih ke Transactional Email Service resmi (seperti SendGrid, Mailgun, Amazon SES, atau SMTP domain perusahaan berbayar). |
| **RSK-03** | **Konflik Race Condition DDL Auto-Migration**<br>Eksekusi `ALTER TABLE` pada saat PM2 Cluster (`instances: 'max'`) start berpotensi menyebabkan tabel terkunci (*metadata lock*) antar worker Node.js. | **Sedang** | **Tinggi** | **Tinggi** | Pisahkan DDL migrasi dari server runtime. Jalankan migrasi via skrip CLI tunggal sebelum proses cluster di-reload. |
| **RSK-04** | **Ketidakakuratan atau Manipulasi GPS (Fake GPS)**<br>Browser Geolocation API dapat dimanipulasi melalui aplikasi fake GPS di ponsel Android karena belum ada SDK mock location guard native. | **Sedang** | **Tinggi** | **Tinggi** | 1. Wajibkan validasi swafoto dengan latar belakang fisik kantor yang jelas.<br>2. Pertimbangkan pembungkusan PWA ke Trusted Web Activity (TWA) dengan validasi API Google Play Integrity. |
| **RSK-05** | **Pelanggaran Kepatuhan Regulasi UU PDP**<br>Penyimpanan kata sandi terdekripsi dua arah di database dan ketiadaan klausul persetujuan privasi berisiko melanggar ketentuan UU No. 27 Tahun 2022. | **Sedang** | **Kritis** | **Tinggi** | 1. Hapus kolom `visible_password`.<br>2. Tambahkan persetujuan pemrosesan data biometrik/lokasi saat pendaftaran akun. |
| **RSK-06** | **Ketergantungan CDN Eksternal (Tailwind Play CDN)**<br>Frontend memuat CSS dari `https://cdn.tailwindcss.com`. Jika koneksi internet pengguna memblokir domain CDN tersebut, tampilan PWA hancur tanpa styling. | **Rendah** | **Tinggi** | **Sedang** | Kompilasi CSS secara lokal ke dalam aset offline PWA (`public/css/style.css`). |
| **RSK-07** | **Memory Leak Akibat Polling Singkat Tanpa Batas**<br>Dashboard Admin Manager melakukan request berkala setiap 10 detik. Jika koneksi lambat, request dapat menumpuk dan membebani pool database. | **Rendah** | **Sedang** | **Rendah** | Batalkan request sebelumnya (`AbortController`) sebelum memicu request polling berikutnya, atau beralih ke Server-Sent Events (SSE). |

---

## 2. Daftar Asumsi Terkumpul (Assumptions Register)

Daftar kesimpulan logis yang diambil selama penyusunan dokumentasi karena tidak adanya bukti langsung di repositori:

1. **[ASUMSI-01] Kalkulasi Payroll Rupiah Dilakukan Eksternal**:
   Sistem tidak memuat tabel formula nominal gaji, potongan PPh 21, atau tunjangan rupiah. Diasumsikan bahwa data durasi kerja dan lembur yang diekspor melalui file Excel (`.xlsx`) diolah lebih lanjut oleh divisi Finance/Accounting di luar aplikasi SedayaClick.
2. **[ASUMSI-02] Prioritas MoSCoW pada Dokumen Kebutuhan**:
   Penetapan kategori *Must Have*, *Should Have*, dan *Could Have* pada katalog FR didasarkan pada tingkat ketergantungan alur kerja kode saat ini.
3. **[ASUMSI-03] Estimasi Volume Transaksi Harian**:
   Estimasi pertumbuhan data dihitung berdasarkan asumsi skala operasional rata-rata 100 karyawan aktif dengan 22 hari kerja per bulan.
4. **[ASUMSI-04] Penggunaan Browser Modern Standar**:
   Sistem diasumsikan berjalan pada peramban seluler yang mendukung WebRTC Camera, Geolocation API, dan W3C Service Worker Cache Storage API.

---

## 3. Daftar Hal yang Perlu Dikonfirmasi (Pending Confirmation)

Daftar poin yang memerlukan klarifikasi formal dari Project Manager, Manajemen PT Rancang Bangun Sedaya, atau Stakeholder terkait:

1. **[PERLU KONFIRMASI-01] Nama Resmi Pemilik Dokumen (Project Manager)**:
   Perlu konfirmasi nama lengkap dan jabatan dari Project Manager yang berwenang atas pengesahan dokumen as-built ini.
2. **[PERLU KONFIRMASI-02] Penunjukan Pejabat Pelindung Data Pribadi (DPO)**:
   Apakah PT Rancang Bangun Sedaya telah menunjuk individu atau bagian operasional tertentu yang bertanggung jawab atas kepatuhan UU PDP?
3. **[PERLU KONFIRMASI-03] Kebutuhan Penghapusan Fitur Intip Password**:
   Apakah fitur intip kata sandi (`visible_password`) oleh Super Admin masih diwajibkan secara operasional, atau sudah dapat disetujui untuk dihapus demi kepatuhan keamanan standar?
4. **[PERLU KONFIRMASI-04] Penerapan Radius Pemblokiran Absensi (Geofencing Enforcement)**:
   Variabel radius kantor (`OFFICE_RADIUS_METERS`) sudah ada di `.env`, namun kode saat ini masih mengizinkan clock-in di luar radius. Apakah manajemen menghendaki pemblokiran mutlak jika karyawan berada di luar radius kantor?
5. **[PERLU KONFIRMASI-05] Anggaran & Rencana Migrasi ke Object Storage**:
   Apakah terdapat rencana pengalokasian cloud storage (seperti AWS S3 atau Cloudflare R2) untuk menampung arsip swafoto absensi jangka panjang?

---

## 4. Glosarium Istilah Teknis dan Bisnis

| Istilah | Definisi dalam Konteks SedayaClick |
| :--- | :--- |
| **App Shell** | Struktur antarmuka dasar PWA (HTML, CSS, JS, Icon) yang disimpan di cache browser oleh Service Worker agar aplikasi terbuka instan. |
| **Clock In** | Transaksi pencatatan waktu masuk kerja karyawan disertai bukti swafoto kamera dan koordinat lokasi GPS. |
| **Clock Out** | Transaksi pencatatan waktu kepulangan kerja karyawan yang memicu perhitungan durasi jam kerja dan lembur. |
| **Day Off (Libur Rolling)** | Hari libur terjadwal bagi karyawan operasional shift yang dapat jatuh pada hari apa saja (bukan hanya Sabtu/Minggu). |
| **Geofencing** | Pembatasan geografis virtual berdasarkan titik lintang (latitude), bujur (longitude), dan radius toleransi (meter). |
| **Handover Plan** | Rincian serah terima tugas pekerjaan yang wajib dicantumkan saat karyawan mengajukan cuti tahunan. |
| **Late Duration** | Durasi keterlambatan kerja (dalam hitungan detik) yang dihitung dari jam mulai shift ditambah menit toleransi. |
| **Overtime Duration** | Durasi kerja lembur karyawan (dalam detik) di luar jam kerja normal atau melalui presensi lembur mandiri. |
| **PII** | *Personally Identifiable Information*, data pribadi yang dapat digunakan untuk mengidentifikasi seseorang secara langsung maupun tidak langsung. |
| **PWA** | *Progressive Web Application*, aplikasi web yang memiliki kapabilitas seperti aplikasi mobile native (dapat diinstal, bekerja offline, dan menerima push notification). |
| **RBAC** | *Role-Based Access Control*, pembatasan hak akses sistem berdasarkan peran akun pengguna (`employee`, `admin_manager`, `super_admin`). |
| **Roster** | Matriks penugasan jadwal kerja bergilir bulanan untuk divisi operasional (kode: P, S, VK, VW, VH, R, PL, SAT, L/OFF). |
| **Under Review** | Status perizinan yang sedang ditinjau atau memerlukan koordinasi internal sebelum disetujui atau ditolak manajer. |
| **UU PDP** | Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. |
| **VAPID** | *Voluntary Application Server Identification*, protokol standar IETF untuk pengiriman Web Push Notification terenkripsi tanpa registrasi vendor spesifik. |
| **WebRTC** | *Web Real-Time Communication*, teknologi web yang memungkinkan browser mengakses hardware kamera dan mikrofon secara langsung via JavaScript. |
