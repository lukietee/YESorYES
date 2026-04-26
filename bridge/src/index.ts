import "dotenv/config";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { registerTwilioWebhook } from "./twilio/webhook.js";
import { registerTwilioStream } from "./twilio/stream.js";

const PORT = Number(process.env.PORT ?? 8080);

async function main() {
  const app = Fastify({ logger: { level: "info" } });
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_req, body, done) => done(null, body),
  );
  await app.register(websocket);

  registerTwilioWebhook(app);
  registerTwilioStream(app);

  app.get("/healthz", async () => ({ ok: true }));

  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`bridge listening on :${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
