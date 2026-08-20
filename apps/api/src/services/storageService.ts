import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@ums/config";
import { prisma } from "@ums/db";
import { BadRequestError, NotFoundError, ForbiddenError } from "../errors/AppError.js";
import { logAuditEvent } from "./auditService.js";
import { isMemoAuthorOrAdmin, assertMemoViewScope } from "./memoDraftService.js";
import { UserProfile } from "@ums/contracts";
import crypto from "crypto";

export const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "image/png",
  "image/jpeg",
];

export async function initiateAttachmentUpload(
  memoId: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  actor: UserProfile
) {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new BadRequestError(`MIME type '${mimeType}' is not allowed. Allowed types: PDF, DOCX, XLSX, PNG, JPEG.`);
  }

  const memo = await prisma.memo.findUnique({ where: { id: memoId } });
  if (!memo) throw new NotFoundError("Memo not found");

  if (!isMemoAuthorOrAdmin(memo, actor)) {
    throw new ForbiddenError("Only the memo's author can add attachments to it");
  }

  if (!["DRAFT", "REVISION"].includes(memo.status)) {
    throw new ForbiddenError("Attachments can only be added to DRAFT or REVISION memos");
  }

  // Only take a short alphanumeric extension from the client-supplied filename — it's
  // otherwise attacker-controlled and was previously usable to inject `/`/`..` into the
  // S3 object key (e.g. "x.png/../../other-memo/y") and place objects outside this
  // memo's folder in the shared bucket.
  const rawExt = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
  const safeExt = /^[a-zA-Z0-9]{1,10}$/.test(rawExt) ? rawExt : "bin";
  const objectKey = `memos/${memoId}/${crypto.randomUUID()}.${safeExt}`;

  const attachmentObj = await prisma.attachmentObject.create({
    data: {
      objectKey,
      fileName,
      fileSize,
      mimeType,
      checksumSha256: "",
      status: "PENDING",
    },
  });

  await prisma.memoAttachment.create({
    data: {
      memoId,
      attachmentObjectId: attachmentObj.id,
    },
  });

  const putCommand = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: objectKey,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 900 }); // 15 mins

  await logAuditEvent({
    actorId: actor.id,
    action: "ATTACHMENT_INITIATED",
    module: "storage",
    resourceType: "AttachmentObject",
    resourceId: attachmentObj.id,
  });

  return {
    attachmentId: attachmentObj.id,
    objectKey,
    uploadUrl,
  };
}

export async function completeAttachmentUpload(
  attachmentId: string,
  checksumSha256: string,
  actor: UserProfile
) {
  const attachmentObj = await prisma.attachmentObject.findUnique({
    where: { id: attachmentId },
  });
  if (!attachmentObj) throw new NotFoundError("Attachment object not found");

  const owningLink = await prisma.memoAttachment.findFirst({
    where: { attachmentObjectId: attachmentId },
    include: { memo: true },
  });
  if (!owningLink || !isMemoAuthorOrAdmin(owningLink.memo, actor)) {
    throw new ForbiddenError("Only the memo's author can finalize this attachment");
  }

  try {
    const headCommand = new HeadObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: attachmentObj.objectKey,
    });
    await s3Client.send(headCommand);
  } catch (error) {
    throw new BadRequestError("File binary not found in storage. Ensure upload completed before verifying.");
  }

  const updated = await prisma.attachmentObject.update({
    where: { id: attachmentId },
    data: {
      checksumSha256,
      status: "READY",
    },
  });

  await logAuditEvent({
    actorId: actor.id,
    action: "ATTACHMENT_COMPLETED",
    module: "storage",
    resourceType: "AttachmentObject",
    resourceId: attachmentId,
  });

  return updated;
}

export async function getAttachmentDownloadUrl(attachmentId: string, actor: UserProfile) {
  const attachmentObj = await prisma.attachmentObject.findUnique({
    where: { id: attachmentId },
  });
  if (!attachmentObj || attachmentObj.status !== "READY") {
    throw new NotFoundError("Ready attachment not found");
  }

  const owningLink = await prisma.memoAttachment.findFirst({
    where: { attachmentObjectId: attachmentId },
    include: { memo: { include: { recipients: true } } },
  });
  if (!owningLink) throw new NotFoundError("Ready attachment not found");
  assertMemoViewScope(owningLink.memo, actor);

  const getCommand = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: attachmentObj.objectKey,
    ResponseContentDisposition: `attachment; filename="${attachmentObj.fileName}"`,
  });

  const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 900 });

  await logAuditEvent({
    actorId: actor.id,
    action: "ATTACHMENT_DOWNLOADED",
    module: "storage",
    resourceType: "AttachmentObject",
    resourceId: attachmentId,
  });

  return { downloadUrl, fileName: attachmentObj.fileName, mimeType: attachmentObj.mimeType };
}

export async function removeAttachment(attachmentId: string, actor: UserProfile) {
  const memoAttachment = await prisma.memoAttachment.findFirst({
    where: { attachmentObjectId: attachmentId },
    include: { memo: true, attachmentObject: true },
  });
  if (!memoAttachment) throw new NotFoundError("Attachment relation not found");

  if (!isMemoAuthorOrAdmin(memoAttachment.memo, actor)) {
    throw new ForbiddenError("Only the memo's author can delete this attachment");
  }

  if (!["DRAFT", "REVISION"].includes(memoAttachment.memo.status)) {
    throw new ForbiddenError("Attachments cannot be deleted from non-draft memos");
  }

  await prisma.memoAttachment.delete({ where: { id: memoAttachment.id } });
  await prisma.attachmentObject.update({
    where: { id: attachmentId },
    data: { status: "DELETED" },
  });

  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: memoAttachment.attachmentObject.objectKey,
    });
    await s3Client.send(deleteCommand);
  } catch (error) {
    console.error("Failed to delete S3 object:", error);
  }

  await logAuditEvent({
    actorId: actor.id,
    action: "ATTACHMENT_DELETED",
    module: "storage",
    resourceType: "AttachmentObject",
    resourceId: attachmentId,
  });
}
