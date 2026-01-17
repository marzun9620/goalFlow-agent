# apps/api

Hono HTTP server with thin handlers:
- `domain/` — schemas and pure rules
- `use-cases/` — orchestration/business logic
- `adapters/http/` — Hono routes calling use cases
- `adapters/db/` — Prisma/SQL adapters implementing ports

Expose a `createApp` for testability; middleware for auth/logging/rate limits. Wire scripts for `dev`, `biome`, `tsc --noEmit`, and `vitest`.
