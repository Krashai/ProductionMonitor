import { getHallsWithLines } from "./actions";
import { MainDashboard } from "@/components/MainDashboard";

export default async function Home() {
  const halls = await getHallsWithLines();

  return (
    // Kiosk: aplikacja działa na TV jako wallboard bez interakcji/scrolla,
    // więc shell jest przypięty do wysokości ekranu (h-screen) i nie przewija.
    // Cała treść musi zmieścić się w jednym widoku — patrz MainDashboard.
    <main className="h-screen overflow-hidden bg-white">
      <MainDashboard halls={halls} />
    </main>
  );
}
