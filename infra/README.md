# Kakeibo Compose Stack

This stack is intended for Coolify Docker Compose deployments.

## Services

- `web`: public Kakeibo Next.js app on port `3000`.
- `postgres`: private Postgres database.
- `waha`: private WAHA WhatsApp service on port `3000`.
- `codex-runner`: private Codex execution service on port `8787`.

Only `web` should receive a public domain in Coolify. Do not assign domains or
host port mappings to `postgres`, `waha`, or `codex-runner`.

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

Optional:

- `POSTGRES_USER`
- `POSTGRES_DB`
- `GOOGLE_GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
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
