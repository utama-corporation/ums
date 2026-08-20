import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { env } from "@ums/config";
import { UnauthorizedError, ForbiddenError } from "../errors/AppError.js";
import { getUserProfile, TokenPayload } from "../services/authService.js";
import { UserProfile } from "@ums/contracts";
import { prisma } from "@ums/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserProfile;
      sessionId?: string;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    let token: string | undefined = req.cookies?.access_token;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new UnauthorizedError("Authentication token missing");
    }

    const decoded = jwt.verify(token, env.SESSION_SECRET) as TokenPayload;

    // Check if session is active and not revoked
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedError("Session expired or revoked");
    }

    const userProfile = await getUserProfile(decoded.userId);
    req.user = userProfile;
    req.sessionId = decoded.sessionId;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError("Invalid authentication token"));
    }
  }
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("User not authenticated"));
    }

    const hasPermission = permissions.some((p) => req.user?.permissions.includes(p));
    if (!hasPermission) {
      return next(new ForbiddenError(`Permission denied: requires [${permissions.join(", ")}]`));
    }

    next();
  };
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many login attempts. Please try again after 15 minutes.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Refresh happens automatically every ~15 minutes for every active session (access tokens are
// short-lived by design), so many legitimate users behind one shared office IP/NAT can
// plausibly exceed a login-strength limit here — this exists to blunt scripted refresh-token
// guessing/replay, not to throttle normal traffic, hence the much higher ceiling than login.
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many token refresh attempts. Please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset sets new credentials — infrequent, sensitive, already admin-gated by
// requirePermission("master.user.manage"), but still worth throttling per IP.
export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many password reset attempts. Please try again later.",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
