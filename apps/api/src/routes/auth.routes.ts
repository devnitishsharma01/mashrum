import { Router } from "express";
import { loginSchema, registerSchema } from "@mashrum/shared";
import { env } from "../config/env";
import { requireAuth, tenantId } from "../middleware/auth";
import {
  getCurrentUser,
  loginUser,
  logoutSession,
  refreshSession,
  registerBusiness,
} from "../services/auth.service";

export const authRouter = Router();

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

authRouter.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await registerBusiness(input);

    res
      .cookie("access_token", result.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refresh_token", result.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(201)
      .json({
        data: {
          user: result.user,
          business: result.business,
          accessToken: result.accessToken,
        },
      });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);

    res
      .cookie("access_token", result.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refresh_token", result.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        data: {
          user: result.user,
          business: result.business,
          accessToken: result.accessToken,
        },
      });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken =
      (req.cookies?.refresh_token as string | undefined) ||
      (req.body?.refreshToken as string | undefined);

    if (!refreshToken) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Refresh token required" },
      });
      return;
    }

    const result = await refreshSession(refreshToken);
    res
      .cookie("access_token", result.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refresh_token", result.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    await logoutSession(refreshToken);
    res
      .clearCookie("access_token", cookieOptions)
      .clearCookie("refresh_token", cookieOptions)
      .json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await getCurrentUser(req.user!.id, tenantId(req));
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});
