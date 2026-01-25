# GoalFlow Agent Execution Plan

Context: skeleton app exists (Client React Router shell, Server Hono health check, Prisma schema only). The plan below is organized into commit-sized slices to reach a functional GoalFlow agent.

## Status snapshot (2026-01-25)
- Implemented: Shared Prisma schema; Atlas SQL migration + seed fixture checked into `Server/database`; Dockerized Postgres task; atlas.hcl for CI/local apply; Prisma generate wired into Server GH Actions; root/Client/Server Taskfiles; GitHub Actions for Client/Server lint/build/test; Backend v2 CI workflow skeleton; migration/apply smoke + Prisma generate verified locally (see commands below).
- Missing: Runtime DB wiring in Server, middleware, domain/use-case logic, connectors, guardrails, UI flows beyond landing page; backendv2 source/tests/compose stack.
- Tests present: `Server/app.test.ts` (health), `Client/app/routes/_index.test.tsx` (landing). No integration/e2e.

## Progress tracker
- [x] Commit 1 — Database foundations (schema, migration, seed, atlas.hcl, CI Prisma generate; migration apply + prisma generate run locally on 2026-01-25)
- [ ] Commit 2 — API scaffolding & middleware
- [ ] Commit 3 — Matching use case
- [ ] Commit 4 — Scheduling use case
- [ ] Commit 5 — Goal planning
- [ ] Commit 6 — Guardrails & connectors stubs
- [ ] Commit 7 — Web UI flows
- [ ] Commit 8 — CI/CD and ops hardening
- [ ] Commit 9 — Evaluation & polish

Commit 1 — Database foundations
- Add Atlas migrations from `Client/prisma/schema.prisma`; wire `Server/database/Taskfile` to apply/seed.
- Ensure `Server/.env.sample` + `DATABASE_URL`/`PORT` align; add Prisma client generation to Server task/CI where needed.
- Tests: prisma generate smoke; migration apply locally. Ran `task up` then `DATABASE_URL=postgres://root:root@127.0.0.1:25431/app?sslmode=disable task migrate:apply:auto` (no pending migrations) and `cd Server && npm run prisma:generate` on 2026-01-25.

Commit 2 — API scaffolding & middleware
- Introduce shared domain types (TS/zod) and request/response schemas.
- Add Hono middleware: auth stub, request-scoped logger/db, error mapper, rate limit placeholder, health/version routes.
- Tests: unit tests for middleware; API health check.

Commit 3 — Matching use case
- Implement `match_employee` use case using Prisma (skills/capacity), deterministic scoring, LLM justification hook (stubbed), and REST handler.
- Return structured match output; add input validation.
- Tests: unit for scoring + handler; integration with Postgres fixture data.

Commit 4 — Scheduling use case
- Implement `propose_schedule` using free/busy inputs (mock connector), deadlines, approvals required flag; REST handler.
- Introduce approval decision structure and audit logging hook.
- Tests: use-case logic with fixtures; handler happy-path.

Commit 5 — Goal planning
- Implement `plan_goal` to break goals into milestones/subtasks and link to scheduling; CRUD for goals; REST handlers.
- Add `summarize_workload` endpoint leveraging existing data.
- Tests: goal planner unit tests; workload summary integration.

Commit 6 — Guardrails & connectors stubs
- Add moderation/PII masking wrapper for OpenAI calls; vector-store adapter placeholder; approval/audit logging implementation.
- Define ports for calendars (Google/Outlook), messaging (Slack/Teams), project tools (Jira/Trello/Notion); add mock adapters for dev/tests.
- Tests: guardrail unit tests; connector mock coverage.

Commit 7 — Web UI flows
- Build UI for dashboard (workload/goals), task/goal detail, assignment + scheduling flows; hook loaders/actions to API.
- Add auth gating (stub), error boundaries, optimistic updates, approvals UX.
- Tests: RTL/Happy DOM coverage for key screens and forms.

Commit 8 — CI/CD and ops hardening
- Update CI to run migrations/seeds for API tests; add router typegen; cache Prisma client builds.
- Add Dockerfiles (Client/Server) and compose for local; logging/metrics stubs; deployment notes for Cloud Run/Cloud SQL.
- Tests: CI passes end-to-end; container build smoke.

Commit 9 — Evaluation & polish
- Add evaluation datasets/metrics for matching and schedule acceptance; track latency/cost budgets.
- Fill docs: README updates, runbooks, approval matrix, vector-store ingestion steps.
- Tests: eval jobs scripted; docs checked in.
