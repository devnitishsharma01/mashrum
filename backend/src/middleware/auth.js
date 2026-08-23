"use strict";

const { docToObject, toId } = require("../db");
const { User } = require("../models");
const { AppError } = require("../lib/errors");

async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    const cookieToken = req.cookies?.access_token;
    const token = bearer || cookieToken;

    if (!token) {
      throw new AppError(401, "Authentication required", "UNAUTHORIZED");
    }

    const { verifyAccessToken } = require("../lib/tokens");
    const payload = verifyAccessToken(token);
    const userDoc = await User.findOne({
      _id: payload.sub,
      businessId: payload.businessId,
      isActive: true,
    }).select("businessId role email name");

    if (!userDoc) {
      throw new AppError(401, "Invalid session", "UNAUTHORIZED");
    }

    const user = docToObject(userDoc);
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

function requirePermission(permission) {
  const { hasPermission } = require("../shared");
  return (req, _res, next) => {
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

function tenantId(req) {
  if (!req.user?.businessId) {
    throw new AppError(401, "Authentication required", "UNAUTHORIZED");
  }
  return req.user.businessId;
}

module.exports = {
  requireAuth,
  requirePermission,
  tenantId,
};
