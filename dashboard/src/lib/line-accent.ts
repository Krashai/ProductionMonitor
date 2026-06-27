import type { LineVisualVariant } from '@/lib/line-visual-state';

export type Accent = 'green' | 'alarm' | 'neutral' | 'offline';

export function accentForVariant(variant: LineVisualVariant): Accent {
  switch (variant) {
    case 'offline':
      return 'offline';
    case 'plan-working':
    case 'no-plan-running':
      return 'green';
    case 'plan-alarm':
      return 'alarm';
    case 'plan-idle':
    case 'no-plan-stopped':
      return 'neutral';
    default:
      variant satisfies never;
      return 'offline';
  }
}
