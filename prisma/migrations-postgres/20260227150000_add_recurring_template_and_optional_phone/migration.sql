-- AlterTable: add isRecurringTemplate column to Session
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "isRecurringTemplate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: make phone optional in Patient
ALTER TABLE "Patient" ALTER COLUMN "phone" DROP NOT NULL;
