# Mashrum deployment guide

## Architecture (MVP)

```text
Browser → Next.js (apps/web)
                ↓ NEXT_PUBLIC_API_URL
           Express API (apps/api)
                ↓
           PostgreSQL
```

WhatsApp webhooks must hit the API publicly:

```text
Meta → https://<api-host>/webhooks/whatsapp
```

## Environment

Copy `.env.example` → `.env` and set at minimum:

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥32 random chars each |
| `TOKEN_ENCRYPTION_KEY` | 64 hex chars (32 bytes) for WhatsApp token encryption |
| `API_URL` | Public API base URL (used in webhook URL display) |
| `WEB_URL` | Admin web origin (CORS) |
| `NEXT_PUBLIC_API_URL` | Same API URL for the browser |
| `META_APP_SECRET` | Required in production for webhook signature verification |
| `WHATSAPP_MOCK_SEND` | Set `false` in production to call Meta Graph API |

Generate secrets:

```bash
openssl rand -hex 32   # JWT secrets
openssl rand -hex 32   # TOKEN_ENCRYPTION_KEY
```

## Database

Fresh environment:

```bash
pnpm setup
pnpm db:migrate:deploy
pnpm db:seed            # optional demo tenant
```

Local iteration shortcut (schema sync without migration files):

```bash
pnpm db:push
```

## Process model

Run two processes (or containers):

1. **API** — `pnpm --filter @mashrum/api start` (after build)
2. **Web** — `pnpm --filter @mashrum/web start`

Build:

```bash
pnpm build
```

Health check:

```bash
curl https://<api-host>/health
```

## WhatsApp / Meta checklist

1. Create Meta app + WhatsApp product
2. Set webhook callback URL to `https://<api-host>/webhooks/whatsapp`
3. Set verify token (same value entered in Mashrum WhatsApp connect form, or `META_WEBHOOK_VERIFY_TOKEN`)
4. Subscribe to `messages` field
5. In Mashrum admin → WhatsApp → connect with:
   - Phone number ID
   - Permanent access token
   - Verify token
6. Set `WHATSAPP_MOCK_SEND=false`
7. Test with a real WhatsApp message (`hi` / `menu`)

## Docker Compose (infra only)

```bash
docker compose up -d   # postgres + redis
```

## Queue (BullMQ)

- `QUEUE_DRIVER=auto` (default): use Redis when reachable, otherwise in-process memory
- `QUEUE_DRIVER=redis`: require Redis (fail startup if unavailable)
- `QUEUE_DRIVER=memory`: force in-process queue

Local Redis helper (avoids broken Homebrew Redis module configs):

```bash
./scripts/redis-dev.sh
```

Check active driver:

```bash
curl http://localhost:4000/queue/status
```

## File uploads

Product images support two drivers:

| `STORAGE_DRIVER` | Behavior |
|------------------|----------|
| `local` (default) | Files saved under `UPLOAD_DIR`, served at `/uploads/...` |
| `s3` | Uploaded to S3-compatible storage (`S3_*` env vars) |

For multi-instance production, use `STORAGE_DRIVER=s3` (AWS S3, Cloudflare R2, MinIO, etc.).

```bash
STORAGE_DRIVER=s3
S3_BUCKET=mashrum-uploads
S3_REGION=ap-south-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
# Optional:
# S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
# S3_PUBLIC_URL_BASE=https://cdn.example.com
```

## Security notes for production

- Never expose `.env` or WhatsApp tokens to the frontend
- Force HTTPS on API and web
- Rotate JWT and encryption keys if leaked
- Restrict CORS to your admin domain (`WEB_URL`)
- Keep `META_APP_SECRET` set so unsigned webhooks are rejected
- Prefer managed Postgres backups

## Demo login (after seed)

```text
Email:    demo@mashrum.app
Password: demo12345
```
