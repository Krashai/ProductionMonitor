'use server'

import { prisma } from '@/lib/prisma';
import { revalidatePath, unstable_cache } from 'next/cache';
import { format } from 'date-fns';
import {
  computeLineReport,
  aggregatePlannedLines,
  buildHealthDistribution,
  type LineComputed,
} from '@/lib/reporting/oee';

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
 * Shape returned by {@link getReportingData}. When the query fails,
 * `factorySummary` is `null` and `halls` is `[]` so the page can render
 * a helpful empty state instead of crashing on destructured fields.
 *
 * `avgOee`, `avgAvailability`, and `prevAvgOee` are `null` when the
 * scope contains zero lines with production plans — averaging "no
 * plan" into the factory KPI would be misleading.
 */
export type ReportingLineStats = {
  scrapCount: number;
  workingTimeMs: number;
  plannedTimeMs: number;
  availability: number | null;
  oee: number | null;
  hasPlan: boolean;
  isUnplanned: boolean;
};

export type ReportingLine = {
  id: string;
  name: string;
  stats: ReportingLineStats;
  prevStats: ReportingLineStats;
  incidents: Array<{
    startTime: Date;
    endTime: Date;
    durationMs: number;
    comment: string | null;
  }>;
};

export type ReportingHall = {
  id: string;
  name: string;
  stats: {
    avgOee: number | null;
    avgAvailability: number | null;
    totalScrap: number;
    integrityScore: number;
    plannedLineCount: number;
  };
  prevStats: {
    avgOee: number | null;
    totalScrap: number;
  };
  pareto: Array<{ name: string; downtimeMs: number }>;
  topScrapLine: { name: string; count: number } | null;
  lines: ReportingLine[];
};

export type ReportingFactorySummary = {
  avgOee: number | null;
  prevAvgOee: number | null;
  totalScrap: number;
  healthDistribution: {
    green: number;
    yellow: number;
    red: number;
    total: number;
  };
};

export type ReportingData = {
  factorySummary: ReportingFactorySummary | null;
  halls: ReportingHall[];
};

function toLineStats(computed: LineComputed): ReportingLineStats {
  return {
    scrapCount: computed.scrapCount,
    workingTimeMs: computed.workingTimeMs,
    plannedTimeMs: computed.plannedTimeMs,
    availability: computed.availability,
    oee: computed.oee,
    hasPlan: computed.hasPlan,
    isUnplanned: !computed.hasPlan,
  };
}

/**
 * Pobiera dane raportowe dla wszystkich hal w podanym zakresie czasu
 */
export async function getReportingData(from: Date, to: Date): Promise<ReportingData> {
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

    const reportData: ReportingHall[] = await Promise.all(halls.map(async (hall) => {
      // Pobieramy wszystkie statystyki linii w hali równolegle, potem
      // osobno incydenty (raw samples to jedyne źródło różne od OEE).
      type LineWithStats = {
        id: string;
        name: string;
        current: LineComputed;
        prev: LineComputed;
        incidents: Array<{ startTime: Date; endTime: Date; durationMs: number }>;
        comments: typeof hall.lines[number]['comments'];
      };

      const enriched: LineWithStats[] = await Promise.all(
        hall.lines.map(async (line) => {
          const [current, prev, incidents] = await Promise.all([
            getLineStats(line.id, from, to),
            getLineStats(line.id, prevFrom, prevTo),
            getLineIncidents(line.id, from, to),
          ]);
          return {
            id: line.id,
            name: line.name,
            current,
            prev,
            incidents,
            comments: line.comments,
          };
        })
      );

      const lineReports = enriched.map(e => ({
        id: e.id,
        name: e.name,
        stats: toLineStats(e.current),
        prevStats: toLineStats(e.prev),
        incidents: e.incidents.map(inc => ({
          ...inc,
          comment: e.comments.find(c =>
            c.startTime <= inc.endTime && c.endTime >= inc.startTime
          )?.comment || null,
        })),
      }));

      // Agregacja przy pomocy czystych funkcji z modułu reporting/oee.
      // Oba aggregatory ignorują linie bez planu — to jest świadoma
      // decyzja produktowa: linia bez planu nie jest "słaba", po prostu
      // nie ma jak ocenić jej wydajności w danym oknie.
      const currentComputed = enriched.map(e => e.current);
      const prevComputed = enriched.map(e => e.prev);

      const hallAgg = aggregatePlannedLines(currentComputed);
      const prevHallAgg = aggregatePlannedLines(prevComputed);

      const totalIncidents = lineReports.reduce((acc, l) => acc + l.incidents.length, 0);
      const commentedIncidents = lineReports.reduce((acc, l) =>
        acc + l.incidents.filter(i => i.comment).length, 0);

      // Pareto: TOP 3 linie o największym skumulowanym czasie przestoju
      const paretoLines = [...lineReports]
        .map(l => ({
          name: l.name,
          downtimeMs: l.incidents.reduce((acc, i) => acc + i.durationMs, 0)
        }))
        .sort((a, b) => b.downtimeMs - a.downtimeMs)
        .slice(0, 3)
        .filter(l => l.downtimeMs > 0);

      // Lider Odrzutów — tylko linie, które w ogóle miały zlecenia
      // w tym oknie. Inaczej linia bez planu i zerowym scrapem może
      // wygrać tę kategorię remisem, co jest mylące.
      const topScrapCandidate = [...lineReports]
        .filter(l => l.stats.hasPlan)
        .sort((a, b) => b.stats.scrapCount - a.stats.scrapCount)[0];

      return {
        id: hall.id,
        name: hall.name,
        stats: {
          avgOee: hallAgg.avgOee,
          avgAvailability: hallAgg.avgAvailability,
          totalScrap: hallAgg.totalScrap,
          integrityScore: totalIncidents > 0 ? (commentedIncidents / totalIncidents) * 100 : 100,
          plannedLineCount: hallAgg.plannedLineCount,
        },
        prevStats: {
          avgOee: prevHallAgg.avgOee,
          totalScrap: prevHallAgg.totalScrap,
        },
        pareto: paretoLines,
        topScrapLine: topScrapCandidate ? {
          name: topScrapCandidate.name,
          count: topScrapCandidate.stats.scrapCount,
        } : null,
        lines: lineReports,
      };
    }));

    // AGREGACJA GLOBALNA (DLA CAŁEJ FABRYKI) — rekonstruujemy
    // LineComputed z tego, co zapisaliśmy na poziomie hali.
    const allComputed: LineComputed[] = reportData
      .flatMap(h => h.lines)
      .map(l => ({
        hasPlan: l.stats.hasPlan,
        plannedTimeMs: l.stats.plannedTimeMs,
        workingTimeMs: l.stats.workingTimeMs,
        availability: l.stats.availability,
        oee: l.stats.oee,
        scrapCount: l.stats.scrapCount,
      }));
    const allPrevComputed: LineComputed[] = reportData
      .flatMap(h => h.lines)
      .map(l => ({
        hasPlan: l.prevStats.hasPlan,
        plannedTimeMs: l.prevStats.plannedTimeMs,
        workingTimeMs: l.prevStats.workingTimeMs,
        availability: l.prevStats.availability,
        oee: l.prevStats.oee,
        scrapCount: l.prevStats.scrapCount,
      }));

    const factoryAgg = aggregatePlannedLines(allComputed);
    const prevFactoryAgg = aggregatePlannedLines(allPrevComputed);
    const healthDistribution = buildHealthDistribution(allComputed);

    const factorySummary: ReportingFactorySummary = {
      avgOee: factoryAgg.avgOee,
      prevAvgOee: prevFactoryAgg.avgOee,
      totalScrap: factoryAgg.totalScrap,
      healthDistribution,
    };

    // JSON round-trip serializes Date → string for the Client Component
    // boundary. Prisma Date objects can't cross it otherwise.
    return JSON.parse(JSON.stringify({
      factorySummary,
      halls: reportData,
    }));
  } catch (error) {
    console.error('Error generating report:', error);
    // Return a typed empty shape so the Client Component can render
    // "no data" instead of crashing on `data.factorySummary.avgOee`.
    return { factorySummary: null, halls: [] };
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
 * Loads the raw data needed by {@link computeLineReport} and delegates
 * the actual math to the pure module in `@/lib/reporting/oee`. Keeping
 * the SQL here and the arithmetic there lets the calculation be unit
 * tested without a database.
 *
 * Query plan per call: one `findMany` for plans, one `findFirst` for
 * the prior status sample, one `findMany` for in-window history, one
 * `count` for scrap — four round-trips, all run in parallel where
 * possible. This replaces the previous N-plans raw-SQL loop.
 */
async function getLineStats(lineId: string, from: Date, to: Date): Promise<LineComputed> {
  const now = new Date();
  const upperBound = new Date(Math.min(to.getTime(), now.getTime()));

  // Plans must load first — scrap clipping uses their bounds.
  const plans = await prisma.productionPlan.findMany({
    where: {
      lineId,
      startTime: { lt: upperBound },
      endTime: { gt: from },
    },
    select: { startTime: true, endTime: true },
  });

  // No plan overlap → short-circuit via the pure module so we don't
  // hit the DB for history or scrap we'd never use.
  if (plans.length === 0) {
    return computeLineReport({
      from,
      to,
      now,
      plans: [],
      history: [],
      priorStatus: false,
      scrapCount: 0,
    });
  }

  // Clip plan ranges to the computable window for scrap filtering.
  const clippedPlans = plans
    .map(p => ({
      start: new Date(Math.max(p.startTime.getTime(), from.getTime())),
      end: new Date(Math.min(p.endTime.getTime(), upperBound.getTime())),
    }))
    .filter(p => p.end > p.start);

  const [priorSample, history, scrapCount] = await Promise.all([
    prisma.machineStatusHistory.findFirst({
      where: { lineId, time: { lt: from } },
      orderBy: { time: 'desc' },
      select: { status: true },
    }),
    prisma.machineStatusHistory.findMany({
      where: { lineId, time: { gte: from, lte: upperBound } },
      orderBy: { time: 'asc' },
      select: { time: true, status: true },
    }),
    clippedPlans.length > 0
      ? prisma.scrapEvent.count({
          where: {
            lineId,
            OR: clippedPlans.map(p => ({ time: { gte: p.start, lte: p.end } })),
          },
        })
      : Promise.resolve(0),
  ]);

  return computeLineReport({
    from,
    to,
    now,
    plans: plans.map(p => ({ startTime: p.startTime, endTime: p.endTime })),
    history: history.map(h => ({ time: h.time, status: h.status })),
    priorStatus: priorSample?.status ?? false,
    scrapCount,
  });
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
