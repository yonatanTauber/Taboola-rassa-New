-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT,
    "usedByUserId" TEXT,
    "code" TEXT NOT NULL,
    "invitedEmail" TEXT,
    "expiresAt" DATETIME,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InviteCode_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InviteCode_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_ownerUserId_createdAt_idx" ON "InviteCode"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "InviteCode_usedByUserId_idx" ON "InviteCode"("usedByUserId");

-- CreateIndex
CREATE INDEX "InviteCode_invitedEmail_idx" ON "InviteCode"("invitedEmail");
