"use strict";

const { docToObject, toId } = require("../../db");
const { WhatsAppAccount, Business, AuditLog } = require("../../models");
const { encryptSecret, sha256 } = require("../../lib/crypto");
const { AppError } = require("../../lib/errors");

async function getWhatsAppStatus(businessId) {
  const accountDoc = await WhatsAppAccount.findOne({ businessId: toId(businessId) }).lean();
  const account = accountDoc
    ? {
        id: accountDoc._id.toString(),
        phoneNumberId: accountDoc.phoneNumberId,
        displayPhone: accountDoc.displayPhone,
        wabaId: accountDoc.wabaId,
        status: accountDoc.status,
        lastError: accountDoc.lastError,
        connectedAt: accountDoc.connectedAt,
        updatedAt: accountDoc.updatedAt,
      }
    : null;

  return {
    connected: account?.status === "CONNECTED",
    account,
  };
}

async function connectWhatsApp(businessId, actorUserId, input) {
  const phoneTaken = await WhatsAppAccount.findOne({
    phoneNumberId: input.phoneNumberId,
    businessId: { $ne: toId(businessId) },
  })
    .select("_id")
    .lean();
  if (phoneTaken) {
    throw new AppError(
      409,
      "This WhatsApp phone number is already connected to another business",
      "PHONE_IN_USE",
    );
  }

  const accountDoc = await WhatsAppAccount.findOneAndUpdate(
    { businessId: toId(businessId) },
    {
      businessId: toId(businessId),
      phoneNumberId: input.phoneNumberId,
      accessTokenEncrypted: encryptSecret(input.accessToken),
      webhookVerifyTokenHash: sha256(input.webhookVerifyToken),
      wabaId: input.wabaId ?? null,
      displayPhone: input.displayPhone ?? null,
      status: "CONNECTED",
      lastError: null,
      connectedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "WHATSAPP_CONNECTED",
    entity: "WhatsAppAccount",
    entityId: accountDoc._id,
    meta: { phoneNumberId: accountDoc.phoneNumberId },
  });

  return docToObject(accountDoc);
}

async function disconnectWhatsApp(businessId, actorUserId) {
  const existing = await WhatsAppAccount.findOne({ businessId: toId(businessId) })
    .select("_id")
    .lean();
  if (!existing) {
    throw new AppError(404, "WhatsApp account not connected", "NOT_FOUND");
  }

  const accountDoc = await WhatsAppAccount.findOneAndUpdate(
    { businessId: toId(businessId) },
    { status: "DISCONNECTED", lastError: null },
    { new: true },
  );

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "WHATSAPP_DISCONNECTED",
    entity: "WhatsAppAccount",
    entityId: accountDoc._id,
  });

  return docToObject(accountDoc);
}

async function findAccountByPhoneNumberId(phoneNumberId) {
  const accountDoc = await WhatsAppAccount.findOne({
    phoneNumberId,
    status: "CONNECTED",
  }).lean();
  if (!accountDoc) return null;

  const businessDoc = await Business.findById(accountDoc.businessId)
    .select("name currency codEnabled status")
    .lean();

  const account = {
    id: accountDoc._id.toString(),
    businessId: accountDoc.businessId.toString(),
    phoneNumberId: accountDoc.phoneNumberId,
    displayPhone: accountDoc.displayPhone,
    wabaId: accountDoc.wabaId,
    status: accountDoc.status,
    accessTokenEncrypted: accountDoc.accessTokenEncrypted,
    webhookVerifyTokenHash: accountDoc.webhookVerifyTokenHash,
    business: businessDoc
      ? {
          id: businessDoc._id.toString(),
          name: businessDoc.name,
          currency: businessDoc.currency,
          codEnabled: businessDoc.codEnabled,
          status: businessDoc.status,
        }
      : null,
  };
  return account;
}

async function findAccountByVerifyToken(token) {
  const hash = sha256(token);
  const accountDoc = await WhatsAppAccount.findOne({
    webhookVerifyTokenHash: hash,
    status: "CONNECTED",
  }).lean();
  return accountDoc ? docToObject(accountDoc) : null;
}

module.exports = {
  getWhatsAppStatus,
  connectWhatsApp,
  disconnectWhatsApp,
  findAccountByPhoneNumberId,
  findAccountByVerifyToken,
};
