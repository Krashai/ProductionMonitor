# Project Design: LineGantt Dashboard

## 🏗️ Architecture Overview

System LineGantt jest zaprojektowany jako modularny monolit bazodanowy (Shared Database Architecture).

### Komponenty systemu:
- **`dashboard-app`**: Aplikacja Next.js 15, która służy do wizualizacji danych i zarządzania planem produkcji.
- **`dashboard-db`**: Baza danych PostgreSQL z rozszerzeniem **TimescaleDB**, zoptymalizowana pod kątem przechowywania serii czasowych (MachineStatusHistory).
- **`plc-gateway`**: (Zewnętrzny moduł) Odpowiada za fizyczny odczyt danych z maszyn i zapisywanie ich bezpośrednio do `dashboard-db`.

## 📡 Data Strategy

Zamiast stosować szynę danych typu MQTT, system polega na wydajnym modelu zapisu bezpośredniego do bazy serii czasowych:

1. **Ingestion:** PLC Gateway odczytuje dane ze sterowników Siemens S7. Przy każdej zmianie istotnych parametrów (status, prędkość) wykonuje `INSERT` do tabeli `MachineStatusHistory`. Impulsy braków są zapisywane jako pojedyncze zdarzenia w `ScrapEvent`.
2. **Persistence:** TimescaleDB automatycznie zarządza partycjonowaniem danych po czasie (hypertables), co pozwala na utrzymanie wysokiej wydajności przy milionach rekordów historii.
3. **Visualization:** Dashboard odczytuje dane za pomocą Server Actions (Prisma). Wykorzystuje zaawansowane grupowanie po stronie SQL, aby wyliczać wskaźniki OEE i generować wykresy Gantta.

## 🛠️ Infrastructure

- **Docker:** Całe środowisko jest skonteneryzowane.
- **Networking:** Moduły Dashboard i Gateway komunikują się przez wspólną sieć Dockerową, co zapewnia bezpieczeństwo (baza nie musi być wystawiona na świat).
- **Caching:** Wykorzystanie wbudowanego mechanizmu cache'owania w Next.js z inwalidacją typu "on-demand" (wyzwalaną przez gateway po zmianach konfiguracji).
