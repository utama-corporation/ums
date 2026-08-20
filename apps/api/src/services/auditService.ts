import { prisma } from "@ums/db";

export interface AuditParams {
  actorId?: string;
  action: string;
  module: string;
  resourceType: string;
  resourceId?: string;
  memoNumber?: string;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

function redactSensitiveData(data: unknown): string | null {
  if (!data) return null;
  const jsonString = JSON.stringify(data, (key, value) => {
    if (["password", "pin", "token", "secret", "refreshToken", "signatureBinary"].includes(key.toLowerCase())) {
      return "[REDACTED]";
    }
    return value;
  });
  return jsonString;
}

export async function logAuditEvent(params: AuditParams): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: params.actorId || null,
        action: params.action,
        module: params.module,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        memoNumber: params.memoNumber || null,
        beforeJson: redactSensitiveData(params.beforeData),
        afterJson: redactSensitiveData(params.afterData),
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        requestId: params.requestId || null,
      },
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}
