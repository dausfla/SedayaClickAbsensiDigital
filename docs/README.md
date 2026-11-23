# Dokumentasi Lengkap SDLC (As-Built) — SedayaClick

Selamat datang di repositori dokumentasi rekayasa perangkat lunak (*Software Development Life Cycle / SDLC*) sistem **SedayaClick** (Aplikasi Presensi & Penggajian Karyawan PWA), dikembangkan untuk **PT Rancang Bangun Sedaya**.

Dokumentasi ini disusun secara *as-built* (berbasis bukti nyata dari kode sumber yang sedang berjalan di lingkungan produksi) pada commit `f374140` (Branch `main`).

---

## 1. Indeks Dokumen SDLC

Seluruh dokumen teknis dan operasional tersimpan di dalam direktori `docs/`:

| Nomor Berkas | Nama Dokumen | Deskripsi Isi Dokumen | Status Kelengkapan |
| :---: | :--- | :--- | :---: |
| **MASTER**| [DOKUMENTASI-SDLC-LENGKAP-SEDAYACLICK.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/DOKUMENTASI-SDLC-LENGKAP-SEDAYACLICK.md) | **DOKUMEN TUNGGAL TERPADU (ALL-IN-ONE CONSOLIDATED)**: Menggabungkan seluruh Bab 1 s.d 15 dan Lampiran dalam satu berkas utuh yang rapi | **Lengkap** |
| **00** | [00-inventaris.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/00-inventaris.md) | Discovery sistem, arsitektur folder, dependensi, titik masuk, background scheduler, dan riwayat git | **Lengkap** |
| **01** | [01-project-overview.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/01-project-overview.md) | Latar belakang masalah, stakeholder, batasan scope (in-scope vs out-of-scope), dan diagram teknologi | **Lengkap** |
| **02** | [02-srs-kebutuhan.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/02-srs-kebutuhan.md) | Spesifikasi Kebutuhan Sistem (FR-01 s.d FR-21, NFR, Aturan Bisnis BR-01 s.d BR-14, Use Case Diagram) | **Lengkap** |
| **03** | [03-sdd-desain-sistem.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/03-sdd-desain-sistem.md) | Desain Arsitektur Perangkat Lunak, Sequence Diagrams alur kunci, State Diagrams, dan Algoritma Inti | **Lengkap** |
| **04** | [04-desain-database.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/04-desain-database.md) | Entity Relationship Diagram (ERD), Kamus Data Lengkap 10 Tabel + Views, PII Mapping, dan Retensi | **Lengkap** |
| **05** | [05-spesifikasi-api.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/05-spesifikasi-api.md) | Katalog Endpoint REST API, Parameter, Format Validasi, Contoh Request/Response, dan Error Codes | **Lengkap** |
| **API**| [openapi.yaml](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/openapi.yaml) | Spesifikasi Standar Mesin OpenAPI 3.0.3 (Swagger Compatible) untuk Pengujian API | **Lengkap** |
| **06** | [06-antarmuka-pengguna.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/06-antarmuka-pengguna.md) | Inventaris Layar UI PWA & Web, Diagram Peta Navigasi, dan Pemetaan Layar -> Endpoint -> Database | **Lengkap** |
| **07** | [07-keamanan-dan-privasi.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/07-keamanan-dan-privasi.md) | Evaluasi Keamanan OWASP Top 10, Register Temuan Keamanan (SEC-01 s.d SEC-06), Gap Analysis UU PDP | **Lengkap** |
| **08** | [08-pengujian.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/08-pengujian.md) | Test Gap Analysis, Katalog Kasus Uji As-Built (TC-01 s.d TC-31), Skenario UAT, dan Strategi Testing | **Lengkap** |
| **09** | [09-deployment-dan-operasi.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/09-deployment-dan-operasi.md) | Runbook Deployment VPS, PM2 Cluster, Nginx SSL, CI/CD GitHub Actions, Backup, Restore & Rollback | **Lengkap** |
| **10** | [10-pemeliharaan-dan-technical-debt.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/10-pemeliharaan-dan-technical-debt.md) | Register Utang Teknis (TD-01 s.d TD-08), Estimasi Usaha, dan Roadmap Refactoring Berprioritas | **Lengkap** |
| **11** | [11-panduan-pengguna.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/11-panduan-pengguna.md) | User Manual Langkah demi Langkah untuk Karyawan, Admin Manager, Super Admin, dan Panduan Troubleshooting | **Lengkap** |
| **12** | [12-release-notes.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/12-release-notes.md) | Changelog Riwayat Perubahan Sistem Berdasarkan 38 Komit Git dari v1.0.0 hingga v1.3.1 | **Lengkap** |
| **13** | [13-matriks-keterlacakan.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/13-matriks-keterlacakan.md) | Requirements Traceability Matrix (Pemetaan Penuh FR -> Berkas Kode -> Tabel DB -> Endpoint -> TC) | **Lengkap** |
| **14** | [14-risiko-asumsi-glosarium.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/14-risiko-asumsi-glosarium.md) | Register Risiko (RSK-01 s.d RSK-07), Daftar Asumsi Terkumpul, Poin Konfirmasi PM, dan Glosarium Istilah | **Lengkap** |
| **PRG**| [_progress.md](file:///Applications/XAMPP/xamppfiles/htdocs/sedayaclick/docs/_progress.md) | Lembar Pelacak Progres Checklist Penyusunan Dokumentasi SDLC | **Lengkap** |

---

## 2. Panduan Membaca Berdasarkan Peran Pembaca

Untuk mempermudah penelusuran informasi sesuai kebutuhan masing-masing audiens:

1. **Bagi Pengembang Baru (Developer Onboarding)**:
   - Mulailah dari `01-project-overview.md` untuk memahami konteks bisnis dan arsitektur sistem secara umum.
   - Pelajari `00-inventaris.md` dan `03-sdd-desain-sistem.md` untuk memahami struktur modular server dan alur request data.
   - Pahami skema relasional di `04-desain-database.md` dan kontrak integrasi di `05-spesifikasi-api.md`.
   - Baca `10-pemeliharaan-dan-technical-debt.md` agar mengetahui area kode yang memerlukan perhatian khusus.
2. **Bagi Tim Quality Assurance (QA / Tester)**:
   - Pelajari `02-srs-kebutuhan.md` untuk memahami seluruh kebutuhan fungsional (FR) dan aturan bisnis (BR).
   - Gunakan katalog pengujian pada `08-pengujian.md` sebagai acuan pembuatan skenario uji manual maupun otomasi.
   - Periksa `13-matriks-keterlacakan.md` untuk memastikan seluruh fitur telah teruji (*test coverage*).
3. **Bagi Tim DevOps, Sysadmin & Infrastruktur**:
   - Jadikan `09-deployment-dan-operasi.md` sebagai **Runbook Utama** untuk prosedur rilis, restart PM2, backup, restore, dan mitigasi downtime.
   - Tinjau register risiko `14-risiko-asumsi-glosarium.md` untuk mengantisipasi masalah disk storage dan konektivitas SMTP.
4. **Bagi Manajemen, Auditor Keamanan & Legal**:
   - Pelajari `07-keamanan-dan-privasi.md` untuk evaluasi kepatuhan terhadap standar OWASP dan kesenjangan terhadap **UU Pelindungan Data Pribadi (UU No. 27 Tahun 2022)**.
   - Tinjau daftar pertanyaan konfirmasi pada `14-risiko-asumsi-glosarium.md` untuk pengambilan keputusan kebijakan privasi dan keamanan internal perusahaan.

---

## 3. Konvensi Tag Bukti & Ketentuan Khusus

Seluruh klaim teknis di dalam bundel dokumentasi ini mematuhi prinsip *Evidence-Based Engineering*:
- `[TERVERIFIKASI: path/berkas:baris]` — Informasi diambil langsung dari kode sumber atau konfigurasi yang valid.
- `[ASUMSI]` — Kesimpulan logis berdasarkan alur kerja sistem namun tidak tertulis eksplisit di kode.
- `[TIDAK DITEMUKAN]` — Fitur, konfigurasi, atau berkas yang tidak tersedia di dalam repositori.
- `[PERLU KONFIRMASI]` — Hal yang memerlukan validasi atau keputusan formal dari Project Manager / Stakeholder.
