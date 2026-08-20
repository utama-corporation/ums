import nodemailer from "nodemailer";
import { prisma } from "@ums/db";
import { env } from "@ums/config";

interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  from: string;
}

const SMTP_HOST_KEY = "smtp.host";
const SMTP_PORT_KEY = "smtp.port";
const SMTP_SECURE_KEY = "smtp.secure";
const SMTP_USER_KEY = "smtp.user";
const SMTP_FROM_KEY = "smtp.from";

let cachedConfig: { data: ResolvedSmtpConfig; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000;

async function resolveSmtpConfig(): Promise<ResolvedSmtpConfig> {
  if (cachedConfig && Date.now() - cachedConfig.fetchedAt < CACHE_TTL_MS) {
    return cachedConfig.data;
  }

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [SMTP_HOST_KEY, SMTP_PORT_KEY, SMTP_SECURE_KEY, SMTP_USER_KEY, SMTP_FROM_KEY] } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const data: ResolvedSmtpConfig = {
    host: byKey.get(SMTP_HOST_KEY) ?? env.SMTP_HOST,
    port: Number(byKey.get(SMTP_PORT_KEY)) || env.SMTP_PORT,
    secure: byKey.has(SMTP_SECURE_KEY) ? byKey.get(SMTP_SECURE_KEY) === "true" : env.SMTP_PORT === 465,
    user: byKey.get(SMTP_USER_KEY) || env.SMTP_USER || null,
    from: byKey.get(SMTP_FROM_KEY) ?? env.SMTP_FROM,
  };

  cachedConfig = { data, fetchedAt: Date.now() };
  return data;
}

export async function sendEmailNotification(to: string, subject: string, htmlContent: string) {
  const config = await resolveSmtpConfig();

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: env.SMTP_PASS } : undefined,
  });

  try {
    await transport.sendMail({
      from: `"Utama Memo System" <${config.from}>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log(`[MAILER] Sent email to ${to}: ${subject}`);
  } catch (error) {
    console.error(`[MAILER_ERROR] Failed to send email to ${to}:`, error);
    throw error;
  }
}
