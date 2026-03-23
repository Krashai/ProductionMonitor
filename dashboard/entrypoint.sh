#!/bin/sh
set -e

echo "🚀 Starting Zero-Touch Initialization..."

# 1. Czekanie na bazę danych
echo "⏳ Waiting for database to be ready..."
until printf "." && nc -z dashboard-db 5432; do
  sleep 1
done
echo "✅ Database is up!"

# 2. Wdrożenie migracji schematu (zawsze bezpieczne)
echo "📂 Running database migrations..."
./node_modules/.bin/prisma migrate deploy

# 3. Konfiguracja TimescaleDB (idempotentna)
echo "⏱️ Configuring TimescaleDB hypertables..."
./node_modules/.bin/prisma db execute --file ./prisma/init_timescale.sql

# 4. Automatyczny Seed (logika sprawdzania jest już wewnątrz seed.ts)
# Uruchamiamy skompilowany plik JS bezpośrednio przez node
echo "🌱 Checking seed data..."
if [ -f "./prisma/dist/prisma/seed.js" ]; then
    node ./prisma/dist/prisma/seed.js
else
    echo "⚠️ Seed script not found at ./prisma/dist/prisma/seed.js, skipping seed."
fi

echo "🎬 Initialization complete. Starting application..."

# 5. Uruchomienie aplikacji Next.js
exec node server.js
