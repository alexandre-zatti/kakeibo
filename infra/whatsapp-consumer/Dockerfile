FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY tsconfig.json ./
COPY src ./src

RUN pnpm exec prisma generate
RUN pnpm exec esbuild src/consumers/whatsapp-consumer.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --packages=external \
  --outfile=dist/whatsapp-consumer.mjs
RUN pnpm prune --prod

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
