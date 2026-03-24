# PLC Gateway for Siemens S7

Nowoczesny, lekki i skalowalny gateway do odczytu danych ze sterowników Siemens PLC (S7-300, S7-1200, S7-1500) z interfejsem webowym i bezpośrednią integracją z bazą danych TimescaleDB.

## 🚀 Kluczowe Funkcje
- **Obsługa wielu PLC:** Równoległy odczyt z wielu sterowników dzięki architekturze wielowątkowej.
- **Wsparcie dla adapterów MPI/DP:** Możliwość łączenia się ze starszymi sterownikami (S7-300/400) poprzez adaptery Ethernet-to-MPI/DP.
- **Interfejs Webowy:** Dashboard w React do konfiguracji (CRUD) i podglądu danych "live" przez WebSockets.
- **Integracja z Bazą Danych:** Automatyczny zapis zmian statusu, prędkości oraz impulsów braków (scrap) bezpośrednio do współdzielonej bazy danych PostgreSQL/TimescaleDB.
- **Detekcja Zdarzeń:** Inteligentne wykrywanie zbocza narastającego dla liczników braków, co zapobiega błędnym odczytom.
- **Bezpieczeństwo:** System logowania oparty na JWT (JSON Web Tokens).

## 🏗️ Architektura Systemu
System opiera się na modelu współdzielonej bazy danych (Shared Database), co eliminuje potrzebę stosowania pośredników typu MQTT:
1. **Core Gateway (Python):** Zarządza pulą wątków PLC. Każdy wątek odpytuje sterownik i przy wykryciu zmiany zapisuje dane do bazy.
2. **API Layer (FastAPI):** Obsługuje konfigurację systemu oraz rozsyła dane "live" przez WebSockets.
3. **Współdzielona Baza (TimescaleDB):** Służy jako centralny punkt wymiany danych między Gatewayem a Dashboardem.

### Przepływ danych (Data Flow)
`PLC (S7 Protocol)` -> `Python Worker` -> `PostgreSQL / TimescaleDB` -> `Next.js Dashboard`
                                     -> `WebSockets` -> `React UI (Gateway)`

## 🛠️ Administracja i Rozruch
Wymagany zainstalowany Docker i Docker Compose.
```bash
docker-compose up -d --build
```
Interfejs Gateway będzie dostępny pod adresem: `http://localhost:3000` (Logowanie: `admin`/`admin`).

## 📝 Roadmap
- [x] Implementacja mechanizmu Multi-threading dla wielu PLC.
- [x] System autoryzacji użytkowników (JWT).
- [x] Bezpośredni zapis zdarzeń procesowych do bazy danych.
- [x] Inteligentna detekcja impulsów braków.
- [ ] Historia danych i wykresy diagnostyczne w UI Gateway.
- [ ] System alarmów i powiadomień e-mail/push.
