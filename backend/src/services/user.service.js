"use strict";

const bcrypt = require("bcryptjs");
const { docToObject, toId } = require("../db");
const { User, AuditLog } = require("../models");
const { env } = require("../config/env");
const { AppError } = require("../lib/errors");

async function listUsers(businessId) {
  const users = await User.find({ businessId: toId(businessId) })
    .select("name email role isActive createdAt updatedAt")
    .sort({ role: 1, createdAt: 1 })
    .lean();
  return users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));
}

async function createUser(businessId, actorUserId, input) {
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) {
    throw new AppError(409, "Email is already registered", "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const userDoc = await User.create({
    businessId: toId(businessId),
    email,
    name: input.name,
    role: input.role,
    passwordHash,
  });

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "USER_CREATED",
    entity: "User",
    entityId: userDoc._id,
    meta: { role: input.role, email },
  });

  return docToObject(userDoc);
}

async function updateUser(businessId, actorUserId, userId, input) {
  const existing = await User.findOne({
    _id: toId(userId),
    businessId: toId(businessId),
  });
  if (!existing) {
    throw new AppError(404, "User not found", "NOT_FOUND");
  }

  if (
    existing.role === "OWNER" &&
    ((input.role && input.role !== "OWNER") || input.isActive === false)
  ) {
    const ownerCount = await User.countDocuments({
      businessId: toId(businessId),
      role: "OWNER",
      isActive: true,
    });
    if (ownerCount <= 1) {
      throw new AppError(400, "Cannot remove or demote the last owner", "LAST_OWNER");
    }
  }

  if (userId === actorUserId && input.isActive === false) {
    throw new AppError(400, "You cannot deactivate yourself", "INVALID");
  }

  if (input.name != null) existing.name = input.name;
  if (input.role != null) existing.role = input.role;
  if (input.isActive != null) existing.isActive = input.isActive;
  if (input.password) {
    existing.passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  }

  await existing.save();

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "USER_UPDATED",
    entity: "User",
    entityId: existing._id,
    meta: input,
  });

  return docToObject(existing);
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
};
