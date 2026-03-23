#!/bin/sh
set -e

echo "🚀 [INIT-DB] Starting Database Initialization..."

# 1. Lekkie czekanie na bazę przy użyciu Node.js
echo "⏳ [INIT-DB] Waiting for database at dashboard-db:5432..."
node -e "
const net = require('net');
const client = new net.Socket();
const check = () => {
  client.connect(5432, 'dashboard-db', () => {
    client.end();
    process.exit(0);
  });
};
client.on('error', () => {
  setTimeout(check, 1000);
});
check();
"
echo "✅ [INIT-DB] Database is reachable!"

# 2. Synchronizacja schematu (db push - idealne dla RPi i świeżych instalacji)
echo "📂 [INIT-DB] Syncing database schema (db push)..."
npx prisma db push --skip-generate

# 3. TimescaleDB (teraz tabele już będą istnieć)
echo "⏱️ [INIT-DB] Configuring TimescaleDB..."
npx prisma db execute --file ./prisma/init_timescale.sql

# 4. Seed
echo "🌱 [INIT-DB] Running database seed..."
npx prisma db seed

echo "🏁 [INIT-DB] Initialization finished successfully!"
