# GoalFlow Agent Execution Plan

Context: skeleton app exists (Client React Router shell, Server Hono health check, Prisma schema only). The plan below is organized into commit-sized slices to reach a functional GoalFlow agent.

## Status snapshot (2026-02-07)
- Implemented: Shared Prisma schema; Atlas SQL migration + seed fixture; Dockerized Postgres; Prisma generate in CI; API scaffolding with Effect/Hono; runtime wiring (config/logger/db); health/version + matching endpoints; ManagedRuntime for DI; RFC7807 error handling; CI passing (lint/typecheck/tests).
- Missing: Matching algorithm improvements (capacity cap, configurable weights); scheduling use case; goal planning; LLM integration; connectors; UI flows; Docker/deployment.
- Tests present: `Server/app.test.ts` (health/version), `Client/app/routes/_index.test.tsx` (landing). No integration/e2e.

## Progress tracker
- [x] Commit 1 — Database foundations
- [x] Commit 2 — API scaffolding & middleware
- [x] Commit 3 — Matching use case (basic algorithm working, CI passing)
- [ ] Commit 4 — Matching algorithm improvements (architectural fixes)
- [ ] Commit 5 — Scheduling use case
- [ ] Commit 6 — Goal planning
- [ ] Commit 7 — LLM integration & guardrails
- [ ] Commit 8 — Connectors (calendar, messaging, project tools)
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

---

## Remaining Commits

### Commit 4 — Matching algorithm improvements
Priority fixes identified in architecture review.

**High Priority (bugs)**
- [ ] Cap capacity score at 1.0 (currently unbounded, skews weighting)
  ```typescript
  // Before: available / effortHours (can be 10+)
  // After: Math.min(1, available / effortHours)
  ```
- [ ] Add `limit` parameter to return top N candidates only
- [ ] Normalize skill score to 0-1 range (currently 0-1.5)

**Medium Priority (configurability)**
- [ ] Make weights configurable via MatchingConfig service
  ```typescript
  interface MatchingConfig {
    skillWeight: number;      // default 0.7
    capacityWeight: number;   // default 0.3
    maxCandidates: number;    // default 10
  }
  ```
- [ ] Add skill priority levels (required | preferred | bonus)
  ```prisma
  model TaskRequiredSkill {
    priority SkillPriority @default(REQUIRED)
  }
  enum SkillPriority { REQUIRED, PREFERRED, BONUS }
  ```
- [ ] Configurable missing skill penalty (default 0 is harsh)

**Low Priority (scale/performance)**
- [ ] Pre-filter candidates in database query (skills, min availability)
  ```typescript
  listCandidates(filter?: {
    hasAnySkills?: string[];
    minAvailableHours?: number;
    excludePersonIds?: string[];
  })
  ```
- [ ] Use enum for SkillLevel in Prisma schema (replace string)

**Tests**
- [ ] Unit tests for scoring edge cases (missing skills, zero effort, etc.)
- [ ] Integration test with seed data

**Verification**
```bash
npm test
curl -X POST http://localhost:3000/api/match \
  -H "Content-Type: application/json" \
  -d '{"taskId": "...", "limit": 5}'
```

---

### Commit 5 — Scheduling use case
Time-aware task scheduling with calendar integration.

**Features**
- [ ] `POST /api/schedule/propose` endpoint
  - Input: taskId, preferredDateRange, constraints
  - Output: proposed slots ranked by availability
- [ ] Free/busy calculation from CalendarEvent data
- [ ] Deadline awareness (task.dueAt vs available slots)
- [ ] Conflict detection with existing assignments

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
- [ ] `getPersonEvents(personId, dateRange)` - fetch calendar events
- [ ] `getPersonAssignments(personId, dateRange)` - fetch task assignments

**Tests**
- [ ] Scheduling logic with mock calendar data
- [ ] Conflict detection scenarios

---

### Commit 6 — Goal planning
Break goals into milestones and track progress.

**Features**
- [ ] `POST /api/goals` - Create goal
- [ ] `GET /api/goals/:id` - Get goal with milestones
- [ ] `POST /api/goals/:id/plan` - AI-assisted milestone breakdown
- [ ] `GET /api/workload/summary` - Aggregate dashboard data
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
- [ ] Goal CRUD operations
- [ ] Workload summary aggregation

---

### Commit 7 — LLM integration & guardrails
Add AI-powered features with safety controls.

**LLM Features**
- [ ] Natural language justification for matching results
  ```typescript
  const justification = await llm.generate({
    prompt: `Explain why ${person} is best for ${task}`,
    context: { skillMatches, capacityScore }
  });
  ```
- [ ] Ambiguous input parsing ("assign to someone this week")
- [ ] Goal milestone suggestions from description

**Guardrails**
- [ ] Rate limiting per user/API key
- [ ] PII detection and masking before LLM calls
- [ ] Content moderation on LLM outputs
- [ ] Cost tracking and budget limits
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
- [ ] Mock LLM responses for deterministic testing
- [ ] Guardrail trigger scenarios

---

### Commit 8 — Connectors (calendar, messaging, project tools)
External service integrations.

**Calendar Connectors**
- [ ] Google Calendar adapter (OAuth2 + Calendar API)
- [ ] Outlook/Microsoft Graph adapter
- [ ] Interface: `syncEvents(personId, dateRange)`

**Messaging Connectors**
- [ ] Slack adapter (Bot API)
- [ ] Teams adapter (Graph API)
- [ ] Notification templates for assignments, reminders

**Project Tool Connectors**
- [ ] Jira adapter (task sync)
- [ ] Notion adapter (goal/doc sync)
- [ ] Trello adapter (board sync)

**Approval Workflow**
- [ ] `POST /api/approvals` - Request approval
- [ ] `PATCH /api/approvals/:id` - Approve/reject
- [ ] Notification on approval status change

**Tests**
- [ ] Mock adapters for all connectors
- [ ] Approval workflow scenarios

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
