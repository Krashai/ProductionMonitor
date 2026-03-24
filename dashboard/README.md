# LineGantt Dashboard: Przemysłowy System Monitorowania i Planowania

LineGantt to zaawansowana aplikacja webowa klasy Dashboard, przeznaczona do wizualizacji stanu linii produkcyjnych w czasie rzeczywistym. System łączy dane rzeczywiste pobierane bezpośrednio ze sterowników PLC (Siemens S7) z harmonogramem produkcji, umożliwiając natychmiastową identyfikację i analizę przestojów.

## 🌟 Kluczowe Funkcjonalności

### 1. Inteligentny Dashboard (Widok Główny)
- **Pełnoekranowa Karuzela:** Automatyczna rotacja widoków pomiędzy halami produkcyjnymi.
- **Metryki Real-time:** Dynamicznie odświeżane wartości prędkości maszyny oraz licznika odpadów (Scrap) pobierane bezpośrednio z bazy danych.
- **Pasek Statusu:** Wizualna informacja o stanie linii (Zielony: OK, Czerwony: Awaria, Szary: Brak zlecenia).

### 2. Zaawansowana Diagnostyka (Widok Szczegółowy)
- **Oś Czasu (Live Gantt):** Dynamiczny wykres korelujący plan produkcji z rzeczywistymi sygnałami pracy maszyny.
- **System Komentarzy:** Możliwość opisywania przestojów poprzez zaznaczanie zakresu czasu na wykresie.

### 3. Analityka Wydajności (KPI Panel)
- **Dostępność (Availability):** Obliczana na podstawie historycznych stanów maszyn zapisanych w bazie TimescaleDB.
- **Wydajność (Performance):** Porównanie prędkości rzeczywistej do założeń planu produkcji.

## 🏗️ Architektura Techniczna

System działa w modelu **Shared Database** z modułem `gateway`:
- **Frontend:** Next.js 15 (App Router).
- **Baza Danych:** PostgreSQL + TimescaleDB (wspólna dla Dashboard i Gateway).
- **Logika Biznesowa:** Server Actions (Prisma) zapewniające spójność danych bez zbędnych API pośrednich.
- **Integracja:** Dane procesowe są zapisywane przez `gateway` bezpośrednio do bazy, skąd Dashboard je odczytuje.

## 🛠️ Administracja i Rozruch
```bash
# Uruchomienie całego stosu
docker-compose up -d --build

# Inicjalizacja bazy (Hale i Linie)
docker exec pm-dashboard-app npx prisma db seed
```

## 🌍 Lokalizacja
- Język: Polski.
- Jednostki: m/min, szt.
