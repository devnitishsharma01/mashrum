# Mushroom

WhatsApp Ordering & Business Management (MVP).

Customers order on WhatsApp. Businesses manage everything in the admin panel.

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React, Vite, Ant Design, Axios, Redux |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| Auth | JWT + bcrypt |
| Storage | Local or AWS S3 |

```text
frontend/  →  backend/  →  MongoDB
```

## Folder structure

```text
mushroom/
├── frontend/          # React admin UI
│   ├── .env.example   # VITE_API_URL
│   └── src/
├── backend/           # Express API
│   ├── .env.example   # Mongo, JWT, S3, WhatsApp
│   ├── scripts/       # seed
│   └── src/
├── docs/              # deploy notes
├── package.json       # short scripts for both apps
├── .nvmrc             # Node version
└── .gitignore
```

## Setup

```bash
nvm use

# 1) Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2) Edit backend/.env (Mongo, secrets, S3 if needed)

# 3) Install + seed
npm run setup
npm run db:seed

# 4) Run (two terminals)
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:3000
```

Demo login: `demo@mushroom.app` / `demo12345`

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run setup` | Install backend + frontend deps |
| `npm run db:seed` | Create demo business/user |
| `npm run dev:api` | Start API |
| `npm run dev:web` | Start UI |

More: [docs/DEPLOY.md](docs/DEPLOY.md)
