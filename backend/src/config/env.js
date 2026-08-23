"use strict";

const fs = require("fs");
const path = require("path");
const { z } = require("zod");
const dotenv = require("dotenv");

const backendEnv = path.resolve(__dirname, "../../.env");
const rootEnv = path.resolve(__dirname, "../../../.env");

if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().default(4000),
    API_URL: z.string().url().default("http://localhost:4000"),
    WEB_URL: z.string().url().default("http://localhost:3000"),
    MONGODB_URI: z.string().min(1).optional(),
    DATABASE_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    QUEUE_DRIVER: z.enum(["auto", "redis", "memory"]).default("auto"),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    BCRYPT_ROUNDS: z.coerce.number().default(12),
    TOKEN_ENCRYPTION_KEY: z.string().length(64),
    META_APP_SECRET: z.string().optional().default(""),
    META_GRAPH_API_VERSION: z.string().default("v21.0"),
    WHATSAPP_API_BASE_URL: z.string().url().default("https://graph.facebook.com"),
    META_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(""),
    WHATSAPP_MOCK_SEND: z
      .enum(["true", "false"])
      .optional()
      .default("true")
      .transform((v) => v === "true"),
    UPLOAD_DIR: z.string().default("uploads"),
    UPLOAD_MAX_BYTES: z.coerce.number().default(2 * 1024 * 1024),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    S3_BUCKET: z.string().optional().default(""),
    S3_REGION: z.string().optional().default(""),
    S3_ACCESS_KEY_ID: z.string().optional().default(""),
    S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
    S3_ENDPOINT: z.string().optional().default(""),
    S3_PUBLIC_URL_BASE: z.string().optional().default(""),
    S3_OBJECT_ACL: z.string().optional().default(""),
    AWS_STORAGE_BUCKET_NAME: z.string().optional().default(""),
    AWS_S3_REGION_NAME: z.string().optional().default(""),
    AWS_ACCESS_KEY_ID: z.string().optional().default(""),
    AWS_SECRET_ACCESS_KEY: z.string().optional().default(""),
  })
  .transform((data) => ({
    ...data,
    MONGODB_URI:
      data.MONGODB_URI ||
      data.DATABASE_URL ||
      "mongodb://127.0.0.1:27017/mushroom",
    S3_BUCKET: data.S3_BUCKET || data.AWS_STORAGE_BUCKET_NAME || "",
    S3_REGION: data.S3_REGION || data.AWS_S3_REGION_NAME || "ap-south-1",
    S3_ACCESS_KEY_ID: data.S3_ACCESS_KEY_ID || data.AWS_ACCESS_KEY_ID || "",
    S3_SECRET_ACCESS_KEY:
      data.S3_SECRET_ACCESS_KEY || data.AWS_SECRET_ACCESS_KEY || "",
  }));

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

const env = parsed.data;

module.exports = { env };
