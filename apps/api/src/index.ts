import { createApp } from "./app";
import { env } from "./config/env";
import { registerJobs } from "./jobs/register";
import { initQueue, shutdownQueue } from "./lib/queue";

async function main() {
  registerJobs();
  const queueMode = await initQueue();
  const app = createApp();

  const server = app.listen(env.API_PORT, () => {
    console.log(`Mashrum API listening on ${env.API_URL}`);
    console.log(
      `WhatsApp webhook: ${env.API_URL}/webhooks/whatsapp (mockSend=${env.WHATSAPP_MOCK_SEND})`,
    );
    console.log(`Queue driver: ${queueMode}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close();
    await shutdownQueue();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Failed to start API:", error);
  process.exit(1);
});
