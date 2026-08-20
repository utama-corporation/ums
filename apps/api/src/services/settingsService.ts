import { prisma } from "@ums/db";
import { env } from "@ums/config";
import { NotFoundError } from "../errors/AppError.js";
import { CompanyProfileUpdateInput, SecurityPolicyInput, SmtpConfigInput } from "@ums/contracts";
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

// SMTP password intentionally never lives here — it stays in the SMTP_PASS env var
// (a secret-manager-style reference) so it's never exposed through the Settings API
// or stored in plaintext in the database. Everything else (host/port/secure/user/from)
// is a real, DB-backed setting the worker reads at send time (see apps/worker/src/mailer.ts).
const SMTP_HOST_KEY = "smtp.host";
const SMTP_PORT_KEY = "smtp.port";
const SMTP_SECURE_KEY = "smtp.secure";
const SMTP_USER_KEY = "smtp.user";
const SMTP_FROM_KEY = "smtp.from";
const SMTP_KEYS = [SMTP_HOST_KEY, SMTP_PORT_KEY, SMTP_SECURE_KEY, SMTP_USER_KEY, SMTP_FROM_KEY];

export async function getSmtpConfig(): Promise<SmtpConfigInput> {
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: SMTP_KEYS } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  return {
    host: byKey.get(SMTP_HOST_KEY) ?? env.SMTP_HOST,
    port: Number(byKey.get(SMTP_PORT_KEY)) || env.SMTP_PORT,
    secure: byKey.has(SMTP_SECURE_KEY) ? byKey.get(SMTP_SECURE_KEY) === "true" : env.SMTP_PORT === 465,
    user: byKey.get(SMTP_USER_KEY) ?? env.SMTP_USER ?? null,
    from: byKey.get(SMTP_FROM_KEY) ?? env.SMTP_FROM,
  };
}

export async function updateSmtpConfig(input: SmtpConfigInput, actorId?: string) {
  const before = await getSmtpConfig();

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: SMTP_HOST_KEY },
      update: { value: input.host },
      create: { key: SMTP_HOST_KEY, value: input.host, description: "SMTP server hostname" },
    }),
    prisma.systemSetting.upsert({
      where: { key: SMTP_PORT_KEY },
      update: { value: String(input.port) },
      create: { key: SMTP_PORT_KEY, value: String(input.port), description: "SMTP server port" },
    }),
    prisma.systemSetting.upsert({
      where: { key: SMTP_SECURE_KEY },
      update: { value: String(input.secure) },
      create: { key: SMTP_SECURE_KEY, value: String(input.secure), description: "Use implicit TLS (SMTPS)" },
    }),
    prisma.systemSetting.upsert({
      where: { key: SMTP_USER_KEY },
      update: { value: input.user || "" },
      create: { key: SMTP_USER_KEY, value: input.user || "", description: "SMTP auth username" },
    }),
    prisma.systemSetting.upsert({
      where: { key: SMTP_FROM_KEY },
      update: { value: input.from },
      create: { key: SMTP_FROM_KEY, value: input.from, description: "Default From header for outgoing email" },
    }),
  ]);

  await logAuditEvent({
    actorId,
    action: "SMTP_CONFIG_UPDATED",
    module: "settings",
    resourceType: "SystemSetting",
    beforeData: before,
    afterData: input,
  });

  return getSmtpConfig();
}
