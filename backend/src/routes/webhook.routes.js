"use strict";

const express = require("express");
const {
  verifyWebhookChallenge,
  verifyMetaSignature,
  ingestWhatsAppWebhook,
} = require("../services/whatsapp/webhook.service");

const webhookRouter = express.Router();

webhookRouter.get("/whatsapp", async (req, res) => {
  const challenge = await verifyWebhookChallenge({
    mode: req.query["hub.mode"],
    verifyToken: req.query["hub.verify_token"],
    challenge: req.query["hub.challenge"],
  });

  if (!challenge) {
    res.status(403).send("Verification failed");
    return;
  }
  res.status(200).send(challenge);
});

webhookRouter.post("/whatsapp", async (req, res, next) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body ?? {});

    const signature = req.header("x-hub-signature-256") || undefined;
    if (!verifyMetaSignature(rawBody, signature)) {
      res.status(401).json({
        error: { code: "INVALID_SIGNATURE", message: "Invalid signature" },
      });
      return;
    }

    const result = await ingestWhatsAppWebhook(req.body);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = { webhookRouter };
