-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "dateOfBirth" DATETIME;
ALTER TABLE "Patient" ADD COLUMN "fixedSessionDay" INTEGER;
ALTER TABLE "Patient" ADD COLUMN "fixedSessionTime" TEXT;
ALTER TABLE "Patient" ADD COLUMN "treatmentStartDate" DATETIME;

-- CreateTable
CREATE TABLE "PatientNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientConceptLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientConceptLink_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
