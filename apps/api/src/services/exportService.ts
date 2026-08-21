import { prisma } from "@ums/db";
import { ExportCreateInput, UserProfile } from "@ums/contracts";
import { ForbiddenError, NotFoundError } from "../errors/AppError.js";
import { logAuditEvent } from "./auditService.js";
import { getS3Client, getS3Bucket } from "./storageService.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function createExportJob(user: UserProfile, input: ExportCreateInput) {
  if (input.reportType === "user-activity" && !user.permissions.includes("audit.view")) {
    throw new ForbiddenError("Permission denied: requires [audit.view]");
  }

  const job = await prisma.exportJob.create({
    data: {
      userId: user.id,
      exportType: input.exportType,
      reportType: input.reportType,
      filtersJson: JSON.stringify(input.filters ?? {}),
      status: "PENDING",
    },
  });

  await prisma.domainOutboxEvent.create({
    data: {
      eventType: "EXPORT_REQUESTED",
      aggregateType: "ExportJob",
      aggregateId: job.id,
      payloadJson: JSON.stringify({
        exportJobId: job.id,
        userId: user.id,
        userRoles: user.roles,
        userDepartmentId: user.departmentId,
        userPermissions: user.permissions,
        reportType: input.reportType,
        exportType: input.exportType,
        filters: input.filters ?? {},
      }),
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: "EXPORT_REQUESTED",
    module: "report",
    resourceType: "ExportJob",
    resourceId: job.id,
  });

  return job;
}

export async function getExportJob(jobId: string, user: UserProfile) {
  const job = await prisma.exportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError("Export job not found");

  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("MEMO_ADMIN");
  if (job.userId !== user.id && !isAdmin) {
    throw new NotFoundError("Export job not found");
  }

  return job;
}

export async function getExportDownloadUrl(jobId: string, user: UserProfile) {
  const job = await getExportJob(jobId, user);

  if (job.status !== "COMPLETED" || !job.fileObjectKey) {
    throw new ForbiddenError(`Export job is not ready for download (status: ${job.status})`);
  }

  if (job.expiresAt && job.expiresAt < new Date()) {
    throw new ForbiddenError("Export download link has expired. Please request a new export.");
  }

  const getCommand = new GetObjectCommand({
    Bucket: await getS3Bucket(),
    Key: job.fileObjectKey,
  });
  const downloadUrl = await getSignedUrl(await getS3Client(), getCommand, { expiresIn: 900 });

  await logAuditEvent({
    actorId: user.id,
    action: "EXPORT_DOWNLOADED",
    module: "report",
    resourceType: "ExportJob",
    resourceId: job.id,
  });

  return { downloadUrl, exportType: job.exportType, reportType: job.reportType };
}
