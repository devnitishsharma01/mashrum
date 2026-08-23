"use strict";

const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { env } = require("./config/env");
const { errorHandler } = require("./middleware/error-handler");
const { authRouter } = require("./routes/auth.routes");
const { businessRouter } = require("./routes/business.routes");
const { categoryRouter } = require("./routes/category.routes");
const { customerRouter } = require("./routes/customer.routes");
const { dashboardRouter } = require("./routes/dashboard.routes");
const { healthRouter } = require("./routes/health.routes");
const { inventoryRouter } = require("./routes/inventory.routes");
const { orderRouter } = require("./routes/order.routes");
const { productRouter } = require("./routes/product.routes");
const { queueRouter } = require("./routes/queue.routes");
const { reportRouter } = require("./routes/report.routes");
const { uploadRouter } = require("./routes/upload.routes");
const { userRouter } = require("./routes/user.routes");
const { webhookRouter } = require("./routes/webhook.routes");
const { whatsappRouter } = require("./routes/whatsapp.routes");

function createApp() {
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
        req.rawBody = buf.toString("utf8");
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
  app.use(queueRouter);
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

module.exports = { createApp };
