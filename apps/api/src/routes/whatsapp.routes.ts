import { Router } from "express";
import {
  connectWhatsAppSchema,
  simulateInboundSchema,
} from "@mashrum/shared";
import {
  requireAuth,
  requirePermission,
  tenantId,
} from "../middleware/auth";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
} from "../services/whatsapp/account.service";
import { simulateInboundMessage } from "../services/whatsapp/webhook.service";
import { env } from "../config/env";
import { AppError } from "../lib/errors";

export const whatsappRouter = Router();

whatsappRouter.use(requireAuth);

whatsappRouter.get(
  "/status",
  requirePermission("whatsapp:manage"),
  async (req, res, next) => {
    try {
      const data = await getWhatsAppStatus(tenantId(req));
      res.json({
        data: {
          ...data,
          webhookUrl: `${env.API_URL}/webhooks/whatsapp`,
          mockSend: env.WHATSAPP_MOCK_SEND,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

whatsappRouter.post(
  "/connect",
  requirePermission("whatsapp:manage"),
  async (req, res, next) => {
    try {
      const input = connectWhatsAppSchema.parse(req.body);
      const data = await connectWhatsApp(tenantId(req), req.user!.id, input);
      res.status(201).json({
        data: {
          ...data,
          webhookUrl: `${env.API_URL}/webhooks/whatsapp`,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

whatsappRouter.post(
  "/disconnect",
  requirePermission("whatsapp:manage"),
  async (req, res, next) => {
    try {
      const data = await disconnectWhatsApp(tenantId(req), req.user!.id);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

whatsappRouter.post(
  "/simulate",
  requirePermission("whatsapp:manage"),
  async (req, res, next) => {
    try {
      if (env.NODE_ENV === "production" && !env.WHATSAPP_MOCK_SEND) {
        throw new AppError(
          403,
          "Simulate endpoint disabled in production",
          "FORBIDDEN",
        );
      }
      const input = simulateInboundSchema.parse(req.body);
      const data = await simulateInboundMessage({
        businessId: tenantId(req),
        from: input.from,
        text: input.text,
        contactName: input.contactName,
      });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);
