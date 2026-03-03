CREATE TABLE "DailyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "parsedType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "matchedPatientId" TEXT,
    "matchedPatientName" TEXT,
    "entryDate" DATETIME NOT NULL,
    "entryTime" TEXT,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "parserProvider" TEXT,
    "parserConfidence" REAL,
    "parseMetaJson" JSONB,
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyEntry_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyEntry_matchedPatientId_fkey" FOREIGN KEY ("matchedPatientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "DailyEntry_ownerUserId_createdAt_idx" ON "DailyEntry"("ownerUserId", "createdAt");
CREATE INDEX "DailyEntry_ownerUserId_status_idx" ON "DailyEntry"("ownerUserId", "status");
CREATE INDEX "DailyEntry_matchedPatientId_createdAt_idx" ON "DailyEntry"("matchedPatientId", "createdAt");
