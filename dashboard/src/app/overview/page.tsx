import { getHallsWithLines } from "@/app/actions";
import { OverviewBoard } from "@/components/OverviewBoard";
import { getAppMode } from "@/lib/settings";

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const [mode, halls] = await Promise.all([getAppMode(), getHallsWithLines()]);

  return (
    <main className="h-screen overflow-hidden bg-white">
      <OverviewBoard halls={halls} mode={mode} />
    </main>
  );
}
