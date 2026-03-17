import { Tag } from './api';

export interface TagPreset {
  name: string;
  description: string;
  tags: Omit<Tag, 'value'>[];
}

export const PLC_PRESETS: TagPreset[] = [
  {
    name: 'Standardowe Monitorowanie Linii',
    description: 'Podstawowe sygnały dla dashboardu: Status (Praca/Postój), Prędkość (Wydajność) oraz Odpady (Scrap).',
    tags: [
      { name: 'status', db: 1, offset: 0, bit: 0, type: 'BOOL' },
      { name: 'speed', db: 1, offset: 2, type: 'REAL' },
      { name: 'scrap', db: 1, offset: 6, type: 'INT' },
    ],
  },
  {
    name: 'Monitorowanie Wydajności',
    description: 'Skoncentrowane na prędkości i licznikach produkcji.',
    tags: [
      { name: 'speed', db: 1, offset: 0, type: 'REAL' },
      { name: 'counter', db: 1, offset: 4, type: 'DINT' },
    ],
  },
  {
    name: 'Diagnostyka Stanu',
    description: 'Tylko sygnał statusu pracy maszyny.',
    tags: [
      { name: 'status', db: 1, offset: 0, bit: 0, type: 'BOOL' },
    ],
  }
];
