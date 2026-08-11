import { registerJob } from "../lib/queue";
import { notifyOrderStatusChange } from "../services/whatsapp/notifications.service";
import { processWhatsAppWebhookEvent } from "../services/whatsapp/webhook.service";

export function registerJobs(): void {
  registerJob<{ providerEventId: string }>(
    "whatsapp.webhook",
    async ({ providerEventId }) => {
      await processWhatsAppWebhookEvent(providerEventId);
    },
  );

  registerJob<{
    businessId: string;
    orderId: string;
    orderNumber: string;
    status: string;
    customerId: string;
  }>("whatsapp.order_status", async (payload) => {
    await notifyOrderStatusChange(payload);
  });
}
