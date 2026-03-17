# Agent AI Context: PLC Gateway S7

Ten dokument służy jako skondensowany kontekst dla agentów AI pracujących nad rozszerzeniem lub wykorzystaniem danych z systemu **PLC Gateway S7**.

## 🏗️ System Overview
- **Purpose:** Gateway odczytujący dane z wielu Siemens PLC (S7-300/400/1200/1500) i wystawiający je przez MQTT oraz API.
- **Backend:** FastAPI (Python), Multithreading (PLCWorker per PLC).
- **Frontend:** React + Tailwind.
- **Message Bus:** MQTT (Mosquitto) oraz WebSockets.

## 📡 Data Integration (For Data-Consumer Agents)

### 1. MQTT Stream (Push)
- **Broker Host:** `mqtt` (wewnątrz sieci Docker) lub `localhost` (na zewnątrz).
- **Port:** `1883`.
- **Topics:**
  - `plc/gate/data/{plc_id}/{tag_name}` -> Wartość (String).
  - `plc/gate/status/{plc_id}` -> `online`/`offline`.
- **Note:** Dane są publikowane przy każdej zmianie/odczycie.

### 2. REST API (Pull)
- **Base URL:** `http://localhost:8000`.
- **Auth:** Bearer Token (JWT).
- **Key Endpoints:**
  - `POST /login`: Uzyskanie tokena (`username`, `password`).
  - `GET /plcs`: Aktualna konfiguracja i ostatnie znane wartości tagów.
  - `POST/PUT/DELETE /plcs`: Zarządzanie flotą sterowników.

### 3. WebSockets (Live Sync)
- **URL:** `ws://localhost:8000/ws`.
- **Message Format:** JSON z typem `PLC_UPDATE`.

## 📂 Data Model (Tags)
Zmienne (Tags) mają następujące typy, które muszą być poprawnie mapowane w systemach odbiorczych:
- `REAL`: Mapuj na `float`.
- `INT`: Mapuj na `int` (16-bit).
- `DINT`: Mapuj na `int` (32-bit).
- `BOOL`: Mapuj na `boolean` (0/1).

## 🛠️ Operational Tasks for Agents
Jeśli masz za zadanie:
- **Tworzenie raportów:** Subskrybuj MQTT i zapisuj dane do bazy (np. InfluxDB).
- **Dashboardy:** Użyj WebSockets do odświeżania UI bez opóźnień.
- **Alarmy:** Monitoruj wartości z MQTT i wyzwalaj akcje przy przekroczeniu progów.
- **Dodawanie PLC:** Użyj endpointu `POST /plcs` z odpowiednią strukturą JSON (zobacz `backend/app/core/models.py`).

## ⚠️ Critical Constraints
- **PLC Slot:** S7-1200/1500 używają zazwyczaj `Slot 1`. S7-300/400 (oraz adaptery MPI) używają zazwyczaj `Slot 2`.
- **Performance:** System wspiera do ~30 sterowników jednocześnie.
- **Loopback:** Jeśli testujesz lokalnie, użyj IP `127.0.0.1`, aby uruchomić wbudowany symulator (Software Mock).
