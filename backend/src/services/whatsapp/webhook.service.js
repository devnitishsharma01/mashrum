"use strict";

const crypto = require("crypto");
const { isDuplicateKeyError, toId } = require("../../db");
const { WhatsAppWebhookEvent, WhatsAppMessage, WhatsAppAccount, Business } = require("../../models");
const { env } = require("../../config/env");
const { enqueue } = require("../../lib/queue");
const { sha256 } = require("../../lib/crypto");
const {
  findAccountByVerifyToken,
  findAccountByPhoneNumberId,
} = require("./account.service");
const { handleInboundText } = require("./bot.service");
const { upsertCustomerByWaId } = require("../customer.service");

function verifyMetaSignature(rawBody, signatureHeader) {
  if (!env.META_APP_SECRET) {
    return env.NODE_ENV !== "production";
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = signatureHeader.slice("sha256=".length);
  const digest = crypto
    .createHmac("sha256", env.META_APP_SECRET)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(digest, "hex"));
  } catch {
    return false;
  }
}

async function verifyWebhookChallenge(params) {
  if (params.mode !== "subscribe" || !params.verifyToken || !params.challenge) {
    return null;
  }

  if (env.META_WEBHOOK_VERIFY_TOKEN && params.verifyToken === env.META_WEBHOOK_VERIFY_TOKEN) {
    return params.challenge;
  }

  const account = await findAccountByVerifyToken(params.verifyToken);
  if (account) return params.challenge;
  return null;
}

function providerEventId(payload) {
  const messageId =
    payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ||
    payload?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.id;
  if (messageId) return messageId;
  return sha256(JSON.stringify(payload)).slice(0, 48);
}

async function ingestWhatsAppWebhook(payload, options) {
  const eventId = providerEventId(payload);
  const phoneNumberId = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;

  try {
    await WhatsAppWebhookEvent.create({
      providerEventId: eventId,
      phoneNumberId,
      payload,
      status: "RECEIVED",
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      await WhatsAppWebhookEvent.updateOne({ providerEventId: eventId }, { status: "DUPLICATE" });
      return { duplicate: true };
    }
    throw error;
  }

  if (options?.enqueueJob !== false) {
    void enqueue("whatsapp.webhook", { providerEventId: eventId });
  }
  return { duplicate: false, providerEventId: eventId };
}

async function processWhatsAppWebhookEvent(providerEventIdValue) {
  const eventDoc = await WhatsAppWebhookEvent.findOne({ providerEventId: providerEventIdValue });
  if (!eventDoc) return;
  if (eventDoc.status === "PROCESSED" || eventDoc.status === "DUPLICATE") return;

  try {
    const payload = eventDoc.payload;
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId) {
      throw new Error("Missing phone_number_id in webhook payload");
    }

    const account = await findAccountByPhoneNumberId(phoneNumberId);
    if (!account || account.business.status !== "ACTIVE") {
      throw new Error("No connected business for phone_number_id");
    }

    eventDoc.businessId = toId(account.businessId);
    await eventDoc.save();

    for (const status of value?.statuses || []) {
      if (!status.id || !status.status) continue;
      const mapped =
        status.status === "delivered"
          ? "DELIVERED"
          : status.status === "read"
            ? "READ"
            : status.status === "sent"
              ? "SENT"
              : status.status === "failed"
                ? "FAILED"
                : null;
      if (!mapped) continue;
      await WhatsAppMessage.updateMany(
        { waMessageId: status.id, businessId: toId(account.businessId) },
        { status: mapped },
      );
    }

    for (const message of value?.messages || []) {
      if (!message.from || !message.id) continue;

      const contactName =
        value?.contacts?.find((c) => c.wa_id === message.from)?.profile?.name ||
        value?.contacts?.[0]?.profile?.name;

      const existingMsg = await WhatsAppMessage.findOne({ waMessageId: message.id })
        .select("_id")
        .lean();
      if (existingMsg) continue;

      const body = message.type === "text" ? message.text?.body || "" : `[${message.type}]`;

      const customer = await upsertCustomerByWaId(account.businessId, message.from, contactName);

      await WhatsAppMessage.create({
        businessId: toId(account.businessId),
        customerId: toId(customer.id),
        direction: "INBOUND",
        waMessageId: message.id,
        type: message.type || "unknown",
        body,
        status: "DELIVERED",
        rawPayload: message,
      });

      if (message.type === "text" && message.text?.body) {
        await handleInboundText({
          businessId: account.businessId,
          businessName: account.business.name,
          currency: account.business.currency,
          waId: message.from,
          contactName,
          text: message.text.body,
        });
      } else {
        await handleInboundText({
          businessId: account.businessId,
          businessName: account.business.name,
          currency: account.business.currency,
          waId: message.from,
          contactName,
          text: "help",
        });
      }
    }

    eventDoc.status = "PROCESSED";
    eventDoc.processedAt = new Date();
    eventDoc.error = null;
    await eventDoc.save();
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Processing failed";
    eventDoc.status = "FAILED";
    eventDoc.error = errMsg;
    eventDoc.processedAt = new Date();
    await eventDoc.save();
    throw error;
  }
}

async function simulateInboundMessage(params) {
  const accountDoc = await WhatsAppAccount.findOne({
    businessId: toId(params.businessId),
    status: "CONNECTED",
  }).lean();
  if (!accountDoc) {
    throw new Error("WhatsApp is not connected for this business");
  }

  const businessDoc = await Business.findById(accountDoc.businessId).select("name currency status").lean();

  const fakePayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: accountDoc.wabaId || "simulate",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                phone_number_id: accountDoc.phoneNumberId,
                display_phone_number: accountDoc.displayPhone || undefined,
              },
              contacts: [
                {
                  wa_id: params.from.replace(/^\+/, ""),
                  profile: { name: params.contactName },
                },
              ],
              messages: [
                {
                  from: params.from.replace(/^\+/, ""),
                  id: `wamid.simulate.${Date.now()}.${Math.random().toString(16).slice(2)}`,
                  timestamp: `${Math.floor(Date.now() / 1000)}`,
                  type: "text",
                  text: { body: params.text },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const result = await ingestWhatsAppWebhook(fakePayload, { enqueueJob: false });
  if (!result.duplicate && result.providerEventId) {
    await processWhatsAppWebhookEvent(result.providerEventId);
  }
  return result;
}

module.exports = {
  verifyMetaSignature,
  verifyWebhookChallenge,
  ingestWhatsAppWebhook,
  processWhatsAppWebhookEvent,
  simulateInboundMessage,
};
