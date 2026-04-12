/**
 * Plan-aware Availability/OEE calculations.
 *
 * This module is intentionally pure — it does not touch Prisma or any
 * runtime side-effect. The caller is responsible for loading plans,
 * history samples, scrap counts, and the "prior status" (the last
 * history sample before `from`, if any) and feeding them in.
 *
 * Availability is computed strictly inside planned production windows:
 *
 *     availability = running_time_inside_plan / planned_time_in_window
 *
 * A line with no plan overlap in the window has `hasPlan=false` and
 * `availability=null` / `oee=null`. Aggregations (hall / factory) must
 * ignore unplanned lines when computing averages.
 */

export interface Plan {
  startTime: Date;
  endTime: Date;
}

export interface HistorySample {
  time: Date;
  status: boolean;
}

export interface LineComputationInput {
  from: Date;
  to: Date;
  /** Current wall-clock. Plans are clipped to `min(to, now)` to avoid
   * counting future planned time against a line that hasn't had a
   * chance to run yet. */
  now: Date;
  plans: Plan[];
  /** History samples inside `[from, to]`, sorted ascending by `time`. */
  history: HistorySample[];
  /** Status that was active immediately before `from`. If unknown
   * (no sample before `from` ever existed) pass `false`. */
  priorStatus: boolean;
  scrapCount: number;
}

export interface LineComputed {
  hasPlan: boolean;
  plannedTimeMs: number;
  workingTimeMs: number;
  availability: number | null;
  oee: number | null;
  scrapCount: number;
}

interface Interval {
  start: number; // ms since epoch
  end: number;
}

/**
 * Merge a list of intervals: dedupe overlaps, sort ascending, return
 * disjoint intervals covering the same set. Zero-length intervals
 * (`start >= end`) are dropped.
 */
function mergeIntervals(intervals: Interval[]): Interval[] {
  const valid = intervals.filter((iv) => iv.end > iv.start);
  if (valid.length === 0) return [];
  valid.sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...valid[0] }];
  for (let i = 1; i < valid.length; i++) {
    const last = out[out.length - 1];
    const cur = valid[i];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** Intersect two interval lists. Both must be sorted and disjoint. */
function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start);
    const end = Math.min(a[i].end, b[j].end);
    if (end > start) out.push({ start, end });
    if (a[i].end < b[j].end) i++;
    else j++;
  }
  return out;
}

function sumDuration(intervals: Interval[]): number {
  return intervals.reduce((acc, iv) => acc + (iv.end - iv.start), 0);
}

/**
 * Reduce the history + prior status into a list of "running" intervals
 * across the window `[from, upperBound)`. The result is disjoint and
 * sorted but not merged — each interval corresponds to one contiguous
 * run of `status=true`.
 */
function buildRunningIntervals(
  history: HistorySample[],
  priorStatus: boolean,
  from: number,
  upperBound: number
): Interval[] {
  if (upperBound <= from) return [];

  // Filter and sort history samples inside the window. Samples at or
  // after `upperBound` are ignored; a sample exactly at `from` becomes
  // the initial state. Samples before `from` should have been collapsed
  // into `priorStatus` by the caller.
  const inWindow = history
    .filter((h) => {
      const t = h.time.getTime();
      return t >= from && t < upperBound;
    })
    .map((h) => ({ time: h.time.getTime(), status: h.status }))
    .sort((a, b) => a.time - b.time);

  const runs: Interval[] = [];
  let curStatus = priorStatus;
  let curStart = from;

  for (const sample of inWindow) {
    if (sample.status === curStatus) {
      // Status didn't change — skip. In practice the gateway only
      // writes on-change events so this branch is rare, but we handle
      // it defensively.
      continue;
    }
    if (curStatus) {
      runs.push({ start: curStart, end: sample.time });
    }
    curStatus = sample.status;
    curStart = sample.time;
  }

  // Tail: from last transition (or `from` if none) to upperBound.
  if (curStatus) {
    runs.push({ start: curStart, end: upperBound });
  }

  return runs;
}

/** Clip and merge plans to the computable window `[from, min(to, now)]`. */
function buildPlanIntervals(input: LineComputationInput): Interval[] {
  const from = input.from.getTime();
  const upperBound = Math.min(input.to.getTime(), input.now.getTime());
  if (upperBound <= from) return [];

  const clipped: Interval[] = input.plans
    .map((p) => ({
      start: Math.max(p.startTime.getTime(), from),
      end: Math.min(p.endTime.getTime(), upperBound),
    }))
    .filter((iv) => iv.end > iv.start);

  return mergeIntervals(clipped);
}

export function computeLineReport(input: LineComputationInput): LineComputed {
  const from = input.from.getTime();
  const upperBound = Math.min(input.to.getTime(), input.now.getTime());

  const planIntervals = buildPlanIntervals(input);
  const plannedTimeMs = sumDuration(planIntervals);
  const hasPlan = plannedTimeMs > 0;

  if (!hasPlan) {
    return {
      hasPlan: false,
      plannedTimeMs: 0,
      workingTimeMs: 0,
      availability: null,
      oee: null,
      scrapCount: input.scrapCount,
    };
  }

  const runningIntervals = buildRunningIntervals(
    input.history,
    input.priorStatus,
    from,
    upperBound
  );
  const runningInPlan = intersectIntervals(
    mergeIntervals(runningIntervals),
    planIntervals
  );
  const workingTimeMs = sumDuration(runningInPlan);

  // Floating-point guard: workingTime should never exceed plannedTime
  // for real data, but we clamp to avoid reporting 100.0001% if the
  // last interval slips past the clip boundary by a microsecond.
  const workingClamped = Math.min(workingTimeMs, plannedTimeMs);
  const availability = (workingClamped / plannedTimeMs) * 100;
  const oee = availability;

  return {
    hasPlan: true,
    plannedTimeMs,
    workingTimeMs: workingClamped,
    availability,
    oee,
    scrapCount: input.scrapCount,
  };
}

export interface PlannedAggregate {
  avgOee: number | null;
  avgAvailability: number | null;
  plannedLineCount: number;
  totalScrap: number;
}

/**
 * Aggregate a list of line reports, averaging ONLY over lines with
 * `hasPlan=true`. Scrap is summed across all lines (planned or not)
 * because scrap events are meaningful even outside of planned time.
 */
export function aggregatePlannedLines(lines: LineComputed[]): PlannedAggregate {
  const planned = lines.filter((l) => l.hasPlan);
  const totalScrap = lines.reduce((acc, l) => acc + l.scrapCount, 0);

  if (planned.length === 0) {
    return {
      avgOee: null,
      avgAvailability: null,
      plannedLineCount: 0,
      totalScrap,
    };
  }

  const avgOee =
    planned.reduce((acc, l) => acc + (l.oee ?? 0), 0) / planned.length;
  const avgAvailability =
    planned.reduce((acc, l) => acc + (l.availability ?? 0), 0) / planned.length;

  return {
    avgOee,
    avgAvailability,
    plannedLineCount: planned.length,
    totalScrap,
  };
}

export interface HealthDistribution {
  green: number; // > 85
  yellow: number; // [60, 85]
  red: number; // < 60
  total: number;
}

/**
 * Bucket planned lines into health categories. Unplanned lines are
 * excluded entirely (not "red") because a missing plan is not a
 * performance problem — it's a planning gap.
 *
 * Thresholds match the reporting UI ribbons: > 85% green, 60-85%
 * yellow, < 60% red. `85` itself lands in yellow; `>85` is strict.
 */
export function buildHealthDistribution(
  lines: LineComputed[]
): HealthDistribution {
  const planned = lines.filter((l) => l.hasPlan && l.oee !== null);
  let green = 0;
  let yellow = 0;
  let red = 0;
  for (const l of planned) {
    const oee = l.oee!;
    if (oee > 85) green++;
    else if (oee >= 60) yellow++;
    else red++;
  }
  return { green, yellow, red, total: planned.length };
}
