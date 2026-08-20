-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "logoUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "employeeId" TEXT,
    "departmentId" UUID,
    "position" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCredential" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "pinHash" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" UUID,
    "headUserId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserDelegate" (
    "id" UUID NOT NULL,
    "delegatorId" UUID NOT NULL,
    "delegateId" UUID NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "reason" TEXT NOT NULL,
    "startDate" TIMESTAMPTZ NOT NULL,
    "expiryDate" TIMESTAMPTZ NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDelegate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoType" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoNumberingRule" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "formatPattern" TEXT NOT NULL,
    "resetFrequency" TEXT NOT NULL DEFAULT 'YEARLY',
    "paddingDigits" INTEGER NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoNumberingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoNumberSequence" (
    "id" UUID NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MemoNumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinitionVersion" (
    "id" UUID NOT NULL,
    "workflowDefinitionId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowDefinitionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" UUID NOT NULL,
    "workflowDefinitionVersionId" UUID NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SEQUENTIAL',
    "parallelPolicy" TEXT NOT NULL DEFAULT 'ALL',
    "slaHours" INTEGER,
    "requireSignature" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowApproverRule" (
    "id" UUID NOT NULL,
    "workflowStepId" UUID NOT NULL,
    "strategy" TEXT NOT NULL,
    "targetId" TEXT,

    CONSTRAINT "WorkflowApproverRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowCondition" (
    "id" UUID NOT NULL,
    "workflowStepId" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "WorkflowCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memo" (
    "id" UUID NOT NULL,
    "memoNumber" TEXT,
    "memoDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memoTypeId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "classification" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    "authorId" UUID NOT NULL,
    "deadline" TIMESTAMPTZ,
    "revisesMemoId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoContentVersion" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoSender" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "partyType" TEXT NOT NULL,
    "partyId" UUID,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "MemoSender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoRecipient" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "partyType" TEXT NOT NULL,
    "partyId" UUID,
    "displayName" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "MemoRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoCc" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "partyType" TEXT NOT NULL,
    "partyId" UUID,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "MemoCc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoStatusHistory" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttachmentObject" (
    "id" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttachmentObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoAttachment" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "attachmentObjectId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "workflowDefinitionVersionId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "currentStepOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstanceStep" (
    "id" UUID NOT NULL,
    "workflowInstanceId" UUID NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mode" TEXT NOT NULL DEFAULT 'SEQUENTIAL',
    "parallelPolicy" TEXT NOT NULL DEFAULT 'ALL',
    "requireSignature" BOOLEAN NOT NULL DEFAULT false,
    "slaHours" INTEGER,
    "activatedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,

    CONSTRAINT "WorkflowInstanceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAssignment" (
    "id" UUID NOT NULL,
    "workflowInstanceStepId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "originalApproverId" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMPTZ,

    CONSTRAINT "ApprovalAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" UUID NOT NULL,
    "approvalAssignmentId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "memoVersion" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoDistribution" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "distributedById" UUID NOT NULL,
    "distributedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionRecipient" (
    "id" UUID NOT NULL,
    "memoDistributionId" UUID NOT NULL,
    "recipientUserId" UUID,
    "recipientDeptId" UUID,
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributionRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadReceipt" (
    "id" UUID NOT NULL,
    "distributionRecipientId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "firstReadAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalRecipientAccess" (
    "id" UUID NOT NULL,
    "distributionRecipientId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalRecipientAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalSignatureProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "signatureType" TEXT NOT NULL DEFAULT 'INTERNAL',
    "imageAssetKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalSignatureProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureUsage" (
    "id" UUID NOT NULL,
    "digitalSignatureProfileId" UUID NOT NULL,
    "approvalDecisionId" UUID,
    "documentPublicationId" UUID,
    "documentHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "signedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPublication" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "canonicalPdfKey" TEXT NOT NULL,
    "pdfHashSha256" TEXT NOT NULL,
    "publishedById" UUID NOT NULL,
    "publishedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVerificationToken" (
    "id" UUID NOT NULL,
    "documentPublicationId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoDisposition" (
    "id" UUID NOT NULL,
    "memoId" UUID NOT NULL,
    "issuerId" UUID NOT NULL,
    "instruction" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoDisposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "memoDispositionId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMPTZ,
    "deadline" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "taskId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "TaskStatusHistory" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEvidenceAttachment" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "attachmentObjectId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvidenceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainOutboxEvent" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorLog" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ,

    CONSTRAINT "DomainOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "exportType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileObjectKey" TEXT,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "memoNumber" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_code_key" ON "CompanyProfile"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCredential_userId_key" ON "UserCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MemoType_code_key" ON "MemoType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MemoNumberSequence_scopeKey_key" ON "MemoNumberSequence"("scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinitionVersion_workflowDefinitionId_versionNumbe_key" ON "WorkflowDefinitionVersion"("workflowDefinitionId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Memo_memoNumber_key" ON "Memo"("memoNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MemoContentVersion_memoId_version_key" ON "MemoContentVersion"("memoId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AttachmentObject_objectKey_key" ON "AttachmentObject"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReadReceipt_distributionRecipientId_userId_key" ON "ReadReceipt"("distributionRecipientId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRecipientAccess_tokenHash_key" ON "ExternalRecipientAccess"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalSignatureProfile_userId_key" ON "DigitalSignatureProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureUsage_approvalDecisionId_key" ON "SignatureUsage"("approvalDecisionId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPublication_memoId_key" ON "DocumentPublication"("memoId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVerificationToken_token_key" ON "DocumentVerificationToken"("token");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDelegate" ADD CONSTRAINT "UserDelegate_delegatorId_fkey" FOREIGN KEY ("delegatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDelegate" ADD CONSTRAINT "UserDelegate_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinitionVersion" ADD CONSTRAINT "WorkflowDefinitionVersion_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowDefinitionVersionId_fkey" FOREIGN KEY ("workflowDefinitionVersionId") REFERENCES "WorkflowDefinitionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowApproverRule" ADD CONSTRAINT "WorkflowApproverRule_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowCondition" ADD CONSTRAINT "WorkflowCondition_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_memoTypeId_fkey" FOREIGN KEY ("memoTypeId") REFERENCES "MemoType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_revisesMemoId_fkey" FOREIGN KEY ("revisesMemoId") REFERENCES "Memo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoContentVersion" ADD CONSTRAINT "MemoContentVersion_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoSender" ADD CONSTRAINT "MemoSender_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoRecipient" ADD CONSTRAINT "MemoRecipient_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoCc" ADD CONSTRAINT "MemoCc_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoStatusHistory" ADD CONSTRAINT "MemoStatusHistory_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoAttachment" ADD CONSTRAINT "MemoAttachment_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoAttachment" ADD CONSTRAINT "MemoAttachment_attachmentObjectId_fkey" FOREIGN KEY ("attachmentObjectId") REFERENCES "AttachmentObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_workflowDefinitionVersionId_fkey" FOREIGN KEY ("workflowDefinitionVersionId") REFERENCES "WorkflowDefinitionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstanceStep" ADD CONSTRAINT "WorkflowInstanceStep_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAssignment" ADD CONSTRAINT "ApprovalAssignment_workflowInstanceStepId_fkey" FOREIGN KEY ("workflowInstanceStepId") REFERENCES "WorkflowInstanceStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_approvalAssignmentId_fkey" FOREIGN KEY ("approvalAssignmentId") REFERENCES "ApprovalAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoDistribution" ADD CONSTRAINT "MemoDistribution_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionRecipient" ADD CONSTRAINT "DistributionRecipient_memoDistributionId_fkey" FOREIGN KEY ("memoDistributionId") REFERENCES "MemoDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadReceipt" ADD CONSTRAINT "ReadReceipt_distributionRecipientId_fkey" FOREIGN KEY ("distributionRecipientId") REFERENCES "DistributionRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecipientAccess" ADD CONSTRAINT "ExternalRecipientAccess_distributionRecipientId_fkey" FOREIGN KEY ("distributionRecipientId") REFERENCES "DistributionRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalSignatureProfile" ADD CONSTRAINT "DigitalSignatureProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureUsage" ADD CONSTRAINT "SignatureUsage_digitalSignatureProfileId_fkey" FOREIGN KEY ("digitalSignatureProfileId") REFERENCES "DigitalSignatureProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureUsage" ADD CONSTRAINT "SignatureUsage_approvalDecisionId_fkey" FOREIGN KEY ("approvalDecisionId") REFERENCES "ApprovalDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureUsage" ADD CONSTRAINT "SignatureUsage_documentPublicationId_fkey" FOREIGN KEY ("documentPublicationId") REFERENCES "DocumentPublication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPublication" ADD CONSTRAINT "DocumentPublication_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVerificationToken" ADD CONSTRAINT "DocumentVerificationToken_documentPublicationId_fkey" FOREIGN KEY ("documentPublicationId") REFERENCES "DocumentPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoDisposition" ADD CONSTRAINT "MemoDisposition_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_memoDispositionId_fkey" FOREIGN KEY ("memoDispositionId") REFERENCES "MemoDisposition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusHistory" ADD CONSTRAINT "TaskStatusHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvidenceAttachment" ADD CONSTRAINT "TaskEvidenceAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvidenceAttachment" ADD CONSTRAINT "TaskEvidenceAttachment_attachmentObjectId_fkey" FOREIGN KEY ("attachmentObjectId") REFERENCES "AttachmentObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
