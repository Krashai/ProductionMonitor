import { getHallsWithLines } from "./actions";
import { MainDashboard } from "@/components/MainDashboard";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const halls = await getHallsWithLines();

  return (
    <main className="min-h-screen bg-white">
      <MainDashboard halls={halls} />
    </main>
  );
}
