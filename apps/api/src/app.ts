import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth.routes";
import { businessRouter } from "./routes/business.routes";
import { categoryRouter } from "./routes/category.routes";
import { customerRouter } from "./routes/customer.routes";
import { dashboardRouter } from "./routes/dashboard.routes";
import { healthRouter } from "./routes/health.routes";
import { inventoryRouter } from "./routes/inventory.routes";
import { orderRouter } from "./routes/order.routes";
import { productRouter } from "./routes/product.routes";
import { reportRouter } from "./routes/report.routes";
import { uploadRouter } from "./routes/upload.routes";
import { userRouter } from "./routes/user.routes";
import { webhookRouter } from "./routes/webhook.routes";
import { whatsappRouter } from "./routes/whatsapp.routes";

export function createApp() {
  const app = express();
  const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
  fs.mkdirSync(uploadRoot, { recursive: true });

  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: env.WEB_URL,
      credentials: true,
    }),
  );
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody =
          buf.toString("utf8");
      },
    }),
  );
  app.use(cookieParser());
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.use(
    "/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use("/uploads", express.static(uploadRoot, { maxAge: "7d" }));

  app.use(healthRouter);
  app.use("/auth", authRouter);
  app.use("/business", businessRouter);
  app.use("/categories", categoryRouter);
  app.use("/products", productRouter);
  app.use("/inventory", inventoryRouter);
  app.use("/customers", customerRouter);
  app.use("/orders", orderRouter);
  app.use("/whatsapp", whatsappRouter);
  app.use("/webhooks", webhookRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/reports", reportRouter);
  app.use("/users", userRouter);
  app.use("/uploads", uploadRouter);

  app.use(errorHandler);
  return app;
}
