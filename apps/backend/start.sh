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

# Start the application
echo "Starting application..."
npm run start
