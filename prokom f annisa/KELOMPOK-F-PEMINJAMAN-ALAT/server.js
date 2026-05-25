const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;
const sessions = {};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Setup multer untuk upload foto
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan (jpeg, jpg, png, gif)'));
    }
  }
});

app.use('/uploads', express.static(uploadsDir));

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function seedInitialData() {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@peminjaman.test' } });
  if (!admin) {
    await prisma.user.create({ data: { name: 'Administrator', email: 'admin@peminjaman.test', password: 'admin123', role: 'ADMIN' } });
  }
  const user = await prisma.user.findUnique({ where: { email: 'user@peminjaman.test' } });
  if (!user) {
    await prisma.user.create({ data: { name: 'Peminjam', email: 'user@peminjaman.test', password: 'user123', role: 'USER' } });
  }

  const alatCount = await prisma.alat.count();
  if (alatCount === 0) {
    await prisma.alat.createMany({
      data: [
        { nama: 'Waterpass', kategori: 'Survey' },
        { nama: 'Theodolite', kategori: 'Survey' },
        { nama: 'Statif', kategori: 'Survey' },
        { nama: 'Rambu Ukur', kategori: 'Survey' },
        { nama: 'Total Station', kategori: 'Survey' },
        { nama: 'Nivo', kategori: 'Survey' }
      ]
    });
  }

  const jadwalCount = await prisma.jadwal.count();
  if (jadwalCount === 0) {
    const alat = await prisma.alat.findFirst();
    if (alat) {
      await prisma.jadwal.createMany({
        data: [
          { tanggal: new Date(Date.now() + 24 * 60 * 60 * 1000), lokasi: 'Lab Multimedia', sesi: 'Pagi', paketNomor: 'A1', alatId: alat.id },
          { tanggal: new Date(Date.now() + 48 * 60 * 60 * 1000), lokasi: 'Studio Foto', sesi: 'Siang', paketNomor: 'B2', alatId: alat.id }
        ]
      });
    }
  }
}

function authMiddleware(role) {
  return (req, res, next) => {
    const token = req.cookies.sessionToken;
    if (!token || !sessions[token]) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const session = sessions[token];
    req.user = session;
    if (role && session.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

app.get('/api/session', authMiddleware(), async (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi.' });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Email atau password salah.' });
  }
  const token = makeToken();
  sessions[token] = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.cookie('sessionToken', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ role: user.role });
});

app.post('/api/logout', authMiddleware(), (req, res) => {
  const token = req.cookies.sessionToken;
  if (token) {
    delete sessions[token];
  }
  res.clearCookie('sessionToken');
  res.json({ success: true });
});

app.get('/api/user/dashboard', authMiddleware('USER'), async (req, res) => {
  const currentBorrowings = await prisma.peminjaman.findMany({
    where: { userId: req.user.id, status: 'AKTIF' },
    include: { alat: true, jadwal: true }
  });
  const recentHistory = await prisma.peminjaman.findMany({
    where: { userId: req.user.id },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: { alat: true, jadwal: true }
  });
  const activeSchedule = await prisma.jadwal.findMany({
    where: { tanggal: { gte: new Date() } },
    include: { alat: true },
    orderBy: { tanggal: 'asc' }
  });
  res.json({ currentBorrowings, recentHistory, activeSchedule });
});

app.get('/api/user/history', authMiddleware('USER'), async (req, res) => {
  const history = await prisma.peminjaman.findMany({
    where: { userId: req.user.id },
    include: { alat: true, jadwal: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ history });
});

app.post('/api/user/report', authMiddleware('USER'), async (req, res) => {
  const { peminjamanId, pesan } = req.body;
  if (!peminjamanId || !pesan) {
    return res.status(400).json({ error: 'ID peminjaman dan pesan laporan wajib diisi.' });
  }
  const peminjaman = await prisma.peminjaman.findUnique({ where: { id: parseInt(peminjamanId, 10) } });
  if (!peminjaman || peminjaman.userId !== req.user.id) {
    return res.status(404).json({ error: 'Peminjaman tidak ditemukan.' });
  }
  const report = await prisma.laporanKendala.create({
    data: { userId: req.user.id, peminjamanId: peminjaman.id, pesan }
  });
  res.json({ report });
});

app.post('/api/user/borrow', authMiddleware('USER'), async (req, res) => {
  const { jadwalId, buktiPinjam, catatanPinjam } = req.body;
  if (!jadwalId || !buktiPinjam) {
    return res.status(400).json({ error: 'Jadwal dan bukti peminjaman wajib diisi.' });
  }
  const jadwal = await prisma.jadwal.findUnique({ where: { id: parseInt(jadwalId, 10) }, include: { alat: true } });
  if (!jadwal) {
    return res.status(404).json({ error: 'Jadwal tidak ditemukan.' });
  }
  if (jadwal.alat.status !== 'TERSEDIA') {
    return res.status(400).json({ error: 'Alat tidak tersedia untuk dipinjam.' });
  }
  const peminjaman = await prisma.peminjaman.create({
    data: {
      userId: req.user.id,
      alatId: jadwal.alatId,
      jadwalId: jadwal.id,
      buktiPinjam,
      catatanPinjam,
      status: 'AKTIF'
    }
  });
  await prisma.alat.update({ where: { id: jadwal.alatId }, data: { status: 'DIPINJAM' } });
  res.json({ peminjaman });
});

app.post('/api/user/return', authMiddleware('USER'), async (req, res) => {
  const { peminjamanId, buktiKembali, catatanKembali } = req.body;
  if (!peminjamanId || !buktiKembali) {
    return res.status(400).json({ error: 'ID peminjaman dan bukti pengembalian wajib diisi.' });
  }
  const peminjaman = await prisma.peminjaman.findUnique({
    where: { id: parseInt(peminjamanId, 10) },
    include: { alat: true }
  });
  if (!peminjaman || peminjaman.userId !== req.user.id || peminjaman.status !== 'AKTIF') {
    return res.status(404).json({ error: 'Peminjaman tidak ditemukan atau tidak aktif.' });
  }
  const updated = await prisma.peminjaman.update({
    where: { id: peminjaman.id },
    data: {
      buktiKembali,
      catatanKembali,
      status: 'SELESAI'
    }
  });
  await prisma.alat.update({ where: { id: peminjaman.alatId }, data: { status: 'TERSEDIA' } });
  res.json({ updated });
});

app.get('/api/admin/dashboard', authMiddleware('ADMIN'), async (req, res) => {
  const allBorrowings = await prisma.peminjaman.findMany({
    include: { user: true, alat: true, jadwal: true },
    orderBy: { createdAt: 'desc' }
  });
  const reports = await prisma.laporanKendala.findMany({
    where: { resolved: false },
    include: { user: true, peminjaman: { include: { alat: true, jadwal: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ allBorrowings, reports });
});

app.get('/api/admin/inventaris', authMiddleware('ADMIN'), async (req, res) => {
  const alat = await prisma.alat.findMany({ orderBy: { id: 'asc' } });
  res.json({ alat });
});

app.post('/api/admin/inventaris', authMiddleware('ADMIN'), async (req, res) => {
  const { nama, kategori } = req.body;
  if (!nama || !kategori) {
    return res.status(400).json({ error: 'Nama dan kategori alat wajib diisi.' });
  }
  const newAlat = await prisma.alat.create({ data: { nama, kategori, status: 'TERSEDIA' } });
  res.json({ alat: newAlat });
});

app.put('/api/admin/inventaris/:id', authMiddleware('ADMIN'), async (req, res) => {
  const { nama, kategori, status } = req.body;
  const id = parseInt(req.params.id, 10);
  const updated = await prisma.alat.update({ where: { id }, data: { nama, kategori, status } });
  res.json({ alat: updated });
});

app.post('/api/admin/inventaris/:id/upload-foto', authMiddleware('ADMIN'), upload.single('foto'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File foto wajib diupload.' });
  }
  
  const id = parseInt(req.params.id, 10);
  const alat = await prisma.alat.findUnique({ where: { id } });
  if (!alat) {
    // Hapus file jika alat tidak ditemukan
    fs.unlinkSync(path.join(uploadsDir, req.file.filename));
    return res.status(404).json({ error: 'Alat tidak ditemukan.' });
  }

  // Hapus foto lama jika ada
  if (alat.foto) {
    const oldFilePath = path.join(uploadsDir, alat.foto.split('/').pop());
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }
  }

  const fotoPath = `/uploads/${req.file.filename}`;
  const updated = await prisma.alat.update({
    where: { id },
    data: { foto: fotoPath }
  });

  res.json({ alat: updated, message: 'Foto berhasil diupload.' });
});

app.delete('/api/admin/inventaris/:id', authMiddleware('ADMIN'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await prisma.alat.delete({ where: { id } });
  res.json({ success: true });
});

app.get('/api/admin/jadwal', authMiddleware('ADMIN'), async (req, res) => {
  const jadwals = await prisma.jadwal.findMany({ include: { alat: true }, orderBy: { tanggal: 'asc' } });
  res.json({ jadwals });
});

app.post('/api/admin/jadwal', authMiddleware('ADMIN'), async (req, res) => {
  const { tanggal, lokasi, sesi, paketNomor, alatId } = req.body;
  if (!tanggal || !lokasi || !sesi || !paketNomor || !alatId) {
    return res.status(400).json({ error: 'Semua field jadwal harus diisi.' });
  }
  const jadwal = await prisma.jadwal.create({ data: { tanggal: new Date(tanggal), lokasi, sesi, paketNomor, alatId: parseInt(alatId, 10) } });
  res.json({ jadwal });
});

app.put('/api/admin/jadwal/:id', authMiddleware('ADMIN'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { tanggal, lokasi, sesi, paketNomor, alatId } = req.body;
  const updated = await prisma.jadwal.update({
    where: { id },
    data: { tanggal: new Date(tanggal), lokasi, sesi, paketNomor, alatId: parseInt(alatId, 10) }
  });
  res.json({ jadwal: updated });
});

app.delete('/api/admin/jadwal/:id', authMiddleware('ADMIN'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await prisma.jadwal.delete({ where: { id } });
  res.json({ success: true });
});

app.post('/api/admin/verify/:id', authMiddleware('ADMIN'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const peminjaman = await prisma.peminjaman.findUnique({ where: { id }, include: { alat: true } });
  if (!peminjaman) {
    return res.status(404).json({ error: 'Peminjaman tidak ditemukan.' });
  }
  const updated = await prisma.peminjaman.update({ where: { id }, data: { status: 'SELESAI' } });
  await prisma.alat.update({ where: { id: peminjaman.alatId }, data: { status: 'TERSEDIA' } });
  res.json({ updated });
});

app.get('/api/admin/reports', authMiddleware('ADMIN'), async (req, res) => {
  const reports = await prisma.laporanKendala.findMany({ include: { user: true, peminjaman: { include: { alat: true, jadwal: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ reports });
});

app.get('/', (req, res) => {
  const token = req.cookies.sessionToken;
  const session = token ? sessions[token] : null;
  if (session) {
    return res.redirect(session.role === 'ADMIN' ? '/admin' : '/user');
  }
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  const token = req.cookies.sessionToken;
  const session = token ? sessions[token] : null;
  if (session) {
    return res.redirect(session.role === 'ADMIN' ? '/admin' : '/user');
  }
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.get('/user', authMiddleware('USER'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/user.html'));
});

app.get('/admin', authMiddleware('ADMIN'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.use((req, res) => {
  res.status(404).send('Halaman tidak ditemukan');
});

(async () => {
  await seedInitialData();
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
})();
