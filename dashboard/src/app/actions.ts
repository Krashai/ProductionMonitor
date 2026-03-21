'use server'

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { format } from 'date-fns';

/**
 * Pobiera wszystkie hale wraz z liniami i ich aktualnym stanem
 */
export async function getHallsWithLines() {
  const now = new Date();
  try {
    console.log('--- FETCHING HALLS START ---');
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

    console.log(`--- FETCHED ${halls.length} HALLS ---`);
    // Serializacja dat przed wysłaniem do Client Component
    return JSON.parse(JSON.stringify(halls));
  } catch (error) {
    console.error('CRITICAL ERROR IN getHallsWithLines:', error);
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

/**
 * Pobiera dane raportowe dla wszystkich hal w podanym zakresie czasu
 */
export async function getReportingData(from: Date, to: Date) {
  try {
    const duration = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - duration);
    const prevTo = new Date(to.getTime() - duration);

    const halls = await prisma.hall.findMany({
      include: {
        lines: {
          include: {
            comments: {
              where: {
                OR: [
                  { startTime: { lte: to }, endTime: { gte: from } }
                ]
              }
            }
          }
        }
      }
    });

    const reportData = await Promise.all(halls.map(async (hall) => {
      const lineReports = await Promise.all(hall.lines.map(async (line) => {
        // 1. Statystyki aktualne
        const stats = await getLineStats(line.id, from, to);
        // 2. Statystyki poprzednie (do porównania)
        const prevStats = await getLineStats(line.id, prevFrom, prevTo);
        // 3. Incydenty (przestoje > 10 min)
        const incidents = await getLineIncidents(line.id, from, to);

        return {
          id: line.id,
          name: line.name,
          stats,
          prevStats,
          incidents: incidents.map(inc => ({
            ...inc,
            comment: line.comments.find(c => 
              (c.startTime <= inc.endTime && c.endTime >= inc.startTime)
            )?.comment || null
          }))
        };
      }));

      // Agregacja na poziomie hali
      const totalIncidents = lineReports.reduce((acc, l) => acc + l.incidents.length, 0);
      const commentedIncidents = lineReports.reduce((acc, l) => 
        acc + l.incidents.filter(i => i.comment).length, 0);

      const hallStats = {
        avgOee: lineReports.reduce((acc, l) => acc + l.stats.oee, 0) / (lineReports.length || 1),
        totalScrap: lineReports.reduce((acc, l) => acc + l.stats.scrapCount, 0),
        avgAvailability: lineReports.reduce((acc, l) => acc + l.stats.availability, 0) / (lineReports.length || 1),
        integrityScore: totalIncidents > 0 ? (commentedIncidents / totalIncidents) * 100 : 100,
      };

      const prevHallStats = {
        avgOee: lineReports.reduce((acc, l) => acc + l.prevStats.oee, 0) / (lineReports.length || 1),
        totalScrap: lineReports.reduce((acc, l) => acc + l.prevStats.scrapCount, 0),
      };

      // Pareto: TOP 3 linie o największym skumulowanym czasie przestoju
      const paretoLines = [...lineReports]
        .map(l => ({
          name: l.name,
          downtimeMs: l.incidents.reduce((acc, i) => acc + i.durationMs, 0)
        }))
        .sort((a, b) => b.downtimeMs - a.downtimeMs)
        .slice(0, 3)
        .filter(l => l.downtimeMs > 0);

      // Lider Odrzutów (Top Scrap Line)
      const topScrapLine = [...lineReports]
        .sort((a, b) => b.stats.scrapCount - a.stats.scrapCount)[0] || null;

      return {
        id: hall.id,
        name: hall.name,
        stats: hallStats,
        prevStats: prevHallStats,
        pareto: paretoLines,
        topScrapLine: topScrapLine ? {
          name: topScrapLine.name,
          count: topScrapLine.stats.scrapCount
        } : null,
        lines: lineReports
      };
    }));

    // AGREGACJA GLOBALNA (DLA CAŁEJ FABRYKI)
    const allLines = reportData.flatMap(h => h.lines);
    const factorySummary = {
      avgOee: allLines.reduce((acc, l) => acc + l.stats.oee, 0) / (allLines.length || 1),
      totalScrap: allLines.reduce((acc, l) => acc + l.stats.scrapCount, 0),
      prevAvgOee: allLines.reduce((acc, l) => acc + l.prevStats.oee, 0) / (allLines.length || 1),
      healthDistribution: {
        green: allLines.filter(l => l.stats.oee > 85).length,
        yellow: allLines.filter(l => l.stats.oee <= 85 && l.stats.oee >= 60).length,
        red: allLines.filter(l => l.stats.oee < 60).length,
        total: allLines.length
      }
    };

    return JSON.parse(JSON.stringify({
      factorySummary,
      halls: reportData
    }));
  } catch (error) {
    console.error('Error generating report:', error);
    return [];
  }
}

/**
 * Pomocnicza funkcja do wyliczania aktywności godzinowej hali (Heatmapa)
 */
async function getHallHourlyActivity(hallId: string, from: Date, to: Date) {
  // Pobieramy historię statusów dla wszystkich linii w danej hali
  const history = await prisma.machineStatusHistory.findMany({
    where: {
      line: { hallId },
      time: { gte: from, lte: to }
    },
    orderBy: { time: 'asc' }
  });

  const hoursMap: Record<string, { total: number, active: number }> = {};
  
  // Inicjalizacja mapy godzinowej
  let current = new Date(from);
  current.setMinutes(0, 0, 0);
  while (current <= to) {
    const key = current.toISOString();
    hoursMap[key] = { total: 0, active: 0 };
    current = new Date(current.getTime() + 60 * 60 * 1000);
  }

  // Grupowanie aktywności (uproszczone zliczanie próbek jako wskaźnik aktywności)
  history.forEach(entry => {
    const h = new Date(entry.time);
    h.setMinutes(0, 0, 0);
    const key = h.toISOString();
    if (hoursMap[key]) {
      hoursMap[key].total++;
      if (entry.status) hoursMap[key].active++;
    }
  });

  return Object.entries(hoursMap).map(([time, stats]) => ({
    time,
    intensity: stats.total > 0 ? stats.active / stats.total : 0
  }));
}

/**
 * Pomocnicza funkcja do statystyk linii
 */
async function getLineStats(lineId: string, from: Date, to: Date) {
  // Scrap count
  const scrapCount = await prisma.scrapEvent.count({
    where: { lineId, time: { gte: from, lte: to } }
  });

  // Historia statusów do obliczenia Availability
  const history = await prisma.machineStatusHistory.findMany({
    where: { lineId, time: { gte: from, lte: to } },
    orderBy: { time: 'asc' }
  });

  let workingTimeMs = 0;
  if (history.length > 1) {
    for (let i = 0; i < history.length - 1; i++) {
      if (history[i].status) {
        workingTimeMs += history[i+1].time.getTime() - history[i].time.getTime();
      }
    }
  }

  const totalTimeMs = to.getTime() - from.getTime();
  const availability = totalTimeMs > 0 ? (workingTimeMs / totalTimeMs) * 100 : 0;
  
  // Uproszczone OEE na potrzeby MVP (dostępność * jakość, gdzie jakość to 1 - scrap/produkcja)
  // Przyjmujemy założenie o wydajności 100% jeśli brak planów
  const oee = Math.min(100, availability); // TODO: Rozbudować o Performance i Quality

  return {
    scrapCount,
    workingTimeMs,
    availability,
    oee
  };
}

/**
 * Pomocnicza funkcja do wykrywania incydentów (przestojów > 10 min)
 */
async function getLineIncidents(lineId: string, from: Date, to: Date) {
  const history = await prisma.machineStatusHistory.findMany({
    where: { lineId, time: { gte: from, lte: to } },
    orderBy: { time: 'asc' }
  });

  const incidents = [];
  const THRESHOLD_MS = 10 * 60 * 1000; // 10 minut

  if (history.length > 1) {
    for (let i = 0; i < history.length - 1; i++) {
      if (!history[i].status) { // Przestój
        const duration = history[i+1].time.getTime() - history[i].time.getTime();
        if (duration >= THRESHOLD_MS) {
          incidents.push({
            startTime: history[i].time,
            endTime: history[i+1].time,
            durationMs: duration
          });
        }
      }
    }
  }

  return incidents;
}
