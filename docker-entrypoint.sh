#!/bin/sh
set -e

# Add prisma-cli to NODE_PATH so prisma can find dotenv and tsx
export NODE_PATH=/prisma-cli/node_modules:$NODE_PATH
export PATH=/prisma-cli/node_modules/.bin:$PATH

echo "Running database migrations..."
/prisma-cli/node_modules/.bin/prisma migrate deploy

echo "Starting application..."
exec node server.js
