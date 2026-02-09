-- Agent chat persistence models
DO $$ BEGIN
    CREATE TYPE "AgentMessageRole" AS ENUM ('USER','ASSISTANT','SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "AgentRunStatus" AS ENUM ('PROPOSED','APPROVED','REJECTED','EXECUTED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "AgentActionStatus" AS ENUM ('PENDING','SUCCESS','FAILED','SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentRun" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'PROPOSED',
    "input" JSONB,
    "proposal" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentAction" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "AgentActionStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConversationMessage_conversationId_createdAt_idx"
    ON "ConversationMessage"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentRun_conversationId_createdAt_idx"
    ON "AgentRun"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentAction_runId_createdAt_idx"
    ON "AgentAction"("runId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "ConversationMessage"
        ADD CONSTRAINT "ConversationMessage_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AgentRun"
        ADD CONSTRAINT "AgentRun_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AgentAction"
        ADD CONSTRAINT "AgentAction_runId_fkey"
        FOREIGN KEY ("runId") REFERENCES "AgentRun"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
