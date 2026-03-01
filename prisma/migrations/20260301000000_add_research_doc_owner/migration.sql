-- AlterTable: add ownerUserId to ResearchDocument
ALTER TABLE "ResearchDocument" ADD COLUMN "ownerUserId" TEXT;

-- CreateIndex
CREATE INDEX "ResearchDocument_ownerUserId_idx" ON "ResearchDocument"("ownerUserId");

-- AddForeignKey
ALTER TABLE "ResearchDocument" ADD CONSTRAINT "ResearchDocument_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
