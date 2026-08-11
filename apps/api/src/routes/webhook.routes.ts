import { Router, type Request, type Response, type NextFunction } from "express";
import {
  ingestWhatsAppWebhook,
  verifyMetaSignature,
  verifyWebhookChallenge,
} from "../services/whatsapp/webhook.service";

export const webhookRouter = Router();

webhookRouter.get("/whatsapp", async (req, res) => {
  const challenge = await verifyWebhookChallenge({
    mode: req.query["hub.mode"] as string | undefined,
    verifyToken: req.query["hub.verify_token"] as string | undefined,
    challenge: req.query["hub.challenge"] as string | undefined,
  });

  if (!challenge) {
    res.status(403).send("Verification failed");
    return;
  }
  res.status(200).send(challenge);
});

webhookRouter.post(
  "/whatsapp",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawBody =
        (req as Request & { rawBody?: string }).rawBody ||
        JSON.stringify(req.body ?? {});

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
  },
);
