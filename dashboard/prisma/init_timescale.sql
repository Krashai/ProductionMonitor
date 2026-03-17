-- 1. Upewnij się, że rozszerzenie jest aktywne
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 2. Konwersja tabel na Hypertables (wymaga klucza kompozytowego z kolumną 'time')
-- Uwaga: migrate_data => true pozwala na konwersję niepustych tabel
SELECT create_hypertable('machine_status_history', 'time', if_not_exists => true, migrate_data => true);
SELECT create_hypertable('scrap_events', 'time', if_not_exists => true, migrate_data => true);

-- 3. Ustawienie polityki retencji (30 dni)
SELECT add_retention_policy('machine_status_history', INTERVAL '30 days', if_not_exists => true);
SELECT add_retention_policy('scrap_events', INTERVAL '30 days', if_not_exists => true);
