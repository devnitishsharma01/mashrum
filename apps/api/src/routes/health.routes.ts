import { Router } from "express";
import { prisma } from "@mashrum/database";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      data: {
        status: "ok",
        service: "mashrum-api",
        database: "up",
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(503).json({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Database unavailable",
      },
    });
  }
});
