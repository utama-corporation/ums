/**
 * Second, separate pass: uploads the legacy `upload/` folder's attachment binaries to the
 * configured S3/MinIO bucket for memos already imported by migrateLegacy.ts, and links them
 * as MemoAttachment/AttachmentObject rows.
 *
 * Split out from migrateLegacy.ts deliberately: attachment upload needs a *working* S3/MinIO
 * connection (Settings > Lampiran File), which may not be ready at the same time as the
 * Postgres-only user/memo import. Re-running this script is safe — it skips any legacy memo
 * that already has an AttachmentObject linked.
 *
 * Usage (run from apps/api):
 *   npx tsx scripts/legacyMigration/uploadLegacyAttachments.ts --dry-run
 *   npx tsx scripts/legacyMigration/uploadLegacyAttachments.ts --commit
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@ums/db";
import { getS3Client, getS3Bucket } from "../../src/services/storageService.js";
import { parseInsertRows, rowsToObjects } from "./sqlDumpParser.js";

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const dumpArg = args.find((a) => a.startsWith("--dump="));
const uploadDirArg = args.find((a) => a.startsWith("--upload-dir="));
const DUMP_PATH = dumpArg ? dumpArg.slice("--dump=".length) : "Z:/nginx-1.29.2/html/ums/db/umsapp.sql";
const UPLOAD_DIR = uploadDirArg ? uploadDirArg.slice("--upload-dir=".length) : "Z:/nginx-1.29.2/html/ums/upload";

function s(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function guessMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
}

async function main() {
  console.log(`=== Legacy attachment upload: ${COMMIT ? "COMMIT" : "DRY-RUN"} ===`);

  const sql = fs.readFileSync(DUMP_PATH, "utf-8");
  const oldMemos = rowsToObjects(parseInsertRows(sql, "memo"));
  const attachmentByLegacyId = new Map<string, string>();
  for (const m of oldMemos) {
    const fileName = s(m.lampiran_memo);
    if (fileName) attachmentByLegacyId.set(`legacy-memo:${m.id_memo}`, fileName);
  }

  const migratedMemos = await prisma.memo.findMany({
    where: { legacySourceId: { startsWith: "legacy-memo:" } },
    include: { attachments: true },
  });

  let toUpload = 0;
  let alreadyLinked = 0;
  let noAttachmentExpected = 0;
  const missingOnDisk: string[] = [];
  const failures: { memoId: string; fileName: string; error: string }[] = [];

  let bucket: string | null = null;
  if (COMMIT) {
    try {
      bucket = await getS3Bucket();
      const client = await getS3Client();
      void client;
    } catch (err) {
      console.error("Could not reach S3/MinIO storage — fix Settings > Lampiran File before running --commit.");
      console.error(err);
      process.exit(1);
    }
  }

  for (const memo of migratedMemos) {
    const fileName = attachmentByLegacyId.get(memo.legacySourceId!);
    if (!fileName) {
      noAttachmentExpected++;
      continue;
    }
    if (memo.attachments.length > 0) {
      alreadyLinked++;
      continue;
    }

    const filePath = path.join(UPLOAD_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      missingOnDisk.push(`${memo.legacySourceId} -> ${fileName}`);
      continue;
    }

    toUpload++;
    if (!COMMIT) continue;

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const checksumSha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");
      const safeExt = /^[a-zA-Z0-9]{1,10}$/.test(fileName.split(".").pop() ?? "") ? fileName.split(".").pop()! : "bin";
      const objectKey = `legacy/${memo.id}/${crypto.randomUUID()}.${safeExt}`;

      const client = await getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket!,
          Key: objectKey,
          Body: fileBuffer,
          ContentType: guessMimeType(fileName),
        })
      );

      const attachmentObject = await prisma.attachmentObject.create({
        data: {
          objectKey,
          fileName,
          fileSize: fileBuffer.length,
          mimeType: guessMimeType(fileName),
          checksumSha256,
          status: "READY",
        },
      });
      await prisma.memoAttachment.create({
        data: { memoId: memo.id, attachmentObjectId: attachmentObject.id },
      });
      console.log(`Uploaded: ${memo.legacySourceId} -> ${fileName} (${objectKey})`);
    } catch (err) {
      failures.push({ memoId: memo.id, fileName, error: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log("\n--- SUMMARY ---");
  console.log(`Migrated memos scanned: ${migratedMemos.length}`);
  console.log(`No attachment expected: ${noAttachmentExpected}`);
  console.log(`Already linked (skipped): ${alreadyLinked}`);
  console.log(`Missing on disk: ${missingOnDisk.length}`);
  missingOnDisk.forEach((m) => console.log(`  - ${m}`));
  console.log(`${COMMIT ? "Uploaded" : "Would upload"}: ${toUpload}`);
  if (failures.length) {
    console.log(`Failures: ${failures.length}`);
    failures.forEach((f) => console.log(`  - ${f.memoId} (${f.fileName}): ${f.error}`));
  }
  if (!COMMIT) console.log("\nDry-run only — nothing was uploaded. Re-run with --commit to apply.");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
