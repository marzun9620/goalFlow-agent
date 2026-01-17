# GoalFlow Agent: Combined Specification (Goal/Stack/Ops)

## Overview
GoalFlow is an AI-driven workload and time-management assistant that matches tasks to people, plans schedules, tracks personal goals, and automates administrative actions. It pairs LLM reasoning with structured data (skills/capacity, calendars, project tools) and enforces guardrails (moderation, PII masking, human approvals). The implementation targets a TypeScript stack with a Hono HTTP layer and React Router v7 SSR web UI.

## Tech Baseline & Repository Layout
- Runtime/tooling: Node 20.19.5 (pinned via `Server/mise.toml`); TypeScript; Biome 1.9.x; Vitest; Taskfile-driven commands; dotenv for config.
- Web: React Router v7 SSR in `Client/` with file-based routes; loaders/actions stay thin and call use cases; `react-router typegen` optional via task.
- API: Hono server in `Server/` exposing thin HTTP handlers that delegate to use cases.
- Data: Prisma 6.x ORM backed by Postgres 15; schema lives in `Client/prisma/schema.prisma`; vector store (Chroma/Faiss) for unstructured docs.
- Current layout:
  - `Client/`: `app/routes/`, `app/domain/`, `app/components/`, `prisma/`, Taskfile for web commands.
  - `Server/`: `app.ts`/`server.ts` Hono entry, `domain/`, `use-cases/`, `database/` (Atlas placeholder Taskfile), Taskfile for API commands.
  - `.github/workflows/`: root CI covering Client/Server; additional Client-specific workflow in `Client/.github/workflows/ci.yml`.
- Layering rules: domain (schemas, pure rules) → use-cases (orchestration) → ports (interfaces) → adapters (DB/HTTP/UI). Keep loaders/actions/handlers thin; avoid domain logic in transport.

## Environment & Dev Workflow
- Postgres: Docker Compose service on `localhost:25431` (`root/root`, db `app` by default); sample `DATABASE_URL=postgres://root:root@localhost:25431/app?schema=public&sslmode=disable&connection_limit=10&pool_timeout=10`.
- Env config: `Server/.env.sample` with `PORT`, `DATABASE_URL`, `HONEYPOT_SECRET`, `SCHEDULER_SECRET`, `OPENAI_API_KEY`, `GCS_BUCKET`; server defaults to `PORT=4000` if unset.
- Taskfiles: root includes `Client` (web) and `Server` (api) Taskfiles plus `Server/database` (Atlas placeholder). Commands include `task install`, `task up`/`down`, `task migrate:apply:auto`, `task prisma:generate`, `task router:generate`, `task run` (web dev), and CI helpers.
- Quickstart: `mise install` (for Node/Task) → `task install` → `task up` → `task migrate:apply:auto` (placeholder) → `task prisma:generate` → `task router:generate` → `task run` for web; run API via `cd Server && npm run dev`.

## Core Features & Data Model
- Skills & capacity mapping: structured table per person (id, skills[], proficiency, years, weekly_capacity_hours, availability, timezone).
- Task matching & workload distribution: LLM-assisted matching returning structured recommendations with justifications; capacity balancing to avoid overload.
- Time management & scheduling: calendar connectors (Google/Outlook) to read free/busy and propose deadlines/meetings; approval before writes.
- Personal goal management: define goals → break into subtasks → inject into schedule; track progress and reminders via messaging.
- Analytics & reporting: workload distribution, deadlines, goal progress; code-interpreter/data-transform for charts.
- Integrations: calendars, messaging (Slack/Teams), project tools (Jira/Trello/Notion), file storage, vector store for unstructured docs.
- Suggested contracts (JSON/DB):
  - `skill { id, name, level, years }`
  - `person { id, name, role, skills: skill_id[], capacity_hours, timezone, current_load_hours }`
  - `task { id, title, description, required_skills[], priority, effort_hours, due_at, owner, sensitivity_level }`
  - `goal { id, owner, title, milestones[], target_date, status }`
  - `calendar_event { id, person_id, start, end, type, external_id, source }`
  - Matching output: `{ task_id, candidates: [{ person_id, score, why, projected_load_hours }] }`

## Agent Logic & APIs
- Prompt templates: interpret project descriptions, select tools, and emit structured JSON (schemas for matching, scheduling, approvals).
- Use cases: `match_employee`, `propose_schedule`, `plan_goal`, `summarize_workload`.
- Hono HTTP surface: handlers validate input → call use-cases → return typed JSON; middleware for auth, rate limits, request-scoped context (DB, logger).
- Reasoning loop: model proposes action → orchestrator calls tool → result fed back → exit on final answer. Include exit conditions and error mapping.
- Vector store: ingest CVs/policies/training docs; retrieval used for justifications and hallucination checks.
- Code execution: optional Python data-transform module for reports (guarded, sandboxed).

## Safety & Guardrails
- Content moderation and PII masking on inputs/outputs; reject or redact unsafe content.
- Hallucination checks against vector store/DB; block unsupported claims.
- Human approval matrix: require approval before creating calendar events, project tasks, or assignments above a risk threshold; log who approved and when.
- Audit logging for key actions; rate limits and auth on APIs; role-based access (admin/manager/member) with data segregation for org vs individual use.

## Implementation Roadmap
1) Planning & data prep: user stories, compliance needs, skills matrix normalization, goal entry design, upload unstructured docs to vector store.
2) Architecture & setup: wire Node/mise/Taskfile, Biome, Prisma + Atlas, React Router v7 SSR, Hono server skeleton, vector store wrapper, safety modules.
3) Core logic: prompts, skill-matching use case, scheduling with calendar APIs, goal planner, reasoning loop, approval step before external writes.
4) UI & integrations: CLI entry point; web chat/SSR UI; notifications via email/chat; dashboards for workload/goals; connectors for calendars, messaging, project tools.
5) Testing & evaluation: unit/integration tests (matching, scheduling, goal planning, adapters); evaluation datasets and metrics (matching precision/recall, schedule feasibility, latency, cost budget); user feedback loop.
6) Deployment & scaling: containerize; logging/monitoring; access control; expand connectors; optional multi-agent split (scheduling vs goal planning) coordinated by a manager agent.

## CI/CD
- Root GitHub Actions: security audit jobs for Client/Server; Client lint/typecheck/build/test (`npm run ci:*` with `npx prisma generate`); Server lint/build/test with Postgres service and optional Atlas migrate; npm caching across jobs.
- Additional Client workflow (`Client/.github/workflows/ci.yml`): mirrors lint/typecheck/test/build for Client path changes.

## Deployment & Infra (GCP-friendly)
- Cloud Run service for Hono server; images in Artifact Registry; env vars sourced from Secret Manager.
- Cloud SQL Postgres (private IP preferred); local dev via `cloud-sql-proxy` to reuse `DATABASE_URL`.
- GCS bucket for assets; service account with `secretAccessor`, `cloudsql.client`, `artifactregistry.writer`, `run.admin`, and scoped storage roles.
- Terraform reference (`/Users/marzun/Nesia-inc/client-works/c-2/cic-infra/service`): VPC, Cloud SQL, Cloud Run, Artifact Registry, buckets, service accounts, scheduler/job, proxy VM. Add environments by copying `env/staging` → `env/<env>` and adjusting `terraform.tfvars`/`backend.tfvars`.
- OIDC GitHub Actions → GCP Workload Identity Federation; avoid key files; use `google-github-actions/auth@v2` + `setup-gcloud@v2`.

## Testing & Evaluation Notes
- Test splits: `test:backend` (use cases/adapters), `test:frontend` (UI), `ci:test` combined; Happy DOM + React Testing Library for components; DB-dependent specs run with Postgres fixtures.
- Performance/regression: automated evals for matching accuracy, schedule acceptance rate, goal completion tracking, latency/SLOs, and cost per run.

## Conclusion
This combined spec aligns GoalFlow’s feature goals with a concrete TypeScript/Hono/React Router stack, clear repository layout, guardrails, and delivery/deployment plan. Start with a single agent and add complexity incrementally, keeping approvals, safety, and evaluations in place throughout.
