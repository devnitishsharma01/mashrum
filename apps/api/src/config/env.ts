import { config } from "dotenv";
import path from "path";
import { z } from "zod";

config({ path: path.resolve(__dirname, "../../../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  API_URL: z.string().url().default("http://localhost:4000"),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
