import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DATA = [
  {
    name: 'HALA 1',
    lines: [
      { plcId: 'LP202', name: 'LP202 (S7-300)' },
      { plcId: 'LP405', name: 'LP405' },
      { plcId: 'LP702', name: 'LP702' },
      { plcId: 'LP802', name: 'LP802' },
      { plcId: 'LP902', name: 'LP902' },
    ]
  },
  {
    name: 'HALA 2',
    lines: [
      { plcId: 'LP302', name: 'LP302' },
      { plcId: 'LP402', name: 'LP402' },
      { plcId: 'LP502', name: 'LP502' },
      { plcId: 'LP602', name: 'LP602' },
    ]
  },
  {
    name: 'HALA 3',
    lines: [
      { plcId: 'LCE131', name: 'LCE131' },
      { plcId: 'LP205', name: 'LP205' },
      { plcId: 'LP305', name: 'LP305' },
      { plcId: 'LP505', name: 'LP505' },
      { plcId: 'LP605', name: 'LP605' },
      { plcId: 'LP705', name: 'LP705' },
      { plcId: 'LP707', name: 'LP707' },
      { plcId: 'LP805', name: 'LP805' },
    ]
  },
  {
    name: 'HALA 4',
    lines: [
      { plcId: 'INS1', name: 'INS1' },
      { plcId: 'INS2', name: 'INS2' },
      { plcId: 'LCE132', name: 'LCE132' },
      { plcId: 'LP606', name: 'LP606' },
      { plcId: 'LP607', name: 'LP607' },
      { plcId: 'LP608', name: 'LP608' },
      { plcId: 'LP609', name: 'LP609' },
    ]
  }
];

const PRODUCTS = ['XJ-100', 'XJ-200', 'Y-ALPHA', 'Z-BETA', 'K-GAMMA', 'M-DELTA', 'OMEGA-7'];

async function main() {
  console.log('🧹 Cleaning up database...');
  await prisma.productionPlan.deleteMany();
  await prisma.machineStatusHistory.deleteMany();
  await prisma.scrapEvent.deleteMany();
  await prisma.downtimeComment.deleteMany();
  await prisma.line.deleteMany();
  await prisma.hall.deleteMany();

  console.log('🌱 Seeding production halls and lines...');

  for (const hallData of DATA) {
    const hall = await prisma.hall.upsert({
      where: { name: hallData.name },
      update: {},
      create: { name: hallData.name },
    });

    for (const lineData of hallData.lines) {
      const line = await prisma.line.upsert({
        where: { plcId: lineData.plcId },
        update: { name: lineData.name, hallId: hall.id },
        create: { ...lineData, hallId: hall.id },
      });

      console.log(`   Registered line: ${line.name}`);
    }
  }

  console.log('✅ Seed finished. Database structure is ready for real MQTT data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
