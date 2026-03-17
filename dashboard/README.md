# LineGantt Dashboard: Przemysłowy System Monitorowania i Planowania

LineGantt to zaawansowana aplikacja webowa klasy Dashboard, przeznaczona do wizualizacji stanu linii produkcyjnych w czasie rzeczywistym. System łączy dane rzeczywiste pobierane bezpośrednio ze sterowników PLC (Siemens S7) z harmonogramem produkcji, umożliwiając natychmiastową identyfikację i analizę przestojów.

## 🌟 Kluczowe Funkcjonalności

### 1. Inteligentny Dashboard (Widok Główny)
- **Pełnoekranowa Karuzela:** Automatyczna rotacja widoków pomiędzy zdefiniowanymi halami produkcyjnymi (Hala 1-4).
- **Tryb Prezentacji:** Przycisk Play/Pause oraz pasek postępu informujący o czasie do zmiany slajdu (idealne na duże monitory halowe).
- **Kafelki Linii (High Impact):**
    - **Pasek Statusu:** Pionowy pasek boczny informujący kolorem o stanie linii (Zielony: OK, Czerwony: Awaria w planie, Szary: Brak zlecenia).
    - **Metryki Real-time:** Dynamicznie odświeżane wartości prędkości maszyny oraz licznika odpadów (Scrap) z ostatniej godziny.
    - **Sekcja Zlecenia:** Dedykowana dolna belka wyświetlająca aktualnie produkowany indeks produktu.

### 2. Zaawansowana Diagnostyka (Widok Szczegółowy)
- **Oś Czasu (Live Gantt):** Dynamiczny wykres obejmujący 32 godziny (24h wstecz, 8h w przód).
- **Korelacja Plan vs PLC:** Bloki planu są automatycznie kolorowane na podstawie sygnałów z maszyny:
    - **Zielony:** Praca zgodna z planem.
    - **Czerwony:** Wykryty przestój w trakcie trwania zlecenia (wymaga opisu).
- **System Komentarzy:**
    - **Zaznaczanie Zakresu:** Możliwość "przeciągnięcia" myszką (Click & Drag) po czerwonych segmentach, aby opisać całą awarię jednym komentarzem.
    - **Tooltipy:** Podgląd przyczyn przestojów po najechaniu myszką na fragment wykresu.
    - **Zarządzanie Konfliktami:** Jeśli w jednym czasie jest wiele wpisów, system oferuje menu wyboru konkretnego zdarzenia do edycji.

### 3. Analityka Wydajności (KPI Panel)
- **Dostępność (Availability):** Procentowy wskaźnik wykorzystania czasu planowanego.
- **Wydajność (Performance):** Porównanie prędkości rzeczywistej do prędkości zadaną w planie.
- **Licznik Przestojów:** Sumaryczny czas strat produkcyjnych w zadanym oknie czasu.
- **Efekt Licznika (Odometer):** Animowane cyfry płynnie odliczające wartości przy ładowaniu strony.
- **Techniczne Tooltipy:** Ikony informacji `(i)` z precyzyjnymi definicjami obliczeń.

### 4. Planowanie Produkcji
- **Formularz "Od-Do":** Intuicyjne dodawanie zleceń poprzez wybór dat i godzin (format europejski 24h).
- **Walidacja Kolizji:** System automatycznie wykrywa, czy nowe zlecenie nachodzi na istniejący plan dla danej linii.
- **Ostrzeżenia:** Interaktywne powiadomienia o konfliktach z możliwością świadomego zignorowania ostrzeżenia.

## 🏗️ Architektura Techniczna

- **Frontend:** Next.js 15 (App Router) + React 19 (Patterns).
- **Styling:** Tailwind CSS (Custom Premium Industrial Theme).
- **Baza Danych:** PostgreSQL + TimescaleDB (zoptymalizowane pod dane czasowe).
- **Backend/API:** Server Actions (Type-safe).
- **Ingestion:** Node.js MQTT Worker (zbieranie danych z bramki S7).
- **Konteneryzacja:** Docker Compose (izolowane środowiska dla bazy, aplikacji i workera).

## 📡 Integracja z Bramką S7 (MQTT)
Aplikacja subskrybuje topiki:
- `plc/gate/data/{plc_id}/Status` -> Stan pracy (0/1).
- `plc/gate/data/{plc_id}/Speed` -> Prędkość rzeczywista.
- `plc/gate/data/{plc_id}/Scrap_Pulse` -> Impulsy odpadu (zliczane tylko podczas statusu Status=1).

## 🛠️ Administracja i Rozruch
```bash
# Uruchomienie całego stosu
docker-compose up -d --build

# Inicjalizacja bazy (Hale i Linie)
docker exec line-gantt-app npx prisma db seed
```

## 🌍 Lokalizacja
- Język: Polski.
- Format czasu: 24h (Europejski).
- Jednostki: m/min, szt.
