# P0 — Frontend Reliability Fixes

**Branch:** `fix/frontend-reliability-p0`
**Cel:** Niezawodny odczyt i prezentacja danych w czasie rzeczywistym (dashboard + gateway frontend).

Wszystkie poprawki adresują problemy wykryte w analizie „niezawodności odczytu i prezentacji danych". Priorytet P0 = bez tych poprawek system może po cichu pokazywać nieaktualne dane albo całkowicie przestać aktualizować UI bez żadnej widocznej informacji dla operatora.

---

## Przegląd commitów

| # | Commit | Temat |
|---|---|---|
| P0.1 | `e24c3fa` | SSE reconnect z exponential backoff + trailing-edge debounce |
| P0.2 | `60cec9f` | SSE heartbeat (keep-alive przez proxy) |
| P0.3 | `60fef2a` | Wskaźnik statusu realtime w dashboardzie |
| P0.4 | `5782867` | Niezawodny WebSocket w gateway-frontend + wskaźnik |
| P0.5 | `1d8182d` | Reconciliation po reconnect + fallback polling |
| P0.6 | `f973010` | `revalidateTag` przed emisją eventu (wyścig cache) |
| P0.7 | `8b0b8b3` | Autoryzacja `/api/notify` wspólnym sekretem |

---

## P0.1 — Robust SSE reconnect + trailing-edge debounce

**Plik:** `dashboard/src/hooks/useRealtime.ts`

### Problem
- `onerror` ustawiał `eventSourceRef.current = null` i **nie próbował** się ponownie połączyć. Po pierwszej przerwie sieci dashboard tracił realtime na zawsze (do ręcznego F5).
- Throttling był *leading-edge*: pierwszy event z okna 500 ms wywoływał refresh, kolejne były **odrzucane**. Przy burstach (np. dwa `LINE_UPDATE` w 100 ms) ostatnia zmiana mogła nigdy nie dotrzeć.

### Poprawka
- Exponential backoff przy reconnect: 1s → 2s → 4s → … → 30s (max), reset na sukcesie.
- Trailing-edge debounce (500 ms) zamiast throttle — zawsze refreshujemy po **ostatnim** evencie w oknie.
- Hook eksportuje `{ status, lastEventAt }` dla wskaźnika statusu.
- Wymuszony `router.refresh()` na każdym (re)connect.
- Zachowano 60s fallback polling interval.

### Co testować
- Zatrzymaj dashboard server na 30s, wznów → klient sam wraca do `connected`.
- Odłącz sieć na 10s → status idzie w `connecting`, potem wraca.
- Wywołaj dwa `LINE_UPDATE` w 100 ms → dashboard pokazuje finalny stan (nie gubi drugiego).

---

## P0.2 — SSE heartbeat

**Plik:** `dashboard/src/app/api/events/route.ts`

### Problem
- Cisza na SSE > 30–60 s → nginx/Cloudflare/Next proxy zamyka połączenie jako idle, mimo że gateway działa.
- Kod używał `TransformStream` z niepełnym cleanupem; błąd `enqueue` po abort rzucał unhandled.

### Poprawka
- 15s heartbeat w formie **SSE comment frame** (`: ping\n\n`) — browser ignoruje, ale proxy widzi ruch.
- Przepisane na `ReadableStream` z jednolitym cleanupem: abort signal + enqueue error → ten sam teardown.
- `eventEmitter.setMaxListeners(1000)` — obsługa wielu klientów bez warningów Node.
- Header `X-Accel-Buffering: no` wyłącza bufor nginx na tym endpointcie.

### Co testować
- Dashboard otwarty 5 min bez żadnego eventu z gateway → nadal `connected`, nie ma reconnectu.
- Sprawdź Network tab → co 15 s powinien być `: ping` widoczny w stream.

---

## P0.3 — Wskaźnik statusu realtime w dashboardzie

**Pliki:**
- `dashboard/src/components/ConnectionStatus.tsx` (nowy)
- `dashboard/src/components/MainDashboard.tsx` (edit)

### Problem
Operator nie miał żadnego sygnału, że realtime jest zerwany. Jeśli SSE padło, widział „zamrożony" ekran i nie wiedział, że to awaria — myślał, że po prostu nic się nie dzieje.

### Poprawka
Pill w headerze dashboardu:
- `LIVE` (zielony) — `status === 'connected'`
- `ŁĄCZENIE` (żółty, pulsujący) — `status === 'connecting'`
- `OFFLINE` (czerwony) — `status === 'disconnected'`

Tooltip przy hover pokazuje `lastEventAt` („ostatni update 12 s temu").

### Co testować
- Normalna praca → zielony LIVE.
- Kill dashboard server → czerwony OFFLINE w < 2 s.
- Reconnect → migający żółty → zielony.
- Hover → sensowny timestamp.

---

## P0.4 — Gateway WebSocket reliability

**Pliki:**
- `gateway/frontend/src/hooks/useWebsocket.ts`
- `gateway/frontend/src/components/ConnectionStatus.tsx` (nowy)
- `gateway/frontend/src/components/Dashboard.tsx` (edit)

### Problem
- Reconnect trywialnie po 3s bez backoffu — burza reconnectów, gdy backend wstaje wolniej.
- Brak heartbeat → połączenie umierało po cichu przy NAT timeoutach.
- `onUpdate` captured stale closure (brak refa) — po rerenderzie komponent mógł wołać starą funkcję.
- Brak widocznego statusu.

### Poprawka
- Exponential backoff 1s → 30s.
- Client heartbeat co 20 s (`ws.send('ping')`).
- `onUpdateRef` i `onReconnectRef` — stabilne callbacki niezależne od rerenderów.
- Hook wraca `{ status, lastEventAt }`, Dashboard renderuje `<ConnectionStatus>` w tab barze.

### Co testować
- Restart gateway backend → gateway frontend sam się łączy z rosnącym opóźnieniem, pokazuje `ŁĄCZENIE`.
- Długie trzymanie karty otwartej (> 5 min) bez eventów → WS nadal żywy dzięki heartbeat.

---

## P0.5 — Reconciliation po reconnect + fallback polling

**Pliki:**
- `gateway/frontend/src/components/Dashboard.tsx`
- `gateway/frontend/src/hooks/useWebsocket.ts` (rozszerzone o `onReconnect`)
- `dashboard/src/hooks/useRealtime.ts` (już w P0.1: wymuszony refresh na connect)

### Problem
Jeśli podczas przerwy w połączeniu gateway wysłał event, klient go przegapił. Po reconnect interfejs pokazywał **nieaktualny snapshot** z przed przerwy, aż ktoś ręcznie odświeżył.

### Poprawka
- Gateway frontend: `usePLCWebsocket(handleUpdate, handleReconnect)`. `handleReconnect` woła `fetchPlcs()` — świeży snapshot z API po każdym (re)connect.
- Dashboard: analogicznie, `router.refresh()` na każdym connect SSE.
- Dodatkowo **fallback polling co 60 s** jako safety net — nawet jeśli WS/SSE raportuje „żywe", ale nie dostarcza danych (np. bug po stronie serwera), UI i tak zrefreshuje się co minutę.

### Co testować
- Odłącz klienta od sieci, zmień stan PLC w bazie ręcznie, przywróć sieć → klient musi pokazać nowy stan (bez F5).
- Zostaw kartę na 2 min bez żadnego ruchu → fallback poll zrefreshuje (Network tab: zapytanie co 60s).

---

## P0.6 — `revalidateTag` przed emisją eventu

**Plik:** `dashboard/src/app/api/notify/route.ts`

### Problem
Kolejność była: najpierw `emitRealtimeEvent`, potem `revalidateTag`. Klient dostawał event, robił `router.refresh()`, a serwer — nadal serwujący stary cache z `unstable_cache` — zwracał **nieaktualne** dane. Widoczny glitch: event przyszedł, ale UI się nie zmienił; dopiero drugi refresh po chwili pokazywał nowy stan.

### Poprawka
```ts
revalidateTag('halls-data')   // NAJPIERW
emitRealtimeEvent({ ... })    // POTEM
```
Dodatkowo: whitelist `ALLOWED_TYPES` — odrzucamy nieznane typy eventów (defense-in-depth po P0.7).

### Co testować
- Zmień PLC przez gateway → dashboard widzi nowy stan **od razu** przy pierwszym refreshu, nie za drugim.
- Wywołaj `POST /api/notify` z `{type: "BOGUS"}` → 400.

---

## P0.7 — Autoryzacja `/api/notify`

**Pliki:**
- `dashboard/src/app/api/notify/route.ts`
- `gateway/backend/app/main.py`
- `gateway/backend/app/plc/worker.py`
- `docker-compose.yml`

### Problem
Endpoint `/api/notify` był publiczny w sieci Docker. Dowolny kontener / maszyna w `prod_net` mogła:
- fałszować eventy `LINE_UPDATE` → wprowadzać operatora w błąd,
- spamować `REVALIDATE` → inwalidować cache w pętli, DoS dashboardu.

### Poprawka
- `verifyToken()` w notify route porównuje nagłówek `X-Notify-Token` z env `NOTIFY_TOKEN` w **czasie stałym** (`crypto.timingSafeEqual`).
- Jeśli `NOTIFY_TOKEN` nie ustawiony → loguje warning i przepuszcza (wygoda dev — **koniecznie ustawić na produkcji**).
- Gateway (main.py, worker.py): wysyła `X-Notify-Token: $NOTIFY_TOKEN` gdy env ustawiony.
- `docker-compose.yml`: `NOTIFY_TOKEN=${NOTIFY_TOKEN:-change-me-in-production}` na obu kontenerach (gateway-backend, dashboard-app).

### Co testować
- Ustaw `NOTIFY_TOKEN=secret123` w `.env`, restart stack → komunikacja gateway↔dashboard nadal działa.
- `curl -X POST http://dashboard-app:3000/api/notify -d '{"type":"LINE_UPDATE"}' -H 'content-type: application/json'` (bez tokenu) → 401.
- Sprawdź log dashboardu na starcie bez env → warning „NOTIFY_TOKEN is not set".

---

## Scenariusz testowy end-to-end

Proponowana sekwencja do sprawdzenia całości:

1. **Cold start**: `docker compose up` → dashboard i gateway-frontend pokazują `LIVE` w < 5 s.
2. **Normalna praca**: zmień tag w PLC (symulator) → oba frontendy widzą zmianę w < 1 s.
3. **Kill dashboard**: `docker compose stop dashboard-app` → gateway-frontend nadal LIVE (swoje WS), dashboard niedostępny. `docker compose start dashboard-app` → dashboard sam wraca do LIVE, bez F5.
4. **Kill gateway-backend**: status gateway-frontend → OFFLINE, po starcie backendu → sam wraca.
5. **Długi idle**: zostaw dashboard otwarty 10 min bez zmian w PLC → nadal LIVE (heartbeat), żadnych reconnectów w Network tab.
6. **Burst events**: wymuś 5 zmian w PLC w 200 ms → dashboard pokazuje ostatni stan (debounce), nie 5 kolejnych refreshów.
7. **Stale cache**: zmień PLC przez gateway → pierwszy refresh dashboardu już pokazuje nowy stan (nie potrzeba drugiego).
8. **Spoof notify**: `curl` do `/api/notify` bez tokenu → 401.
9. **Fallback poll**: w DevTools zablokuj `/api/events` → w ciągu 60 s i tak jest refresh danych (polling safety net).

## Notatki operacyjne

- `NOTIFY_TOKEN` — ustawić w `.env` na produkcji. Wartość musi być identyczna dla `gateway-backend` i `dashboard-app`.
- Jeśli używany jest zewnętrzny reverse proxy (nginx) przed dashboardem: upewnij się, że `/api/events` nie jest buforowane (`proxy_buffering off`) i nie ma krótkiego `proxy_read_timeout`. Heartbeat co 15 s powinien wystarczyć dla domyślnych ustawień.

## Co NIE zostało zrobione (świadomie)

Poza scope P0 pozostały (do osobnej iteracji, jeśli będzie potrzeba):
- Error Boundaries na poziomie stron dashboardu.
- Synchronizacja stanu w komponencie Gantt przy częstych update'ach.
- Bug fake-event w `LineDiagnostics`.
- Metryki/telemetria po stronie klienta (ile reconnectów, ile eventów przepuszczonych).

Te punkty są P1/P2 — nie blokują niezawodności odczytu, ale warto wrócić.
