-- Atlas-managed Postgres schema for GoalFlow core entities.
-- Generated as a starting point; adjust as models evolve.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  level TEXT,
  years SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  timezone TEXT,
  weekly_capacity_hours INTEGER,
  current_load_hours INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS person_skills (
  person_id UUID NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  level TEXT,
  years SMALLINT,
  PRIMARY KEY (person_id, skill_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT,
  effort_hours NUMERIC,
  due_at TIMESTAMPTZ,
  owner_id UUID REFERENCES people (id),
  sensitivity_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_required_skills (
  task_id UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  required_level TEXT,
  PRIMARY KEY (task_id, skill_id)
);

CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  allocated_hours NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, person_id)
);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES people (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  milestones JSONB,
  target_date DATE,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  event_type TEXT,
  external_id TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks (due_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_person_time ON calendar_events (person_id, start_at, end_at);
