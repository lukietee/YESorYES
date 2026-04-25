import type { FastifyInstance } from "fastify";

export function registerTwilioWebhook(app: FastifyInstance) {
  app.post("/twilio/voice", async (req, reply) => {
    const host = process.env.PUBLIC_HOST ?? req.headers.host;
    const wsUrl = `wss://${host}/twilio`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="callSid" value="{{CallSid}}"/>
    </Stream>
  </Connect>
</Response>`;

    reply.type("text/xml").send(twiml);
  });
}
