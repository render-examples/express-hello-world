const { PrismaClient } = require('@prisma/client');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('Skip seed (DATABASE_URL missing)');
    return;
  }
  const prisma = new PrismaClient();
  const locale = await prisma.locale.findFirst();
  if (!locale) {
    await prisma.locale.create({ data: { name: 'Locale Principale' } });
    console.log('Created default locale');
  } else {
    console.log('Default locale already exists');
  }
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      const prisma = new PrismaClient();
      await prisma.$disconnect();
    } catch (error) {
      console.error('Prisma disconnect error:', error);
    }
  });
