-- Create enums for daily entries
CREATE TYPE "DailyEntryType" AS ENUM ('SESSION', 'TASK', 'GUIDANCE', 'UNKNOWN');
CREATE TYPE "DailyEntryStatus" AS ENUM ('DRAFT', 'READY', 'SAVED', 'SAVE_FAILED');
CREATE TYPE "DailyTargetEntityType" AS ENUM ('SESSION', 'TASK', 'GUIDANCE');

-- Create table
CREATE TABLE "DailyEntry" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "parsedType" "DailyEntryType" NOT NULL DEFAULT 'UNKNOWN',
    "status" "DailyEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "matchedPatientId" TEXT,
    "matchedPatientName" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "entryTime" TEXT,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "parserProvider" TEXT,
    "parserConfidence" DOUBLE PRECISION,
    "parseMetaJson" JSONB,
    "targetEntityType" "DailyTargetEntityType",
    "targetEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyEntry_pkey" PRIMARY KEY ("id")
);

-- FKs
ALTER TABLE "DailyEntry"
ADD CONSTRAINT "DailyEntry_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyEntry"
ADD CONSTRAINT "DailyEntry_matchedPatientId_fkey"
FOREIGN KEY ("matchedPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "DailyEntry_ownerUserId_createdAt_idx" ON "DailyEntry"("ownerUserId", "createdAt" DESC);
CREATE INDEX "DailyEntry_ownerUserId_status_idx" ON "DailyEntry"("ownerUserId", "status");
CREATE INDEX "DailyEntry_matchedPatientId_createdAt_idx" ON "DailyEntry"("matchedPatientId", "createdAt" DESC);
