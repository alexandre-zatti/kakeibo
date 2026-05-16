#!/bin/sh
set -e

# Add prisma-cli to NODE_PATH so prisma can find dotenv and tsx
export NODE_PATH=/prisma-cli/node_modules:$NODE_PATH
export PATH=/prisma-cli/node_modules/.bin:$PATH

PRISMA_CLI="/prisma-cli/node_modules/.bin/prisma"

if [ "$NODE_ENV" = "production" ]; then
    : "${DATABASE_URL:?DATABASE_URL is required in production}"
    : "${BETTER_AUTH_SECRET:?BETTER_AUTH_SECRET is required in production}"
    : "${BETTER_AUTH_URL:?BETTER_AUTH_URL is required in production}"

    if [ "$BETTER_AUTH_SECRET" = "build-time-placeholder-not-for-production" ]; then
        echo "Refusing to start with placeholder BETTER_AUTH_SECRET in production."
        exit 1
    fi
fi

echo "Running database migrations..."

# Try to deploy migrations
if ! $PRISMA_CLI migrate deploy 2>&1; then
    echo "Migration failed. Checking if baselining is needed..."

    # If database has existing schema but no migration history, baseline it
    # This marks the init migration as already applied
    echo "Baselining database with initial migration..."
    $PRISMA_CLI migrate resolve --applied "20260107004524_init" || true

    # Retry deploy after baselining
    echo "Retrying migration deploy..."
    $PRISMA_CLI migrate deploy
fi

echo "Migrations complete. Starting application..."
exec node server.js
