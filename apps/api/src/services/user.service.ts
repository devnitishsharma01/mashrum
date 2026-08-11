import bcrypt from "bcryptjs";
import { prisma } from "@mashrum/database";
import type { CreateUserInput, UpdateUserInput } from "@mashrum/shared";
import { env } from "../config/env";
import { AppError } from "../lib/errors";

export async function listUsers(businessId: string) {
  return prisma.user.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

export async function createUser(
  businessId: string,
  actorUserId: string,
  input: CreateUserInput,
) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    throw new AppError(409, "Email is already registered", "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      businessId,
      email,
      name: input.name,
      role: input.role,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "USER_CREATED",
      entity: "User",
      entityId: user.id,
      meta: { role: user.role, email: user.email },
    },
  });

  return user;
}

export async function updateUser(
  businessId: string,
  actorUserId: string,
  userId: string,
  input: UpdateUserInput,
) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, businessId },
  });
  if (!existing) {
    throw new AppError(404, "User not found", "NOT_FOUND");
  }

  if (
    existing.role === "OWNER" &&
    ((input.role && input.role !== "OWNER") || input.isActive === false)
  ) {
    const ownerCount = await prisma.user.count({
      where: { businessId, role: "OWNER", isActive: true },
    });
    if (ownerCount <= 1) {
      throw new AppError(
        400,
        "Cannot remove or demote the last owner",
        "LAST_OWNER",
      );
    }
  }

  if (userId === actorUserId && input.isActive === false) {
    throw new AppError(400, "You cannot deactivate yourself", "INVALID");
  }

  const passwordHash = input.password
    ? await bcrypt.hash(input.password, env.BCRYPT_ROUNDS)
    : undefined;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      role: input.role,
      isActive: input.isActive,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "USER_UPDATED",
      entity: "User",
      entityId: userId,
      meta: input,
    },
  });

  return user;
}
