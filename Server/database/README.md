# database

- Schema source of truth is the Prisma datamodel at `../Client/prisma/schema.prisma` (symlinked in this package at `../prisma/schema.prisma`). Atlas migrations in `migrations/` are generated from that schema.
- Use `task database:schema:apply:auto` to apply migrations (defaults to the local Docker compose Postgres at `postgres://root:root@localhost:25431/app?sslmode=disable` unless `DATABASE_URL` is set).
- Use `task database:seed` to load the lightweight fixtures in `fixtures/seed.sql` for local/dev/test.
- `atlas migrate status --dir file://migrations --url "$DATABASE_URL"` shows pending migrations.
