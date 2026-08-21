import { prisma } from "@ums/db";
import { env, encryptSecret, decryptSecret } from "@ums/config";
import { NotFoundError } from "../errors/AppError.js";
import { CompanyProfileUpdateInput, SecurityPolicyInput, SmtpConfigInput, S3ConfigInput, S3ConfigResponse } from "@ums/contracts";
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

// Unlike SMTP_PASS, the S3 secret key is meant to be editable from the Settings UI rather
// than staying pinned to an env var forever — so it's stored here encrypted at rest
// (see @ums/config's encryptSecret/decryptSecret) instead of being excluded like the SMTP
// password is.
const S3_ENDPOINT_KEY = "s3.endpoint";
const S3_REGION_KEY = "s3.region";
const S3_BUCKET_KEY = "s3.bucket";
const S3_ACCESS_KEY_KEY = "s3.access_key";
const S3_SECRET_KEY_KEY = "s3.secret_key";
const S3_FORCE_PATH_STYLE_KEY = "s3.force_path_style";
const S3_KEYS = [S3_ENDPOINT_KEY, S3_REGION_KEY, S3_BUCKET_KEY, S3_ACCESS_KEY_KEY, S3_SECRET_KEY_KEY, S3_FORCE_PATH_STYLE_KEY];

async function loadS3SettingRows(): Promise<Map<string, string>> {
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: S3_KEYS } } });
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function getS3Config(): Promise<S3ConfigResponse> {
  const byKey = await loadS3SettingRows();

  return {
    endpoint: byKey.get(S3_ENDPOINT_KEY) ?? env.S3_ENDPOINT,
    region: byKey.get(S3_REGION_KEY) ?? env.S3_REGION,
    bucket: byKey.get(S3_BUCKET_KEY) ?? env.S3_BUCKET,
    accessKey: byKey.get(S3_ACCESS_KEY_KEY) ?? env.S3_ACCESS_KEY,
    secretKeyConfigured: byKey.has(S3_SECRET_KEY_KEY) || Boolean(env.S3_SECRET_KEY),
    forcePathStyle: byKey.has(S3_FORCE_PATH_STYLE_KEY) ? byKey.get(S3_FORCE_PATH_STYLE_KEY) === "true" : env.S3_FORCE_PATH_STYLE,
  };
}

// Internal-only: resolves the S3 config WITH the decrypted secret key, for building an
// actual S3Client. Never expose this return value through an API response — that's what
// getS3Config() (no secret) is for.
export interface ResolvedS3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export async function resolveS3StorageConfig(): Promise<ResolvedS3Config> {
  const byKey = await loadS3SettingRows();
  const encryptedSecret = byKey.get(S3_SECRET_KEY_KEY);

  return {
    endpoint: byKey.get(S3_ENDPOINT_KEY) ?? env.S3_ENDPOINT,
    region: byKey.get(S3_REGION_KEY) ?? env.S3_REGION,
    bucket: byKey.get(S3_BUCKET_KEY) ?? env.S3_BUCKET,
    accessKeyId: byKey.get(S3_ACCESS_KEY_KEY) ?? env.S3_ACCESS_KEY,
    secretAccessKey: encryptedSecret ? decryptSecret(encryptedSecret) : env.S3_SECRET_KEY,
    forcePathStyle: byKey.has(S3_FORCE_PATH_STYLE_KEY) ? byKey.get(S3_FORCE_PATH_STYLE_KEY) === "true" : env.S3_FORCE_PATH_STYLE,
  };
}

export async function updateS3Config(input: S3ConfigInput, actorId?: string): Promise<S3ConfigResponse> {
  const before = await getS3Config();

  const upserts = [
    prisma.systemSetting.upsert({
      where: { key: S3_ENDPOINT_KEY },
      update: { value: input.endpoint },
      create: { key: S3_ENDPOINT_KEY, value: input.endpoint, description: "S3/MinIO endpoint URL" },
    }),
    prisma.systemSetting.upsert({
      where: { key: S3_REGION_KEY },
      update: { value: input.region },
      create: { key: S3_REGION_KEY, value: input.region, description: "S3/MinIO region" },
    }),
    prisma.systemSetting.upsert({
      where: { key: S3_BUCKET_KEY },
      update: { value: input.bucket },
      create: { key: S3_BUCKET_KEY, value: input.bucket, description: "S3/MinIO bucket name" },
    }),
    prisma.systemSetting.upsert({
      where: { key: S3_ACCESS_KEY_KEY },
      update: { value: input.accessKey },
      create: { key: S3_ACCESS_KEY_KEY, value: input.accessKey, description: "S3/MinIO access key" },
    }),
    prisma.systemSetting.upsert({
      where: { key: S3_FORCE_PATH_STYLE_KEY },
      update: { value: String(input.forcePathStyle) },
      create: { key: S3_FORCE_PATH_STYLE_KEY, value: String(input.forcePathStyle), description: "Use path-style S3 URLs (required for most MinIO setups)" },
    }),
  ];

  if (input.secretKey) {
    const encrypted = encryptSecret(input.secretKey);
    upserts.push(
      prisma.systemSetting.upsert({
        where: { key: S3_SECRET_KEY_KEY },
        update: { value: encrypted },
        create: { key: S3_SECRET_KEY_KEY, value: encrypted, description: "S3/MinIO secret key (encrypted at rest)" },
      })
    );
  }

  await prisma.$transaction(upserts);

  await logAuditEvent({
    actorId,
    action: "S3_CONFIG_UPDATED",
    module: "settings",
    resourceType: "SystemSetting",
    beforeData: before,
    afterData: { ...input, secretKey: input.secretKey ? "[REDACTED]" : undefined },
  });

  return getS3Config();
}
