-- Add enums for skill levels and priorities
DO $$ BEGIN
    CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER','JUNIOR','INTERMEDIATE','MID','SENIOR','EXPERT','PRINCIPAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "SkillPriority" AS ENUM ('REQUIRED','PREFERRED','BONUS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Normalize existing data to uppercase to match enum values
UPDATE "Skill" SET "level" = UPPER("level") WHERE "level" IS NOT NULL;
UPDATE "PersonSkill" SET "level" = UPPER("level") WHERE "level" IS NOT NULL;
UPDATE "TaskRequiredSkill" SET "requiredLevel" = UPPER("requiredLevel") WHERE "requiredLevel" IS NOT NULL;

-- Alter columns to use enums
ALTER TABLE "Skill" ALTER COLUMN "level" TYPE "SkillLevel" USING ("level"::"SkillLevel");
ALTER TABLE "PersonSkill" ALTER COLUMN "level" TYPE "SkillLevel" USING ("level"::"SkillLevel");
ALTER TABLE "TaskRequiredSkill" ALTER COLUMN "requiredLevel" TYPE "SkillLevel" USING ("requiredLevel"::"SkillLevel");

-- Add priority to task required skills
ALTER TABLE "TaskRequiredSkill"
    ADD COLUMN IF NOT EXISTS "priority" "SkillPriority" NOT NULL DEFAULT 'REQUIRED';
