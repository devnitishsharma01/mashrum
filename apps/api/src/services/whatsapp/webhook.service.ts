import crypto from "crypto";
import { prisma } from "@mashrum/database";
import { env } from "../../config/env";
import { enqueue } from "../../lib/queue";
import { sha256 } from "../../lib/crypto";
import {
  findAccountByPhoneNumberId,
  findAccountByVerifyToken,
} from "./account.service";
import { handleInboundText } from "./bot.service";

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          phone_number_id?: string;
          display_phone_number?: string;
        };
        contacts?: Array<{
          profile?: { name?: string };
          wa_id?: string;
        }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
        statuses?: Array<{
          id?: string;
          status?: string;
          timestamp?: string;
          recipient_id?: string;
        }>;
      };
    }>;
  }>;
};

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader?: string,
): boolean {
  if (!env.META_APP_SECRET) {
    // Dev-friendly: allow unsigned webhooks when secret is not configured
    return env.NODE_ENV !== "production";
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = signatureHeader.slice("sha256=".length);
  const digest = crypto
    .createHmac("sha256", env.META_APP_SECRET)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(digest, "hex"),
    );
  } catch {
    return false;
  }
}

export async function verifyWebhookChallenge(params: {
  mode?: string;
  verifyToken?: string;
  challenge?: string;
}): Promise<string | null> {
  if (params.mode !== "subscribe" || !params.verifyToken || !params.challenge) {
    return null;
  }

  if (
    env.META_WEBHOOK_VERIFY_TOKEN &&
    params.verifyToken === env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return params.challenge;
  }

  const account = await findAccountByVerifyToken(params.verifyToken);
  if (account) return params.challenge;
  return null;
}

function providerEventId(payload: MetaWebhookPayload): string {
  const messageId =
    payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ||
    payload.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.id;
  if (messageId) return messageId;
  return sha256(JSON.stringify(payload)).slice(0, 48);
}

export async function ingestWhatsAppWebhook(
  payload: MetaWebhookPayload,
  options?: { enqueueJob?: boolean },
) {
  const eventId = providerEventId(payload);
  const phoneNumberId =
    payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;

  try {
    await prisma.whatsAppWebhookEvent.create({
      data: {
        providerEventId: eventId,
        phoneNumberId,
        payload: payload as object,
        status: "RECEIVED",
      },
    });
  } catch (error) {
    // Unique constraint => duplicate delivery from Meta
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      await prisma.whatsAppWebhookEvent.update({
        where: { providerEventId: eventId },
        data: { status: "DUPLICATE" },
      });
      return { duplicate: true as const };
    }
    throw error;
  }

  if (options?.enqueueJob !== false) {
    enqueue("whatsapp.webhook", { providerEventId: eventId });
  }
  return { duplicate: false as const, providerEventId: eventId };
}

export async function processWhatsAppWebhookEvent(
  providerEventId: string,
): Promise<void> {
  const event = await prisma.whatsAppWebhookEvent.findUnique({
    where: { providerEventId },
  });
  if (!event) return;
  if (event.status === "PROCESSED" || event.status === "DUPLICATE") return;

  try {
    const payload = event.payload as MetaWebhookPayload;
    const value = payload.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId) {
      throw new Error("Missing phone_number_id in webhook payload");
    }

    const account = await findAccountByPhoneNumberId(phoneNumberId);
    if (!account || account.business.status !== "ACTIVE") {
      throw new Error("No connected business for phone_number_id");
    }

    await prisma.whatsAppWebhookEvent.update({
      where: { id: event.id },
      data: { businessId: account.businessId },
    });

    // Status updates
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
      await prisma.whatsAppMessage.updateMany({
        where: { waMessageId: status.id, businessId: account.businessId },
        data: { status: mapped },
      });
    }

    // Inbound messages
    for (const message of value?.messages || []) {
      if (!message.from || !message.id) continue;

      const contactName =
        value?.contacts?.find((c) => c.wa_id === message.from)?.profile?.name ||
        value?.contacts?.[0]?.profile?.name;

      const existingMsg = await prisma.whatsAppMessage.findFirst({
        where: { waMessageId: message.id },
      });
      if (existingMsg) continue;

      const body =
        message.type === "text" ? message.text?.body || "" : `[${message.type}]`;

      // Ensure customer exists for FK on message
      const { upsertCustomerByWaId } = await import("../customer.service");
      const customer = await upsertCustomerByWaId(
        account.businessId,
        message.from,
        contactName,
      );

      await prisma.whatsAppMessage.create({
        data: {
          businessId: account.businessId,
          customerId: customer.id,
          direction: "INBOUND",
          waMessageId: message.id,
          type: message.type || "unknown",
          body,
          status: "DELIVERED",
          rawPayload: message as object,
        },
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

    await prisma.whatsAppWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        error: null,
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Processing failed";
    await prisma.whatsAppWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        error: errMsg,
        processedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function simulateInboundMessage(params: {
  businessId: string;
  from: string;
  text: string;
  contactName?: string;
}) {
  const account = await prisma.whatsAppAccount.findFirst({
    where: { businessId: params.businessId, status: "CONNECTED" },
    include: {
      business: {
        select: { id: true, name: true, currency: true, status: true },
      },
    },
  });
  if (!account) {
    throw new Error("WhatsApp is not connected for this business");
  }

  const fakePayload: MetaWebhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: account.wabaId || "simulate",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                phone_number_id: account.phoneNumberId,
                display_phone_number: account.displayPhone || undefined,
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

  const result = await ingestWhatsAppWebhook(fakePayload, {
    enqueueJob: false,
  });
  if (!result.duplicate && result.providerEventId) {
    await processWhatsAppWebhookEvent(result.providerEventId);
  }
  return result;
}
