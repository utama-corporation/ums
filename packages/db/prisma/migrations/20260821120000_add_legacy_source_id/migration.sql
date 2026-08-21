-- AlterTable
ALTER TABLE "User" ADD COLUMN     "legacySourceId" TEXT;

-- AlterTable
ALTER TABLE "Memo" ADD COLUMN     "legacySourceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_legacySourceId_key" ON "User"("legacySourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Memo_legacySourceId_key" ON "Memo"("legacySourceId");
