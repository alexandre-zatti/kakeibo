# Kakeibo Compose Stack

This stack is intended for Coolify Docker Compose deployments.

## Services

- `web`: public Kakeibo Next.js app on port `3000`.
- `whatsapp-consumer`: private WAHA event consumer on port `8788`.
- `postgres`: private Postgres database.
- `waha`: private WAHA WhatsApp service on port `3000`.
- `codex-runner`: private Codex execution service on port `8787`.

Only `web` should receive a public domain in Coolify. Do not assign domains or
host port mappings to `postgres`, `waha`, `whatsapp-consumer`, or
`codex-runner`.

## Coolify Environment Variables

Set these in Coolify, not in Git:

- `KAKEIBO_PUBLIC_URL`
- `POSTGRES_PASSWORD`
- `BETTER_AUTH_SECRET`
- `WAHA_API_KEY_PLAIN`
- `WAHA_API_KEY_HASH`
- `WAHA_DASHBOARD_PASSWORD`
- `WAHA_SWAGGER_PASSWORD`
- `CODEX_RUNNER_TOKEN`
- `KAKEIBO_INTERNAL_WEBHOOK_SECRET`
- `KAKEIBO_WHATSAPP_DEFAULT_CHAT_ID`

Optional:

- `POSTGRES_USER`
- `POSTGRES_DB`
- `GOOGLE_GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `KAKEIBO_WHATSAPP_SESSION`
- `KAKEIBO_WHATSAPP_DEFAULT_USER_ID`
- `WHATSAPP_CONSUMER_PORT`
- `CODEX_DEFAULT_MODEL`
- `CODEX_DEFAULT_SANDBOX`
- `CODEX_JOB_TIMEOUT_MS`
- `CODEX_MAX_PROMPT_BYTES`
- `CODEX_MAX_OUTPUT_BYTES`

## WAHA Key

Generate a plain key and a SHA-512 hash:

```sh
WAHA_API_KEY_PLAIN="$(uuidgen | tr -d '-')"
WAHA_API_KEY_HASH="sha512:$(printf '%s' "$WAHA_API_KEY_PLAIN" | shasum -a 512 | awk '{print $1}')"
```

Store the plain key in `WAHA_API_KEY_PLAIN` for Kakeibo requests and the hashed
value in `WAHA_API_KEY_HASH` for the WAHA service.

## WhatsApp Defaults

Use `KAKEIBO_WHATSAPP_SESSION` for the WAHA session name Kakeibo should use.
It defaults to `default`.

Use `KAKEIBO_WHATSAPP_DEFAULT_CHAT_ID` for the household group chat id. Keep
the real chat id in Coolify, not in Git.

Optionally use `KAKEIBO_WHATSAPP_DEFAULT_USER_ID` for the Kakeibo user that
owns purchases created from WhatsApp imports. If it is not set, the consumer
uses the first household owner, then falls back to the oldest user.

WAHA posts `message.any` and `message.reaction` events to
`http://whatsapp-consumer:8788/events` on the internal compose network. The
consumer has no public Traefik labels or host port mapping.

## Codex Authentication

The `codex-runner` uses ChatGPT-managed Codex auth stored in the named
`codex_home` volume at `/home/codex/.codex`.

After the first deploy, open the `codex-runner` terminal in Coolify and run:

```sh
codex login --device-auth
codex login status
```

Do not copy `auth.json` into the repository or into Coolify environment
variables.

## Internal Validation

From inside the compose stack:

```sh
curl -fsS http://web:3000/api/health
curl -fsS http://whatsapp-consumer:8788/health
curl -fsS -H "X-Api-Key: $WAHA_API_KEY_PLAIN" http://waha:3000/api/sessions
curl -fsS -H "Authorization: Bearer $CODEX_RUNNER_TOKEN" http://codex-runner:8787/codex/login/status
```

Run a minimal Codex job only after `codex login status` succeeds:

```sh
curl -fsS \
  -H "Authorization: Bearer $CODEX_RUNNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Reply with OK only."}' \
  http://codex-runner:8787/jobs
```
