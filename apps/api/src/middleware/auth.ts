import type { NextFunction, Request, Response } from "express";
import type { Permission, UserRole } from "@mashrum/shared";
import { hasPermission } from "@mashrum/shared";
import { prisma } from "@mashrum/database";
import { AppError } from "../lib/errors";
import { verifyAccessToken } from "../lib/tokens";

export type AuthUser = {
  id: string;
  businessId: string;
  role: UserRole;
  email: string;
  name: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    const bearer =
      header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    const cookieToken = req.cookies?.access_token as string | undefined;
    const token = bearer || cookieToken;

    if (!token) {
      throw new AppError(401, "Authentication required", "UNAUTHORIZED");
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        businessId: payload.businessId,
        isActive: true,
      },
      select: {
        id: true,
        businessId: true,
        role: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new AppError(401, "Invalid session", "UNAUTHORIZED");
    }

    req.user = {
      id: user.id,
      businessId: user.businessId,
      role: user.role,
      email: user.email,
      name: user.name,
    };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError(401, "Invalid or expired token", "UNAUTHORIZED"));
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
      return;
    }
    if (!hasPermission(req.user.role, permission)) {
      next(new AppError(403, "Forbidden", "FORBIDDEN"));
      return;
    }
    next();
  };
}

/** Always scope by JWT businessId — never trust client-supplied tenant IDs. */
export function tenantId(req: Request): string {
  if (!req.user?.businessId) {
    throw new AppError(401, "Authentication required", "UNAUTHORIZED");
  }
  return req.user.businessId;
}
