'use server'

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * Pobiera wszystkie hale wraz z liniami i ich aktualnym stanem
 */
export async function getHallsWithLines() {
  const now = new Date();
  try {
    const halls = await prisma.hall.findMany({
      include: {
        lines: {
          include: {
            history: {
              orderBy: [
                { time: 'desc' },
                { speed: 'desc' }
              ],
              take: 1,
            },
            plans: {
              where: {
                startTime: { lte: now },
                endTime: { gte: now },
              },
              take: 1,
            },
            _count: {
              select: {
                scrap: {
                  where: {
                    time: {
                      gte: new Date(Date.now() - 60 * 60 * 1000),
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Serializacja dat przed wysłaniem do Client Component
    return JSON.parse(JSON.stringify(halls));
  } catch (error) {
    console.error('Error fetching halls:', error);
    return [];
  }
}

/**
 * Dodaje nowe zlecenie do planu produkcji
 */
export async function addProductionPlan(data: {
  lineId: string;
  productIndex: string;
  startTime: Date;
  endTime: Date;
  plannedSpeed: number;
  ignoreWarning?: boolean; // Pozwala wymusić zapis mimo kolizji
}) {
  try {
    // 1. Sprawdź kolizje
    const overlap = await prisma.productionPlan.findFirst({
      where: {
        lineId: data.lineId,
        AND: [
          { startTime: { lt: data.endTime } },
          { endTime: { gt: data.startTime } }
        ]
      }
    });

    if (overlap && !data.ignoreWarning) {
      return { 
        success: false, 
        warning: true, 
        message: `Wykryto kolizję z indeksem ${overlap.productIndex} (${format(overlap.startTime, 'HH:mm')} - ${format(overlap.endTime, 'HH:mm')}). Czy na pewno chcesz dodać plan jako kolejny wiersz?` 
      };
    }

    // 2. Jeśli brak kolizji lub zignorowano - zapisz
    const plan = await prisma.productionPlan.create({
      data: {
        lineId: data.lineId,
        productIndex: data.productIndex,
        startTime: data.startTime,
        endTime: data.endTime,
        plannedSpeed: data.plannedSpeed,
      },
    });
    revalidatePath('/');
    revalidatePath('/planning');
    return { success: true, plan };
  } catch (error) {
    console.error('Error adding production plan:', error);
    return { success: false, error: 'Nie udało się dodać planu.' };
  }
}

/**
 * Pobiera prostą listę wszystkich linii
 */
export async function getLines() {
  try {
    return await prisma.line.findMany({
      select: { id: true, name: true, hall: { select: { name: true } } }
    });
  } catch (error) {
    console.error('Error fetching lines:', error);
    return [];
  }
}

/**
 * Pobiera szczegółowe dane linii dla osi czasu
 */
export async function getLineDetails(lineId: string, from: Date, to: Date) {
  try {
    const line = await prisma.line.findUnique({
      where: { id: lineId },
      include: {
        plans: {
          where: {
            OR: [
              { startTime: { lte: to }, endTime: { gte: from } }
            ]
          },
          orderBy: { startTime: 'asc' }
        },
        history: {
          where: {
            time: { gte: from, lte: to }
          },
          orderBy: { time: 'asc' }
        },
        scrap: {
          where: {
            time: { gte: from, lte: to }
          }
        },
        comments: {
          where: {
            OR: [
              { startTime: { lte: to }, endTime: { gte: from } }
            ]
          }
        }
      }
    });

    return line;
  } catch (error) {
    console.error('Error fetching line details:', error);
    return null;
  }
}

/**
 * Dodaje komentarz do przestoju
 */
export async function addDowntimeComment(data: {
  lineId: string;
  startTime: Date;
  endTime: Date;
  comment: string;
}) {
  try {
    const comment = await prisma.downtimeComment.create({
      data,
    });
    revalidatePath(`/line/${data.lineId}`);
    return { success: true, comment };
  } catch (error) {
    console.error('Error adding comment:', error);
    return { success: false, error: 'Nie udało się zapisać komentarza.' };
  }
}

/**
 * Aktualizuje istniejący komentarz
 */
export async function updateDowntimeComment(id: string, comment: string) {
  try {
    const updated = await prisma.downtimeComment.update({
      where: { id },
      data: { comment },
    });
    revalidatePath(`/line/${updated.lineId}`);
    return { success: true, updated };
  } catch (error) {
    console.error('Error updating comment:', error);
    return { success: false, error: 'Nie udało się zaktualizować komentarza.' };
  }
}
