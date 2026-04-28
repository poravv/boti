#!/bin/sh

# Wait for database
echo "Waiting for database..."
while ! nc -z postgres 5432; do
  sleep 1
done
echo "Database is up!"

# Sync database schema
echo "Syncing database schema..."
npx prisma db push

# Backfill default org and patch existing rows without orgId
echo "Running org backfill..."
npx tsx prisma/seed-default-org.ts || echo "Backfill skipped (tsx unavailable — index.ts seed will handle it)"

# build: 2026-04-28b
# Start the application
echo "Starting application..."
npm run start
