import { describe, expect, test } from 'vitest';
import {
  deriveLineVisualState,
  type DeriveLineVisualStateParams,
} from '@/lib/line-visual-state';

// Baza poprawnych parametrów — testy nadpisują tylko to, co istotne.
function params(
  overrides: Partial<DeriveLineVisualStateParams>
): DeriveLineVisualStateParams {
  return {
    mode: 'PLAN_MODE',
    isOffline: false,
    hasActivePlan: false,
    status: undefined,
    speed: 0,
    ...overrides,
  };
}

describe('deriveLineVisualState', () => {
  test('offline ma najwyższy priorytet w PLAN_MODE', () => {
    const state = deriveLineVisualState(
      params({ isOffline: true, hasActivePlan: true, status: true, speed: 10 })
    );
    expect(state.variant).toBe('offline');
  });

  test('offline ma najwyższy priorytet w NO_PLAN_MODE', () => {
    const state = deriveLineVisualState(
      params({ mode: 'NO_PLAN_MODE', isOffline: true, status: true, speed: 50 })
    );
    expect(state.variant).toBe('offline');
  });

  test('PLAN_MODE: plan + PRACA => plan-working', () => {
    const state = deriveLineVisualState(
      params({ hasActivePlan: true, status: true, speed: 12 })
    );
    expect(state.variant).toBe('plan-working');
  });

  test('PLAN_MODE: plan + postój => plan-alarm', () => {
    const state = deriveLineVisualState(
      params({ hasActivePlan: true, status: false, speed: 0 })
    );
    expect(state.variant).toBe('plan-alarm');
  });

  test('PLAN_MODE: brak planu => plan-idle (niezależnie od statusu)', () => {
    expect(
      deriveLineVisualState(params({ hasActivePlan: false, status: true, speed: 30 })).variant
    ).toBe('plan-idle');
    expect(
      deriveLineVisualState(params({ hasActivePlan: false, status: false })).variant
    ).toBe('plan-idle');
  });

  test('NO_PLAN_MODE: PRACA && speed>0 => no-plan-running', () => {
    const state = deriveLineVisualState(
      params({ mode: 'NO_PLAN_MODE', status: true, speed: 0.5 })
    );
    expect(state.variant).toBe('no-plan-running');
  });

  test('NO_PLAN_MODE: status=false => no-plan-stopped', () => {
    const state = deriveLineVisualState(
      params({ mode: 'NO_PLAN_MODE', status: false, speed: 10 })
    );
    expect(state.variant).toBe('no-plan-stopped');
  });

  // Edge case wymagany w zadaniu: PRACA, ale speed === 0 → stopped (nie running).
  test('NO_PLAN_MODE edge: status=true && speed===0 => no-plan-stopped', () => {
    const state = deriveLineVisualState(
      params({ mode: 'NO_PLAN_MODE', status: true, speed: 0 })
    );
    expect(state.variant).toBe('no-plan-stopped');
  });

  test('NO_PLAN_MODE: status=undefined => no-plan-stopped', () => {
    const state = deriveLineVisualState(
      params({ mode: 'NO_PLAN_MODE', status: undefined, speed: 5 })
    );
    expect(state.variant).toBe('no-plan-stopped');
  });

  test('NO_PLAN_MODE: aktywny plan jest ignorowany (tryb bez planów)', () => {
    const state = deriveLineVisualState(
      params({ mode: 'NO_PLAN_MODE', hasActivePlan: true, status: true, speed: 8 })
    );
    expect(state.variant).toBe('no-plan-running');
  });
});
