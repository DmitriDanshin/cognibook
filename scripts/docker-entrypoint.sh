#!/bin/sh
set -e

# Run Prisma db push to sync schema
echo "Running Prisma DB migration..."
prisma db push --schema=./prisma/schema.prisma --url="${DATABASE_URL}" --accept-data-loss || {
    echo "Warning: Prisma migration failed, but continuing..."
}

# Execute the main command
exec "$@"