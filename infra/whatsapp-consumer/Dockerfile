# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY infra/whatsapp-consumer/package.json infra/whatsapp-consumer/pnpm-lock.yaml ./
RUN --mount=type=cache,id=kakeibo-pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --store-dir /pnpm/store

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY tsconfig.json ./tsconfig.json

RUN pnpm exec prisma generate
RUN generated_client="$(find node_modules/.pnpm -path '*/node_modules/.prisma/client/default.js' -print -quit)" \
  && generated_prisma_dir="$(dirname "$(dirname "$generated_client")")" \
  && cp -R "$generated_prisma_dir" /tmp/generated-prisma-client

RUN mkdir -p src/consumers src/lib/schemas src/services src/types
COPY src/consumers/whatsapp-consumer.ts ./src/consumers/whatsapp-consumer.ts
COPY src/whatsapp ./src/whatsapp
COPY src/lib/prisma.ts src/lib/logger.ts ./src/lib/
COPY src/lib/schemas/receipt.ts ./src/lib/schemas/receipt.ts
COPY src/services/grocery-import.ts src/services/whatsapp-command-run.ts ./src/services/
COPY src/types/purchase.ts ./src/types/purchase.ts

RUN pnpm exec esbuild src/consumers/whatsapp-consumer.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --packages=external \
  --outfile=dist/whatsapp-consumer.mjs
RUN CI=true pnpm prune --prod
RUN prisma_client="$(find node_modules/.pnpm -path '*/node_modules/@prisma/client/default.js' -print -quit)" \
  && prisma_node_modules="$(dirname "$(dirname "$(dirname "$prisma_client")")")" \
  && rm -rf "$prisma_node_modules/.prisma" \
  && cp -R /tmp/generated-prisma-client "$prisma_node_modules/.prisma"

FROM node:22-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV WHATSAPP_CONSUMER_PORT=8788

EXPOSE 8788

CMD ["node", "dist/whatsapp-consumer.mjs"]
