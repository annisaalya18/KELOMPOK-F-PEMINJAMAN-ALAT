# Fitur Upload Foto Alat - Dokumentasi

## Ringkasan Fitur

Admin sekarang dapat menambahkan dan mengelola foto/gambar dari setiap alat dalam inventaris. Fitur ini memudahkan identifikasi alat dan memberikan panduan visual untuk pengguna.

## Perubahan yang Dibuat

### 1. Database Schema (Prisma)
- Menambahkan kolom `foto` (tipe: String, optional) ke model `Alat`
- Kolom ini menyimpan path relatif ke file foto yang diupload

### 2. Backend (server.js)
- **Multer Configuration**: Setup multer untuk handle file uploads
  - Lokasi penyimpanan: `public/uploads/`
  - Format file yang diizinkan: JPEG, JPG, PNG, GIF
  - Ukuran maksimal: 5MB per file

- **Endpoint Baru**: `POST /api/admin/inventaris/:id/upload-foto`
  - Menerima multipart/form-data dengan file foto
  - Menghapus foto lama jika ada penggantian
  - Menyimpan path foto ke database
  - Response: JSON dengan data alat yang sudah diupdate

### 3. Frontend (public/login.html)
- **UI Components Baru**:
  - Input file untuk memilih foto
  - Dropdown untuk memilih alat
  - Preview foto di inventory list
  - Placeholder jika alat belum punya foto

- **Fitur JavaScript**:
  - `renderPhotoOptions()`: Populate dropdown dengan daftar alat
  - `renderPhotoList()`: Tampilkan daftar alat dengan foto
  - `renderAdminInventory()`: Updated untuk menampilkan foto dan kategori alat
  - Event handler untuk form upload foto

### 4. Struktur Folder
```
public/
├── uploads/           # Folder baru untuk menyimpan foto
│   └── [timestamp]-[filename]
├── index.html
├── login.html        # UI utama (updated)
├── admin.html
└── user.html
```

## Cara Penggunaan

### Setup Awal
1. Install dependencies:
   ```bash
   npm install
   ```

2. Jalankan database migration:
   ```bash
   npx prisma migrate dev
   ```

3. Mulai server:
   ```bash
   npm run dev
   ```

### Sebagai Admin
1. Login dengan akun admin (email: `admin@peminjaman.test`, password: `admin123`)
2. Di dashboard admin, lihat bagian "Upload Foto Alat"
3. Pilih alat dari dropdown
4. Klik "Browse" dan pilih file gambar
5. Klik "Upload Foto"
6. Foto akan muncul di section "CRUD Inventaris"

### Fitur yang Tersedia
- **Upload Foto**: Tambahkan foto untuk setiap alat
- **Preview**: Lihat foto alat di inventory list
- **Replace**: Upload foto baru akan menggantikan foto lama
- **Display**: Foto ditampilkan dengan ukuran thumbnail

## API Endpoints

### Upload Foto Alat
```
POST /api/admin/inventaris/:id/upload-foto
Content-Type: multipart/form-data
Authorization: Cookie (sessionToken)

Body:
- foto: [file]

Response (200):
{
  "alat": {
    "id": 1,
    "nama": "Waterpass",
    "kategori": "Survey",
    "status": "TERSEDIA",
    "foto": "/uploads/1234567890-waterpass.jpg"
  },
  "message": "Foto berhasil diupload."
}

Error Response (400):
{
  "error": "File foto wajib diupload."
}

Error Response (404):
{
  "error": "Alat tidak ditemukan."
}
```

## Validasi File
- **Format**: JPEG, JPG, PNG, GIF
- **Ukuran Maksimal**: 5MB
- **Resolusi**: Tidak ada batasan (rekomendasi: minimal 800x600px)

## Catatan Penting
1. Foto disimpan di `public/uploads/` dan dapat diakses via `/uploads/[filename]`
2. Nama file otomatis dibuat dengan timestamp untuk menghindari konflik
3. Foto lama dihapus otomatis saat upload foto baru
4. Fitur ini memerlukan Node.js dan npm sudah terinstall
5. Database harus sudah dimigrasi sebelum fitur bisa digunakan

## Troubleshooting

### Foto tidak muncul setelah upload
- Pastikan folder `public/uploads/` ada dan accessible
- Restart server
- Check browser console untuk error messages

### Error "File tidak diizinkan"
- Periksa format file (harus JPEG, JPG, PNG, atau GIF)
- Periksa ukuran file (maksimal 5MB)

### npm install multer gagal
- Pastikan npm sudah terinstall
- Try: `npm cache clean --force` kemudian ulangi `npm install`

## Future Improvements
- Crop/resize foto otomatis
- Kompresi gambar untuk performa lebih baik
- Drag & drop untuk upload
- Edit kategori alat dari UI
- Hapus foto dari UI admin
