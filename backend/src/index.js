"use strict";

const { createApp } = require("./app");
const { env } = require("./config/env");
const { connectDb } = require("./db");
const { registerJobs } = require("./jobs/register");
const { initQueue, shutdownQueue } = require("./lib/queue");

async function main() {
  await connectDb(env.MONGODB_URI);
  registerJobs();
  const queueMode = await initQueue();
  const app = createApp();

  const server = app.listen(env.API_PORT, () => {
    console.log(`Mushroom API listening on ${env.API_URL}`);
    console.log(
      `WhatsApp webhook: ${env.API_URL}/webhooks/whatsapp (mockSend=${env.WHATSAPP_MOCK_SEND})`,
    );
    console.log(`Queue driver: ${queueMode}`);
  });

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close();
    await shutdownQueue();
    const { mongoose } = require("./db");
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Failed to start API:", error);
  process.exit(1);
});
