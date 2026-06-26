import { getHallsWithLines } from '../actions';
import { OverviewDashboard } from '@/components/OverviewDashboard';
import { getAppMode } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const [mode, halls] = await Promise.all([getAppMode(), getHallsWithLines()]);

  return (
    <main className='h-screen overflow-hidden bg-white'>
      <OverviewDashboard halls={halls} mode={mode} />
    </main>
  );
}
