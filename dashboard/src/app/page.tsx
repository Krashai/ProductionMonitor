import { getHallsWithLines } from "./actions";
import { MainDashboard } from "@/components/MainDashboard";

export default async function Home() {
  const halls = await getHallsWithLines();

  return (
    <main className="min-h-screen bg-white">
      <MainDashboard halls={halls} />
    </main>
  );
}
