import { Router, Request, Response, NextFunction } from "express";
import { loginUser, refreshSession, logoutSession, logoutAllUserSessions, getUserProfile } from "../services/authService.js";
import { LoginRequestSchema } from "@ums/contracts";
import { authenticate, authRateLimiter, refreshRateLimiter } from "../middleware/authMiddleware.js";
import { env } from "@ums/config";

export const authRouter: Router = Router();

const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

authRouter.post("/login", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = LoginRequestSchema.parse(req.body);
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString();
    const userAgent = req.headers["user-agent"];

    const { accessToken, refreshToken } = await loginUser(input.username, input.password, ip, userAgent);

    res.cookie("access_token", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15 mins
    res.cookie("refresh_token", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days

    // Tokens are set as httpOnly cookies above and never read from this body by the
    // first-party frontend — returning them here too would just be an unnecessary
    // exposure surface (proxies/APM/devtools network history) for no functional gain.
    res.status(200).json({
      success: true,
      message: "Login successful",
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", refreshRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRefreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
    if (!rawRefreshToken) {
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Refresh token missing" } });
    }

    const ip = req.ip || req.headers["x-forwarded-for"]?.toString();
    const userAgent = req.headers["user-agent"];

    const { accessToken, refreshToken } = await refreshSession(rawRefreshToken, ip, userAgent);

    res.cookie("access_token", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie("refresh_token", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
    });
  } catch (error) {
    res.clearCookie("access_token", cookieOptions);
    res.clearCookie("refresh_token", cookieOptions);
    next(error);
  }
});

authRouter.post("/logout", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.sessionId && req.user) {
      await logoutSession(req.sessionId, req.user.id);
    }
    res.clearCookie("access_token", cookieOptions);
    res.clearCookie("refresh_token", cookieOptions);

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout-all", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user) {
      await logoutAllUserSessions(req.user.id);
    }
    res.clearCookie("access_token", cookieOptions);
    res.clearCookie("refresh_token", cookieOptions);

    res.status(200).json({
      success: true,
      message: "Logged out from all sessions",
    });
  } catch (error) {
    next(error);
  }
});

// `GET /me` is intentionally not nested under this router's `/auth` mount point —
// the API contract places it at the top-level `/api/v1/me`, see meRouter below.
export const meRouter: Router = Router();

meRouter.get("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    const profile = await getUserProfile(req.user.id);
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});
