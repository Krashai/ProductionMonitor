-- 1. Upewnij się, że rozszerzenie jest aktywne
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 2. Konwersja tabel na Hypertables
SELECT create_hypertable('machine_status_history', 'time', if_not_exists => true, migrate_data => true);
SELECT create_hypertable('scrap_events', 'time', if_not_exists => true, migrate_data => true);

-- 3. Ustawienie polityki retencji (7 dni)
-- Najpierw usuwamy stare polityki jeśli istnieją
SELECT remove_retention_policy('machine_status_history', if_exists => true);
SELECT remove_retention_policy('scrap_events', if_exists => true);

-- Dodajemy nowe
SELECT add_retention_policy('machine_status_history', INTERVAL '7 days');
SELECT add_retention_policy('scrap_events', INTERVAL '7 days');
