# Integracja z PLC Gateway S7

System PLC Gateway S7 umożliwia pobieranie danych z maszyn przemysłowych i ich dalsze przetwarzanie. Poniżej opisano dostępne metody integracji.

## 🔗 1. Integracja przez Współdzieloną Bazę Danych (Rekomendowane)

Dla systemów analitycznych, raportowych i dashboardów historycznych, najlepszym sposobem jest bezpośrednie połączenie z bazą danych PostgreSQL/TimescaleDB.

### Struktura Danych:
Dane procesowe są zapisywane w sposób ciągły do tabeli `MachineStatusHistory`. Każdy wpis zawiera:
- `lineId`: Klucz obcy do tabeli `Line`.
- `status`: Boolean (True = Running, False = Stopped).
- `speed`: Float (Prędkość maszyny).
- `time`: Timestamp (Zoptymalizowany pod TimescaleDB).

Zdarzenia braków są rejestrowane w tabeli `ScrapEvent`. Każdy rekord to jeden wykryty impuls (sztuka odpadu).

### Zalety:
- Pełny dostęp do danych historycznych.
- Brak konieczności implementacji dodatkowych usług pośredniczących.
- Wysoka wydajność dzięki indeksom czasowym.

## 🔗 2. Integracja przez REST API (Konfiguracja i Status)

Bramka udostępnia API oparte na FastAPI do zarządzania flotą sterowników.

- **Base URL:** `http://localhost:8000`
- **Główny punkt odczytu:** `GET /plcs` – zwraca listę sterowników wraz z ich konfiguracją i ostatnio odczytanymi wartościami tagów.

## 🔗 3. Integracja przez WebSockets (Dane Live)

Jeśli Twój system wymaga natychmiastowej reakcji na zmianę (np. wyświetlanie prędkości na panelu operatorskim bez przeładowania), użyj kanału WebSockets.

- **URL:** `ws://localhost:8000/ws`
- **Format:** JSON `{"type": "PLC_UPDATE", "payload": { ... }}`

## ⚠️ Uwaga dot. Liczników (Scrap)
Bramka posiada wbudowany mechanizm **Edge Detection**. Oznacza to, że impulsy braków są zapisywane do bazy danych tylko w momencie przejścia sygnału ze stanu niskiego na wysoki (zbocze narastające). Dzięki temu nie musisz martwić się o duplikowanie odczytów, gdy sygnał ze sterownika trwa dłużej niż cykl odpytywania.
