# GoalFlow Agent Execution Plan

Context: skeleton app exists (Client React Router shell, Server Hono health check, Prisma schema only). The plan below is organized into commit-sized slices to reach a functional GoalFlow agent.

## Status snapshot (2026-02-07)
- Implemented: Shared Prisma schema; Atlas SQL migration + seed fixture; Dockerized Postgres; Prisma generate in CI; API scaffolding with Effect/Hono; runtime wiring (config/logger/db); health/version + matching endpoints; matching algorithm improvements (caps, weights, priorities, prefilter); scheduling use case with calendar/assignment conflicts and due-date awareness; goal planning endpoints with milestone generation and workload summary; LLM justification stub with guardrails (PII/toxicity checks, rate limit) and cost reporting; connectors stubs (calendar, messaging, project) with HTTP endpoints; approvals workflow; ManagedRuntime for DI; RFC7807 error handling; CI passing (lint/typecheck/tests).
- Missing: UI flows; Docker/deployment.
- Tests present: `Server/app.test.ts` (health/version), `Client/app/routes/_index.test.tsx` (landing), `Server/use-cases/matching/matchEmployeeUseCase.test.ts` (matching scoring). No integration/e2e.

## Progress tracker
- [x] Commit 1 — Database foundations
- [x] Commit 2 — API scaffolding & middleware
- [x] Commit 3 — Matching use case (basic algorithm working, CI passing)
- [x] Commit 4 — Matching algorithm improvements (architectural fixes)
- [x] Commit 5 — Scheduling use case
- [x] Commit 6 — Goal planning
- [x] Commit 7 — LLM integration & guardrails
- [x] Commit 8 — Connectors (calendar, messaging, project tools)
- [ ] Commit 9 — Web UI flows
- [ ] Commit 10 — CI/CD and ops hardening
- [ ] Commit 11 — Evaluation & polish

---

## Completed Commits

### Commit 1 — Database foundations ✅
- Atlas migrations from Prisma schema; `Server/database/Taskfile` for apply/seed.
- 8 models: Skill, Person, PersonSkill, Task, TaskRequiredSkill, TaskAssignment, Goal, CalendarEvent.
- Seed data: 2 persons, 3 skills, 2 tasks, 1 goal.

### Commit 2 — API scaffolding & middleware ✅
- Hono middleware: request-id, logger, error mapper.
- Health/version routes with Effect Schema types.
- RFC7807 Problem Details error responses.

### Commit 3 — Matching use case (basic) ✅
- `POST /api/match` endpoint with skill-based matching.
- Scoring: 70% skill + 30% capacity weighted average.
- Repository pattern with Prisma; Effect DI with ManagedRuntime.
- Typed errors: TaskNotFoundError, NoSuitableCandidateError.

### Commit 4 — Matching algorithm improvements ✅
- Capacity score capped at 1.0; skill scores normalized/capped at 1.0 with configurable missing-skill penalty.
- Per-request limit and weight overrides; default weights/config via MatchingConfig.
- Skill priorities (REQUIRED/PREFERRED/BONUS) and weighted skillScore; Prisma enums for SkillLevel and SkillPriority.
- Repository candidate pre-filter by skills/available hours; HTTP schema returns priority.
- New unit suite for matching edge cases and priority weighting.

---

## Remaining Commits

### Commit 5 — Scheduling use case ✅
Time-aware task scheduling with calendar integration.

**Features**
- [x] `POST /api/schedule/propose` endpoint
  - Input: taskId, preferredDateRange, constraints
  - Output: proposed slots ranked by availability
- [x] Free/busy calculation from CalendarEvent data
- [x] Deadline awareness (task.dueAt vs available slots) with automatic range clamping
- [x] Conflict detection with existing assignments

**Domain types**
```typescript
interface ScheduleProposal {
  taskId: string;
  proposedSlots: TimeSlot[];
  conflicts: Conflict[];
  recommendation: TimeSlot;
}
interface TimeSlot {
  start: Date;
  end: Date;
  personId: string;
  availabilityScore: number;
}
```

**Repository additions**
- [x] `getPersonEvents(personId, dateRange)` - fetch calendar events
- [x] `getPersonAssignments(personId, dateRange)` - fetch task assignments

**Tests**
- [x] Scheduling logic with mock calendar data
- [x] Conflict detection scenarios (events + assignments)

---

### Commit 6 — Goal planning ✅
Break goals into milestones and track progress.

**Features**
- [x] `POST /api/goals` - Create goal
- [x] `GET /api/goals/:id` - Get goal with milestones
- [x] `POST /api/goals/:id/plan` - Milestone breakdown (heuristic, LLM-ready)
- [x] `GET /api/workload/summary` - Aggregate dashboard data
  - Total assigned hours by person
  - Upcoming deadlines
  - Goal progress percentages

**Domain types**
```typescript
interface GoalPlan {
  goalId: string;
  milestones: Milestone[];
  estimatedCompletion: Date;
}
interface Milestone {
  title: string;
  tasks: string[];  // task IDs
  targetDate: Date;
  status: "pending" | "in_progress" | "completed";
}
```

**Tests**
- [x] Goal create/get/plan
- [x] Workload summary aggregation

---

### Commit 7 — LLM integration & guardrails ✅
Add AI-powered features with safety controls.

**LLM Features**
- [x] Natural language justification for matching results (`POST /api/llm/justify` stubbed provider)
- [ ] Ambiguous input parsing ("assign to someone this week")
- [ ] Goal milestone suggestions from description

**Guardrails**
- [x] Rate limiting per user/API key (in-memory)
- [x] PII detection and masking before LLM calls
- [x] Content moderation on LLM outputs
- [x] Cost tracking (approximate) per response
- [ ] Audit logging for all LLM interactions

**Infrastructure**
- [ ] LLM adapter interface (OpenAI, Gemini, Anthropic)
- [ ] Retry logic with exponential backoff
- [ ] Fallback to template strings if LLM fails

**Environment**
```env
OPENAI_API_KEY=sk-...
LLM_PROVIDER=openai  # or gemini, anthropic
LLM_MODEL=gpt-4o-mini
LLM_MAX_TOKENS=500
LLM_RATE_LIMIT_RPM=60
```

**Tests**
- [x] Mock LLM responses for deterministic testing
- [x] Guardrail trigger scenarios

---

### Commit 8 — Connectors (calendar, messaging, project tools) ✅
External service integrations.

**Calendar Connectors**
- [x] Stub Google Calendar adapter via `POST /api/connectors/calendar/sync`
- [ ] Outlook/Microsoft Graph adapter
- [x] Interface: `syncEvents(personId, dateRange)` (stubbed)

**Messaging Connectors**
- [x] Slack/Teams/email stub via `POST /api/connectors/messaging/notify`
- [ ] Notification templates for assignments, reminders

**Project Tool Connectors**
- [x] Jira/Notion/Trello stub via `POST /api/connectors/project/sync`

**Approval Workflow**
- [x] `POST /api/approvals` - Request approval (in-memory)
- [x] `PATCH /api/approvals/:id` - Approve/reject
- [ ] Notification on approval status change

**Tests**
- [x] Mock adapters for connectors (stub layer tests)
- [x] Approval workflow scenarios

---

### Commit 9 — Web UI flows
React Router frontend for core workflows.

**Pages**
- [ ] Dashboard (`/`)
  - Workload distribution chart
  - Upcoming deadlines
  - Goal progress cards
- [ ] Task list (`/tasks`)
- [ ] Task detail (`/tasks/:id`)
  - Assignment panel with match suggestions
- [ ] Goal list (`/goals`)
- [ ] Goal detail (`/goals/:id`)
  - Milestone timeline
- [ ] Person view (`/people/:id`)
  - Capacity utilization
  - Assigned tasks

**Components**
- [ ] MatchCandidateCard - display candidate with scores
- [ ] ScheduleProposal - time slot picker
- [ ] ApprovalDialog - approve/reject flow
- [ ] WorkloadChart - capacity visualization

**State Management**
- [ ] React Router loaders for data fetching
- [ ] Actions for mutations
- [ ] Optimistic updates for assignments

**Auth**
- [ ] Auth stub (session-based, no real auth yet)
- [ ] Protected routes

**Tests**
- [ ] RTL tests for key components
- [ ] Happy path flows

---

### Commit 10 — CI/CD and ops hardening
Production readiness.

**Docker**
- [ ] `Server/Dockerfile` - Node.js production image
- [ ] `Client/Dockerfile` - React build + nginx
- [ ] `docker-compose.yml` - Full stack local dev
  - PostgreSQL
  - Server API
  - Client app
  - (optional) Redis for rate limiting

**CI Improvements**
- [ ] Run migrations in CI before tests
- [ ] Generate Prisma client in CI
- [ ] Cache node_modules and Prisma
- [ ] E2E tests with Playwright

**Observability**
- [ ] Structured logging (JSON format)
- [ ] Request tracing (correlation IDs)
- [ ] Health check endpoints for k8s probes
- [ ] Metrics stub (Prometheus format)

**Deployment**
- [ ] Cloud Run deployment guide
- [ ] Cloud SQL connection setup
- [ ] Environment variable documentation
- [ ] Secrets management guide

---

### Commit 11 — Evaluation & polish
Quality assurance and documentation.

**Evaluation**
- [ ] Matching quality dataset (expected matches)
- [ ] Schedule acceptance rate tracking
- [ ] Latency budgets (p50, p95, p99)
- [ ] LLM cost tracking dashboard

**Documentation**
- [ ] README with setup instructions
- [ ] API documentation (OpenAPI spec)
- [ ] Architecture decision records (ADRs)
- [ ] Runbooks for common operations
- [ ] Approval matrix for sensitive actions

**Polish**
- [ ] Error message improvements
- [ ] Loading states in UI
- [ ] Empty state designs
- [ ] Mobile responsiveness

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (React Router)                    │
│  Dashboard │ Tasks │ Goals │ People │ Approvals                 │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Server (Hono + Effect)                   │
├─────────────────────────────────────────────────────────────────┤
│  Adapters/HTTP     │  Use Cases        │  Domain                │
│  ─────────────     │  ─────────        │  ──────                │
│  /api/health       │  MatchEmployee    │  SkillMatch            │
│  /api/match        │  ProposeSchedule  │  MatchCandidate        │
│  /api/schedule     │  PlanGoal         │  ScheduleProposal      │
│  /api/goals        │  SummarizeWork    │  Goal, Milestone       │
│  /api/approvals    │                   │  Approval              │
├─────────────────────────────────────────────────────────────────┤
│  Repositories      │  Connectors       │  Guardrails            │
│  ────────────      │  ──────────       │  ──────────            │
│  MatchingRepo      │  GoogleCalendar   │  RateLimiter           │
│  SchedulingRepo    │  Slack            │  PIIMasker             │
│  GoalRepo          │  Jira             │  ContentModerator      │
│                    │  LLMAdapter       │  AuditLogger           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         PostgreSQL (Prisma)                      │
│  Person │ Skill │ Task │ Goal │ CalendarEvent │ Approval        │
└─────────────────────────────────────────────────────────────────┘
```

## LLM vs Code Split

| Component | Code | LLM |
|-----------|------|-----|
| Data fetching | 100% | 0% |
| Matching algorithm | 100% | 0% |
| Scoring & ranking | 100% | 0% |
| Scheduling logic | 100% | 0% |
| Conflict detection | 100% | 0% |
| Natural language justification | 0% | 100% |
| Ambiguous input parsing | 0% | 100% |
| Milestone suggestions | 20% | 80% |
| **Overall** | **~90%** | **~10%** |

---

## Quick Reference

### Server Commands
```bash
cd Server
npm install
npm run prisma:generate
npm run dev                    # http://localhost:3000
npm run ci:check              # lint + typecheck
npm test                      # run tests
```

### Database Commands
```bash
cd Server/database
task up                        # start PostgreSQL
task migrate:apply:auto        # apply migrations
task seed                      # load seed data
```

### Test Endpoints
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/version
curl -X POST http://localhost:3000/api/match \
  -H "Content-Type: application/json" \
  -d '{"taskId": "uuid-here"}'
```
