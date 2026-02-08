# GoalFlow Agent

LLM-assisted workload, scheduling, and goal management. This repo contains:
- **Server** — Hono + Effect API with Prisma/Postgres
- **Client** — React Router v7 SPA
- **Database** — PostgreSQL (Atlas migrations + Prisma schema)
- **DevOps** — Dockerfiles for server/client and a compose stack

## Quick start (local)
Requirements: Node `>=20.19.5`, npm, Docker (optional), Postgres.

### Clone & install
```bash
git clone <repo>
cd goalFlow-agent
npm install --prefix Server
npm install --prefix Client
```

### Run server (dev)
```bash
cd Server
npm run prisma:generate
npm run dev      # http://localhost:3000
```

### Run client (dev)
```bash
cd Client
npm run dev      # http://localhost:5173
```

### Tests
```bash
cd Server && npm test          # API/unit
cd Client && npm test          # RTL/unit
```

## Docker
Build and run the full stack (Postgres + API + Web):
```bash
docker compose up --build
# API: http://localhost:3000, Web: http://localhost:4173
```

## Project structure
```
Server/   # Hono + Effect API, Prisma schema
Client/   # React Router SPA
docker-compose.yml
```

## Key endpoints
- `GET /api/health` — health check
- `POST /api/match` — match candidates to a task
- `POST /api/schedule/propose` — propose time slots
- `POST /api/goals` / `POST /api/goals/:id/plan` — goal planning
- `POST /api/approvals` / `PATCH /api/approvals/:id` — approvals
- `POST /api/llm/justify` — LLM justification (guardrailed stub)
- `POST /api/connectors/...` — calendar/messaging/project stubs

## Environment variables (server)
```
DATABASE_URL=postgres://user:pass@host:5432/app?schema=public
PORT=3000
```

## CI
GitHub Actions run lint/typecheck/test/build for Server & Client, plus security audit and CodeQL. Compose/db is used for server tests with migrations via Atlas.

## License
See `LICENSE` (if present) or contact maintainers.
