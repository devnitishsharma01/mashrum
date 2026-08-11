import { createApp } from "./app";
import { env } from "./config/env";
import { registerJobs } from "./jobs/register";

registerJobs();
const app = createApp();

app.listen(env.API_PORT, () => {
  console.log(`Mashrum API listening on ${env.API_URL}`);
  console.log(
    `WhatsApp webhook: ${env.API_URL}/webhooks/whatsapp (mockSend=${env.WHATSAPP_MOCK_SEND})`,
  );
});
