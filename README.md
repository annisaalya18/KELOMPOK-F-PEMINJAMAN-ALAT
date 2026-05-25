# Aplikasi Manajemen Peminjaman Alat

Aplikasi ini menggunakan:
- Backend: Node.js + Express
- Database: SQLite dengan Prisma ORM
- Frontend: HTML5 + Tailwind CSS (CDN) + Vanilla JavaScript

## Instalasi

1. Buka terminal VS Code di folder proyek.
2. Jalankan:
   ```bash
   npm install
   ```
3. Generate Prisma Client:
   ```bash
   npm run prisma:generate
   ```
4. Jalankan migrasi awal untuk membuat database SQLite:
   ```bash
   npm run prisma:migrate
   ```

## Menjalankan Aplikasi

1. Jalankan server:
   ```bash
   npm run dev
   ```
2. Buka browser dan akses:
   - `http://localhost:3000/login`

## Akun Default

- Admin: `admin@peminjaman.test` / `admin123`
- User: `user@peminjaman.test` / `user123`

## Fitur

- Login berbasis cookie session
- Dashboard user untuk melihat peminjaman aktif, jadwal, riwayat, dan laporan kendala
- Dashboard admin untuk memantau peminjaman, CRUD inventaris dan jadwal, serta verifikasi pengembalian

## Catatan

- Database SQLite tersimpan di `prisma/dev.db`
- Jika `dev.db` belum dibuat maka `npm run prisma:migrate` akan membuatnya 
