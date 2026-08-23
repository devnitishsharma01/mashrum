"use strict";

const { docToObject, toId } = require("../../db");
const { WhatsAppAccount, WhatsAppMessage, MessageTemplate } = require("../../models");
const { decryptSecret } = require("../../lib/crypto");
const { sendWhatsAppText } = require("./meta-client");

async function sendTextToCustomer(params) {
  const accountDoc = await WhatsAppAccount.findOne({
    businessId: toId(params.businessId),
    status: "CONNECTED",
  });
  if (!accountDoc) {
    console.warn(
      `Skipping WhatsApp send; account not connected for business ${params.businessId}`,
    );
    return null;
  }

  const account = docToObject(accountDoc);
  const messageDoc = await WhatsAppMessage.create({
    businessId: toId(params.businessId),
    customerId: toId(params.customerId),
    direction: "OUTBOUND",
    type: "text",
    body: params.body,
    status: "QUEUED",
  });

  try {
    const accessToken = decryptSecret(accountDoc.accessTokenEncrypted);
    const result = await sendWhatsAppText({
      phoneNumberId: accountDoc.phoneNumberId,
      accessToken,
      to: params.toWaId,
      body: params.body,
    });

    messageDoc.waMessageId = result.waMessageId;
    messageDoc.status = "SENT";
    messageDoc.rawPayload = result.raw || null;
    await messageDoc.save();

    return messageDoc._id.toString();
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Send failed";
    messageDoc.status = "FAILED";
    messageDoc.error = errMsg;
    await messageDoc.save();

    accountDoc.lastError = errMsg;
    accountDoc.status = "ERROR";
    await accountDoc.save();
    throw error;
  }
}

async function renderTemplate(businessId, key, vars) {
  const templateDoc = await MessageTemplate.findOne({
    businessId: toId(businessId),
    key,
    isActive: true,
  })
    .select("body")
    .lean();
  if (!templateDoc) return null;

  return Object.entries(vars).reduce(
    (body, [name, value]) => body.replaceAll(`{{${name}}}`, value),
    templateDoc.body,
  );
}

module.exports = {
  sendTextToCustomer,
  renderTemplate,
};
