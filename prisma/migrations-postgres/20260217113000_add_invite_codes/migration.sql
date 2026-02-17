-- CreateTable
CREATE TABLE "public"."InviteCode" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "usedByUserId" TEXT,
    "code" TEXT NOT NULL,
    "invitedEmail" TEXT,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "public"."InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_ownerUserId_createdAt_idx" ON "public"."InviteCode"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "InviteCode_usedByUserId_idx" ON "public"."InviteCode"("usedByUserId");

-- CreateIndex
CREATE INDEX "InviteCode_invitedEmail_idx" ON "public"."InviteCode"("invitedEmail");

-- AddForeignKey
ALTER TABLE "public"."InviteCode" ADD CONSTRAINT "InviteCode_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InviteCode" ADD CONSTRAINT "InviteCode_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
