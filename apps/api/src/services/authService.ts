import { prisma } from "@ums/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "@ums/config";
import { UnauthorizedError, ForbiddenError, PasswordNotSetError } from "../errors/AppError.js";
import { logAuditEvent } from "./auditService.js";
import { getSecurityPolicy } from "./settingsService.js";
import { UserProfile } from "@ums/contracts";

export interface TokenPayload {
  userId: string;
  email: string;
  sessionId: string;
}

export function hashString(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function generateAccessToken(payload: TokenPayload, accessTokenTtlMinutes: number): string {
  return jwt.sign(payload, env.SESSION_SECRET, { expiresIn: `${accessTokenTtlMinutes}m` });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function loginUser(username: string, passwordPlain: string, ipAddress?: string, userAgent?: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      credentials: true,
      department: true,
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    await prisma.loginAttempt.create({
      data: { userId: user?.id || null, username, success: false, ipAddress, userAgent },
    });
    await logAuditEvent({ action: "LOGIN_FAILED", module: "auth", resourceType: "User", ipAddress, userAgent });
    throw new UnauthorizedError("Invalid username or password");
  }

  if (!user.credentials) {
    // Not a failed login attempt in the usual sense — the account is real and active, it
    // just hasn't had a password set yet (see userService.createUser / setInitialPassword).
    throw new PasswordNotSetError();
  }

  const passwordValid = await bcrypt.compare(passwordPlain, user.credentials.passwordHash);
  if (!passwordValid) {
    await prisma.loginAttempt.create({
      data: { userId: user.id, username, success: false, ipAddress, userAgent },
    });
    await logAuditEvent({ actorId: user.id, action: "LOGIN_FAILED", module: "auth", resourceType: "User", ipAddress, userAgent });
    throw new UnauthorizedError("Invalid username or password");
  }

  const policy = await getSecurityPolicy();
  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = hashString(rawRefreshToken);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + policy.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.loginAttempt.create({
    data: { userId: user.id, username, success: true, ipAddress, userAgent },
  });

  await logAuditEvent({
    actorId: user.id,
    action: "LOGIN_SUCCESS",
    module: "auth",
    resourceType: "Session",
    resourceId: session.id,
    ipAddress,
    userAgent,
  });

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, sessionId: session.id }, policy.accessTokenTtlMinutes);

  return { accessToken, refreshToken: rawRefreshToken, session };
}

export async function refreshSession(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
  const hash = hashString(rawRefreshToken);

  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: hash },
    include: { user: true },
  });

  if (!session) {
    throw new ForbiddenError("Invalid or compromised refresh token");
  }

  if (session.revokedAt || session.expiresAt < new Date()) {
    // Token reuse detection! Revoke all sessions for security
    await prisma.session.updateMany({
      where: { userId: session.userId },
      data: { revokedAt: new Date() },
    });
    await logAuditEvent({
      actorId: session.userId,
      action: "TOKEN_REUSE_DETECTED_ALL_SESSIONS_REVOKED",
      module: "auth",
      resourceType: "Session",
      ipAddress,
      userAgent,
    });
    throw new ForbiddenError("Refresh token revoked or expired. All sessions terminated.");
  }

  const policy = await getSecurityPolicy();

  // Rotate token
  const newRawRefreshToken = generateRefreshToken();
  const newHash = hashString(newRawRefreshToken);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newHash,
      expiresAt: new Date(Date.now() + policy.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = generateAccessToken(
    {
      userId: session.userId,
      email: session.user.email,
      sessionId: session.id,
    },
    policy.accessTokenTtlMinutes,
  );

  return { accessToken, refreshToken: newRawRefreshToken };
}

export async function logoutSession(sessionId: string, actorId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
  await logAuditEvent({ actorId, action: "LOGOUT", module: "auth", resourceType: "Session", resourceId: sessionId });
}

export async function logoutAllUserSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await logAuditEvent({ actorId: userId, action: "LOGOUT_ALL_SESSIONS", module: "auth", resourceType: "Session" });
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError("User inactive or not found");
  }

  const roleNames = user.userRoles.map((ur) => ur.role.name);
  const permissionSet = new Set<string>();

  for (const ur of user.userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permissionSet.add(rp.permission.code);
    }
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    employeeId: user.employeeId,
    mobilePhone: user.mobilePhone,
    companyId: user.companyId,
    departmentId: user.departmentId,
    departmentName: user.department?.name || null,
    position: user.position,
    roles: roleNames,
    permissions: Array.from(permissionSet),
    isActive: user.isActive,
  };
}
