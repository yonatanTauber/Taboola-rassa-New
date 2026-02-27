-- AlterTable
PRAGMA foreign_keys=OFF;
CREATE TABLE "Patient_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT,
    "internalCode" TEXT NOT NULL UNIQUE,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "avatarKey" TEXT,
    "gender" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "dateOfBirth" DATETIME,
    "treatmentStartDate" DATETIME,
    "fixedSessionDay" INTEGER,
    "fixedSessionTime" TEXT,
    "researchAlias" TEXT,
    "defaultSessionFeeNis" INTEGER,
    "lateCancelCharge" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "Patient_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "Patient_new" SELECT * FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "Patient_new" RENAME TO "Patient";
CREATE INDEX "Patient_ownerUserId_archivedAt_idx" ON "Patient"("ownerUserId", "archivedAt");
CREATE UNIQUE INDEX "Patient_ownerUserId_firstName_lastName_key" ON "Patient"("ownerUserId", "firstName", "lastName");
PRAGMA foreign_keys=ON;
