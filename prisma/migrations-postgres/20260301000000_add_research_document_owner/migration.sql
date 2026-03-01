-- AlterTable
ALTER TABLE "public"."ResearchDocument" ADD COLUMN "ownerUserId" TEXT;

-- CreateIndex
CREATE INDEX "ResearchDocument_ownerUserId_idx" ON "public"."ResearchDocument"("ownerUserId");

-- AddForeignKey
ALTER TABLE "public"."ResearchDocument" ADD CONSTRAINT "ResearchDocument_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
