import bcrypt from "bcryptjs";
import { prisma } from "@mashrum/database";
import {
  DEFAULT_WORKING_HOURS,
  type LoginInput,
  type RegisterInput,
} from "@mashrum/shared";
import { env } from "../config/env";
import { randomToken, sha256 } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { uniqueSlug } from "../lib/slug";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/tokens";

function refreshExpiryDate(): Date {
  const match = /^(\d+)([dhms])$/.exec(env.JWT_REFRESH_EXPIRES_IN);
  const amount = match ? Number(match[1]) : 7;
  const unit = match?.[2] ?? "d";
  const ms =
    unit === "d"
      ? amount * 24 * 60 * 60 * 1000
      : unit === "h"
        ? amount * 60 * 60 * 1000
        : unit === "m"
          ? amount * 60 * 1000
          : amount * 1000;
  return new Date(Date.now() + ms);
}

async function issueSession(user: {
  id: string;
  businessId: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  email: string;
  name: string;
}) {
  const accessToken = signAccessToken({
    sub: user.id,
    businessId: user.businessId,
    role: user.role,
    email: user.email,
  });

  const jti = randomToken(16);
  const refreshToken = signRefreshToken({ sub: user.id, jti });
  await prisma.refreshToken.create({
    data: {
      businessId: user.businessId,
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: refreshExpiryDate(),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      businessId: user.businessId,
    },
  };
}

export async function registerBusiness(input: RegisterInput) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { email },
  });
  if (existing) {
    throw new AppError(409, "Email is already registered", "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const slug = uniqueSlug(input.businessName, randomToken(3).slice(0, 6));

  const result = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: input.businessName,
        slug,
        timezone: input.timezone,
        currency: input.currency,
        workingHours: DEFAULT_WORKING_HOURS,
        messageTemplates: {
          create: [
            {
              key: "WELCOME",
              name: "Welcome",
              body: "Welcome to {{business_name}}! Reply with *menu* to browse our catalog.",
            },
            {
              key: "ORDER_CONFIRMED",
              name: "Order Confirmed",
              body: "Your order {{order_number}} has been confirmed. We will update you shortly.",
            },
            {
              key: "ORDER_STATUS",
              name: "Order Status",
              body: "Order {{order_number}} status: {{status}}.",
            },
          ],
        },
        automationRules: {
          create: [
            { event: "CUSTOMER_FIRST_MESSAGE", templateKey: "WELCOME" },
            { event: "ORDER_CONFIRMED", templateKey: "ORDER_CONFIRMED" },
            { event: "ORDER_STATUS_CHANGED", templateKey: "ORDER_STATUS" },
          ],
        },
      },
    });

    const user = await tx.user.create({
      data: {
        businessId: business.id,
        email,
        passwordHash,
        name: input.name,
        role: "OWNER",
      },
    });

    await tx.auditLog.create({
      data: {
        businessId: business.id,
        actorUserId: user.id,
        action: "BUSINESS_REGISTERED",
        entity: "Business",
        entityId: business.id,
      },
    });

    return { business, user };
  });

  const session = await issueSession(result.user);
  return {
    ...session,
    business: {
      id: result.business.id,
      name: result.business.name,
      slug: result.business.slug,
    },
  };
}

export async function loginUser(input: LoginInput) {
  const email = input.email.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
  });

  if (!user) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const business = await prisma.business.findFirst({
    where: { id: user.businessId, status: "ACTIVE" },
  });
  if (!business) {
    throw new AppError(403, "Business is not active", "BUSINESS_INACTIVE");
  }

  const session = await issueSession(user);
  return {
    ...session,
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
    },
  };
}

export async function refreshSession(refreshToken: string) {
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid refresh token", "UNAUTHORIZED");
  }

  const tokenHash = sha256(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      userId: payload.sub,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!stored) {
    throw new AppError(401, "Refresh token revoked or expired", "UNAUTHORIZED");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, isActive: true },
  });
  if (!user) {
    throw new AppError(401, "User not found", "UNAUTHORIZED");
  }

  return issueSession(user);
}

export async function logoutSession(refreshToken?: string) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getCurrentUser(userId: string, businessId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, businessId, isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      businessId: true,
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          currency: true,
          codEnabled: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, "User not found", "NOT_FOUND");
  }

  return user;
}
