#!/bin/sh
set -e

# Run Prisma db push to sync schema
npx prisma db push --schema=./prisma/schema.prisma --skip-generate 2>/dev/null || true

# Execute the main command
exec "$@"