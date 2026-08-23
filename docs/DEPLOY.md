# Deploy

## Architecture

```text
Browser → React (Vite) + Ant Design + Axios + Redux
              ↓ VITE_API_URL
         Node.js / Express
              ↓ Mongoose
           MongoDB
```

WhatsApp webhooks hit the API:

```text
Meta → https://<api-host>/webhooks/whatsapp
```

## Required env

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`.

| Variable | File | Notes |
|----------|------|-------|
| `MONGODB_URI` | `backend/.env` | MongoDB URI |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `backend/.env` | ≥32 chars each |
| `TOKEN_ENCRYPTION_KEY` | `backend/.env` | 64 hex chars |
| `API_URL` / `WEB_URL` | `backend/.env` | Public API + CORS |
| `VITE_API_URL` | `frontend/.env` | Browser → API |
| `AWS_*` | `backend/.env` | Optional S3 uploads |
| `WHATSAPP_MOCK_SEND` | `backend/.env` | `false` in production |

```bash
openssl rand -hex 32   # JWT / encryption secrets
```

## Run

```bash
npm run setup
npm run db:seed

npm run start --prefix backend
npm run build --prefix frontend && npm run preview --prefix frontend
```

Health: `curl https://<api-host>/health`

## WhatsApp / Meta

1. Meta app + WhatsApp product
2. Webhook URL: `https://<api-host>/webhooks/whatsapp`
3. Verify token (same as Mushroom connect form or `META_WEBHOOK_VERIFY_TOKEN`)
4. Subscribe to `messages`
5. Admin → WhatsApp → connect (phone number ID, access token, verify token)
6. Set `WHATSAPP_MOCK_SEND=false`

## Queue (optional)

| `QUEUE_DRIVER` | Behavior |
|----------------|----------|
| `auto` | Redis if available, else memory |
| `redis` | Redis required |
| `memory` | In-process only |

Optional local Redis: `./scripts/redis-dev.sh`  
Status: `curl http://localhost:4000/queue/status`

## Uploads

| `STORAGE_DRIVER` | Behavior |
|------------------|----------|
| `local` | Files under `UPLOAD_DIR`, served at `/uploads/...` |
| `s3` | AWS S3 (`AWS_*` or `S3_*` env vars) |

S3 example:

```bash
STORAGE_DRIVER=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=your-bucket
AWS_S3_REGION_NAME=ap-south-1
```
