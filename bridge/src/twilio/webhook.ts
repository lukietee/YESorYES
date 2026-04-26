import type { FastifyInstance } from "fastify";

export function registerTwilioWebhook(app: FastifyInstance) {
  app.post("/twilio/voice", async (req, reply) => {
    const host = process.env.PUBLIC_HOST ?? req.headers.host;
    const wsUrl = `wss://${host}/twilio`;

    // Note: do NOT pass <Parameter name="callSid" value="{{CallSid}}"/> here.
    // Twilio does not substitute template variables inside <Parameter>, so it
    // gets passed as the literal string "{{CallSid}}" and every call ends up
    // sharing the same KV keys. Use the real CallSid from the WS start event
    // instead (see stream.ts).
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}"/>
  </Connect>
</Response>`;

    reply.type("text/xml").send(twiml);
  });
}
