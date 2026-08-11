# Mashrum

WhatsApp Ordering & Business Management SaaS (MVP).

Businesses manage catalog/orders in the admin panel. Customers order on WhatsApp — no separate customer app.

## Stack

- **Web:** Next.js 15 + Ant Design (`apps/web`)
- **API:** Node.js + Express (`apps/api`)
- **DB:** PostgreSQL + Prisma (`packages/database`)
- **Shared:** Zod schemas, RBAC, order lifecycle (`packages/shared`)
- **Monorepo:** pnpm workspaces

## Prerequisites

- Node.js 20+ (recommended 22; see `.nvmrc`)
- pnpm 9+
- PostgreSQL 14+

## Quick start

```bash
nvm use
pnpm install

cp .env.example .env
ln -sf ../../.env packages/database/.env

# Infra (optional if Postgres already running)
docker compose up -d

# Build workspace packages + Prisma client
pnpm setup

# Apply schema (choose one)
pnpm db:migrate:deploy   # preferred
# pnpm db:push           # local shortcut

# Optional demo tenant
pnpm db:seed

# Run API (:4000) + Web (:3000)
pnpm --filter @mashrum/shared build
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health

### Demo login (after seed)

```text
demo@mashrum.app / demo12345
```

## MVP modules

| Area | Status |
|------|--------|
| Auth + multi-tenant business | Done |
| Categories / products / variants | Done |
| Inventory + stock statuses | Done |
| Customers | Done |
| Orders + Kanban + COD | Done |
| WhatsApp connect + webhook + bot | Done |
| Dashboard + reports | Done |
| Working hours | Done |
| Users / RBAC | Done |
| Product image upload | Done |

## WhatsApp local testing

1. Admin → **WhatsApp** → Connect (any test phone number ID + token)
2. Keep `WHATSAPP_MOCK_SEND=true` in `.env`
3. Use **Local simulator** (`hi` → browse → `checkout` → address → `confirm`)
4. Replies appear in the API console as `[whatsapp:mock]`

Production webhook setup: see [docs/DEPLOY.md](docs/DEPLOY.md).

## Common scripts

```bash
pnpm dev                 # API + Web
pnpm build               # production build
pnpm db:seed             # demo data
pnpm db:migrate:deploy   # apply migrations
pnpm db:studio           # Prisma Studio
```

## Workspace

```text
apps/web            Admin UI
apps/api            REST API + WhatsApp webhook/bot
packages/shared     Shared types/schemas
packages/database   Prisma schema, migrations, seed
docs/DEPLOY.md      Deployment guide
```
