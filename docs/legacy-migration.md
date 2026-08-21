# Migrasi Data dari Sistem Lama (PHP/MySQL)

Panduan operasional untuk memindahkan **User** dan **Memo** dari sistem UMS lama
(PHP + MySQL, dump `umsapp.sql`) ke sistem baru ini (Postgres/Prisma). Ditulis untuk
dijalankan di server tempat `docker-compose.prod.yml` di-deploy, setelah `git pull` membawa
masuk perubahan ini.

## Ringkasan komponen

| File | Fungsi |
| :--- | :--- |
| `apps/worker/src/departmentSyncWorker.ts` | Sinkronisasi Department → Divisi → Sub-Divisi dari API `emp.padmoasm.com/api/v1/q/{uc,gsu,ru}`. Berjalan otomatis setiap 6 jam sebagai bagian dari worker daemon. |
| `apps/worker/scripts/runDepartmentSyncOnce.ts` | Memicu sinkronisasi di atas sekali secara manual (tanpa menunggu 6 jam / restart worker). |
| `apps/api/scripts/legacyMigration/sqlDumpParser.ts` | Parser dump MySQL (`INSERT INTO ... VALUES ...`) — sudah diuji terhadap `umsapp.sql` asli (263 memo, 22 user, 0 baris korup). |
| `apps/api/scripts/legacyMigration/migrateLegacy.ts` | Migrasi User + Memo. Mode `--dry-run` (default) dan `--commit`. Aman dijalankan berulang (idempoten via kolom `legacySourceId`). |
| `apps/api/scripts/legacyMigration/uploadLegacyAttachments.ts` | Upload file lampiran lama ke S3/MinIO untuk memo yang sudah dimigrasi. Terpisah dari `migrateLegacy.ts` karena butuh koneksi storage yang sudah berfungsi. |

## Keputusan yang sudah dikonfirmasi

- Status memo lama (`Approved`/`Verified`) → **ARCHIVED**. Status `Reject` → **REJECTED**.
- Password user lama (MD5, tidak bisa dikonversi ke bcrypt) → user dibuat **tanpa password
  aktif**. Wajib direset satu per satu lewat Master User → Reset Password sebelum user itu
  bisa login.
- Department/Divisi/Sub-Divisi **tidak** diambil dari tabel `departemen`/`divisi` di dump
  lama — diambil dari API `emp.padmoasm.com` yang sudah jadi sumber kebenaran organisasi.
- Role lama dipetakan ke role baru sebagai berikut (lihat `ROLE_ID_TO_NEW_ROLE` di
  `migrateLegacy.ts` bila perlu diubah):

  | Role lama | Role baru |
  | :--- | :--- |
  | Administrator | SUPER_ADMIN |
  | Kepala Departemen, Kepala Divisi | DEPARTMENT_HEAD |
  | Direktur, Asisten Direktur Korporat, Management, Deputy Asistan Direktur | MANAGEMENT |

## Langkah eksekusi di server

### 0. Prasyarat

- Kode terbaru sudah di-pull dan di-deploy (`docker compose -f docker-compose.prod.yml up -d
  --build`) — ini otomatis menjalankan migrasi Prisma (`migrate deploy`), termasuk kolom
  `legacySourceId` baru pada `User`/`Memo`.
- File `umsapp.sql` dan folder `upload/` dari sistem lama sudah disalin ke server (path apa
  saja, akan dipetakan lewat volume mount di bawah).
- `EMPLOYEE_API_TOKEN` sudah terisi di `.env.production` (sudah ada dari fitur employee
  sync sebelumnya).

### 1. Sinkronkan Department/Divisi/Sub-Divisi lebih dulu

Wajib dijalankan sebelum migrasi User/Memo — `migrateLegacy.ts` akan menolak berjalan
(exit dengan pesan jelas) kalau belum ada data `Company`/`Department` sama sekali.

```bash
docker compose -f docker-compose.prod.yml run --rm worker \
  npx tsx apps/worker/scripts/runDepartmentSyncOnce.ts
```

Cek hasilnya: harus mencetak `{ companies: 3, departments: ..., divisions: ..., subDivisions: ... }`
tanpa error.

### 2. Salin dump + folder lampiran ke tempat yang bisa diakses container

```bash
mkdir -p /opt/ums-legacy-data
cp /path/ke/umsapp.sql /opt/ums-legacy-data/
cp -r /path/ke/upload /opt/ums-legacy-data/upload
```

### 3. Dry-run migrasi User + Memo

```bash
docker compose -f docker-compose.prod.yml run --rm \
  -v /opt/ums-legacy-data:/legacy:ro \
  api \
  npx tsx apps/api/scripts/legacyMigration/migrateLegacy.ts \
  --dry-run \
  --dump=/legacy/umsapp.sql \
  --upload-dir=/legacy/upload
```

Baca laporan yang tercetak dengan teliti sebelum lanjut, terutama bagian ini:

- **Department unmatched** — nama departemen/divisi lama yang tidak ketemu padanannya di
  hasil sync API. User tetap akan dibuat, tapi tanpa `departmentId` (perlu diisi manual nanti
  di Master User).
- **Recipient department unmatched** — sama, tapi untuk penerima memo.
- **Duplicate memoNumber collisions** — kalau ini muncul, `--commit` akan **ditolak otomatis**
  karena `Memo.memoNumber` unik. Perlu diputuskan cara penyelesaiannya (mis. tambah prefix
  perusahaan) sebelum lanjut.
- **Skipped** (users/memos) — daftar baris yang tidak bisa dimigrasi beserta alasannya
  (biasanya: username referensi yang tidak ada di tabel `user`).
- **Attachments missing on disk** — nama file yang disebut di `lampiran_memo` tapi tidak
  ditemukan di folder `upload/` yang disalin — cek lagi apakah folder `upload/` yang disalin
  sudah lengkap.

Ulangi langkah 2–3 kalau ada yang perlu diperbaiki di sisi data lama atau di mapping.

### 4. Commit migrasi User + Memo

Setelah laporan dry-run terlihat wajar:

```bash
docker compose -f docker-compose.prod.yml run --rm \
  -v /opt/ums-legacy-data:/legacy:ro \
  api \
  npx tsx apps/api/scripts/legacyMigration/migrateLegacy.ts \
  --commit \
  --dump=/legacy/umsapp.sql \
  --upload-dir=/legacy/upload
```

Semua penulisan berada dalam satu transaksi Postgres — kalau ada error di tengah jalan,
tidak ada data yang tersimpan sebagian. Aman dijalankan ulang (baris yang sudah punya
`legacySourceId` otomatis dilewati).

### 5. Upload lampiran (setelah Settings > Lampiran File terkoneksi)

Pastikan dulu tombol "Test Koneksi" di Settings → Lampiran File berhasil. Baru kemudian:

```bash
# dry-run dulu
docker compose -f docker-compose.prod.yml run --rm \
  -v /opt/ums-legacy-data:/legacy:ro \
  api \
  npx tsx apps/api/scripts/legacyMigration/uploadLegacyAttachments.ts \
  --dry-run \
  --dump=/legacy/umsapp.sql \
  --upload-dir=/legacy/upload

# lalu commit
docker compose -f docker-compose.prod.yml run --rm \
  -v /opt/ums-legacy-data:/legacy:ro \
  api \
  npx tsx apps/api/scripts/legacyMigration/uploadLegacyAttachments.ts \
  --commit \
  --dump=/legacy/umsapp.sql \
  --upload-dir=/legacy/upload
```

### 6. Setelah migrasi

- Semua user hasil migrasi **tidak bisa login** sampai passwordnya direset manual satu per
  satu lewat Master User → Reset Password. Tidak ada mekanisme "reset massal" — ini
  keputusan sadar (lihat percakapan migrasi) supaya tidak ada password yang bocor lewat
  file/chat.
- Memo hasil migrasi masuk ke menu **Archive** dengan catatan status history "Migrasi dari
  sistem lama (ID lama #..., status lama '...')" — bisa dicek di detail memo → tab Audit/Timeline.
- Department/recipient yang tidak ke-match otomatis (lihat laporan dry-run) sebaiknya
  dirapikan manual lewat Master Department / edit memo, karena snapshot nama lama tetap
  tersimpan di `displayName` walau `partyId`-nya kosong.
