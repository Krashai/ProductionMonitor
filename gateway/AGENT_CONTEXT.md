# Agent AI Context: PLC Gateway S7

Ten dokument służy jako skondensowany kontekst dla agentów AI pracujących nad systemem **PLC Gateway S7**.

## 🏗️ System Overview
- **Purpose:** Gateway odczytujący dane z Siemens PLC (S7-300/400/1200/1500) i zapisujący je bezpośrednio do współdzielonej bazy PostgreSQL/TimescaleDB.
- **Backend:** FastAPI (Python), Multithreading (PLCWorker per PLC).
- **Frontend:** React + Tailwind.
- **Komunikacja:** Bezpośredni zapis do DB, REST API dla konfiguracji, WebSockets dla podglądu Live.

## 📡 Integracja Danych
System opiera się na współdzieleniu bazy danych (Shared Database pattern) z modułem Dashboard.

### 1. Baza Danych (Rekomendowane dla danych historycznych)
- **Typ:** PostgreSQL + TimescaleDB.
- **Kluczowe Tabele:** 
  - `MachineStatusHistory`: Historia statusów (On/Off) i prędkości.
  - `ScrapEvent`: Zdarzenia wykrytych braków (scrap).
  - `Line`: Konfiguracja linii i ich przypisanie do hal.

### 2. REST API (Konfiguracja)
- **Base URL:** `http://gateway-backend:8000`.
- **Auth:** JWT (Bearer Token).
- **Zadania:** Zarządzanie sterownikami (CRUD), definicja tagów S7.

### 3. WebSockets (Dane Live)
- **URL:** `ws://gateway-backend:8000/ws`.
- **Zastosowanie:** Natychmiastowe odświeżanie wartości tagów w interfejsie użytkownika bez obciążania bazy danych.

## ⚠️ Kluczowe Ograniczenia
- **S7 Slots:** S7-1200/1500 -> Slot 1. S7-300/400 -> Slot 2.
- **Detekcja Scrap:** Gateway implementuje detekcję zbocza narastającego. Nie dubluj tej logiki w systemach odbiorczych – ufaj wpisom w tabeli `ScrapEvent`.
- **IP 127.0.0.1:** Użycie tego adresu w konfiguracji PLC aktywuje wewnętrzny port symulacji (1102).
