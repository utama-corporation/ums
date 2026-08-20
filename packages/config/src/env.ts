import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

function findRepoRootEnvFile(): string | undefined {
  let dir = process.cwd();

  // Bounded instead of `while (true)` so this can't spin forever on an unexpected path shape;
  // 64 levels is far deeper than any real directory tree we'd be invoked from.
  for (let depth = 0; depth < 64; depth++) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) return candidate;
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return undefined;

    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }

  return undefined;
}

dotenv.config({ path: findRepoRootEnvFile() });

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5500),
  WEB_PORT: z.coerce.number().default(5000),

  APP_URL: z.string().url().default("http://localhost:5000"),
  API_URL: z.string().url().default("http://localhost:5500"),

  DATABASE_URL: z.string().min(1).default("postgresql://ums_user:ums_password@localhost:5432/ums_db?schema=public"),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(""),

  SESSION_SECRET: z.string().min(16).default("dev_super_secret_session_key_change_in_production_32chars"),

  // Overrides the auth cookies' `Secure` flag independently of NODE_ENV. Browsers silently
  // drop `Secure` cookies on plain HTTP, so a production deploy not yet behind HTTPS needs
  // this set to "false" — otherwise login "succeeds" (200 with tokens) but no session
  // cookie is ever stored, and every page bounces back to /login. Leave unset to keep the
  // safe default (secure=true whenever NODE_ENV=production).
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),

  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("ums-attachments"),
  S3_ACCESS_KEY: z.string().default("minioadmin"),
  S3_SECRET_KEY: z.string().default("minioadmin"),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().default("Utama Memo System <noreply@utama.co.id>"),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // External HR employee directory (source of truth for who is allowed a UMS account).
  EMPLOYEE_API_BASE_URL: z.string().url().default("https://emp.padmoasm.com/api/v1/q"),
  EMPLOYEE_API_TOKEN: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

const DEFAULT_SESSION_SECRET = "dev_super_secret_session_key_change_in_production_32chars";

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", JSON.stringify(result.error.format(), null, 2));
    throw new Error("Invalid environment configuration.");
  }

  // The dev default is checked into source control, so it's a known value —
  // if it's still active in production, every JWT this process ever signs or
  // verifies can be forged by anyone. Docker Compose already refuses to boot
  // without POSTGRES_PASSWORD/S3_ACCESS_KEY/S3_SECRET_KEY set (`${VAR:?...}`);
  // this closes the same gap for SESSION_SECRET, which had no such guard.
  if (result.data.NODE_ENV === "production" && result.data.SESSION_SECRET === DEFAULT_SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET is still set to the development default in a production environment. " +
        "Set a real secret in .env.production (e.g. `openssl rand -hex 32`) before starting the API."
    );
  }

  return result.data;
}

export const env = validateEnv();
