"use strict";

const { registerJob } = require("../lib/queue");
const { notifyOrderStatusChange } = require("../services/whatsapp/notifications.service");
const { processWhatsAppWebhookEvent } = require("../services/whatsapp/webhook.service");

function registerJobs() {
  registerJob("whatsapp.webhook", async ({ providerEventId }) => {
    await processWhatsAppWebhookEvent(providerEventId);
  });

  registerJob("whatsapp.order_status", async (payload) => {
    await notifyOrderStatusChange(payload);
  });
}

module.exports = { registerJobs };
