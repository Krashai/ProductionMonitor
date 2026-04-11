import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Standardowe sloty CPU dla rodzin Siemens przez ISO-on-TCP (snap7):
//   S7-300:       rack 0, slot 2
//   S7-1200/1500: rack 0, slot 1
// Jeśli konkretna instalacja używa innego slotu, można skorygować później
// w UI lub bezpośrednio w bazie.
type PlcType = 'S7-300' | 'S7-1200' | 'S7-1500';

interface TagDef {
  name: string;
  db: number;
  offset: number;
  bit: number;
  type: 'BOOL' | 'REAL' | 'INT' | 'DINT' | 'STRING';
}

interface LineDef {
  plcId: string;
  name: string;
  ip: string;
  type: PlcType;
  tags: TagDef[];
  notes?: string;
}

interface HallDef {
  name: string;
  lines: LineDef[];
}

function slotForType(type: PlcType): number {
  return type === 'S7-300' ? 2 : 1;
}

// Konwencja nazewnictwa tagów jest istotna — PLCWorker w gateway/backend
// rozpoznaje statusy po nazwach:
//   - 'status' (lub 'Status'/'state'/'state2') → bit pracy linii
//   - 'speed'  (lub 'Speed')                   → prędkość linii (REAL)
//   - 'scrap'  (lub 'scrap_pulse')             → impuls odrzutu
// Nazwy w seedzie są zawsze lowercase.

const DATA: HallDef[] = [
  {
    name: 'HALA 1',
    lines: [
      {
        plcId: 'LP102',
        name: 'LP102',
        ip: '10.3.0.74',
        type: 'S7-1500',
        tags: [
          // Praca = Laser ON Status
          { name: 'status', db: 30, offset: 1203, bit: 5, type: 'BOOL' },
          { name: 'speed', db: 30, offset: 896, bit: 0, type: 'REAL' },
          { name: 'scrap', db: 30, offset: 1211, bit: 5, type: 'BOOL' },
        ],
        notes: 'Praca = Laser ON Status',
      },
      {
        plcId: 'LP202',
        name: 'LP202',
        ip: '10.3.0.68',
        type: 'S7-1500',
        tags: [
          { name: 'status', db: 105, offset: 1, bit: 3, type: 'BOOL' },
          { name: 'speed', db: 105, offset: 74, bit: 0, type: 'REAL' },
          { name: 'scrap', db: 307, offset: 9, bit: 1, type: 'BOOL' },
        ],
      },
      {
        plcId: 'LP702',
        name: 'LP702',
        ip: '10.3.0.53',
        type: 'S7-1200',
        tags: [
          // Praca = WT3
          { name: 'status', db: 999, offset: 362, bit: 1, type: 'BOOL' },
          { name: 'speed', db: 999, offset: 0, bit: 0, type: 'REAL' },
          // UWAGA: Scrap = QualityOK status. W kodzie workera edge detection
          // wyzwala scrap na zboczu narastającym. Jeśli QualityOK=TRUE dla
          // dobrej sztuki, semantyka może wymagać inwersji — do zweryfikowania
          // na linii produkcyjnej.
          { name: 'scrap', db: 999, offset: 362, bit: 3, type: 'BOOL' },
        ],
        notes: 'Praca = WT3; Scrap = QualityOK status (wymaga weryfikacji semantyki)',
      },
      {
        plcId: 'LP802',
        name: 'LP802',
        ip: '10.3.0.77',
        type: 'S7-1500',
        tags: [
          // Praca z SIKORY
          { name: 'status', db: 30, offset: 370, bit: 0, type: 'BOOL' },
          { name: 'speed', db: 30, offset: 0, bit: 0, type: 'REAL' },
          { name: 'scrap', db: 30, offset: 436, bit: 3, type: 'BOOL' },
        ],
        notes: 'Praca z SIKORY',
      },
      {
        plcId: 'LP902',
        name: 'LP902',
        ip: '10.3.0.100',
        type: 'S7-1500',
        tags: [
          // Praca z SIKORY
          { name: 'status', db: 30, offset: 422, bit: 0, type: 'BOOL' },
          { name: 'speed', db: 30, offset: 0, bit: 0, type: 'REAL' },
          { name: 'scrap', db: 30, offset: 423, bit: 5, type: 'BOOL' },
        ],
        notes: 'Praca z SIKORY',
      },
    ],
  },
  {
    name: 'HALA 2',
    lines: [
      {
        plcId: 'LP302',
        name: 'LP302',
        ip: '10.3.0.69',
        type: 'S7-1500',
        tags: [
          { name: 'status', db: 105, offset: 1, bit: 3, type: 'BOOL' },
          { name: 'speed', db: 105, offset: 74, bit: 0, type: 'REAL' },
          { name: 'scrap', db: 307, offset: 9, bit: 1, type: 'BOOL' },
        ],
      },
      {
        plcId: 'LP402',
        name: 'LP402',
        ip: '10.3.0.92',
        type: 'S7-300',
        tags: [
          { name: 'status', db: 105, offset: 1, bit: 3, type: 'BOOL' },
          { name: 'speed', db: 105, offset: 74, bit: 0, type: 'REAL' },
          { name: 'scrap', db: 307, offset: 9, bit: 1, type: 'BOOL' },
        ],
      },
    ],
  },
  {
    name: 'HALA 3',
    lines: [
      {
        plcId: 'LP608',
        name: 'LP608',
        ip: '10.3.0.84',
        type: 'S7-1500',
        tags: [
          // Praca = Odciąg 1 praca
          { name: 'status', db: 30, offset: 832, bit: 3, type: 'BOOL' },
          { name: 'speed', db: 30, offset: 0, bit: 0, type: 'REAL' },
          { name: 'scrap', db: 30, offset: 148, bit: 2, type: 'BOOL' },
        ],
        notes: 'Praca = Odciąg 1 praca',
      },
      {
        plcId: 'LP609',
        name: 'LP609',
        ip: '10.3.0.85',
        type: 'S7-1500',
        tags: [
          // Praca = Odciąg 1 praca
          { name: 'status', db: 30, offset: 832, bit: 3, type: 'BOOL' },
          { name: 'speed', db: 30, offset: 0, bit: 0, type: 'REAL' },
          { name: 'scrap', db: 30, offset: 148, bit: 2, type: 'BOOL' },
        ],
        notes: 'Praca = Odciąg 1 praca',
      },
      {
        plcId: 'LCE132',
        name: 'LCE132',
        ip: '10.3.0.78',
        type: 'S7-1500',
        tags: [
          { name: 'status', db: 50, offset: 9, bit: 6, type: 'BOOL' },
          { name: 'speed', db: 50, offset: 68, bit: 0, type: 'REAL' },
          { name: 'scrap', db: 50, offset: 11, bit: 2, type: 'BOOL' },
        ],
      },
      {
        plcId: 'INS1',
        name: 'INS1',
        ip: '10.3.0.76',
        type: 'S7-1500',
        tags: [
          // Praca = Praca krążkarki
          { name: 'status', db: 50, offset: 224, bit: 4, type: 'BOOL' },
          { name: 'speed', db: 50, offset: 152, bit: 0, type: 'REAL' },
          // Scrap = nieosiągnięta dł. krążka — semantyka do zweryfikowania
          { name: 'scrap', db: 50, offset: 230, bit: 5, type: 'BOOL' },
        ],
        notes:
          'Praca = Praca krążkarki; Scrap = nieosiągnięta dł. krążka (weryfikacja semantyki)',
      },
    ],
  },
];

async function main() {
  console.log('🌱 Checking if database needs seeding...');

  const hallCount = await prisma.hall.count();
  if (hallCount > 0) {
    console.log('⚠️ Database already contains data. Skipping seed to protect user changes.');
    return;
  }

  console.log('🌱 Seeding production halls and lines with real PLC configuration...');

  for (const hallData of DATA) {
    const hall = await prisma.hall.upsert({
      where: { name: hallData.name },
      update: {},
      create: { name: hallData.name },
    });

    for (const lineData of hallData.lines) {
      // Prisma's Json column expects InputJsonValue. Our TagDef[] is
      // structurally compatible (only primitives + arrays + objects)
      // but TypeScript can't prove that without a structural cast.
      const tagsJson = lineData.tags as unknown as Prisma.InputJsonValue;

      const line = await prisma.line.upsert({
        where: { plcId: lineData.plcId },
        update: {
          name: lineData.name,
          hallId: hall.id,
          ip: lineData.ip,
          rack: 0,
          slot: slotForType(lineData.type),
          type: lineData.type,
          tags: tagsJson,
        },
        create: {
          plcId: lineData.plcId,
          name: lineData.name,
          hallId: hall.id,
          ip: lineData.ip,
          rack: 0,
          slot: slotForType(lineData.type),
          type: lineData.type,
          tags: tagsJson,
        },
      });

      const noteSuffix = lineData.notes ? `  (${lineData.notes})` : '';
      console.log(
        `   Registered line: ${line.name} @ ${lineData.ip} [${lineData.type}, slot ${slotForType(lineData.type)}]${noteSuffix}`
      );
    }
  }

  console.log('✅ Seed finished. Database structure is ready for production data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
