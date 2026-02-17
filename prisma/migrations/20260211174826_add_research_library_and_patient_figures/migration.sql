-- CreateTable
CREATE TABLE "ResearchSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PatientFigure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientFigure_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ResearchDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'ARTICLE',
    "title" TEXT NOT NULL,
    "publicationYear" INTEGER,
    "source" TEXT,
    "sourceId" TEXT,
    "externalUrl" TEXT,
    "filePath" TEXT NOT NULL,
    "ocrText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResearchSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ResearchDocument" ("createdAt", "filePath", "id", "ocrText", "publicationYear", "source", "title", "updatedAt") SELECT "createdAt", "filePath", "id", "ocrText", "publicationYear", "source", "title", "updatedAt" FROM "ResearchDocument";
DROP TABLE "ResearchDocument";
ALTER TABLE "new_ResearchDocument" RENAME TO "ResearchDocument";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ResearchSource_name_key" ON "ResearchSource"("name");
