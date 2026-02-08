# Ops & Deployment Notes

## Containers
- `Server/Dockerfile`: multi-stage build, Prisma client generated, runs `dist/index.js` on Node 20.19-alpine.
- `Client/Dockerfile`: React Router build served by nginx (see `Client/nginx.conf`).
- `docker-compose.yml`: postgres + server + client. Ports: `3000` (API), `4173` (web), `5432` (db).

Run stack:
```bash
docker compose up --build
```

## Database
- Schema is defined in `Server/prisma/schema.prisma`.
- Migrations managed by Atlas; CI applies with `atlas migrate apply --env local`.
- Local URL example: `postgres://root:root@localhost:5432/app?schema=public`.

## CI/CD expectations
- Node version pinned to `20.19.5`.
- Jobs: security audit, lint/typecheck, build, tests (server uses postgres service + atlas migrate).
- Artifacts: client build, server dist.

## Runtime env
- `DATABASE_URL` (required)
- `PORT` (default 3000)
- Optional LLM settings (future): `LLM_PROVIDER`, `OPENAI_API_KEY`, `LLM_MODEL`.

## Health & readiness
- `GET /api/health`
- `GET /api/version` (if added)
- For k8s: configure readiness to hit `/api/health`.

## Logs & monitoring (to do)
- Add structured JSON logging and metrics exporter (Prometheus) in a future pass.

## Secrets
- Keep `.env` out of git; prefer runtime injection (CI secrets, env vars, or secret manager).
