# database

- Managed via Atlas with source of truth at `schema/schema.sql`.
- Use `task database:schema:apply:auto` (placeholder) to apply migrations before running Prisma generate.
- Fixtures/seeds live under `fixtures/` for local/dev/test Postgres.
