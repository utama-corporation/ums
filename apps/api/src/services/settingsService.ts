import { prisma } from "@ums/db";
import { NotFoundError } from "../errors/AppError.js";
import { CompanyProfileUpdateInput, SecurityPolicyInput } from "@ums/contracts";
import { logAuditEvent } from "./auditService.js";

export async function getCompanyProfile() {
  const profile = await prisma.companyProfile.findFirst({ orderBy: { createdAt: "asc" } });
  if (!profile) throw new NotFoundError("Company profile not configured");
  return profile;
}

export async function updateCompanyProfile(input: CompanyProfileUpdateInput, actorId?: string) {
  const before = await getCompanyProfile();

  const updated = await prisma.companyProfile.update({
    where: { id: before.id },
    data: input,
  });

  await logAuditEvent({
    actorId,
    action: "COMPANY_PROFILE_UPDATED",
    module: "settings",
    resourceType: "CompanyProfile",
    resourceId: updated.id,
    beforeData: before,
    afterData: updated,
  });

  return updated;
}

// Session/security policy is stored as individual SystemSetting rows so authService can
// read it without a schema migration for every new tunable. Defaults match the values
// that were previously hard-coded in authService.
const DEFAULT_ACCESS_TOKEN_TTL_MINUTES = 15;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 7;

const ACCESS_TOKEN_TTL_KEY = "security.access_token_ttl_minutes";
const REFRESH_TOKEN_TTL_KEY = "security.refresh_token_ttl_days";

export async function getSecurityPolicy(): Promise<SecurityPolicyInput> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [ACCESS_TOKEN_TTL_KEY, REFRESH_TOKEN_TTL_KEY] } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const accessTokenTtlMinutes = Number(byKey.get(ACCESS_TOKEN_TTL_KEY)) || DEFAULT_ACCESS_TOKEN_TTL_MINUTES;
  const refreshTokenTtlDays = Number(byKey.get(REFRESH_TOKEN_TTL_KEY)) || DEFAULT_REFRESH_TOKEN_TTL_DAYS;

  return { accessTokenTtlMinutes, refreshTokenTtlDays };
}

export async function updateSecurityPolicy(input: SecurityPolicyInput, actorId?: string) {
  const before = await getSecurityPolicy();

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: ACCESS_TOKEN_TTL_KEY },
      update: { value: String(input.accessTokenTtlMinutes), description: "Access token lifetime in minutes" },
      create: { key: ACCESS_TOKEN_TTL_KEY, value: String(input.accessTokenTtlMinutes), description: "Access token lifetime in minutes" },
    }),
    prisma.systemSetting.upsert({
      where: { key: REFRESH_TOKEN_TTL_KEY },
      update: { value: String(input.refreshTokenTtlDays), description: "Refresh token / session lifetime in days" },
      create: { key: REFRESH_TOKEN_TTL_KEY, value: String(input.refreshTokenTtlDays), description: "Refresh token / session lifetime in days" },
    }),
  ]);

  await logAuditEvent({
    actorId,
    action: "SECURITY_POLICY_UPDATED",
    module: "settings",
    resourceType: "SystemSetting",
    beforeData: before,
    afterData: input,
  });

  return input;
}
