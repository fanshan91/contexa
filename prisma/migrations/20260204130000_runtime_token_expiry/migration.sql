-- AlterTable
ALTER TABLE "ProjectRuntimeToken" ADD COLUMN "expiresAt" DATETIME;

-- DataBackfill
UPDATE "ProjectRuntimeToken"
SET "expiresAt" = DATETIME('now', '+6 months')
WHERE "expiresAt" IS NULL;

