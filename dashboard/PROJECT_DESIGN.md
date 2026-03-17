# Project Design: LineGantt Dashboard

System do wizualizacji statusu linii produkcyjnych w czasie rzeczywistym, łączący planowanie (Gantt) z danymi rzeczywistymi z maszyn (PLC S7 Gateway).

## 🎯 Purpose & Scope
- **Zasada działania:** Porównywanie planu produkcji (Schedule) z rzeczywistym stanem pracy maszyny (Actual status).
- **Główny cel:** Natychmiastowa identyfikacja awarii i postojów na halach produkcyjnych oraz umożliwienie ich opisania przez użytkowników.
- **Użytkownicy:** Operatorzy, Kierownicy Hal, Planuści.

## 🏗️ Technical Stack (Docker-based)
- **Frontend & API:** Next.js 14/15 (App Router, TypeScript).
- **Baza Danych:** PostgreSQL + TimescaleDB (przechowywanie planów oraz historii statusów time-series).
- **Ingestion:** Node.js MQTT Worker (lekki proces zbierający dane z PLC Gateway S7 i zrzucający je do bazy).
- **Styling:** Tailwind CSS + Shadcn UI.
- **Oś Czasu (Gantt):** Customowy komponent React oparty na CSS Grid lub bibliotece vis-timeline (z obsługą dynamicznego kolorowania bloków).
- **ORM:** Prisma lub Drizzle.

## 📡 Data Integration (MQTT S7 Gateway)
- `plc/gate/data/{plc_id}/Status` (BOOL) -> 1: Running, 0: Stopped.
- `plc/gate/data/{plc_id}/Speed` (REAL/INT) -> Prędkość rzeczywista.
- `plc/gate/data/{plc_id}/Scrap_Pulse` (BOOL) -> Impuls (zbocze narastające) oznaczający zdarzenie SCRAP.

## 📱 User Experience & UI
### 1. Widok Hal (High Level)
- Podział na konkretne Hale produkcyjne.
- Kafelki linii z ogólnym statusem (Kolor tła: Zielony/Czerwony/Żółty).
- Szybki podgląd prędkości i liczniku Scrap.

### 2. Widok Linii (Drill-down)
- **Interaktywna Oś Czasu:** Blok planu produkcji (Indeks, Prędkość), który przesuwa się w prawo wraz z czasem ("Live").
- **Kolorowanie Statusu:**
    - Fragment bloku jest **Zielony**, gdy linia pracuje (Status=1).
    - Fragment bloku jest **Czerwony**, gdy linia stoi (Status=0) w czasie trwania planowanego zlecenia.
- **Opisy Awarrii:** Kliknięcie w czerwony fragment otwiera panel do dodania/edycji komentarza.
- **Wykresy:** Dodatkowy graf prędkości i narastająca liczba zdarzeń Scrap.

### 3. Planowanie (Hybryda)
- Formularz dodawania zlecenia (Indeks, Start, Duration, Plan_Speed).
- Możliwość importu pliku Excel/CSV z tygodniowym planem.

## 🗄️ Data Model (Key Entities)
- `Halls`: id, name.
- `Lines`: id, hall_id, plc_id, name.
- `ProductionPlan`: id, line_id, product_index, start_time, end_time, planned_speed.
- `MachineStatusHistory` (TimescaleDB): time, line_id, status (bool), speed (float).
- `ScrapEvents` (TimescaleDB): time, line_id.
- `DowntimeComments`: id, line_id, start_time, end_time, comment.

## 🚀 Docker Composition
- `db`: TimescaleDB image.
- `app`: Next.js (Node.js).
- `worker`: MQTT Ingestion Service.
- `mosquitto`: (Opcjonalnie) Lokalny broker MQTT.
