import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

async function run() {
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: { id: DEFAULT_ORG_ID, name: 'Default', slug: 'default' },
  });
  await prisma.$executeRaw`UPDATE "User"         SET "orgId" = ${DEFAULT_ORG_ID} WHERE "orgId" IS NULL`;
  await prisma.$executeRaw`UPDATE "WhatsAppLine" SET "orgId" = ${DEFAULT_ORG_ID} WHERE "orgId" IS NULL`;
  await prisma.$executeRaw`UPDATE "Client"       SET "orgId" = ${DEFAULT_ORG_ID} WHERE "orgId" IS NULL`;
  console.log('Backfill complete.');
  await prisma.$disconnect();
}

run().catch(console.error);
