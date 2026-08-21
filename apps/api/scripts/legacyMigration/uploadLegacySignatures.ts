/**
 * Third, separate pass: migrates legacy `user.tdt_user` signature images (stored in the same
 * `upload/` folder as memo attachments) into DigitalSignatureProfile.imageAssetKey for users
 * already imported by migrateLegacy.ts. Skipped entirely for users whose legacy tdt_user was
 * the literal placeholder "default.jpg" (meaning they never actually uploaded a signature in
 * the old system) or empty.
 *
 * This only migrates the *image* — it does NOT set a PIN or otherwise make the profile usable
 * for signing; each user (or an admin) still needs to complete signature setup in the new
 * system before it can be used to sign a document.
 *
 * Usage (run from apps/api):
 *   npx tsx scripts/legacyMigration/uploadLegacySignatures.ts --dry-run
 *   npx tsx scripts/legacyMigration/uploadLegacySignatures.ts --commit
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

const PLACEHOLDER_SIGNATURE_FILENAMES = new Set(["default.jpg", "default.png", ""]);

function s(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function guessMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

async function main() {
  console.log(`=== Legacy signature image migration: ${COMMIT ? "COMMIT" : "DRY-RUN"} ===`);

  const sql = fs.readFileSync(DUMP_PATH, "utf-8");
  const oldUsers = rowsToObjects(parseInsertRows(sql, "user"));

  const migratedUsers = await prisma.user.findMany({
    where: { legacySourceId: { startsWith: "legacy-user:" } },
    include: { signatureProfile: true },
  });
  const byLegacyId = new Map(migratedUsers.map((u) => [u.legacySourceId!, u]));

  let placeholderOrEmpty = 0;
  let userNotMigrated = 0;
  let alreadyHasProfile = 0;
  let toMigrate = 0;
  const missingOnDisk: string[] = [];
  const failures: { username: string; fileName: string; error: string }[] = [];

  let bucket: string | null = null;
  if (COMMIT) {
    try {
      bucket = await getS3Bucket();
      await getS3Client();
    } catch (err) {
      console.error("Could not reach S3/MinIO storage — fix Settings > Lampiran File before running --commit.");
      console.error(err);
      process.exit(1);
    }
  }

  for (const u of oldUsers) {
    const fileName = s(u.tdt_user);
    if (PLACEHOLDER_SIGNATURE_FILENAMES.has(fileName.toLowerCase())) {
      placeholderOrEmpty++;
      continue;
    }

    const legacyId = `legacy-user:${u.id_user}`;
    const user = byLegacyId.get(legacyId);
    if (!user) {
      userNotMigrated++;
      continue;
    }
    if (user.signatureProfile) {
      alreadyHasProfile++;
      continue;
    }

    // The legacy app saves tdt_user images under upload/images/ (see app/ajax_pengguna.php),
    // unlike memo attachments which sit directly under upload/ — fall back to the flat path
    // in case a different deployment ever puts them there instead.
    const imagesSubdirPath = path.join(UPLOAD_DIR, "images", fileName);
    const flatPath = path.join(UPLOAD_DIR, fileName);
    const filePath = fs.existsSync(imagesSubdirPath) ? imagesSubdirPath : flatPath;
    if (!fs.existsSync(filePath)) {
      missingOnDisk.push(`${user.username} -> ${fileName}`);
      continue;
    }

    toMigrate++;
    if (!COMMIT) continue;

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const safeExt = /^[a-zA-Z0-9]{1,10}$/.test(fileName.split(".").pop() ?? "") ? fileName.split(".").pop()! : "bin";
      const objectKey = `legacy-signatures/${user.id}/${crypto.randomUUID()}.${safeExt}`;

      const client = await getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket!,
          Key: objectKey,
          Body: fileBuffer,
          ContentType: guessMimeType(fileName),
        })
      );

      await prisma.digitalSignatureProfile.create({
        data: {
          userId: user.id,
          signatureType: "INTERNAL",
          imageAssetKey: objectKey,
          isActive: true,
        },
      });
      console.log(`Migrated signature: ${user.username} -> ${fileName} (${objectKey})`);
    } catch (err) {
      failures.push({ username: user.username, fileName, error: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log("\n--- SUMMARY ---");
  console.log(`Users in dump: ${oldUsers.length}`);
  console.log(`No real signature (placeholder/empty): ${placeholderOrEmpty}`);
  console.log(`User not migrated (run migrateLegacy.ts first): ${userNotMigrated}`);
  console.log(`Already has a signature profile (skipped): ${alreadyHasProfile}`);
  console.log(`Missing on disk: ${missingOnDisk.length}`);
  missingOnDisk.forEach((m) => console.log(`  - ${m}`));
  console.log(`${COMMIT ? "Migrated" : "Would migrate"}: ${toMigrate}`);
  if (failures.length) {
    console.log(`Failures: ${failures.length}`);
    failures.forEach((f) => console.log(`  - ${f.username} (${f.fileName}): ${f.error}`));
  }
  if (!COMMIT) console.log("\nDry-run only — nothing was uploaded. Re-run with --commit to apply.");
  console.log(
    "\nNote: this only migrates the signature IMAGE. Each user still needs to complete signature/PIN setup in the new system before it can be used to sign anything."
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
