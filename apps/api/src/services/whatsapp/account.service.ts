import { prisma } from "@mashrum/database";
import type { ConnectWhatsAppInput } from "@mashrum/shared";
import { encryptSecret, sha256 } from "../../lib/crypto";
import { AppError } from "../../lib/errors";

export async function getWhatsAppStatus(businessId: string) {
  const account = await prisma.whatsAppAccount.findUnique({
    where: { businessId },
    select: {
      id: true,
      phoneNumberId: true,
      displayPhone: true,
      wabaId: true,
      status: true,
      lastError: true,
      connectedAt: true,
      updatedAt: true,
    },
  });

  return {
    connected: account?.status === "CONNECTED",
    account,
  };
}

export async function connectWhatsApp(
  businessId: string,
  actorUserId: string,
  input: ConnectWhatsAppInput,
) {
  const phoneTaken = await prisma.whatsAppAccount.findFirst({
    where: {
      phoneNumberId: input.phoneNumberId,
      NOT: { businessId },
    },
  });
  if (phoneTaken) {
    throw new AppError(
      409,
      "This WhatsApp phone number is already connected to another business",
      "PHONE_IN_USE",
    );
  }

  const account = await prisma.whatsAppAccount.upsert({
    where: { businessId },
    create: {
      businessId,
      phoneNumberId: input.phoneNumberId,
      accessTokenEncrypted: encryptSecret(input.accessToken),
      webhookVerifyTokenHash: sha256(input.webhookVerifyToken),
      wabaId: input.wabaId ?? null,
      displayPhone: input.displayPhone ?? null,
      status: "CONNECTED",
      lastError: null,
      connectedAt: new Date(),
    },
    update: {
      phoneNumberId: input.phoneNumberId,
      accessTokenEncrypted: encryptSecret(input.accessToken),
      webhookVerifyTokenHash: sha256(input.webhookVerifyToken),
      wabaId: input.wabaId ?? null,
      displayPhone: input.displayPhone ?? null,
      status: "CONNECTED",
      lastError: null,
      connectedAt: new Date(),
    },
    select: {
      id: true,
      phoneNumberId: true,
      displayPhone: true,
      wabaId: true,
      status: true,
      connectedAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "WHATSAPP_CONNECTED",
      entity: "WhatsAppAccount",
      entityId: account.id,
      meta: { phoneNumberId: account.phoneNumberId },
    },
  });

  return account;
}

export async function disconnectWhatsApp(
  businessId: string,
  actorUserId: string,
) {
  const existing = await prisma.whatsAppAccount.findUnique({
    where: { businessId },
  });
  if (!existing) {
    throw new AppError(404, "WhatsApp account not connected", "NOT_FOUND");
  }

  const account = await prisma.whatsAppAccount.update({
    where: { businessId },
    data: {
      status: "DISCONNECTED",
      lastError: null,
    },
    select: {
      id: true,
      phoneNumberId: true,
      status: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      actorUserId,
      action: "WHATSAPP_DISCONNECTED",
      entity: "WhatsAppAccount",
      entityId: account.id,
    },
  });

  return account;
}

export async function findAccountByPhoneNumberId(phoneNumberId: string) {
  return prisma.whatsAppAccount.findFirst({
    where: { phoneNumberId, status: "CONNECTED" },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          currency: true,
          codEnabled: true,
          status: true,
        },
      },
    },
  });
}

export async function findAccountByVerifyToken(token: string) {
  const hash = sha256(token);
  return prisma.whatsAppAccount.findFirst({
    where: { webhookVerifyTokenHash: hash, status: "CONNECTED" },
  });
}
