-- CreateTable
CREATE TABLE "PatientLifecycleEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "reason" TEXT,
    "metadataJson" JSONB,
    "actorUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientLifecycleEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientLifecycleEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PatientLifecycleEvent_patientId_occurredAt_idx" ON "PatientLifecycleEvent"("patientId", "occurredAt");

-- CreateIndex
CREATE INDEX "PatientLifecycleEvent_actorUserId_idx" ON "PatientLifecycleEvent"("actorUserId");
