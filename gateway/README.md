# PLC Gateway for Siemens S7

Nowoczesny, lekki i skalowalny gateway do odczytu danych ze sterowników Siemens PLC (S7-300, S7-1200, S7-1500) z interfejsem webowym i publikacją danych przez MQTT.

## 🚀 Kluczowe Funkcje
- **Obsługa wielu PLC:** Równoległy odczyt z wielu sterowników dzięki architekturze wielowątkowej.
- **Wsparcie dla adapterów MPI/DP:** Możliwość łączenia się ze starszymi sterownikami (S7-300/400) poprzez adaptery Ethernet-to-MPI/DP (np. NetLink, IBH Link).
- **Interfejs Webowy:** Nowoczesny dashboard w React do konfiguracji (CRUD) i podglądu danych "live".
- **Dynamiczna Konfiguracja:** Dodawanie i edycja sterowników oraz definiowanie zmiennych (DB) z poziomu UI bez restartu aplikacji.

### 💡 Ważna uwaga dot. konfiguracji:
Dla sterowników **S7-1200/1500** zazwyczaj używamy **Slot 1**.
Dla starszych sterowników **S7-300/400** (w tym tych za adapterami MPI/DP) zazwyczaj należy ustawić **Slot 2**.
- **Import CSV:** Szybkie definiowanie tagów poprzez import plików CSV.
- **Dystrybucja danych:** Publikacja wartości w czasie rzeczywistym do brokera MQTT (IIoT Ready).
- **Bezpieczeństwo:** System logowania oparty na JWT (JSON Web Tokens).
- **Docker-First:** Całość uruchamiana jednym poleceniem przy użyciu Docker Compose.

## 🛠️ Stack Technologiczny
- **Backend:** Python 3.11, FastAPI (REST & WebSockets), `python-snap7`.
- **Frontend:** React + Vite, TailwindCSS, Lucide Icons.
- **Broker MQTT:** Eclipse Mosquitto.
- **Przechowywanie danych:** JSON (Konfiguracja), In-Memory (Aktualne stany).
- **Orkiestracja:** Docker & Docker Compose.

## 🏗️ Architektura Systemu
System składa się z trzech głównych komponentów:
1. **Core Gateway (Python):** Zarządza pulą wątków (jeden per PLC). Każdy wątek odpytuje sterownik zgodnie z ustawionym interwałem i przekazuje dane do magistrali wewnętrznej.
2. **API Layer (FastAPI):** Obsługuje żądania z Frontendu oraz rozsyła dane przez WebSockets do aktywnych użytkowników.
3. **Frontend (React):** SPA serwowane przez Nginx, pozwalające na zarządzanie infrastrukturą PLC.

### Przepływ danych (Data Flow)
`PLC (S7 Protocol)` -> `Python Worker` -> `Internal Bus` -> `MQTT Publish`
                                     -> `WebSockets` -> `React UI`

## 📡 Schemat MQTT
Dane są publikowane na następujących tematach:
- `plc/gate/status/{plc_id}` - `online` / `offline`
- `plc/gate/data/{plc_id}/{tag_name}` - wartość zmiennej (np. `23.5`)

## 🛠️ Uruchomienie
Wymagany zainstalowany Docker i Docker Compose.
```bash
docker-compose up -d --build
```
Interfejs będzie dostępny pod adresem: `http://localhost:3000` (Logowanie: `admin`/`admin`).

## 📝 Roadmap
- [x] Implementacja mechanizmu Multi-threading dla wielu PLC.
- [x] Dashboard z automatycznym odświeżaniem (WebSockets).
- [x] System autoryzacji użytkowników (JWT).
- [x] Pełny CRUD sterowników z poziomu interfejsu.
- [x] Obsługa typów danych: BOOL, INT, REAL, DINT.
- [x] Import konfiguracji tagów z pliku CSV.
- [ ] Historia danych i proste wykresy w UI.
- [ ] System alarmów i powiadomień (progowe wartości tagów).
- [ ] Wsparcie dla zapisu danych do PLC (MQTT -> S7).
- [ ] Eksport danych do zewnętrznej bazy (InfluxDB/TimescaleDB).
