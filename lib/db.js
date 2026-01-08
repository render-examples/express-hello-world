const { PrismaClient } = require('@prisma/client');

let prismaClient;

function getPrismaClient() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

async function ensureDefaultLocale(prisma) {
  const existing = await prisma.locale.findFirst();
  if (existing) return existing;
  return prisma.locale.create({
    data: {
      name: 'Locale Principale'
    }
  });
}

async function upsertBusinessDay(prisma, localeId, dateISO) {
  return prisma.businessDay.upsert({
    where: {
      localeId_dateISO: { localeId, dateISO }
    },
    update: {},
    create: {
      localeId,
      dateISO,
      isClosed: false
    }
  });
}

module.exports = {
  getPrismaClient,
  ensureDefaultLocale,
  upsertBusinessDay
};
