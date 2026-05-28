# Konfiguracja Reverse Proxy dla ProductionMonitor

## Topologia sieci

```
  10.3.0.x (PLC)          10.10.0.x (RPi)           10.0.0.x (uzytkownicy)
 +-----------+          +----------------+          +------------------+
 | Sterowniki| <--TCP-- | Raspberry Pi   | <--HTTP--| Reverse Proxy    |
 | S7 / 102  |  Snap7   | gateway :8000  |          | (nginx / other)  |
 |           |          | dashboard:3001 |          |                  |
 +-----------+          | postgres :5432 |          +------------------+
                        +----------------+                  |
                                                     +-----------+
                                                     | Klienci   |
                                                     | (browser) |
                                                     +-----------+
```

Reverse proxy serwuje ruch z sieci 10.0.0.x do RPi na 10.10.0.x.
Komunikacja wewnetrzna (PLC polling, gateway->dashboard notify, Docker network)
**nie przechodzi** przez reverse proxy i nie wymaga konfiguracji.

---

## Wymagania

Aplikacja korzysta z **Server-Sent Events (SSE)** do aktualizacji w czasie
rzeczywistym. SSE to dlugotrwale polaczenie HTTP, ktore wymaga specjalnej
konfiguracji proxy:

1. **Wylaczenie buforowania** -- bez tego zdarzenia SSE gromadza sie w buforze
   proxy i nie docieraja do przegladarki na biezaco
2. **Dlugi timeout odczytu** -- domyslny `proxy_read_timeout 60s` zamknie SSE
   jesli PLC nie wygeneruje zdarzenia przez minute
3. **HTTP/1.1 minimum** -- SSE wymaga chunked transfer lub keep-alive

Serwer wysyla heartbeat co 25 sekund (komentarz SSE `: heartbeat\n\n`), co
resetuje timer timeout na proxy. Heartbeat nie wyzwala zdarzen w przegladarce.

---

## Konfiguracja nginx

### Podstawowa (tylko dashboard)

```nginx
upstream dashboard {
    server 10.10.0.x:3001;
}

server {
    listen 80;
    server_name monitor.example.com;

    # --- SSE endpoint (KRYTYCZNE) ---
    location /api/events {
        proxy_pass         http://dashboard;
        proxy_http_version 1.1;
        proxy_set_header   Connection '';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_buffering    off;           # WYMAGANE -- bez tego SSE nie dziala
        proxy_cache        off;
        proxy_read_timeout 86400s;        # 24h -- heartbeat co 25s resetuje timer
        chunked_transfer_encoding off;
    }

    # --- Dashboard (Server Actions, statyczne pliki, strony) ---
    location / {
        proxy_pass       http://dashboard;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Rozszerzona (dashboard + gateway API + WebSocket)

Jesli uzytkownicy z 10.0.0.x maja miec dostep do panelu konfiguracji gateway:

```nginx
upstream dashboard {
    server 10.10.0.x:3001;
}

upstream gateway {
    server 10.10.0.x:8000;
}

server {
    listen 80;
    server_name monitor.example.com;

    # --- SSE (dashboard real-time) ---
    location /api/events {
        proxy_pass         http://dashboard;
        proxy_http_version 1.1;
        proxy_set_header   Connection '';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding off;
    }

    # --- Dashboard ---
    location / {
        proxy_pass       http://dashboard;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # --- Gateway API (Swagger, REST) ---
    location /gateway/ {
        rewrite            ^/gateway/(.*) /$1 break;
        proxy_pass         http://gateway;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # --- Gateway WebSocket ---
    location /gateway/ws {
        rewrite            ^/gateway/(.*) /$1 break;
        proxy_pass         http://gateway;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_read_timeout 86400s;
    }
}
```

> Przy konfiguracji rozszerzonej ustaw `VITE_API_URL` w gateway-frontend
> na adres reverse proxy (np. `http://monitor.example.com/gateway`), aby
> `window.location.hostname` nie probowal laczyc sie bezposrednio z portem 8000.

---

## Konfiguracja HAProxy

Jesli reverse proxy to HAProxy zamiast nginx:

```haproxy
frontend http_in
    bind *:80
    default_backend dashboard

    # SSE wymaga trybu HTTP i wylaczonego buforowania
    acl is_sse path_beg /api/events
    use_backend dashboard_sse if is_sse

backend dashboard
    server rpi 10.10.0.x:3001 check

backend dashboard_sse
    timeout server 86400s
    timeout tunnel 86400s
    option http-no-delay       # wylacz buforowanie Nagle
    no option http-buffer-request
    server rpi 10.10.0.x:3001 check
```

---

## Konfiguracja Apache (mod_proxy)

```apache
<VirtualHost *:80>
    ServerName monitor.example.com

    # SSE endpoint
    <Location /api/events>
        ProxyPass        http://10.10.0.x:3001/api/events
        ProxyPassReverse http://10.10.0.x:3001/api/events
        SetEnv           proxy-sendchunked 1
        SetEnv           proxy-sendcl 0

        # Wylacz buforowanie
        SetOutputFilter  NONE
        SetEnv           no-gzip 1
    </Location>

    # Dashboard
    ProxyPass        / http://10.10.0.x:3001/
    ProxyPassReverse / http://10.10.0.x:3001/

    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "http"

    # Timeout dla dlugich polaczen
    ProxyTimeout 86400
</VirtualHost>
```

---

## Weryfikacja po wdrozeniu

### 1. SSE dziala przez proxy

```bash
# Z sieci 10.0.0.x:
curl -s -N http://<reverse-proxy-ip>/api/events

# Oczekiwany wynik (natychmiast, bez opoznienia):
data: {"type":"CONNECTED","timestamp":"2026-04-12T..."}

# Po ~25s powinien pojawic sie heartbeat:
: heartbeat
```

Jesli `CONNECTED` pojawia sie z opoznieniem lub wcale -- buforowanie nie
zostalo wylaczone.

### 2. Zdarzenia docieraja w czasie rzeczywistym

```bash
# Terminal 1 -- nasluchuj SSE:
curl -s -N http://<reverse-proxy-ip>/api/events

# Terminal 2 -- wymus zdarzenie:
curl -s -X POST http://<rpi-ip>:3001/api/notify \
  -H "Content-Type: application/json" \
  -d '{"type":"LINE_UPDATE","lineId":"test"}'

# Terminal 1 powinien natychmiast wyswietlic:
data: {"type":"LINE_UPDATE","lineId":"test",...}
```

### 3. Dashboard w przegladarce

1. Otworz `http://<reverse-proxy-ip>/` z sieci 10.0.0.x
2. DevTools > Network > filtr "events" -- polaczenie SSE status 200
3. DevTools > Console -- brak bledow, komunikat `Real-time connected`
4. Zmien stan PLC -- dashboard odswieza sie automatycznie

### 4. Reconnect po zerwaniu polaczenia

1. Otworz dashboard w przegladarce
2. Zrestartuj reverse proxy: `systemctl restart nginx`
3. DevTools > Console -- po 1-2s automatyczny reconnect (exponential backoff)
4. Brak koniecznosci recznego odswiezania strony

---

## Zabezpieczenia

### Porty na RPi

Binduj porty Docker tylko na interfejsie 10.10.0.x (nie na 0.0.0.0):

```yaml
# docker-compose.yml
services:
  pm-dashboard-app:
    ports:
      - "10.10.0.x:3001:3000"
  pm-gateway-backend:
    ports:
      - "10.10.0.x:8000:8000"
  pm-dashboard-db:
    # NIE wystawiaj PostgreSQL na host -- dostep tylko przez siec Docker
    # ports:
    #   - "5432:5432"
```

### Endpoint /api/notify

Endpoint `/api/notify` sluzy do komunikacji gateway->dashboard. Nie powinien
byc dostepny z sieci 10.0.0.x. Zablokuj go na reverse proxy:

```nginx
location /api/notify {
    deny all;
    return 403;
}
```

### CORS gateway

Jesli gateway API jest dostepny przez reverse proxy, ogranicz `allow_origins`
w `main.py` do adresu reverse proxy zamiast `"*"`.
