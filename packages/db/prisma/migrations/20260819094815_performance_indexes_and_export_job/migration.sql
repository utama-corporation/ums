-- AlterTable
ALTER TABLE "ExportJob" ADD COLUMN     "completedAt" TIMESTAMPTZ,
ADD COLUMN     "errorLog" TEXT,
ADD COLUMN     "filtersJson" TEXT,
ADD COLUMN     "reportType" TEXT NOT NULL DEFAULT 'status',
ADD COLUMN     "rowCount" INTEGER;

-- CreateIndex
CREATE INDEX "ApprovalAssignment_approverId_status_idx" ON "ApprovalAssignment"("approverId", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "AuditEvent_timestamp_idx" ON "AuditEvent"("timestamp");

-- CreateIndex
CREATE INDEX "DistributionRecipient_recipientUserId_idx" ON "DistributionRecipient"("recipientUserId");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_status_createdAt_idx" ON "DomainOutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExportJob_userId_idx" ON "ExportJob"("userId");

-- CreateIndex
CREATE INDEX "Memo_status_idx" ON "Memo"("status");

-- CreateIndex
CREATE INDEX "Memo_categoryId_idx" ON "Memo"("categoryId");

-- CreateIndex
CREATE INDEX "Memo_authorId_idx" ON "Memo"("authorId");

-- CreateIndex
CREATE INDEX "Memo_memoDate_idx" ON "Memo"("memoDate");

-- CreateIndex
CREATE INDEX "MemoRecipient_partyId_idx" ON "MemoRecipient"("partyId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");
