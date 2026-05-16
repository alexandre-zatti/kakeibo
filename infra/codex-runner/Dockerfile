FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    ripgrep \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g @openai/codex

RUN useradd --create-home --shell /bin/bash codex \
  && mkdir -p /home/codex/.codex /workspace/data \
  && chown -R codex:codex /home/codex/.codex /workspace

WORKDIR /opt/codex-runner

COPY --chown=codex:codex server.mjs ./server.mjs

USER codex

ENV NODE_ENV=production
ENV PORT=8787
ENV CODEX_HOME=/home/codex/.codex
ENV HOME=/home/codex
ENV CODEX_WORKSPACE=/workspace

EXPOSE 8787

CMD ["node", "server.mjs"]
