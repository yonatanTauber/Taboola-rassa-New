-- CreateEnum
CREATE TYPE "public"."PatientLifecycleEventType" AS ENUM ('INQUIRY_LINKED', 'CONVERTED_TO_PATIENT', 'SET_INACTIVE', 'REACTIVATED');

-- CreateTable
CREATE TABLE "public"."PatientLifecycleEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "eventType" "public"."PatientLifecycleEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "metadataJson" JSONB,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientLifecycleEvent_patientId_occurredAt_idx" ON "public"."PatientLifecycleEvent"("patientId", "occurredAt");

-- CreateIndex
CREATE INDEX "PatientLifecycleEvent_actorUserId_idx" ON "public"."PatientLifecycleEvent"("actorUserId");

-- AddForeignKey
ALTER TABLE "public"."PatientLifecycleEvent" ADD CONSTRAINT "PatientLifecycleEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatientLifecycleEvent" ADD CONSTRAINT "PatientLifecycleEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
