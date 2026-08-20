import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import crypto from "crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "./storageService.js";
import { env } from "@ums/config";
import { prisma } from "@ums/db";
import { NotFoundError, ForbiddenError } from "../errors/AppError.js";
import { logAuditEvent } from "./auditService.js";
import { UserProfile } from "@ums/contracts";

export interface SignatureResult {
  signatureType: "INTERNAL" | "CERTIFIED";
  signedHash: string;
  verificationToken: string;
  signedAt: Date;
}

export interface ISignatureProvider {
  signDocument(documentHash: string, signer: UserProfile, ipAddress?: string): Promise<SignatureResult>;
}

export class InternalSignatureProvider implements ISignatureProvider {
  async signDocument(documentHash: string, signer: UserProfile, ipAddress?: string): Promise<SignatureResult> {
    const signedAt = new Date();
    const payload = `${documentHash}:${signer.id}:${signedAt.toISOString()}:${ipAddress || "127.0.0.1"}`;
    const signedHash = crypto.createHmac("sha256", env.SESSION_SECRET).update(payload).digest("hex");
    const verificationToken = crypto.randomBytes(16).toString("hex");

    return {
      signatureType: "INTERNAL",
      signedHash,
      verificationToken,
      signedAt,
    };
  }
}

export async function generateCanonicalPdfBuffer(
  memo: {
    memoNumber?: string | null;
    memoDate: Date;
    category?: { name: string } | null;
    memoType?: { name: string } | null;
    priority: string;
    classification: string;
    title: string;
    contentVersions: { bodyHtml: string }[];
    authorId: string;
  },
  verificationUrl: string
): Promise<{ pdfBuffer: Buffer; hashSha256: string }> {
  const qrDataUrl = await QRCode.toDataURL(verificationUrl);
  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
  const qrBuffer = Buffer.from(qrBase64, "base64");

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        const hashSha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
        resolve({ pdfBuffer, hashSha256 });
      });

      // Header
      doc.fontSize(18).font("Helvetica-Bold").text("PT UTAMA CORP", { align: "center" });
      doc.fontSize(10).font("Helvetica").text("MEMORANDUM RESMI PERUSAHAAN", { align: "center" });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#0284c7");
      doc.moveDown(1.5);

      // Metadata Grid
      doc.fontSize(10).font("Helvetica-Bold").text("Nomor Memo: ", { continued: true }).font("Helvetica").text(memo.memoNumber || "DRAFT");
      doc.font("Helvetica-Bold").text("Tanggal: ", { continued: true }).font("Helvetica").text(new Date(memo.memoDate).toLocaleDateString("id-ID"));
      doc.font("Helvetica-Bold").text("Kategori: ", { continued: true }).font("Helvetica").text(memo.category?.name || "-");
      doc.font("Helvetica-Bold").text("Jenis: ", { continued: true }).font("Helvetica").text(memo.memoType?.name || "-");
      doc.font("Helvetica-Bold").text("Prioritas: ", { continued: true }).font("Helvetica").text(memo.priority);
      doc.font("Helvetica-Bold").text("Klasifikasi: ", { continued: true }).font("Helvetica").text(memo.classification);
      doc.moveDown();

      // Title
      doc.fontSize(14).font("Helvetica-Bold").text(memo.title, { align: "left" });
      doc.moveDown();

      // Body (Strip HTML tags for basic PDF rendering)
      const plainTextBody = memo.contentVersions[0]?.bodyHtml.replace(/<[^>]*>?/gm, "") || "";
      doc.fontSize(10).font("Helvetica").text(plainTextBody, { align: "justify", lineGap: 4 });
      doc.moveDown(2);

      // Digital Signature & QR Verification Block
      doc.fontSize(10).font("Helvetica-Bold").text("DITANDATANGANI ANGGOTA RESMI PERUSAHAAN", { align: "left" });
      doc.fontSize(8).font("Helvetica").text(`Pengesah: ${memo.authorId}`, { align: "left" });
      doc.fontSize(8).font("Helvetica").text(`Status Dokumen: PUBLISHED / RESMI`, { align: "left" });

      doc.image(qrBuffer, 440, doc.y - 40, { width: 90, height: 90 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function publishMemo(memoId: string, publisher: UserProfile, ipAddress?: string) {
  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findUnique({
      where: { id: memoId },
      include: {
        category: true,
        memoType: true,
        contentVersions: { orderBy: { version: "desc" }, take: 1 },
      },
    });

    if (!memo || memo.deletedAt) throw new NotFoundError("Memo not found");

    if (!["APPROVED", "OUTBOX", "PUBLISHED"].includes(memo.status)) {
      throw new ForbiddenError("Only APPROVED or OUTBOX memos can be published");
    }

    const existingProfile = await tx.digitalSignatureProfile.findUnique({ where: { userId: publisher.id } });
    if (existingProfile && !existingProfile.isActive) {
      throw new ForbiddenError("Your digital signature profile has been deactivated. Contact an administrator.");
    }

    const signatureProvider = new InternalSignatureProvider();

    // 1. Initial Hash calculation
    const dummyUrl = `${env.APP_URL}/verify/preview`;
    const { hashSha256 } = await generateCanonicalPdfBuffer(memo, dummyUrl);

    // 2. Digital Signing
    const sigResult = await signatureProvider.signDocument(hashSha256, publisher, ipAddress);

    // 3. Final Verification URL with token
    const verificationUrl = `${env.APP_URL}/verify/${sigResult.verificationToken}`;
    const finalPdf = await generateCanonicalPdfBuffer(memo, verificationUrl);

    // 4. Upload Canonical PDF to S3/MinIO
    const s3Key = `published/${memo.id}/canonical-${sigResult.verificationToken}.pdf`;
    const putCommand = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: s3Key,
      Body: finalPdf.pdfBuffer,
      ContentType: "application/pdf",
    });
    await s3Client.send(putCommand);

    // 5. Store Publication & Signature Records
    const publication = await tx.documentPublication.upsert({
      where: { memoId },
      update: {
        canonicalPdfKey: s3Key,
        pdfHashSha256: finalPdf.hashSha256,
        publishedById: publisher.id,
        publishedAt: new Date(),
      },
      create: {
        memoId,
        canonicalPdfKey: s3Key,
        pdfHashSha256: finalPdf.hashSha256,
        publishedById: publisher.id,
      },
    });

    const sigProfile = await tx.digitalSignatureProfile.upsert({
      where: { userId: publisher.id },
      update: {},
      create: { userId: publisher.id, signatureType: sigResult.signatureType },
    });

    await tx.signatureUsage.create({
      data: {
        digitalSignatureProfileId: sigProfile.id,
        documentPublicationId: publication.id,
        documentHash: finalPdf.hashSha256,
        ipAddress,
        signedAt: sigResult.signedAt,
      },
    });

    await tx.documentVerificationToken.create({
      data: {
        documentPublicationId: publication.id,
        token: sigResult.verificationToken,
      },
    });

    // 6. Transition Memo status -> PUBLISHED
    await tx.memo.update({
      where: { id: memoId },
      data: { status: "PUBLISHED" },
    });

    await tx.memoStatusHistory.create({
      data: { memoId, fromStatus: memo.status, toStatus: "PUBLISHED", actorId: publisher.id, reason: "Published canonical PDF document" },
    });

    await tx.domainOutboxEvent.create({
      data: {
        eventType: "MEMO_PUBLISHED",
        aggregateType: "Memo",
        aggregateId: memoId,
        payloadJson: JSON.stringify({ memoId, canonicalPdfKey: s3Key, pdfHashSha256: finalPdf.hashSha256 }),
      },
    });

    await logAuditEvent({
      actorId: publisher.id,
      action: "MEMO_PUBLISHED",
      module: "publication",
      resourceType: "DocumentPublication",
      resourceId: publication.id,
      memoNumber: memo.memoNumber || undefined,
      ipAddress,
    });

    return { publicationId: publication.id, canonicalPdfKey: s3Key, verificationToken: sigResult.verificationToken, status: "PUBLISHED" };
  });
}

export async function getCanonicalPdfDownloadUrl(memoId: string) {
  const publication = await prisma.documentPublication.findUnique({
    where: { memoId },
    include: { memo: true },
  });
  if (!publication) throw new NotFoundError("Published document not found for this memo");

  const getCommand = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: publication.canonicalPdfKey,
    ResponseContentDisposition: `inline; filename="Canonical-Memo-${publication.memo.memoNumber || memoId}.pdf"`,
  });

  const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 900 });
  return { downloadUrl, pdfHashSha256: publication.pdfHashSha256 };
}

export async function verifyDocumentToken(token: string) {
  const verificationRecord = await prisma.documentVerificationToken.findUnique({
    where: { token },
    include: {
      publication: {
        include: {
          memo: {
            include: {
              category: true,
              memoType: true,
            },
          },
          signatureUsages: {
            include: {
              profile: {
                include: {
                  user: {
                    include: { department: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!verificationRecord) {
    return {
      isValid: false,
      message: "Verification token invalid or not found",
    };
  }

  const pub = verificationRecord.publication;
  const memo = pub.memo;
  const sigUsage = pub.signatureUsages[0];
  const signer = sigUsage?.profile.user;

  return {
    isValid: true,
    message: "Document signature is valid and authentic",
    memoNumber: memo.memoNumber || "DRAFT",
    title: memo.title,
    categoryName: memo.category.name,
    typeName: memo.memoType.name,
    classification: memo.classification,
    publicationDate: pub.publishedAt,
    documentHashSha256: pub.pdfHashSha256,
    signer: signer
      ? {
          fullName: signer.fullName,
          employeeId: signer.employeeId,
          departmentName: signer.department?.name || null,
          position: signer.position,
        }
      : null,
    signedAt: sigUsage?.signedAt || pub.publishedAt,
  };
}

export async function listSignatureProfiles() {
  const profiles = await prisma.digitalSignatureProfile.findMany({
    include: {
      user: { include: { department: true } },
      usages: { select: { signedAt: true }, orderBy: { signedAt: "desc" }, take: 1 },
      _count: { select: { usages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return profiles.map((p) => ({
    id: p.id,
    signatureType: p.signatureType,
    isActive: p.isActive,
    createdAt: p.createdAt,
    ownerName: p.user.fullName,
    ownerUsername: p.user.username,
    departmentName: p.user.department?.name ?? null,
    usageCount: p._count.usages,
    lastUsedAt: p.usages[0]?.signedAt ?? null,
  }));
}

export async function setSignatureProfileActive(profileId: string, isActive: boolean, actorId?: string) {
  const before = await prisma.digitalSignatureProfile.findUnique({ where: { id: profileId } });
  if (!before) throw new NotFoundError("Signature profile not found");

  const updated = await prisma.digitalSignatureProfile.update({
    where: { id: profileId },
    data: { isActive },
  });

  await logAuditEvent({
    actorId,
    action: isActive ? "SIGNATURE_PROFILE_ACTIVATED" : "SIGNATURE_PROFILE_DEACTIVATED",
    module: "master.signature",
    resourceType: "DigitalSignatureProfile",
    resourceId: profileId,
    beforeData: { isActive: before.isActive },
    afterData: { isActive: updated.isActive },
  });

  return updated;
}
