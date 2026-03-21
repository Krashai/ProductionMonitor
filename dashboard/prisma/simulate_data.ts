import { PrismaClient } from '@prisma/client';
import { subDays, addMinutes, isAfter } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting data simulation for the last 7 days...');

  const lines = await prisma.line.findMany();
  const now = new Date();
  const startDate = subDays(now, 7);

  const downtimeReasons = [
    'Awaria mechaniczna głowicy',
    'Brak komponentów na wejściu',
    'Przegląd okresowy',
    'Czyszczenie linii',
    'Błąd oprogramowania PLC',
    'Wymiana narzędzia',
    'Nieplanowana przerwa techniczna'
  ];

  for (const line of lines) {
    console.log(` Generating data for line: ${line.name}...`);
    let currentTime = startDate;

    while (isAfter(now, currentTime)) {
      const isWorking = Math.random() > 0.15; // 85% uptime
      const durationMin = Math.floor(Math.random() * 180) + 15; // Blok od 15 min do 3h
      const endTime = addMinutes(currentTime, durationMin);
      
      const finalEndTime = isAfter(endTime, now) ? now : endTime;

      // 1. Zapisz historię statusu
      await prisma.machineStatusHistory.create({
        data: {
          lineId: line.id,
          time: currentTime,
          status: isWorking,
          speed: isWorking ? (Math.random() * 20 + 80) : 0, // Prędkość 80-100 lub 0
        }
      });

      // 2. Jeśli to przestój > 10 min, dodaj komentarz (50% szans)
      if (!isWorking && durationMin > 10 && Math.random() > 0.5) {
        await prisma.downtimeComment.create({
          data: {
            lineId: line.id,
            startTime: currentTime,
            endTime: finalEndTime,
            comment: downtimeReasons[Math.floor(Math.random() * downtimeReasons.length)]
          }
        });
      }

      // 3. Jeśli maszyna pracuje, wygeneruj scrap
      if (isWorking) {
        const scrapCount = Math.floor(Math.random() * 5);
        for (let i = 0; i < scrapCount; i++) {
          const scrapTime = addMinutes(currentTime, Math.random() * durationMin);
          if (isAfter(now, scrapTime)) {
            await prisma.scrapEvent.create({
              data: {
                lineId: line.id,
                time: scrapTime
              }
            });
          }
        }
      }

      currentTime = finalEndTime;
    }
  }

  console.log('✅ Simulation completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
