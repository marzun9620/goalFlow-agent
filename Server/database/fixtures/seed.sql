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

INSERT INTO "Skill" ("id", "name", "level", "years", "createdAt", "updatedAt") VALUES
  ('skill-ts', 'TypeScript', 'expert', 6, NOW(), NOW()),
  ('skill-pm', 'Project Management', 'senior', 8, NOW(), NOW()),
  ('skill-llm', 'LLM Orchestration', 'mid', 3, NOW(), NOW());

INSERT INTO "Person" ("id", "name", "role", "timezone", "weeklyCapacityHours", "currentLoadHours", "createdAt", "updatedAt") VALUES
  ('person-ava', 'Ava Chen', 'Tech Lead', 'America/Los_Angeles', 35, 18, NOW(), NOW()),
  ('person-lee', 'Jordan Lee', 'Project Manager', 'America/New_York', 30, 10, NOW(), NOW());

INSERT INTO "PersonSkill" ("personId", "skillId", "level", "years") VALUES
  ('person-ava', 'skill-ts', 'expert', 6),
  ('person-ava', 'skill-llm', 'mid', 3),
  ('person-lee', 'skill-pm', 'senior', 8),
  ('person-lee', 'skill-ts', 'mid', 4);

INSERT INTO "Task" ("id", "title", "description", "priority", "effortHours", "dueAt", "ownerId", "sensitivityLevel", "createdAt", "updatedAt") VALUES
  ('task-matcher', 'Implement matching pipeline', 'Ship deterministic scoring plus LLM justification hook.', 'high', 24.0, '2026-02-05T00:00:00Z', 'person-ava', 'internal', NOW(), NOW()),
  ('task-workload', 'Draft workload summary API', 'Aggregate assignments and events for dashboard.', 'medium', 12.0, '2026-01-29T00:00:00Z', 'person-lee', 'internal', NOW(), NOW());

INSERT INTO "TaskRequiredSkill" ("taskId", "skillId", "requiredLevel") VALUES
  ('task-matcher', 'skill-ts', 'senior'),
  ('task-matcher', 'skill-llm', 'mid'),
  ('task-workload', 'skill-pm', 'mid'),
  ('task-workload', 'skill-ts', 'mid');

INSERT INTO "Goal" ("id", "ownerId", "title", "milestones", "targetDate", "status", "createdAt", "updatedAt") VALUES
  (
    'goal-matching',
    'person-ava',
    'GoalFlow matching rollout',
    '[{"title":"Design signals","eta":"2026-01-22"},{"title":"Ship scoring service","eta":"2026-02-03"}]',
    '2026-02-10',
    'in_progress',
    NOW(),
    NOW()
  );

INSERT INTO "TaskAssignment" ("id", "taskId", "personId", "allocatedHours", "status", "createdAt") VALUES
  ('assign-1', 'task-matcher', 'person-ava', 16.0, 'in_progress', NOW()),
  ('assign-2', 'task-workload', 'person-lee', 10.0, 'not_started', NOW());

INSERT INTO "CalendarEvent" ("id", "personId", "startAt", "endAt", "eventType", "externalId", "source", "createdAt") VALUES
  ('event-ava-1', 'person-ava', '2026-01-20T17:00:00Z', '2026-01-20T18:00:00Z', 'meeting', NULL, 'google', NOW()),
  ('event-lee-1', 'person-lee', '2026-01-20T15:30:00Z', '2026-01-20T16:30:00Z', 'meeting', NULL, 'google', NOW());

COMMIT;
