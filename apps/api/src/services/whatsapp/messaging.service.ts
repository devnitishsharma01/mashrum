import { prisma } from "@mashrum/database";
import { decryptSecret } from "../../lib/crypto";
import { sendWhatsAppText } from "./meta-client";

export async function sendTextToCustomer(params: {
  businessId: string;
  customerId: string;
  toWaId: string;
  body: string;
}) {
  const account = await prisma.whatsAppAccount.findFirst({
    where: { businessId: params.businessId, status: "CONNECTED" },
  });
  if (!account) {
    console.warn(
      `Skipping WhatsApp send; account not connected for business ${params.businessId}`,
    );
    return null;
  }

  const message = await prisma.whatsAppMessage.create({
    data: {
      businessId: params.businessId,
      customerId: params.customerId,
      direction: "OUTBOUND",
      type: "text",
      body: params.body,
      status: "QUEUED",
    },
  });

  try {
    const accessToken = decryptSecret(account.accessTokenEncrypted);
    const result = await sendWhatsAppText({
      phoneNumberId: account.phoneNumberId,
      accessToken,
      to: params.toWaId,
      body: params.body,
    });

    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        waMessageId: result.waMessageId,
        status: "SENT",
        rawPayload: result.raw ? (result.raw as object) : undefined,
      },
    });

    return message.id;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Send failed";
    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: { status: "FAILED", error: errMsg },
    });
    await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: { lastError: errMsg, status: "ERROR" },
    });
    throw error;
  }
}

export async function renderTemplate(
  businessId: string,
  key: string,
  vars: Record<string, string>,
): Promise<string | null> {
  const template = await prisma.messageTemplate.findFirst({
    where: { businessId, key, isActive: true },
  });
  if (!template) return null;

  return Object.entries(vars).reduce(
    (body, [name, value]) => body.replaceAll(`{{${name}}}`, value),
    template.body,
  );
}
