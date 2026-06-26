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

## 🔁 Reverse proxy (dostęp z sieci operatorów)

Dashboard wystawiamy operatorom przez osobny host z nginxem, który ma dwie karty sieciowe — odseparowuje sieć operatorów od sieci PLC.

**Topologia:**
- Komputer A (reverse proxy): `10.0.0.211` (NIC1 — operatorzy) + `10.10.0.199` (NIC2 — sieć produkcji)
- Komputer B (Production Monitor / docker-compose): `10.10.0.244`, port `3001` → kontener `pm-dashboard-app:3000`
- Panel admina PLC (`gateway-frontend`) **nie** jest wystawiony na zewnątrz — pozostaje lokalny.

**Plik konfiguracyjny:** [`deploy/reverse-proxy/dashboard.conf`](../deploy/reverse-proxy/dashboard.conf)

**Krytyczne dla dynamicznego odświeżania (SSE `/api/events`):**
```nginx
location = /api/events {
    proxy_buffering off;   # bez tego eventy stoją w buforze nginx
    proxy_cache     off;
    gzip            off;   # gzip buforuje, zabija SSE
    proxy_read_timeout 1h; # heartbeat aplikacyjny co 25 s
    proxy_set_header Connection "";   # keepalive do upstreamu
    # + Host / X-Forwarded-* powtórzone w każdym `location` —
    # nginx NIE dziedziczy proxy_set_header z `server` jeśli
    # location ma własny proxy_set_header.
}
```

**Nginx w Dockerze:** `listen 80;` w configu (kontener nie zna IP hosta), bind do NIC1 robi się przez Docker port mapping `ports: ["10.0.0.211:80:80"]` albo przez `network_mode: host`.

**Test po wdrożeniu (z dowolnej maszyny w 10.0.0.x):**
```bash
# Strona ładuje się
curl -I http://10.0.0.211/

# SSE działa — natychmiast CONNECTED, potem heartbeat co ~25s
curl -N -H "Accept: text/event-stream" http://10.0.0.211/api/events

# Realny event z PLC (z hosta z dockerem):
docker exec pm-gateway-backend curl -X POST \
  http://dashboard-app:3000/api/notify \
  -H "Content-Type: application/json" -d '{"type":"REVALIDATE"}'
```

Weryfikacja end-to-end (operator → proxy → app → PLC notify → SSE → panel) potwierdzona — eventy propagują w <100 ms.
