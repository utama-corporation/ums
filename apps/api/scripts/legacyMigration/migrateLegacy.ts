/**
 * One-off ETL: imports Users and Memos from the legacy PHP/MySQL "Utama Memo System" dump
 * into this Postgres/Prisma schema.
 *
 * Usage (run from apps/api):
 *   npx tsx scripts/legacyMigration/migrateLegacy.ts --dry-run
 *   npx tsx scripts/legacyMigration/migrateLegacy.ts --commit
 *
 * Flags:
 *   --dry-run          Default. Parses, resolves, and validates everything; writes nothing.
 *   --commit           Actually writes Users, Memos, and related rows in one DB transaction.
 *   --dump=<path>       Path to the legacy umsapp.sql dump (default: the Z:\ path supplied by the user).
 *   --upload-dir=<path> Path to the legacy `upload/` folder holding attachment binaries.
 *
 * Preconditions:
 *   - The Department/Company sync (apps/worker/src/departmentSyncWorker.ts, or
 *     `pnpm --filter @ums/worker exec tsx -e "import('./src/departmentSyncWorker.js').then(m=>m.runDepartmentSyncCycle())"`)
 *     must have run at least once against the target database, so Company/Department rows
 *     exist for name-matching. The script aborts early with a clear message if none are found.
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@ums/db";
import { parseInsertRows, rowsToObjects, SqlValue } from "./sqlDumpParser.js";
import { sanitizeMemoHtml } from "../../src/services/sanitizerService.js";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const dumpArg = args.find((a) => a.startsWith("--dump="));
const uploadDirArg = args.find((a) => a.startsWith("--upload-dir="));
const DUMP_PATH = dumpArg ? dumpArg.slice("--dump=".length) : "Z:/nginx-1.29.2/html/ums/db/umsapp.sql";
const UPLOAD_DIR = uploadDirArg ? uploadDirArg.slice("--upload-dir=".length) : "Z:/nginx-1.29.2/html/ums/upload";

// ---------------------------------------------------------------------------
// Static mapping tables (reviewed with the product owner before --commit)
// ---------------------------------------------------------------------------
const ROLE_ID_TO_NEW_ROLE: Record<number, string> = {
  1: "SUPER_ADMIN", // Administrator
  2: "DEPARTMENT_HEAD", // Kepala Departemen
  3: "DEPARTMENT_HEAD", // Kepala Divisi
  4: "MANAGEMENT", // Direktur
  5: "MANAGEMENT", // Asisten Direktur Korporat
  6: "MANAGEMENT", // Management
  7: "MANAGEMENT", // Deputy Asistan Direktur
};

const STATUS_MEMO_TO_NEW_STATUS: Record<string, string> = {
  Approved: "ARCHIVED",
  Verified: "ARCHIVED",
  Reject: "REJECTED",
};

const FALLBACK_CATEGORY_CODE = "LEGACY";
const FALLBACK_MEMOTYPE_CODE = "LEGACY";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function s(v: SqlValue): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function normalizeName(v: SqlValue): string {
  return s(v).toLowerCase().replace(/\s+/g, " ").trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
}

interface Report {
  users: {
    total: number;
    toCreate: number;
    alreadyMigrated: number;
    skipped: { oldId: SqlValue; username: string; reason: string }[];
    roleMapApplied: Record<number, string>;
    unmappedRoles: number[];
    departmentUnmatched: { username: string; departemen: string; divisi: string }[];
    employeeIdBackfilled: number;
  };
  memos: {
    total: number;
    toCreate: number;
    alreadyMigrated: number;
    skipped: { oldId: SqlValue; reason: string }[];
    byTargetStatus: Record<string, number>;
    duplicateMemoNumbers: string[];
    recipientDepartmentUnmatched: { oldMemoId: SqlValue; name: string }[];
    attachmentsExpected: number;
    attachmentsFoundOnDisk: number;
    attachmentsMissingOnDisk: string[];
  };
}

async function buildDepartmentIndex(): Promise<{
  deptIndex: Map<string, Map<string, string>>;
  divIndex: Map<string, Map<string, string>>;
  companiesFound: string[];
  companyIdByCode: Map<string, string>;
}> {
  const companies = await prisma.company.findMany();
  const departments = await prisma.department.findMany();

  const deptIndex = new Map<string, Map<string, string>>();
  const divIndex = new Map<string, Map<string, string>>();

  for (const company of companies) {
    deptIndex.set(company.code, new Map());
    divIndex.set(company.code, new Map());
  }

  for (const dept of departments) {
    // Department codes are namespaced "{companyCodeLower}-...", so recover the owning company.
    const companyCode = companies.find((c) => dept.code.startsWith(`${c.code.toLowerCase()}-`))?.code;
    if (!companyCode) continue;

    if (dept.parentId === null) {
      // Level 1 (Department): stored name is "DeptName (COMPANY)" — strip the suffix for matching.
      const bareName = dept.name.replace(/\s*\([A-Z]+\)$/, "");
      deptIndex.get(companyCode)?.set(normalizeName(bareName), dept.id);
    } else {
      // Level 2/3 (Division/SubDivision): stored name is already bare.
      divIndex.get(companyCode)?.set(normalizeName(dept.name), dept.id);
    }
  }

  const companyIdByCode = new Map(companies.map((c) => [c.code, c.id]));

  return { deptIndex, divIndex, companiesFound: [...deptIndex.keys()], companyIdByCode };
}

function resolveDepartment(
  deptIndex: Map<string, Map<string, string>>,
  divIndex: Map<string, Map<string, string>>,
  companyCode: string,
  departemenName: string,
  divisiName: string
): string | null {
  const divMatch = divIndex.get(companyCode)?.get(normalizeName(divisiName));
  if (divMatch) return divMatch;
  const deptMatch = deptIndex.get(companyCode)?.get(normalizeName(departemenName));
  if (deptMatch) return deptMatch;
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`=== Legacy UMS migration: ${COMMIT ? "COMMIT" : "DRY-RUN"} ===`);
  console.log(`Dump: ${DUMP_PATH}`);
  console.log(`Upload dir: ${UPLOAD_DIR}`);

  const sql = fs.readFileSync(DUMP_PATH, "utf-8");

  const oldUsers = rowsToObjects(parseInsertRows(sql, "user"));
  const oldMemos = rowsToObjects(parseInsertRows(sql, "memo"));
  const oldMism = rowsToObjects(parseInsertRows(sql, "memo_mism")); // extra recipients
  const oldMims = rowsToObjects(parseInsertRows(sql, "memo_mims")); // extra senders

  const { deptIndex, divIndex, companiesFound, companyIdByCode } = await buildDepartmentIndex();
  if (companiesFound.length === 0) {
    console.error(
      "\nNo Company/Department rows found in the target database. Run the department sync " +
        "(apps/worker's DEPARTMENT_SYNC cycle) against this database first, then re-run this script.\n"
    );
    process.exit(1);
  }
  console.log(`Companies available for matching: ${companiesFound.join(", ")}`);

  const existingUsersByUsername = new Map((await prisma.user.findMany()).map((u) => [u.username.toLowerCase(), u]));
  const existingUsersByLegacyId = new Map(
    (await prisma.user.findMany({ where: { legacySourceId: { not: null } } })).map((u) => [u.legacySourceId!, u])
  );
  const existingMemosByLegacyId = new Map(
    (await prisma.memo.findMany({ where: { legacySourceId: { not: null } } })).map((m) => [m.legacySourceId!, m])
  );

  const report: Report = {
    users: {
      total: oldUsers.length,
      toCreate: 0,
      alreadyMigrated: 0,
      skipped: [],
      roleMapApplied: ROLE_ID_TO_NEW_ROLE,
      unmappedRoles: [],
      departmentUnmatched: [],
      employeeIdBackfilled: 0,
    },
    memos: {
      total: oldMemos.length,
      toCreate: 0,
      alreadyMigrated: 0,
      skipped: [],
      byTargetStatus: {},
      duplicateMemoNumbers: [],
      recipientDepartmentUnmatched: [],
      attachmentsExpected: 0,
      attachmentsFoundOnDisk: 0,
      attachmentsMissingOnDisk: [],
    },
  };

  // -------------------------------------------------------------------------
  // Plan: Users
  // -------------------------------------------------------------------------
  interface PlannedUser {
    legacyId: string;
    username: string;
    email: string;
    fullName: string;
    mobilePhone: string | null;
    companyId: string;
    departmentId: string | null;
    isActive: boolean;
    roleName: string | null;
  }
  const plannedUsers: PlannedUser[] = [];

  for (const u of oldUsers) {
    const legacyId = `legacy-user:${u.id_user}`;
    const username = s(u.username_user).toLowerCase();

    if (existingUsersByLegacyId.has(legacyId)) {
      report.users.alreadyMigrated++;
      continue;
    }
    if (existingUsersByUsername.has(username)) {
      report.users.skipped.push({ oldId: u.id_user, username, reason: "Username already exists in target DB (not legacy-tagged) — possible collision" });
      continue;
    }

    const companyCode = s(u.perusahaan_user).toUpperCase();
    const companyId = companyIdByCode.get(companyCode);
    if (!companyId) {
      report.users.skipped.push({ oldId: u.id_user, username, reason: `Unknown company code '${companyCode}'` });
      continue;
    }

    const roleId = Number(u.idrole_user);
    const roleName = ROLE_ID_TO_NEW_ROLE[roleId] ?? null;
    if (!roleName) report.users.unmappedRoles.push(roleId);

    const departmentId = resolveDepartment(deptIndex, divIndex, companyCode, s(u.departemen_user), s(u.divisi_user));
    if (!departmentId) {
      report.users.departmentUnmatched.push({ username, departemen: s(u.departemen_user), divisi: s(u.divisi_user) });
    }

    const email = s(u.email_user).toLowerCase();
    plannedUsers.push({
      legacyId,
      username,
      email: email || `${username}@utamacorp.local`,
      fullName: s(u.nama_user) || username,
      mobilePhone: s(u.nohp_user) || null,
      companyId,
      departmentId,
      isActive: s(u.status_user) === "Enable",
      roleName,
    });
    report.users.toCreate++;
  }

  const plannedByUsername = new Map(plannedUsers.map((p) => [p.username, p]));

  // -------------------------------------------------------------------------
  // Plan: Memos
  // -------------------------------------------------------------------------
  // MySQL's naive DATETIME columns (created_memo/updated_memo) carry no timezone; the legacy
  // app and its users all operate in Indonesia (WIB, UTC+7), so that offset is applied
  // explicitly here rather than relying on whatever local timezone this script happens to run
  // in (which would silently shift every migrated timestamp if run from a non-WIB machine).
  function parseLegacyDateTime(raw: string): Date {
    if (!raw) return new Date();
    const parsed = new Date(raw.replace(" ", "T") + "+07:00");
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function resolveAuthorId(username: string): string | "PLANNED" | null {
    const existing = existingUsersByUsername.get(username.toLowerCase());
    if (existing) return existing.id;
    if (plannedByUsername.has(username.toLowerCase())) return "PLANNED";
    return null;
  }

  const seenMemoNumbers = new Set<string>();
  interface PlannedMemo {
    oldId: SqlValue;
    legacyId: string;
    memoNumber: string;
    memoDate: Date;
    title: string;
    bodyHtml: string;
    bodyText: string;
    authorUsername: string;
    targetStatus: string;
    createdAt: Date;
    updatedAt: Date;
    reasonNote: string;
    recipients: { partyType: string; partyId: string | null; displayName: string }[];
    // extraSenders' partyId (for USER senders) can't be resolved until commit time, since the
    // approver may itself be a user this same migration run is about to create — so we carry
    // the username through and resolve it via finalUserId() inside the commit transaction.
    extraSenders: { partyType: string; approverUsername: string | null; displayName: string }[];
    attachmentFileName: string | null;
  }
  const plannedMemos: PlannedMemo[] = [];

  for (const m of oldMemos) {
    const oldId = m.id_memo;
    const legacyId = `legacy-memo:${oldId}`;
    if (existingMemosByLegacyId.has(legacyId)) {
      report.memos.alreadyMigrated++;
      continue;
    }

    const authorUsername = s(m.userpengaju_memo);
    const authorId = resolveAuthorId(authorUsername);
    if (!authorId) {
      report.memos.skipped.push({ oldId, reason: `Author username '${authorUsername}' not found among existing or planned users` });
      continue;
    }

    const targetStatus = STATUS_MEMO_TO_NEW_STATUS[s(m.status_memo)];
    if (!targetStatus) {
      report.memos.skipped.push({ oldId, reason: `Unmapped legacy status '${s(m.status_memo)}'` });
      continue;
    }

    const memoNumber = s(m.nomor_memo) || `LEGACY-${oldId}`;
    if (seenMemoNumbers.has(memoNumber)) {
      report.memos.duplicateMemoNumbers.push(memoNumber);
    }
    seenMemoNumbers.add(memoNumber);

    // Base recipient (DEPARTMENT for internal memos, EXTERNAL for jenis_memo === "ME").
    const isExternal = s(m.jenis_memo) === "ME";
    const recipients: PlannedMemo["recipients"] = [];

    if (isExternal) {
      recipients.push({ partyType: "EXTERNAL", partyId: null, displayName: s(m.comt_memo) || s(m.dept_memo) });
    } else {
      const recipientCompanyCode = s(m.comt_memo).toUpperCase().includes("GSU")
        ? "GSU"
        : s(m.comt_memo).toUpperCase().includes("RU")
          ? "RU"
          : "UC";
      const deptId = resolveDepartment(deptIndex, divIndex, recipientCompanyCode, s(m.dept_memo), s(m.divt_memo));
      if (!deptId) report.memos.recipientDepartmentUnmatched.push({ oldMemoId: oldId, name: `${s(m.dept_memo)} / ${s(m.divt_memo)}` });
      recipients.push({
        partyType: "DEPARTMENT",
        partyId: deptId,
        displayName: `${s(m.dept_memo)}${s(m.divt_memo) ? " - " + s(m.divt_memo) : ""} (${recipientCompanyCode})`,
      });
    }

    for (const extra of oldMism.filter((r) => Number(r.idmemo_mism) === Number(oldId))) {
      const cCode = s(extra.comt_mism).toUpperCase().includes("GSU") ? "GSU" : s(extra.comt_mism).toUpperCase().includes("RU") ? "RU" : "UC";
      const deptId = resolveDepartment(deptIndex, divIndex, cCode, s(extra.dept_mism), s(extra.divt_mism));
      if (!deptId) report.memos.recipientDepartmentUnmatched.push({ oldMemoId: oldId, name: `${s(extra.dept_mism)} / ${s(extra.divt_mism)}` });
      recipients.push({
        partyType: "DEPARTMENT",
        partyId: deptId,
        displayName: `${s(extra.dept_mism)}${s(extra.divt_mism) ? " - " + s(extra.divt_mism) : ""} (${cCode})`,
      });
    }

    const extraSenders: PlannedMemo["extraSenders"] = [];
    for (const extra of oldMims.filter((r) => Number(r.idmemo_mims) === Number(oldId))) {
      const approverUsername = s(extra.tdtdep_mims);
      const approverResolvable = approverUsername ? resolveAuthorId(approverUsername) : null;
      extraSenders.push({
        partyType: approverResolvable ? "USER" : "DEPARTMENT",
        approverUsername: approverResolvable ? approverUsername : null,
        displayName: approverResolvable ? approverUsername : `${s(extra.depf_mims)}${s(extra.divf_mims) ? " - " + s(extra.divf_mims) : ""} (${s(extra.comf_mims)})`,
      });
    }

    const bodyHtml = sanitizeMemoHtml(s(m.isi_memo));
    const createdAt = parseLegacyDateTime(s(m.created_memo));
    const updatedAt = parseLegacyDateTime(s(m.updated_memo));

    const attachmentFileName = s(m.lampiran_memo) || null;
    if (attachmentFileName) {
      report.memos.attachmentsExpected++;
      if (fs.existsSync(path.join(UPLOAD_DIR, attachmentFileName))) {
        report.memos.attachmentsFoundOnDisk++;
      } else {
        report.memos.attachmentsMissingOnDisk.push(attachmentFileName);
      }
    }

    plannedMemos.push({
      oldId,
      legacyId,
      memoNumber,
      memoDate: new Date(s(m.tgl_memo)),
      title: s(m.perihal_memo) || "(tanpa judul)",
      bodyHtml,
      bodyText: stripHtml(bodyHtml),
      authorUsername,
      targetStatus,
      createdAt,
      updatedAt,
      reasonNote: `Migrasi dari sistem lama (ID lama #${oldId}, status lama '${s(m.status_memo)}', jenis '${s(m.jenis_memo)}')${s(m.keterangan_memo) ? " — " + s(m.keterangan_memo) : ""}`,
      recipients,
      extraSenders,
      attachmentFileName,
    });
    report.memos.toCreate++;
    report.memos.byTargetStatus[targetStatus] = (report.memos.byTargetStatus[targetStatus] ?? 0) + 1;
  }

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------
  console.log("\n--- USERS ---");
  console.log(`Total in dump: ${report.users.total}`);
  console.log(`Already migrated (legacySourceId present): ${report.users.alreadyMigrated}`);
  console.log(`Will create: ${report.users.toCreate}`);
  console.log(`Skipped: ${report.users.skipped.length}`);
  report.users.skipped.forEach((s2) => console.log(`  - old id ${s2.oldId} (${s2.username}): ${s2.reason}`));
  if (report.users.unmappedRoles.length) console.log(`Unmapped role IDs: ${[...new Set(report.users.unmappedRoles)].join(", ")}`);
  console.log(`Department unmatched: ${report.users.departmentUnmatched.length}`);
  report.users.departmentUnmatched.forEach((d) => console.log(`  - ${d.username}: departemen='${d.departemen}' divisi='${d.divisi}'`));

  console.log("\n--- MEMOS ---");
  console.log(`Total in dump: ${report.memos.total}`);
  console.log(`Already migrated: ${report.memos.alreadyMigrated}`);
  console.log(`Will create: ${report.memos.toCreate}`);
  console.log(`By target status:`, report.memos.byTargetStatus);
  console.log(`Skipped: ${report.memos.skipped.length}`);
  report.memos.skipped.forEach((s2) => console.log(`  - old id ${s2.oldId}: ${s2.reason}`));
  console.log(`Duplicate memoNumber collisions: ${report.memos.duplicateMemoNumbers.length}`);
  if (report.memos.duplicateMemoNumbers.length) console.log(`  ${report.memos.duplicateMemoNumbers.slice(0, 20).join(", ")}`);
  console.log(`Recipient department unmatched: ${report.memos.recipientDepartmentUnmatched.length}`);
  report.memos.recipientDepartmentUnmatched.slice(0, 30).forEach((d) => console.log(`  - memo #${d.oldMemoId}: '${d.name}'`));
  console.log(`Attachments expected: ${report.memos.attachmentsExpected}, found on disk: ${report.memos.attachmentsFoundOnDisk}, missing: ${report.memos.attachmentsMissingOnDisk.length}`);
  if (report.memos.attachmentsMissingOnDisk.length) console.log(`  missing: ${report.memos.attachmentsMissingOnDisk.slice(0, 20).join(", ")}`);

  if (!COMMIT) {
    console.log("\nDry-run only — nothing was written. Re-run with --commit to apply.");
    await prisma.$disconnect();
    return;
  }

  if (report.memos.duplicateMemoNumbers.length > 0) {
    console.error("\nRefusing to commit: duplicate memoNumber collisions must be resolved first (Memo.memoNumber is unique).");
    await prisma.$disconnect();
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Commit
  // -------------------------------------------------------------------------
  console.log("\n--- COMMITTING ---");
  const newUserIdByUsername = new Map<string, string>();

  await prisma.$transaction(
    async (tx) => {
      const category = await tx.category.upsert({
        where: { code: FALLBACK_CATEGORY_CODE },
        update: {},
        create: { code: FALLBACK_CATEGORY_CODE, name: "Migrasi Data Lama", description: "Kategori fallback untuk memo hasil migrasi dari sistem lama" },
      });
      const memoType = await tx.memoType.upsert({
        where: { code: FALLBACK_MEMOTYPE_CODE },
        update: {},
        create: { code: FALLBACK_MEMOTYPE_CODE, name: "Memo Migrasi", description: "Jenis memo fallback untuk memo hasil migrasi dari sistem lama" },
      });

      for (const pu of plannedUsers) {
        const randomSecret = crypto.randomBytes(32).toString("hex");
        const passwordHash = await bcrypt.hash(randomSecret, 10);

        const user = await tx.user.create({
          data: {
            username: pu.username,
            email: pu.email,
            fullName: pu.fullName,
            mobilePhone: pu.mobilePhone,
            departmentId: pu.departmentId,
            isActive: pu.isActive,
            legacySourceId: pu.legacyId,
            companyId: pu.companyId,
            credentials: { create: { passwordHash } },
          },
        });
        newUserIdByUsername.set(pu.username, user.id);

        if (pu.roleName) {
          const role = await tx.role.findUnique({ where: { name: pu.roleName } });
          if (role) {
            await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
          }
        }
      }

      function finalUserId(username: string): string {
        const existing = existingUsersByUsername.get(username.toLowerCase());
        if (existing) return existing.id;
        const created = newUserIdByUsername.get(username.toLowerCase());
        if (!created) throw new Error(`Unresolved user id for username '${username}' during commit`);
        return created;
      }

      for (const pm of plannedMemos) {
        const authorId = finalUserId(pm.authorUsername);

        const memo = await tx.memo.create({
          data: {
            memoNumber: pm.memoNumber,
            memoDate: pm.memoDate,
            title: pm.title,
            priority: "NORMAL",
            classification: "GENERAL",
            status: pm.targetStatus,
            authorId,
            categoryId: category.id,
            memoTypeId: memoType.id,
            legacySourceId: pm.legacyId,
            createdAt: pm.createdAt,
            updatedAt: pm.updatedAt,
          },
        });

        await tx.memoContentVersion.create({
          data: {
            memoId: memo.id,
            version: 1,
            bodyHtml: pm.bodyHtml,
            bodyText: pm.bodyText,
            createdById: authorId,
            createdAt: pm.createdAt,
          },
        });

        await tx.memoSender.create({
          data: { memoId: memo.id, partyType: "USER", partyId: authorId, displayName: pm.authorUsername },
        });
        for (const extra of pm.extraSenders) {
          const partyId = extra.approverUsername ? finalUserId(extra.approverUsername) : null;
          await tx.memoSender.create({
            data: { memoId: memo.id, partyType: extra.partyType, partyId, displayName: extra.displayName },
          });
        }

        for (const r of pm.recipients) {
          await tx.memoRecipient.create({
            data: { memoId: memo.id, partyType: r.partyType, partyId: r.partyId, displayName: r.displayName },
          });
        }

        await tx.memoStatusHistory.create({
          data: {
            memoId: memo.id,
            fromStatus: null,
            toStatus: pm.targetStatus,
            actorId: authorId,
            reason: pm.reasonNote,
            createdAt: pm.updatedAt,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          actorId: null,
          action: "LEGACY_DATA_MIGRATED",
          module: "migration",
          resourceType: "Bulk",
          resourceId: "legacy-import",
          afterJson: JSON.stringify({ usersCreated: plannedUsers.length, memosCreated: plannedMemos.length, ranAt: new Date().toISOString() }),
        },
      });
    },
    { maxWait: 30_000, timeout: 300_000 }
  );

  console.log(`Committed: ${plannedUsers.length} users, ${plannedMemos.length} memos.`);
  console.log("Note: attachments were NOT uploaded by this run — run uploadLegacyAttachments.ts separately (see docs/legacy-migration.md).");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
