#!/bin/sh
set -e

echo "Running database migrations..."
/prisma-cli/node_modules/.bin/prisma migrate deploy

echo "Starting application..."
exec node server.js
