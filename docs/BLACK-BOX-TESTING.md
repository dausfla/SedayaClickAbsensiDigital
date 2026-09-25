# Form Test Case Black Box Testing — SedayaClick

**Nama Penguji**: ___________________________  
**Tanggal Pengujian**: ___________________________  
**Versi Aplikasi**: v1.0.0 (SedayaClick Absensi Digital & Management Pengajuan)  
**Lingkungan Pengujian**: Browser (Chrome / Safari / Firefox) & Device (Desktop / Smartphone PWA)

---

## 📋 Petunjuk Pengujian Manual
1. Isilah kolom **Hasil Aktual** dengan kondisi nyata saat tombol/fitur diklik.
2. Pilih **[Pass]** jika hasil sesuai dengan **Hasil yang Diharapkan**, atau **[Fail]** jika terdapat bug / kesalahan.
3. Tuliskan **Catatan / Temuan** jika ada kendala khusus.

---

## 1. Modul Autentikasi & Hak Akses (Auth & Authorization)

| ID Test | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status (Pass/Fail) | Catatan |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-AUTH-01** | Login Karyawan dengan kredensial valid | 1. Buka `/index.html`<br>2. Masukkan NIK/Username & Password karyawan<br>3. Klik **Login** | Berhasil login dan diarahkan ke Dashboard Karyawan (`/employee/dashboard.html`). | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-AUTH-02** | Login Admin Manager dengan kredensial valid | 1. Masukkan NIK/Username & Password Admin Manager<br>2. Klik **Login** | Berhasil login dan diarahkan ke Dashboard Admin Manager (`/admin/dashboard.html`). | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-AUTH-03** | Login Super Admin dengan kredensial valid | 1. Masukkan NIK/Username & Password Super Admin<br>2. Klik **Login** | Berhasil login dan diarahkan ke Dashboard Super Admin (`/superadmin/dashboard.html`). | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-AUTH-04** | Login dengan password salah | 1. Masukkan Username benar, Password salah<br>2. Klik **Login** | Tampil pesan error *"Username/NIK atau password salah."* dan tetap di halaman login. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-AUTH-05** | Akses langsung URL dashboard tanpa login | 1. Buka browser incognito/tab baru<br>2. Langsung ketik URL `/admin/dashboard.html` | Di-redirect otomatis kembali ke halaman login. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-AUTH-06** | Logout pengguna | 1. Di dashboard, klik tombol **Logout** | Sesi terhapus dan pengguna kembali ke halaman Login. | | `[  ]` Pass<br>`[  ]` Fail | |

---

## 2. Modul Presensi Harian Karyawan (Attendance Clock-In & Clock-Out)

| ID Test | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status (Pass/Fail) | Catatan |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-ATT-01** | Absen Masuk tanpa mengaktifkan kamera | 1. Buka menu Absensi<br>2. Langsung klik Konfirmasi tanpa aktifkan kamera | Tombol konfirmasi tidak dapat diklik / kamera wajib diaktifkan terlebih dahulu. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-ATT-02** | Absen Masuk saat GPS dimatikan/ditolak | 1. Matikan izin GPS di browser<br>2. Aktifkan kamera & coba Absen Masuk | Tampil peringatan *"Lokasi GPS belum terkunci. Mohon aktifkan izin GPS."* | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-ATT-03** | Absen Masuk berhasil (Kamera + GPS Aktif) | 1. Izin Kamera & GPS Aktif<br>2. Klik **Aktifkan Kamera** -> **Konfirmasi Absen Masuk** | Foto selfie tersimpan, status berubah menjadi *"Sudah Absen Masuk"*, dan durasi mulai dihitung. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-ATT-04** | Absen Masuk ganda pada hari yang sama | 1. Setelah sukses Absen Masuk, coba lakukan Absen Masuk lagi | Tampil pesan error *"Anda sudah melakukan Absen Masuk hari ini."* | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-ATT-05** | Absen Pulang berhasil | 1. Klik **Aktifkan Kamera** -> **Konfirmasi Absen Pulang** | Status berubah menjadi *"Absensi Hari Ini Selesai"* & total durasi kerja dihitung. | | `[  ]` Pass<br>`[  ]` Fail | |

---

## 3. Modul Presensi Lembur Harian (Overtime Attendance)

| ID Test | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status (Pass/Fail) | Catatan |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-OT-01** | Absen Masuk Lembur tanpa Keterangan Tugas | 1. Aktifkan kamera lembur<br>2. Kosongkan field *Ngerjain Apa*<br>3. Klik Konfirmasi | Tampil peringatan *"Keterangan tugas lembur wajib diisi."* | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-OT-02** | Absen Masuk Lembur Berhasil | 1. Isi keterangan tugas<br>2. Aktifkan kamera + GPS terkunci<br>3. Klik **Konfirmasi Absen Masuk Lembur** | Foto selfie lembur masuk tersimpan & badge berubah menjadi *"Sudah Clock In Lembur"*. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-OT-03** | Absen Pulang Lembur Berhasil | 1. Klik **Aktifkan Kamera** -> **Konfirmasi Absen Pulang Lembur** | Status lembur selesai & total durasi lembur dihitung. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-OT-04** | Verifikasi Foto & GPS Lembur di Dashboard Admin / Super Admin | 1. Login sebagai Admin Manager / Super Admin<br>2. Buka tab **Presensi Lembur**<br>3. Klik tombol **📸 Lihat Foto & GPS** | Modal pop-up terbuka menampilkan foto selfie masuk/pulang, koordinat GPS exact, & tombol **🗺️ Buka Maps GPS** yang mengarahkan ke Google Maps. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-OT-05** | Persetujuan / Penolakan Lembur oleh Admin | 1. Pada presensi lembur pending, klik **Setujui** atau **Tolak**<br>2. Masukkan catatan review -> Simpan | Status presensi lembur diperbarui dan berpindah ke tabel Riwayat Lembur. | | `[  ]` Pass<br>`[  ]` Fail | |

---

## 4. Modul Pengajuan (Izin Khusus, Cuti Tahunan, Sakit)

| ID Test | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status (Pass/Fail) | Catatan |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-SUB-01** | Memilih Jenis Pengajuan selain Cuti (Izin / Sakit) | 1. Buka form pengajuan<br>2. Pilih Jenis Pengajuan = `Izin Khusus` atau `Sakit` | Form Serah Terima Pekerjaan otomatis tersembunyi. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-SUB-02** | Memilih Jenis Pengajuan = Cuti Tahunan | 1. Pilih Jenis Pengajuan = `Cuti Tahunan` | Form **Rencana Serah Terima Pekerjaan**, **Dialihkan Kepada (Nama)**, dan **Jabatan** otomatis muncul. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-SUB-03** | Upload Lampiran Pengajuan > 10 MB | 1. Unggah file dokumen/gambar > 10 MB<br>2. Klik **Kirim Pengajuan** | Tampil pesan error *"Ukuran berkas terlalu besar! Maksimal 10 MB."* dan pengajuan dibatalkan. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-SUB-04** | Kirim Pengajuan Cuti Berhasil | 1. Pilih Cuti Tahunan<br>2. Isi tanggal, alasan, & serah terima pekerjaan<br>3. Upload berkas < 10MB -> Klik **Kirim** | Pengajuan berhasil dikirim & tampil di kartu riwayat pengajuan dengan rincian serah terima. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-SUB-05** | Pemeriksaan Detail Pengajuan di Dashboard Admin Manager & Super Admin | 1. Login Admin Manager / Super Admin<br>2. Buka menu **Pengajuan** | Tampil detail utuh: Jenis, Tanggal Mulai/Selesai, Alasan, Card Serah Terima Pekerjaan (jika cuti), dan link `📎 Lihat Bukti File / Surat Dokter`. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-SUB-06** | Buka Bukti File / Surat Dokter | 1. Klik tautan `📎 Lihat Bukti File / Surat Dokter` | File terbuka dengan aman di tab browser baru via rute terproteksi `/secure-uploads/`. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-SUB-07** | Setujui / Tolak Pengajuan Karyawan | 1. Klik **Setujui** atau **Tolak**<br>2. Isi catatan review | Status pengajuan berubah & karyawan dapat melihat catatan review dari admin. | | `[  ]` Pass<br>`[  ]` Fail | |

---

## 5. Modul Pelaporan & Ekspor Data (Reports & Export)

| ID Test | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status (Pass/Fail) | Catatan |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-REP-01** | Filter Laporan berdasarkan Periode & Divisi | 1. Buka menu **Pelaporan**<br>2. Pilih periode (Mingguan/Bulanan/Rentang Custom) & Divisi<br>3. Klik **Terapkan Filter** | Tabel memperbarui data sesuai kriteria filter secara presisi. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-REP-02** | Ekspor Laporan Absensi ke CSV | 1. Klik tombol **Ekspor CSV** | File CSV berhasil diunduh dan dapat dibuka dengan rapi di Excel. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-REP-03** | Ekspor Laporan Absensi ke Excel (.xlsx) | 1. Klik tombol **Ekspor Excel (.xlsx)** | File `.xlsx` dengan format header & border rapi berhasil diunduh. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-REP-04** | Ekspor Pengajuan ke Excel (.xlsx) | 1. Pada menu Pengajuan, klik **Ekspor Excel** | File rekap pengajuan terunduh beserta detail status & catatan review. | | `[  ]` Pass<br>`[  ]` Fail | |

---

## 6. Modul Tampilan (UI/UX, Responsive, & PWA)

| ID Test | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status (Pass/Fail) | Catatan |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-UI-01** | Responsivitas Tampilan Mobile (Smartphone) | 1. Buka aplikasi via smartphone / DevTools Mobile View | Seluruh komponen, form input, dan tombol tersusun rapi tanpa ada field yang tertumpuk atau terpotong. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-UI-02** | Mode Gelap / Terang (Dark / Light Mode) | 1. Klik tombol **Toggle Tema (🌙/☀️)** | Tampilan berpindah warna dengan mulus antara Dark Mode dan Light Mode. | | `[  ]` Pass<br>`[  ]` Fail | |
| **TC-UI-03** | Instalasi Aplikasi PWA (Progressive Web App) | 1. Buka di Chrome Android / Safari iOS<br>2. Klik *Add to Home Screen* / *Install App* | Aplikasi terpasang di layar utama HP dan dapat dibuka secara fullscreen tanpa bar browser. | | `[  ]` Pass<br>`[  ]` Fail | |

---

### 📝 Ringkasan Hasil Pengujian (Summary)
- **Total Test Case**: 29
- **Jumlah Pass**: _____
- **Jumlah Fail**: _____
- **Persentase Kelayakan**: _____ %

**Catatan Akhir / Kesimpulan Penguji**:  
____________________________________________________________________________________________________  
____________________________________________________________________________________________________

**Tanda Tangan Penguji**: ___________________________
