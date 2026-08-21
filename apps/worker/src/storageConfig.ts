import { S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@ums/db";
import { env, decryptSecret } from "@ums/config";

// The API and worker are separate processes, so this mirrors settingsService's
// resolveS3StorageConfig() rather than importing it — same SystemSetting keys, same
// env fallback, same "decrypt the secret key with @ums/config's shared crypto" approach.
const S3_ENDPOINT_KEY = "s3.endpoint";
const S3_REGION_KEY = "s3.region";
const S3_BUCKET_KEY = "s3.bucket";
const S3_ACCESS_KEY_KEY = "s3.access_key";
const S3_SECRET_KEY_KEY = "s3.secret_key";
const S3_FORCE_PATH_STYLE_KEY = "s3.force_path_style";
const S3_KEYS = [S3_ENDPOINT_KEY, S3_REGION_KEY, S3_BUCKET_KEY, S3_ACCESS_KEY_KEY, S3_SECRET_KEY_KEY, S3_FORCE_PATH_STYLE_KEY];

interface ResolvedS3Config {
  bucket: string;
  client: S3Client;
}

let cachedConfig: { data: ResolvedS3Config; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000;

export async function getS3ClientAndBucket(): Promise<ResolvedS3Config> {
  if (cachedConfig && Date.now() - cachedConfig.fetchedAt < CACHE_TTL_MS) {
    return cachedConfig.data;
  }

  const rows = await prisma.systemSetting.findMany({ where: { key: { in: S3_KEYS } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const encryptedSecret = byKey.get(S3_SECRET_KEY_KEY);

  const client = new S3Client({
    endpoint: byKey.get(S3_ENDPOINT_KEY) ?? env.S3_ENDPOINT,
    region: byKey.get(S3_REGION_KEY) ?? env.S3_REGION,
    credentials: {
      accessKeyId: byKey.get(S3_ACCESS_KEY_KEY) ?? env.S3_ACCESS_KEY,
      secretAccessKey: encryptedSecret ? decryptSecret(encryptedSecret) : env.S3_SECRET_KEY,
    },
    forcePathStyle: byKey.has(S3_FORCE_PATH_STYLE_KEY) ? byKey.get(S3_FORCE_PATH_STYLE_KEY) === "true" : env.S3_FORCE_PATH_STYLE,
  });

  const data: ResolvedS3Config = { client, bucket: byKey.get(S3_BUCKET_KEY) ?? env.S3_BUCKET };
  cachedConfig = { data, fetchedAt: Date.now() };
  return data;
}
