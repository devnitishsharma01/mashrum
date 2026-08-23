"use strict";

const bcrypt = require("bcryptjs");
const { docToObject, withTransaction, sessionOpts, toId } = require("../db");
const {
  Business,
  User,
  RefreshToken,
  MessageTemplate,
  AutomationRule,
  AuditLog,
} = require("../models");
const { DEFAULT_WORKING_HOURS } = require("../shared");
const { env } = require("../config/env");
const { sha256, randomToken } = require("../lib/crypto");
const { AppError } = require("../lib/errors");
const { uniqueSlug } = require("../lib/slug");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../lib/tokens");

function refreshExpiryDate() {
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

async function issueSession(user) {
  const accessToken = signAccessToken({
    sub: user.id,
    businessId: user.businessId,
    role: user.role,
    email: user.email,
  });

  const refreshToken = signRefreshToken({ sub: user.id, jti: randomToken(16) });
  await RefreshToken.create({
    businessId: user.businessId,
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: refreshExpiryDate(),
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

const MESSAGE_TEMPLATES = [
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
];

const AUTOMATION_RULES = [
  { event: "CUSTOMER_FIRST_MESSAGE", templateKey: "WELCOME" },
  { event: "ORDER_CONFIRMED", templateKey: "ORDER_CONFIRMED" },
  { event: "ORDER_STATUS_CHANGED", templateKey: "ORDER_STATUS" },
];

async function registerBusiness(input) {
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) {
    throw new AppError(409, "Email is already registered", "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const slug = uniqueSlug(input.businessName, randomToken(3).slice(0, 6));

  const result = await withTransaction(async (session) => {
    const opts = sessionOpts(session);
    const business = await Business.create(
      [
        {
          name: input.businessName,
          slug,
          timezone: input.timezone,
          currency: input.currency,
          workingHours: DEFAULT_WORKING_HOURS,
        },
      ],
      opts,
    ).then((docs) => docs[0]);

    const businessId = business._id;

    await MessageTemplate.insertMany(
      MESSAGE_TEMPLATES.map((t) => ({
        businessId,
        key: t.key,
        name: t.name,
        body: t.body,
      })),
      opts,
    );

    await AutomationRule.insertMany(
      AUTOMATION_RULES.map((r) => ({
        businessId,
        event: r.event,
        templateKey: r.templateKey,
      })),
      opts,
    );

    const user = await User.create(
      [
        {
          businessId,
          email,
          passwordHash,
          name: input.name,
          role: "OWNER",
        },
      ],
      opts,
    ).then((docs) => docs[0]);

    await AuditLog.create(
      [
        {
          businessId,
          actorUserId: user._id,
          action: "BUSINESS_REGISTERED",
          entity: "Business",
          entityId: businessId,
        },
      ],
      opts,
    );

    return {
      business: { id: businessId.toString(), name: input.businessName, slug },
      user: docToObject(user),
    };
  });

  const session = await issueSession(result.user);
  return {
    ...session,
    business: result.business,
  };
}

async function loginUser(input) {
  const email = input.email.toLowerCase();
  const userDoc = await User.findOne({ email, isActive: true });
  if (!userDoc) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const user = docToObject(userDoc);
  const valid = await bcrypt.compare(input.password, userDoc.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const business = await Business.findOne({ _id: user.businessId, status: "ACTIVE" })
    .select("id name slug")
    .lean();
  if (!business) {
    throw new AppError(403, "Business is not active", "BUSINESS_INACTIVE");
  }

  const session = await issueSession(user);
  return {
    ...session,
    business: { id: business._id.toString(), name: business.name, slug: business.slug },
  };
}

async function refreshSession(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "Invalid refresh token", "UNAUTHORIZED");
  }

  const tokenHash = sha256(refreshToken);
  const stored = await RefreshToken.findOne({
    tokenHash,
    userId: payload.sub,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!stored) {
    throw new AppError(401, "Refresh token revoked or expired", "UNAUTHORIZED");
  }

  await RefreshToken.updateOne({ _id: stored._id }, { revokedAt: new Date() });

  const userDoc = await User.findOne({ _id: payload.sub, isActive: true });
  if (!userDoc) {
    throw new AppError(401, "User not found", "UNAUTHORIZED");
  }

  return issueSession(docToObject(userDoc));
}

async function logoutSession(refreshToken) {
  if (!refreshToken) return;
  await RefreshToken.updateMany(
    { tokenHash: sha256(refreshToken), revokedAt: null },
    { revokedAt: new Date() },
  );
}

async function getCurrentUser(userId, businessId) {
  const userDoc = await User.findOne({
    _id: toId(userId),
    businessId: toId(businessId),
    isActive: true,
  });
  if (!userDoc) {
    throw new AppError(404, "User not found", "NOT_FOUND");
  }

  const businessDoc = await Business.findById(userDoc.businessId).select(
    "name slug timezone currency codEnabled",
  );
  const user = docToObject(userDoc);
  const business = docToObject(businessDoc);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    businessId: user.businessId,
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      timezone: business.timezone,
      currency: business.currency,
      codEnabled: business.codEnabled,
    },
  };
}

module.exports = {
  registerBusiness,
  loginUser,
  refreshSession,
  logoutSession,
  getCurrentUser,
};
