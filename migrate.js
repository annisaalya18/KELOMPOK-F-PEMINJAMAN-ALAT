const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // Try to add column - it might already exist
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE Alat ADD COLUMN foto TEXT`);
      console.log('✓ Kolom foto berhasil ditambahkan ke tabel Alat');
    } catch (error) {
      if (error.message.includes('duplicate') || error.message.includes('already exists')) {
        console.log('✓ Kolom foto sudah ada di tabel Alat');
      } else {
        throw error;
      }
    }
    
    console.log('✓ Migrasi database selesai!');
  } catch (error) {
    console.error('✗ Error migrasi:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
