BEGIN;

TRUNCATE TABLE
  "CalendarEvent",
  "TaskAssignment",
  "TaskRequiredSkill",
  "Task",
  "Goal",
  "PersonSkill",
  "Person",
  "Skill"
RESTART IDENTITY CASCADE;

-- Skills (8 total)
INSERT INTO "Skill" ("id", "name", "level", "years", "createdAt", "updatedAt") VALUES
  ('skill-ts', 'TypeScript', 'EXPERT', 6, NOW(), NOW()),
  ('skill-react', 'React', 'SENIOR', 5, NOW(), NOW()),
  ('skill-python', 'Python', 'INTERMEDIATE', 3, NOW(), NOW()),
  ('skill-devops', 'DevOps', 'MID', 4, NOW(), NOW()),
  ('skill-docker', 'Docker', 'MID', 3, NOW(), NOW()),
  ('skill-db', 'Database Design', 'SENIOR', 5, NOW(), NOW()),
  ('skill-pm', 'Project Management', 'SENIOR', 8, NOW(), NOW()),
  ('skill-llm', 'LLM Orchestration', 'MID', 2, NOW(), NOW());

-- People (5 total)
INSERT INTO "Person" ("id", "name", "role", "timezone", "weeklyCapacityHours", "currentLoadHours", "createdAt", "updatedAt") VALUES
  ('person-ava', 'Ava Chen', 'Tech Lead', 'America/Los_Angeles', 35, 18, NOW(), NOW()),
  ('person-jordan', 'Jordan Lee', 'Project Manager', 'America/New_York', 30, 10, NOW(), NOW()),
  ('person-sam', 'Sam Rodriguez', 'Backend Engineer', 'America/Chicago', 40, 15, NOW(), NOW()),
  ('person-maya', 'Maya Patel', 'QA Lead', 'Europe/London', 38, 8, NOW(), NOW()),
  ('person-chris', 'Chris Kim', 'DevOps Engineer', 'Asia/Seoul', 32, 20, NOW(), NOW());

-- Person Skills (realistic mappings)
-- Ava: TypeScript (EXPERT), React (SENIOR), LLM (MID)
-- Jordan: Project Management (SENIOR), TypeScript (MID)
-- Sam: TypeScript (SENIOR), Python (INTERMEDIATE), Database (SENIOR)
-- Maya: React (INTERMEDIATE), TypeScript (INTERMEDIATE)
-- Chris: Docker (MID), DevOps (MID), TypeScript (JUNIOR)
INSERT INTO "PersonSkill" ("personId", "skillId", "level", "years") VALUES
  ('person-ava', 'skill-ts', 'EXPERT', 6),
  ('person-ava', 'skill-react', 'SENIOR', 5),
  ('person-ava', 'skill-llm', 'MID', 2),
  ('person-jordan', 'skill-pm', 'SENIOR', 8),
  ('person-jordan', 'skill-ts', 'MID', 3),
  ('person-sam', 'skill-ts', 'SENIOR', 4),
  ('person-sam', 'skill-python', 'INTERMEDIATE', 3),
  ('person-sam', 'skill-db', 'SENIOR', 5),
  ('person-maya', 'skill-react', 'INTERMEDIATE', 2),
  ('person-maya', 'skill-ts', 'INTERMEDIATE', 2),
  ('person-chris', 'skill-docker', 'MID', 3),
  ('person-chris', 'skill-devops', 'MID', 4),
  ('person-chris', 'skill-ts', 'JUNIOR', 1);

-- Tasks (5 total)
INSERT INTO "Task" ("id", "title", "description", "priority", "effortHours", "dueAt", "ownerId", "sensitivityLevel", "createdAt", "updatedAt") VALUES
  ('task-api', 'Build REST API endpoints', 'Implement core API endpoints for user management, task CRUD, and matching service.', 'high', 24.0, '2026-02-20T00:00:00Z', 'person-ava', 'internal', NOW(), NOW()),
  ('task-cicd', 'Setup CI/CD pipeline', 'Configure GitHub Actions for automated testing, linting, and deployment.', 'high', 16.0, '2026-02-15T00:00:00Z', 'person-chris', 'internal', NOW(), NOW()),
  ('task-qa', 'QA Test Suite', 'Develop comprehensive E2E and integration test suite for dashboard components.', 'medium', 20.0, '2026-02-25T00:00:00Z', 'person-maya', 'internal', NOW(), NOW()),
  ('task-dashboard', 'Dashboard UI', 'Build interactive dashboard with real-time metrics and LLM-powered insights.', 'medium', 32.0, '2026-03-01T00:00:00Z', 'person-ava', 'internal', NOW(), NOW()),
  ('task-docs', 'API Documentation', 'Write OpenAPI specs and developer guides for external integrations.', 'low', 8.0, '2026-02-10T00:00:00Z', 'person-jordan', 'public', NOW(), NOW());

-- Task Required Skills (with priorities)
-- task-api: TypeScript (REQUIRED), Database (REQUIRED), Python (BONUS)
-- task-cicd: Docker (REQUIRED), DevOps (REQUIRED), TypeScript (PREFERRED)
-- task-qa: React (REQUIRED), TypeScript (REQUIRED)
-- task-dashboard: React (REQUIRED), TypeScript (REQUIRED), LLM (PREFERRED)
-- task-docs: Project Management (REQUIRED)
INSERT INTO "TaskRequiredSkill" ("taskId", "skillId", "requiredLevel", "priority") VALUES
  ('task-api', 'skill-ts', 'SENIOR', 'REQUIRED'),
  ('task-api', 'skill-db', 'MID', 'REQUIRED'),
  ('task-api', 'skill-python', 'JUNIOR', 'BONUS'),
  ('task-cicd', 'skill-docker', 'MID', 'REQUIRED'),
  ('task-cicd', 'skill-devops', 'MID', 'REQUIRED'),
  ('task-cicd', 'skill-ts', 'JUNIOR', 'PREFERRED'),
  ('task-qa', 'skill-react', 'INTERMEDIATE', 'REQUIRED'),
  ('task-qa', 'skill-ts', 'INTERMEDIATE', 'REQUIRED'),
  ('task-dashboard', 'skill-react', 'SENIOR', 'REQUIRED'),
  ('task-dashboard', 'skill-ts', 'SENIOR', 'REQUIRED'),
  ('task-dashboard', 'skill-llm', 'MID', 'PREFERRED'),
  ('task-docs', 'skill-pm', 'MID', 'REQUIRED');

-- Goals (2 total)
-- Q1 Platform Launch (owner: Ava, 4 milestones)
-- CI/CD Automation (owner: Chris, 3 milestones)
INSERT INTO "Goal" ("id", "ownerId", "title", "milestones", "targetDate", "status", "createdAt", "updatedAt") VALUES
  (
    'goal-q1-launch',
    'person-ava',
    'Q1 Platform Launch',
    '[{"title":"Complete API layer","eta":"2026-02-20"},{"title":"Dashboard MVP","eta":"2026-03-01"},{"title":"QA signoff","eta":"2026-03-10"},{"title":"Production deploy","eta":"2026-03-15"}]',
    '2026-03-15',
    'in_progress',
    NOW(),
    NOW()
  ),
  (
    'goal-cicd',
    'person-chris',
    'CI/CD Automation',
    '[{"title":"Pipeline design","eta":"2026-02-08"},{"title":"Staging environment","eta":"2026-02-12"},{"title":"Production pipeline","eta":"2026-02-15"}]',
    '2026-02-15',
    'in_progress',
    NOW(),
    NOW()
  );

-- Task Assignments (4 total - realistic allocations within capacity)
INSERT INTO "TaskAssignment" ("id", "taskId", "personId", "allocatedHours", "status", "createdAt") VALUES
  ('assign-api-sam', 'task-api', 'person-sam', 20.0, 'in_progress', NOW()),
  ('assign-cicd-chris', 'task-cicd', 'person-chris', 16.0, 'in_progress', NOW()),
  ('assign-qa-maya', 'task-qa', 'person-maya', 12.0, 'not_started', NOW()),
  ('assign-docs-jordan', 'task-docs', 'person-jordan', 8.0, 'not_started', NOW());

-- Calendar Events (8 total - spread across team for realistic scheduling conflicts)
INSERT INTO "CalendarEvent" ("id", "personId", "startAt", "endAt", "eventType", "externalId", "source", "createdAt") VALUES
  ('event-ava-standup', 'person-ava', '2026-02-10T09:00:00Z', '2026-02-10T09:30:00Z', 'meeting', NULL, 'google', NOW()),
  ('event-ava-design', 'person-ava', '2026-02-10T14:00:00Z', '2026-02-10T15:30:00Z', 'meeting', NULL, 'google', NOW()),
  ('event-jordan-planning', 'person-jordan', '2026-02-10T10:00:00Z', '2026-02-10T11:00:00Z', 'meeting', NULL, 'google', NOW()),
  ('event-jordan-stakeholder', 'person-jordan', '2026-02-11T15:00:00Z', '2026-02-11T16:00:00Z', 'meeting', NULL, 'google', NOW()),
  ('event-sam-review', 'person-sam', '2026-02-10T11:00:00Z', '2026-02-10T12:00:00Z', 'meeting', NULL, 'google', NOW()),
  ('event-maya-qa-sync', 'person-maya', '2026-02-10T16:00:00Z', '2026-02-10T16:30:00Z', 'meeting', NULL, 'google', NOW()),
  ('event-chris-deploy', 'person-chris', '2026-02-12T02:00:00Z', '2026-02-12T04:00:00Z', 'blocked', NULL, 'manual', NOW()),
  ('event-chris-oncall', 'person-chris', '2026-02-14T00:00:00Z', '2026-02-15T00:00:00Z', 'blocked', NULL, 'pagerduty', NOW());

COMMIT;
