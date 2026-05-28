import { describe, it, expect } from 'vitest';
import {
  computeLineReport,
  aggregatePlannedLines,
  buildHealthDistribution,
  type Plan,
  type HistorySample,
  type LineComputationInput,
  type LineComputed,
} from './oee';

const t = (iso: string) => new Date(iso);
const MIN = 60_000;
const HOUR = 60 * MIN;

const baseWindow = {
  from: t('2026-04-11T08:00:00Z'),
  to: t('2026-04-11T10:00:00Z'),
  now: t('2026-04-11T12:00:00Z'),
};

function makeInput(overrides: Partial<LineComputationInput> = {}): LineComputationInput {
  return {
    ...baseWindow,
    plans: [],
    history: [],
    priorStatus: false,
    scrapCount: 0,
    ...overrides,
  };
}

describe('computeLineReport', () => {
  it('no plan in window → hasPlan=false, oee=null, availability=null', () => {
    const r = computeLineReport(makeInput());
    expect(r.hasPlan).toBe(false);
    expect(r.availability).toBeNull();
    expect(r.oee).toBeNull();
    expect(r.plannedTimeMs).toBe(0);
    expect(r.workingTimeMs).toBe(0);
  });

  it('plan fully covers window, line running the whole time → availability=100%', () => {
    const r = computeLineReport(
      makeInput({
        plans: [{ startTime: baseWindow.from, endTime: baseWindow.to }],
        priorStatus: true,
        history: [],
      })
    );
    expect(r.hasPlan).toBe(true);
    expect(r.plannedTimeMs).toBe(2 * HOUR);
    expect(r.workingTimeMs).toBe(2 * HOUR);
    expect(r.availability).toBeCloseTo(100, 5);
    expect(r.oee).toBeCloseTo(100, 5);
  });

  it('plan fully covers window, line stopped the whole time → availability=0%', () => {
    const r = computeLineReport(
      makeInput({
        plans: [{ startTime: baseWindow.from, endTime: baseWindow.to }],
        priorStatus: false,
        history: [],
      })
    );
    expect(r.hasPlan).toBe(true);
    expect(r.plannedTimeMs).toBe(2 * HOUR);
    expect(r.workingTimeMs).toBe(0);
    expect(r.availability).toBe(0);
    expect(r.oee).toBe(0);
  });

  it('plan covers window, running 50/50 → availability=50%', () => {
    const r = computeLineReport(
      makeInput({
        plans: [{ startTime: baseWindow.from, endTime: baseWindow.to }],
        priorStatus: true,
        history: [{ time: t('2026-04-11T09:00:00Z'), status: false }],
      })
    );
    expect(r.plannedTimeMs).toBe(2 * HOUR);
    expect(r.workingTimeMs).toBe(HOUR);
    expect(r.availability).toBeCloseTo(50, 5);
    expect(r.oee).toBeCloseTo(50, 5);
  });

  it('plan starts before window → clipped to from', () => {
    const r = computeLineReport(
      makeInput({
        plans: [{ startTime: t('2026-04-11T07:00:00Z'), endTime: t('2026-04-11T09:00:00Z') }],
        priorStatus: true,
      })
    );
    // intersection is [08:00, 09:00] → 1h
    expect(r.plannedTimeMs).toBe(HOUR);
    expect(r.workingTimeMs).toBe(HOUR);
    expect(r.availability).toBeCloseTo(100, 5);
  });

  it('plan ends after window → clipped to to', () => {
    const r = computeLineReport(
      makeInput({
        plans: [{ startTime: t('2026-04-11T09:30:00Z'), endTime: t('2026-04-11T11:00:00Z') }],
        priorStatus: true,
      })
    );
    // intersection is [09:30, 10:00] → 30 min
    expect(r.plannedTimeMs).toBe(30 * MIN);
    expect(r.workingTimeMs).toBe(30 * MIN);
    expect(r.availability).toBeCloseTo(100, 5);
  });

  it('plan extends into the future → clipped to now', () => {
    const r = computeLineReport(
      makeInput({
        from: t('2026-04-11T11:00:00Z'),
        to: t('2026-04-11T14:00:00Z'),
        now: t('2026-04-11T12:30:00Z'),
        plans: [{ startTime: t('2026-04-11T11:00:00Z'), endTime: t('2026-04-11T14:00:00Z') }],
        priorStatus: true,
      })
    );
    // intersection is [11:00, 12:30] → 90 min
    expect(r.plannedTimeMs).toBe(90 * MIN);
    expect(r.workingTimeMs).toBe(90 * MIN);
    expect(r.availability).toBeCloseTo(100, 5);
  });

  it('two disjoint plans with different running patterns', () => {
    const r = computeLineReport(
      makeInput({
        plans: [
          { startTime: t('2026-04-11T08:00:00Z'), endTime: t('2026-04-11T08:30:00Z') },
          { startTime: t('2026-04-11T09:00:00Z'), endTime: t('2026-04-11T09:30:00Z') },
        ],
        priorStatus: true,
        history: [
          { time: t('2026-04-11T08:15:00Z'), status: false },
          { time: t('2026-04-11T09:15:00Z'), status: true },
        ],
      })
    );
    // planned: 30 + 30 = 60 min
    // working in plan #1: [08:00,08:15) running → 15 min
    // working in plan #2: [09:15,09:30) running → 15 min
    expect(r.plannedTimeMs).toBe(60 * MIN);
    expect(r.workingTimeMs).toBe(30 * MIN);
    expect(r.availability).toBeCloseTo(50, 5);
  });

  it('overlapping plans are deduped (no double-counting)', () => {
    const r = computeLineReport(
      makeInput({
        plans: [
          { startTime: t('2026-04-11T08:00:00Z'), endTime: t('2026-04-11T09:30:00Z') },
          { startTime: t('2026-04-11T09:00:00Z'), endTime: t('2026-04-11T10:00:00Z') },
        ],
        priorStatus: true,
      })
    );
    expect(r.plannedTimeMs).toBe(2 * HOUR);
    expect(r.workingTimeMs).toBe(2 * HOUR);
    expect(r.availability).toBeCloseTo(100, 5);
  });

  it('running only outside plan window → availability=0%', () => {
    const r = computeLineReport(
      makeInput({
        plans: [{ startTime: t('2026-04-11T08:00:00Z'), endTime: t('2026-04-11T09:00:00Z') }],
        priorStatus: false,
        history: [
          { time: t('2026-04-11T09:00:00Z'), status: true },
          { time: t('2026-04-11T09:30:00Z'), status: false },
        ],
      })
    );
    expect(r.plannedTimeMs).toBe(HOUR);
    expect(r.workingTimeMs).toBe(0);
    expect(r.availability).toBe(0);
  });

  it('running both inside and outside plan → only inside counts', () => {
    const r = computeLineReport(
      makeInput({
        plans: [{ startTime: t('2026-04-11T08:00:00Z'), endTime: t('2026-04-11T09:00:00Z') }],
        priorStatus: true,
        history: [{ time: t('2026-04-11T10:00:00Z'), status: false }],
      })
    );
    expect(r.plannedTimeMs).toBe(HOUR);
    expect(r.workingTimeMs).toBe(HOUR);
    expect(r.availability).toBeCloseTo(100, 5);
  });

  it('history toggles at boundary correctly', () => {
    const r = computeLineReport(
      makeInput({
        plans: [{ startTime: baseWindow.from, endTime: baseWindow.to }],
        priorStatus: false,
        history: [
          { time: t('2026-04-11T08:30:00Z'), status: true },
          { time: t('2026-04-11T09:00:00Z'), status: false },
          { time: t('2026-04-11T09:30:00Z'), status: true },
        ],
      })
    );
    // running: [08:30,09:00) + [09:30,10:00) = 30 + 30 = 60 min
    expect(r.workingTimeMs).toBe(HOUR);
    expect(r.availability).toBeCloseTo(50, 5);
  });

  it('empty window (from===to) → no plan work, zero everything', () => {
    const r = computeLineReport(
      makeInput({
        from: t('2026-04-11T08:00:00Z'),
        to: t('2026-04-11T08:00:00Z'),
        plans: [{ startTime: t('2026-04-11T07:00:00Z'), endTime: t('2026-04-11T09:00:00Z') }],
        priorStatus: true,
      })
    );
    expect(r.plannedTimeMs).toBe(0);
    expect(r.hasPlan).toBe(false);
    expect(r.availability).toBeNull();
  });

  it('scrapCount is passed through untouched', () => {
    const r = computeLineReport(
      makeInput({
        plans: [{ startTime: baseWindow.from, endTime: baseWindow.to }],
        priorStatus: true,
        scrapCount: 42,
      })
    );
    expect(r.scrapCount).toBe(42);
  });

  it('workingTimeMs never exceeds plannedTimeMs', () => {
    // If history says running for a long time that bleeds outside plan,
    // result must still be capped at plannedTimeMs.
    const r = computeLineReport(
      makeInput({
        plans: [{ startTime: t('2026-04-11T08:30:00Z'), endTime: t('2026-04-11T09:30:00Z') }],
        priorStatus: true,
      })
    );
    expect(r.workingTimeMs).toBeLessThanOrEqual(r.plannedTimeMs);
    expect(r.availability).toBeLessThanOrEqual(100);
  });
});

describe('aggregatePlannedLines', () => {
  const mk = (oee: number | null, hasPlan: boolean, scrap = 0): LineComputed => ({
    hasPlan,
    plannedTimeMs: hasPlan ? HOUR : 0,
    workingTimeMs: hasPlan ? HOUR : 0,
    availability: oee,
    oee,
    scrapCount: scrap,
  });

  it('averages oee across planned lines', () => {
    const res = aggregatePlannedLines([mk(80, true), mk(90, true), mk(70, true)]);
    expect(res.avgOee).toBeCloseTo(80, 5);
    expect(res.plannedLineCount).toBe(3);
  });

  it('ignores unplanned lines in average', () => {
    const res = aggregatePlannedLines([mk(80, true), mk(null, false), mk(60, true)]);
    expect(res.avgOee).toBeCloseTo(70, 5);
    expect(res.plannedLineCount).toBe(2);
  });

  it('returns null avgOee when no planned lines', () => {
    const res = aggregatePlannedLines([mk(null, false), mk(null, false)]);
    expect(res.avgOee).toBeNull();
    expect(res.plannedLineCount).toBe(0);
  });

  it('totals scrap across ALL lines (planned or not) — scrap is independent', () => {
    const res = aggregatePlannedLines([mk(80, true, 3), mk(null, false, 2), mk(60, true, 1)]);
    expect(res.totalScrap).toBe(6);
  });

  it('empty input → null/zeros', () => {
    const res = aggregatePlannedLines([]);
    expect(res.avgOee).toBeNull();
    expect(res.totalScrap).toBe(0);
  });
});

describe('buildHealthDistribution', () => {
  const mk = (oee: number | null, hasPlan: boolean): LineComputed => ({
    hasPlan,
    plannedTimeMs: hasPlan ? HOUR : 0,
    workingTimeMs: hasPlan ? HOUR : 0,
    availability: oee,
    oee,
    scrapCount: 0,
  });

  it('buckets planned lines by threshold', () => {
    const d = buildHealthDistribution([mk(90, true), mk(75, true), mk(40, true)]);
    expect(d.green).toBe(1);
    expect(d.yellow).toBe(1);
    expect(d.red).toBe(1);
    expect(d.total).toBe(3);
  });

  it('excludes unplanned lines from distribution', () => {
    const d = buildHealthDistribution([mk(null, false), mk(null, false), mk(90, true)]);
    expect(d.total).toBe(1);
    expect(d.green).toBe(1);
  });

  it('all unplanned → total=0 (caller must null-guard)', () => {
    const d = buildHealthDistribution([mk(null, false), mk(null, false)]);
    expect(d.total).toBe(0);
    expect(d.green).toBe(0);
    expect(d.yellow).toBe(0);
    expect(d.red).toBe(0);
  });

  it('boundary 85 and 60 — 85 counts as yellow, >85 as green', () => {
    const d = buildHealthDistribution([mk(85, true), mk(85.1, true), mk(60, true), mk(59.9, true)]);
    expect(d.green).toBe(1); // 85.1
    expect(d.yellow).toBe(2); // 85, 60
    expect(d.red).toBe(1); // 59.9
  });
});
