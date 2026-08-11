import { env } from "../../config/env";

export type SendTextResult = {
  waMessageId: string | null;
  mocked: boolean;
  raw?: unknown;
};

export async function sendWhatsAppText(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}): Promise<SendTextResult> {
  const to = params.to.replace(/^\+/, "");

  if (env.WHATSAPP_MOCK_SEND || env.NODE_ENV === "test") {
    const mockId = `mock_${Date.now()}`;
    console.log(
      `[whatsapp:mock] to=${to} phoneNumberId=${params.phoneNumberId} body=${JSON.stringify(params.body)}`,
    );
    return { waMessageId: mockId, mocked: true };
  }

  const url = `${env.WHATSAPP_API_BASE_URL}/${env.META_GRAPH_API_VERSION}/${params.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body: params.body },
    }),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (raw as { error?: { message?: string } })?.error?.message ||
      `Meta API error ${res.status}`;
    throw new Error(message);
  }

  const waMessageId =
    (raw as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id ?? null;

  return { waMessageId, mocked: false, raw };
}
