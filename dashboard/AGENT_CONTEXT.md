# Agent AI Context: LineGantt Dashboard

Dokumentacja kontekstowa dla agentów AI pracujących nad systemem wizualizacji i planowania **LineGantt**.

## 🏗️ Architektura
- **Stack:** Next.js 15 (App Router), Prisma ORM, Tailwind CSS.
- **Model Integracji:** Shared Database (Współdzielona baza z PLC Gateway).
- **Źródło Danych:** PostgreSQL/TimescaleDB. Gateway zapisuje dane procesowe, Dashboard je wizualizuje.

## 📡 Zarządzanie Danymi
Wszelkie operacje na danych odbywają się przez Server Actions (`src/app/actions.ts`).

### Kluczowe Przepływy:
1. **Statusy Linii:** Pobierane z tabeli `MachineStatusHistory` (ostatni rekord dla każdej linii).
2. **Plany Produkcji:** Zarządzane przez Dashboard, zapisywane w tabeli `ProductionPlan`.
3. **Braki (Scrap):** Zliczane z tabeli `ScrapEvent`.

## 🛠️ Wytyczne dla Agenta
- **Rewalidacja:** Po modyfikacji planów lub komentarzy zawsze używaj `revalidatePath`, aby zaktualizować cache Next.js.
- **TimescaleDB:** Pamiętaj, że tabele historii są zoptymalizowane pod zapytania czasowe. Unikaj ciężkich joinów na dużych zakresach czasu bez filtrów po `time`.
- **Serializacja:** Server Actions muszą zwracać dane gotowe do serializacji JSON (daty muszą być skonwertowane lub przechodzić przez `JSON.parse(JSON.stringify())` przed wysłaniem do komponentów klienckich).

## 📂 Struktura Bazy (Prisma)
- `Hall`: Grupowanie linii.
- `Line`: Metadane linii (powiązane z `plcId` w gatewayu).
- `MachineStatusHistory`: Surowe dane o pracy i prędkości (zasilane przez gateway).
- `ScrapEvent`: Zdarzenia braków (zasilane przez gateway).
- `ProductionPlan`: Harmonogram (zasilane przez dashboard).
