import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const bakPath = path.join(__dirname, '../../gateway/backend/config/settings.json.bak');
  
  if (!fs.existsSync(bakPath)) {
    console.error('Błąd: Nie znaleziono pliku settings.json.bak');
    return;
  }

  const data = JSON.parse(fs.readFileSync(bakPath, 'utf8'));
  const halls = data.halls || [];
  const plcs = data.plcs || [];

  console.log(`🚀 Rozpoczynam przywracanie ${halls.length} hal i ${plcs.length} linii...`);

  // 1. Przywracanie Hal
  for (const hallData of halls) {
    const hall = await prisma.hall.upsert({
      where: { id: hallData.id },
      update: { name: hallData.name },
      create: { id: hallData.id, name: hallData.name },
    });
    console.log(`✅ Przywrócono halę: ${hall.name} (${hall.id})`);
  }

  // 2. Przywracanie Linii (PLC)
  for (const plcData of plcs) {
    const line = await prisma.line.upsert({
      where: { plcId: plcData.id },
      update: {
        name: plcData.name,
        hallId: plcData.hall_id,
        ip: plcData.ip,
        rack: plcData.rack,
        slot: plcData.slot,
        type: plcData.type,
        tags: plcData.tags || [],
        isOnline: plcData.online || false,
      },
      create: {
        plcId: plcData.id,
        name: plcData.name,
        hallId: plcData.hall_id,
        ip: plcData.ip,
        rack: plcData.rack,
        slot: plcData.slot,
        type: plcData.type,
        tags: plcData.tags || [],
        isOnline: plcData.online || false,
      },
    });
    console.log(`✅ Przywrócono linię: ${line.name} (${line.plcId})`);
  }

  console.log('✨ Przywracanie zakończone pomyślnie!');
}

main()
  .catch((e) => {
    console.error('❌ Błąd podczas przywracania:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
