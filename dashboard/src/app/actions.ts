'use server'

import { prisma } from '@/lib/prisma';
import { revalidatePath, unstable_cache } from 'next/cache';
import { format } from 'date-fns';

/**
 * Pobiera wszystkie hale wraz z liniami i ich aktualnym stanem
 * ZOPTYMALIZOWANE CACHE'OWANIEM
 */
export const getHallsWithLines = unstable_cache(
  async () => {
    const now = new Date();
    const recentThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minut wstecz

    try {
      console.log('--- FETCHING HALLS START (DB QUERY) ---');
      const halls = await prisma.hall.findMany({
        include: {
          lines: {
            include: {
              history: {
                orderBy: [
                  { time: 'desc' },
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
  },
  ['halls-overview'],
  { revalidate: 2, tags: ['halls-data'] } // Cache na 2 sekundy, tag do manualnej rewalidacji
);

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
 * Aktualizuje istniejące zlecenie
 */
export async function updateProductionPlan(id: string, data: {
  productIndex?: string;
  startTime?: Date;
  endTime?: Date;
  plannedSpeed?: number;
  lineId?: string;
}) {
  try {
    // Jeśli zmieniamy czasy lub linię, sprawdź kolizje (wykluczając obecny rekord)
    if (data.startTime || data.endTime || data.lineId) {
      const current = await prisma.productionPlan.findUnique({ where: { id } });
      if (!current) return { success: false, error: 'Nie znaleziono planu.' };

      const startTime = data.startTime || current.startTime;
      const endTime = data.endTime || current.endTime;
      const lineId = data.lineId || current.lineId;

      const overlap = await prisma.productionPlan.findFirst({
        where: {
          id: { not: id },
          lineId,
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: startTime } }
          ]
        }
      });

      if (overlap) {
        return { success: false, error: `Kolizja z indeksem ${overlap.productIndex}` };
      }
    }

    const updated = await prisma.productionPlan.update({
      where: { id },
      data,
    });

    revalidatePath('/');
    revalidatePath('/planning');
    revalidatePath(`/line/${updated.lineId}`);
    return { success: true, plan: updated };
  } catch (error) {
    console.error('Error updating production plan:', error);
    return { success: false, error: 'Błąd podczas aktualizacji.' };
  }
}

/**
 * Usuwa zlecenie z planu
 */
export async function deleteProductionPlan(id: string) {
  try {
    const deleted = await prisma.productionPlan.delete({
      where: { id },
    });
    revalidatePath('/');
    revalidatePath('/planning');
    revalidatePath(`/line/${deleted.lineId}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting production plan:', error);
    return { success: false, error: 'Nie udało się usunąć zlecenia.' };
  }
}

/**
 * Pobiera wszystkie plany dla wszystkich linii w danym zakresie
 */
export async function getAllProductionPlans(from: Date, to: Date) {
  try {
    const plans = await prisma.productionPlan.findMany({
      where: {
        OR: [
          { startTime: { lte: to }, endTime: { gte: from } }
        ]
      },
      include: {
        line: {
          select: { name: true, hall: { select: { name: true } } }
        }
      },
      orderBy: { startTime: 'asc' }
    });
    return JSON.parse(JSON.stringify(plans));
  } catch (error) {
    console.error('Error fetching all plans:', error);
    return [];
  }
}

/**
 * Pobiera prostą listę wszystkich linii
 */
export async function getLines() {
  try {
    const lines = await prisma.line.findMany({
      include: { hall: true }
    });
    console.log(`Fetched ${lines.length} lines for dropdown.`);
    return JSON.parse(JSON.stringify(lines));
  } catch (error) {
    console.error('Error fetching lines:', error);
    return [];
  }
}

/**
 * Pobiera listę hal dla zakładek
 */
export async function getHalls() {
  try {
    return await prisma.hall.findMany({
      orderBy: { name: 'asc' }
    });
  } catch (error) {
    console.error('Error fetching halls:', error);
    return [];
  }
}

/**
 * Pobiera szczegółowe dane linii dla osi czasu
 * ZOPTYMALIZOWANE: Pobiera tylko zmiany stanu (status/speed), nie wszystkie punkty
 */
export async function getLineDetails(lineId: string, from: Date, to: Date) {
  try {
    const linePromise = prisma.line.findUnique({
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

    // Pobieramy historię za pomocą SQL, filtrując tylko zmiany
    // Dodajemy też stan początkowy (ostatni punkt przed "from"), aby oś czasu wiedziała od czego zacząć
    const historyPromise = prisma.$queryRaw<any[]>`
      WITH raw_history AS (
        -- Punkt początkowy (stan tuż przed zakresem)
        (
          SELECT "id", "time", "status", "speed"
          FROM machine_status_history
          WHERE "lineId" = ${lineId} AND "time" < ${from}
          ORDER BY "time" DESC
          LIMIT 1
        )
        UNION ALL
        -- Punkty w zakresie
        (
          SELECT "id", "time", "status", "speed"
          FROM machine_status_history
          WHERE "lineId" = ${lineId} AND "time" >= ${from} AND "time" <= ${to}
          ORDER BY "time" ASC
        )
      ),
      changes AS (
        SELECT 
          "id", "time", "status", "speed",
          LAG("status") OVER (ORDER BY "time") as "prev_status",
          LAG("speed") OVER (ORDER BY "time") as "prev_speed"
        FROM raw_history
      )
      SELECT "id", "time", "status", "speed"
      FROM changes
      WHERE "prev_status" IS NULL 
         OR "status" IS DISTINCT FROM "prev_status"
         OR ABS("speed" - "prev_speed") >= 0.5
      ORDER BY "time" ASC;
    `;

    const [line, history] = await Promise.all([linePromise, historyPromise]);

    if (!line) return null;

    return {
      ...line,
      history: history.map(h => ({
        ...h,
        // Konwersja dla kompatybilności z Prisma types
        time: h.time.toISOString() 
      }))
    };
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

      // Agregacja na poziomie hali (tylko dla linii, które miały plan lub pracowały)
      const plannedLines = lineReports.filter(l => !l.stats.isUnplanned);
      const prevPlannedLines = lineReports.filter(l => !l.prevStats.isUnplanned);

      const totalIncidents = lineReports.reduce((acc, l) => acc + l.incidents.length, 0);
      const commentedIncidents = lineReports.reduce((acc, l) => 
        acc + l.incidents.filter(i => i.comment).length, 0);

      const hallStats = {
        avgOee: plannedLines.length > 0 
          ? plannedLines.reduce((acc, l) => acc + l.stats.oee, 0) / plannedLines.length 
          : 0,
        totalScrap: lineReports.reduce((acc, l) => acc + l.stats.scrapCount, 0),
        avgAvailability: plannedLines.length > 0
          ? plannedLines.reduce((acc, l) => acc + l.stats.availability, 0) / plannedLines.length
          : 0,
        integrityScore: totalIncidents > 0 ? (commentedIncidents / totalIncidents) * 100 : 100,
      };

      const prevHallStats = {
        avgOee: prevPlannedLines.length > 0
          ? prevPlannedLines.reduce((acc, l) => acc + l.prevStats.oee, 0) / prevPlannedLines.length
          : 0,
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
    const allPlannedLines = allLines.filter(l => !l.stats.isUnplanned);
    const allPrevPlannedLines = allLines.filter(l => !l.prevStats.isUnplanned);

    const factorySummary = {
      avgOee: allPlannedLines.length > 0
        ? allPlannedLines.reduce((acc, l) => acc + l.stats.oee, 0) / allPlannedLines.length
        : 0,
      totalScrap: allLines.reduce((acc, l) => acc + l.stats.scrapCount, 0),
      prevAvgOee: allPrevPlannedLines.length > 0
        ? allPrevPlannedLines.reduce((acc, l) => acc + l.prevStats.oee, 0) / allPrevPlannedLines.length
        : 0,
      healthDistribution: {
        green: allPlannedLines.filter(l => l.stats.oee > 85).length,
        yellow: allPlannedLines.filter(l => l.stats.oee <= 85 && l.stats.oee >= 60).length,
        red: allPlannedLines.filter(l => l.stats.oee < 60).length,
        total: allPlannedLines.length
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
 * Pomocnicza funkcja do statystyk linii (ZOPTYMALIZOWANA SQL)
 */
async function getLineStats(lineId: string, from: Date, to: Date) {
  // 1. Pobieramy plany produkcyjne w tym zakresie (przycięte do granic from/to i NOW)
  const plans = await prisma.productionPlan.findMany({
    where: {
      lineId,
      startTime: { lt: to },
      endTime: { gt: from },
    }
  });

  const now = new Date();
  let totalPlannedTimeMs = 0;
  
  // Obliczamy całkowity zaplanowany czas (mianownik OEE)
  plans.forEach(p => {
    const start = Math.max(p.startTime.getTime(), from.getTime());
    const end = Math.min(p.endTime.getTime(), to.getTime(), now.getTime());
    if (end > start) {
      totalPlannedTimeMs += (end - start);
    }
  });

  // 2. Scrap count (tylko w trakcie planów)
  let scrapCount = 0;
  if (plans.length > 0) {
    const scrapResult = await prisma.scrapEvent.count({
      where: {
        lineId,
        OR: plans.map(p => ({
          time: {
            gte: new Date(Math.max(p.startTime.getTime(), from.getTime())),
            lte: new Date(Math.min(p.endTime.getTime(), to.getTime(), now.getTime()))
          }
        }))
      }
    });
    scrapCount = scrapResult;
  }

  // 3. Obliczanie Working Time przy użyciu SQL (Tylko w oknach planów)
  let workingTimeMs = 0;
  if (totalPlannedTimeMs > 0) {
    // Dla każdego segmentu planu liczymy czas pracy
    for (const p of plans) {
      const pStart = new Date(Math.max(p.startTime.getTime(), from.getTime()));
      const pEnd = new Date(Math.min(p.endTime.getTime(), to.getTime(), now.getTime()));
      
      if (pEnd <= pStart) continue;

      const result = await prisma.$queryRaw<any[]>`
        WITH bounds AS (
          SELECT ${pStart}::timestamptz as start_time, ${pEnd}::timestamptz as end_time
        ),
        initial_state AS (
          SELECT status
          FROM machine_status_history
          WHERE "lineId" = ${lineId} AND "time" < (SELECT start_time FROM bounds)
          ORDER BY "time" DESC
          LIMIT 1
        ),
        timeline AS (
          SELECT (SELECT start_time FROM bounds) as time, COALESCE((SELECT status FROM initial_state), false) as status
          UNION ALL
          SELECT "time", status
          FROM machine_status_history
          WHERE "lineId" = ${lineId} 
            AND "time" >= (SELECT start_time FROM bounds) 
            AND "time" <= (SELECT end_time FROM bounds)
          UNION ALL
          SELECT (SELECT end_time FROM bounds) as time, true as status
        )
        SELECT SUM(duration) as "workingTimeMs"
        FROM (
          SELECT
            status,
            EXTRACT(EPOCH FROM (LEAD(time) OVER (ORDER BY time) - time)) * 1000 as duration
          FROM timeline
        ) sub
        WHERE status = true;
      `;
      workingTimeMs += Number(result[0]?.workingTimeMs || 0);
    }
  }

  const availability = totalPlannedTimeMs > 0 ? (workingTimeMs / totalPlannedTimeMs) * 100 : 0;
  const oee = Math.min(100, availability); // Na razie uproszczone

  // Linia nieplanowana to taka, która nie miała zlecenia I nie pracowała
  const isUnplanned = totalPlannedTimeMs === 0 && workingTimeMs === 0;

  return {
    scrapCount,
    workingTimeMs,
    availability,
    oee,
    isUnplanned,
    hasPlan: totalPlannedTimeMs > 0,
    plannedTimeMs: totalPlannedTimeMs
  };
}

/**
 * Pomocnicza funkcja do wykrywania incydentów (TYLKO W TRAKCIE PLANU)
 */
async function getLineIncidents(lineId: string, from: Date, to: Date) {
  const THRESHOLD_SECONDS = 10 * 60; // 10 minut
  const now = new Date();

  // Pobieramy plany
  const plans = await prisma.productionPlan.findMany({
    where: {
      lineId,
      startTime: { lt: to },
      endTime: { gt: from },
    }
  });

  const allIncidents: any[] = [];

  for (const p of plans) {
    const pStart = new Date(Math.max(p.startTime.getTime(), from.getTime()));
    const pEnd = new Date(Math.min(p.endTime.getTime(), to.getTime(), now.getTime()));
    
    if (pEnd <= pStart) continue;

    const incidents = await prisma.$queryRaw<any[]>`
      WITH bounds AS (
        SELECT ${pStart}::timestamptz as start_time, ${pEnd}::timestamptz as end_time
      ),
      initial_state AS (
        SELECT status
        FROM machine_status_history
        WHERE "lineId" = ${lineId} AND "time" < (SELECT start_time FROM bounds)
        ORDER BY "time" DESC
        LIMIT 1
      ),
      timeline AS (
        SELECT (SELECT start_time FROM bounds) as time, COALESCE((SELECT status FROM initial_state), false) as status
        UNION ALL
        SELECT "time", status
        FROM machine_status_history
        WHERE "lineId" = ${lineId} 
          AND "time" >= (SELECT start_time FROM bounds) 
          AND "time" <= (SELECT end_time FROM bounds)
        UNION ALL
        SELECT (SELECT end_time FROM bounds) as time, true as status
      )
      SELECT 
        time as "startTime",
        next_time as "endTime",
        duration * 1000 as "durationMs"
      FROM (
        SELECT 
          time,
          status,
          LEAD(time) OVER (ORDER BY time) as next_time,
          EXTRACT(EPOCH FROM (LEAD(time) OVER (ORDER BY time) - time)) as duration
        FROM timeline
      ) sub
      WHERE status = false 
        AND duration >= ${THRESHOLD_SECONDS};
    `;
    
    allIncidents.push(...incidents.map(inc => ({
      startTime: new Date(inc.startTime),
      endTime: new Date(inc.endTime),
      durationMs: Number(inc.durationMs)
    })));
  }

  return allIncidents;
}
