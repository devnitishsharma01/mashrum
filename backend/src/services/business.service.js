"use strict";

const { docToObject, toId } = require("../db");
const { Business, WhatsAppAccount, AuditLog } = require("../models");
const { AppError } = require("../lib/errors");

async function getBusiness(businessId) {
  const businessDoc = await Business.findById(toId(businessId));
  if (!businessDoc) {
    throw new AppError(404, "Business not found", "NOT_FOUND");
  }

  const waDoc = await WhatsAppAccount.findOne({ businessId: businessDoc._id }).lean();
  const business = docToObject(businessDoc);

  business.whatsappAccount = waDoc
    ? {
        id: waDoc._id.toString(),
        displayPhone: waDoc.displayPhone,
        phoneNumberId: waDoc.phoneNumberId,
        status: waDoc.status,
        connectedAt: waDoc.connectedAt,
      }
    : null;

  return business;
}

async function updateBusiness(businessId, actorUserId, input) {
  const update = {};
  if (input.name != null) update.name = input.name;
  if (input.timezone != null) update.timezone = input.timezone;
  if (input.currency != null) update.currency = input.currency;
  if (input.phone !== undefined) update.phone = input.phone;
  if (input.address !== undefined) update.address = input.address;
  if (input.codEnabled != null) update.codEnabled = input.codEnabled;
  if (input.workingHours != null) update.workingHours = input.workingHours;

  const businessDoc = await Business.findOneAndUpdate(
    { _id: toId(businessId) },
    { $set: update },
    { new: true },
  );
  if (!businessDoc) {
    throw new AppError(404, "Business not found", "NOT_FOUND");
  }

  await AuditLog.create({
    businessId: toId(businessId),
    actorUserId: toId(actorUserId),
    action: "BUSINESS_UPDATED",
    entity: "Business",
    entityId: toId(businessId),
    meta: input,
  });

  return docToObject(businessDoc);
}

module.exports = {
  getBusiness,
  updateBusiness,
};
