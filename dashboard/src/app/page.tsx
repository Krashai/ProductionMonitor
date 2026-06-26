import { getHallsWithLines } from "./actions";
import { MainDashboard } from "@/components/MainDashboard";
import { getAppMode } from "@/lib/settings";

// Wallboard pokazuje dane produkcyjne na żywo — render per żądanie, bez
// statycznego prerenderu (przy buildzie nie ma bazy/DATABASE_URL, a fetch
// rzuca przy braku DB). Spójne z /reporting, /planning, /line/[id].
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Tryb i dane pobieramy równolegle — niezależne źródła, brak kaskady.
  const [mode, halls] = await Promise.all([getAppMode(), getHallsWithLines()]);

  return (
    // Kiosk: aplikacja działa na TV jako wallboard bez interakcji/scrolla,
    // więc shell jest przypięty do wysokości ekranu (h-screen) i nie przewija.
    // Cała treść musi zmieścić się w jednym widoku — patrz MainDashboard.
    <main className="h-screen overflow-hidden bg-white">
      <MainDashboard halls={halls} mode={mode} />
    </main>
  );
}
