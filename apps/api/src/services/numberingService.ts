import { prisma } from "@ums/db";
import { logAuditEvent } from "./auditService.js";
import { MemoNumberingRuleInput } from "@ums/contracts";

const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function getRomanMonth(monthIndexOneBased: number): string {
  if (monthIndexOneBased < 1 || monthIndexOneBased > 12) return "I";
  return ROMAN_MONTHS[monthIndexOneBased - 1] || "I";
}

export function formatMemoNumber(
  pattern: string,
  sequenceNumber: number,
  paddingDigits: number,
  deptCode: string,
  typeCode: string,
  date: Date = new Date()
): string {
  const year = date.getFullYear().toString();
  const monthRoman = getRomanMonth(date.getMonth() + 1);
  const monthPadded = (date.getMonth() + 1).toString().padStart(2, "0");
  const paddedSeq = sequenceNumber.toString().padStart(paddingDigits, "0");

  return pattern
    .replace("{SEQUENCE}", paddedSeq)
    .replace("{DEPT}", deptCode)
    .replace("{TYPE}", typeCode)
    .replace("{ROMAN_MONTH}", monthRoman)
    .replace("{MONTH}", monthPadded)
    .replace("{YEAR}", year);
}

export async function allocateNextMemoNumber(
  ruleId: string,
  deptCode: string,
  typeCode: string,
  date: Date = new Date()
): Promise<string> {
  const rule = await prisma.memoNumberingRule.findUnique({ where: { id: ruleId } });
  if (!rule || !rule.isActive) {
    throw new Error("Active numbering rule not found");
  }

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const scopeSuffix = rule.resetFrequency === "MONTHLY" ? `${deptCode}/${typeCode}/${year}-${month}` : `${deptCode}/${typeCode}/${year}`;

  // Concurrency-safe atomic transaction using raw SQL lock or upsert
  const seqRecord = await prisma.$transaction(async (tx) => {
    const existing = await tx.memoNumberSequence.upsert({
      where: { scopeKey: scopeSuffix },
      update: {
        lastSequence: { increment: 1 },
      },
      create: {
        scopeKey: scopeSuffix,
        lastSequence: 1,
      },
    });

    return existing.lastSequence;
  });

  return formatMemoNumber(rule.formatPattern, seqRecord, rule.paddingDigits, deptCode, typeCode, date);
}

export async function createNumberingRule(input: MemoNumberingRuleInput, actorId?: string) {
  const rule = await prisma.memoNumberingRule.create({
    data: {
      name: input.name,
      formatPattern: input.formatPattern,
      resetFrequency: input.resetFrequency,
      paddingDigits: input.paddingDigits,
    },
  });

  await logAuditEvent({
    actorId,
    action: "NUMBERING_RULE_CREATED",
    module: "master.numbering",
    resourceType: "MemoNumberingRule",
    resourceId: rule.id,
    afterData: rule,
  });

  return rule;
}

export async function listNumberingRules() {
  return prisma.memoNumberingRule.findMany({
    orderBy: { createdAt: "desc" },
  });
}
