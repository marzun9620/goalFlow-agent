# apps/web

React Router v7 SSR shell with layered structure:
- `app/routes/` — file-based routes
- `app/.server/` — use cases/adapters invoked from loaders/actions
- `app/domain/` — schemas/types/validation
- `app/components/` — UI primitives and features
- `prisma/` — Prisma schema shared with API (if monorepo)

Add Taskfile/scripts to mirror CI commands (`router:typegen`, `biome`, `build`, `test`).
