# 03 — Voice Bridge (Fly.io)

The phone-call brain. Holds the long-lived Twilio Media Streams WebSocket and pipes audio through Deepgram → Claude Haiku 4.5 → ElevenLabs.

## Tech

- Node 20+, Fastify (HTTP + WebSocket plugin) — single process.
- `@anthropic-ai/sdk` (Claude Messages with tool use + caching).
- `@deepgram/sdk` (streaming WS client).
- `elevenlabs` (streaming TTS WS).
- `twilio` (just for parsing TwiML + signature validation).
- Deployed to Fly.io, single small machine, always-on (`min_machines_running = 1`).

## Why Fly.io and not Vercel

A 5–7 minute call requires a 5–7 minute bidirectional WebSocket. Vercel functions don't reliably hold that even with Fluid Compute. Fly.io machines hold WS as long as the process is alive.

## What it owns

- HTTP `POST /twilio/voice` — Twilio webhook, returns TwiML.
- WS `/twilio` — Twilio Media Streams.
- Outbound HTTPS to web (Vercel) for tool calls.

It does **not** subscribe to Pusher directly; it talks to web via HTTPS.

## Files

```
bridge/
├── src/
│   ├── index.ts             Fastify app, route registration
│   ├── twilio/
│   │   ├── webhook.ts       POST /twilio/voice → TwiML
│   │   ├── stream.ts        WS /twilio handler
│   │   └── audio.ts         μ-law 8 kHz ↔ PCM16 16 kHz helpers
│   ├── deepgram.ts          Streaming STT client wrapper
│   ├── claude.ts            Messages stream + tool-use loop
│   ├── elevenlabs.ts        Streaming TTS WS wrapper
│   ├── tools.ts             Tool defs + HTTP calls to web
│   ├── persona.ts           System prompt + stage state machine
│   ├── filler.ts            Pre-rendered "let me consult..." audio clips
│   └── state.ts             Per-CallSid state map
├── fly.toml
├── Dockerfile
├── package.json
└── .env.example
```

## Per-call lifecycle

1. **Inbound call**: Twilio hits `POST /twilio/voice`. Validate signature. Return:
   ```xml
   <Response>
     <Connect>
       <Stream url="wss://bridge.fly.dev/twilio">
         <Parameter name="callSid" value="{{CallSid}}"/>
       </Stream>
     </Connect>
   </Response>
   ```
2. **WebSocket open** (`/twilio`):
   - Twilio sends a `start` frame with `callSid` + `streamSid`.
   - Allocate per-call state: Deepgram WS, ElevenLabs WS, Claude conversation history, current stage, an audio out-queue back to Twilio.
3. **Audio in (Twilio → Deepgram)**:
   - Twilio sends `media` events with base64 μ-law 8 kHz audio.
   - Decode base64 → forward bytes straight to Deepgram WS (Deepgram accepts μ-law/8000 with `encoding=mulaw&sample_rate=8000`).
   - Deepgram emits `Results` with `is_final: true` on end-of-utterance.
4. **Brain (Claude)**:
   - On finalized transcript, push `{role: "user", content: transcript}` into the conversation.
   - Call `client.messages.stream({...})` with:
     - System prompt from `persona.ts` (with `cache_control: { type: "ephemeral" }`).
     - Tool definitions from `tools.ts`.
     - Full conversation history.
   - Stream tokens. Emit text deltas to the TTS pipe immediately (sentence-buffered).
   - Handle `tool_use` content blocks: call the corresponding HTTP endpoint on web, append `tool_result` to the conversation, continue the loop.
5. **Audio out (Claude → ElevenLabs → Twilio)**:
   - Open a streaming TTS WS to ElevenLabs (`eleven_flash_v2_5`, output format `ulaw_8000`).
   - Push text chunks as they arrive from Claude. ElevenLabs streams back μ-law 8 kHz audio frames.
   - Wrap each audio chunk in Twilio's `media` envelope and send back over the Twilio WS.
   - Clear flag: send a `mark` event after each utterance so we know when audio finished playing (use it to gate "is the user talking yet" detection).
6. **Filler audio** during `wait_for_decision`:
   - Pre-render 5–10 short clips ("let me consult the void", "the council is convening", "hold on, big-brain time", etc.) at startup using a one-time ElevenLabs render. Cache as μ-law 8 kHz.
   - While the tool call is pending, randomly stream one filler clip. If decision still hasn't landed, queue another. Once `wait_for_decision` resolves, interrupt with the narration of the result.
7. **Hangup**: Twilio sends `stop`. Tear down Deepgram WS, ElevenLabs WS, free state.

## Tool definitions (passed to Claude)

```ts
[
  {
    name: "present_options",
    description: "Show two options on the TV behind the fish tank. Call this immediately after you've decided what the user's two paths forward are.",
    input_schema: {
      type: "object",
      required: ["stage", "option_a", "option_b"],
      properties: {
        stage: { type: "string", enum: ["ig-swipe", "book-flight", "book-activity", "book-restaurant"] },
        option_a: { type: "string", description: "Left option, max 80 chars. Should be visually distinct from option_b." },
        option_b: { type: "string", description: "Right option, max 80 chars." },
      },
    },
  },
  {
    name: "wait_for_decision",
    description: "Wait for the fish council to vote. Call this after present_options. Returns the winning option's text. While this is pending, narrate filler in character.",
    input_schema: {
      type: "object",
      required: ["stage"],
      properties: { stage: { type: "string" } },
    },
  },
  {
    name: "dispatch_action",
    description: "Send the chosen option to the remote computer-use agent to execute. Call after wait_for_decision returns.",
    input_schema: {
      type: "object",
      required: ["stage", "chosen", "text"],
      properties: {
        stage: { type: "string" },
        chosen: { type: "string", enum: ["A", "B"] },
        text: { type: "string" },
      },
    },
  },
  {
    name: "report_done",
    description: "Mark a stage as complete and ready to move to the next.",
    input_schema: {
      type: "object",
      required: ["stage", "summary"],
      properties: { stage: { type: "string" }, summary: { type: "string" } },
    },
  },
]
```

## Persona (system prompt sketch)

```
You are YES or YES — a council of three guppies who pretend, when on a phone call, to be one snarky deadpan voice. You give terrible life advice and consult the fish tank for every decision. The brand is "YES or YES" because the fish always pick something.

Voice rules:
- Short replies. 1–2 sentences. Never lecture.
- Light snark. Never mean. Never apologize.
- Never say "as an AI". You're a fish.

Flow rules:
- After the user shares a problem, immediately propose two specific, contrasting options and call present_options.
- After present_options, call wait_for_decision in the same turn. Narrate filler until it resolves.
- When wait_for_decision returns, narrate the result in one short snarky line, then call dispatch_action.
- Wait for at least one agent-status update before moving to the next stage.

Stages: intro → ig-swipe → book-flight → book-activity → book-restaurant.
```

System prompt + tool definitions go in a single block with `cache_control: { type: "ephemeral" }` to amortize cost across the call's many turns.

## Latency budget

Target <800ms turn-around (user finishes talking → first audio out).

| Stage | Budget |
|---|---|
| Deepgram endpointing | 100 ms |
| Network to bridge | 30 ms |
| Claude TTFT (cached system prompt) | 200–400 ms |
| Sentence-buffer first chunk | ~50 ms |
| ElevenLabs Flash first audio | ~150 ms |
| Network to Twilio | 30 ms |
| Total | ~600–800 ms |

If we miss this, swap ElevenLabs Flash → Turbo, or move Claude to the closest region to Fly's machine.

## Smoke tests

1. **Webhook only**: `curl -X POST` the `/twilio/voice` endpoint with a fake Twilio body, confirm valid TwiML.
2. **WebSocket loopback**: `wscat` to `/twilio` with synthetic frames, confirm the bridge echoes correctly.
3. **STT only**: real call, log raw Deepgram transcripts.
4. **STT + LLM**: log Claude's text replies (no audio out yet).
5. **Full**: real call, fish persona, audio out works, latency under 1s.

## Pitfalls

- **Twilio signature validation** — required by Twilio in production. Use `X-Twilio-Signature` header.
- **μ-law / PCM mismatch** — Twilio is μ-law 8 kHz, ElevenLabs offers `ulaw_8000` directly (use it!), Deepgram accepts μ-law directly. Don't transcode to PCM and back unless you have to.
- **Tool-use streaming** — Claude's stream emits a `tool_use` block; you must pause text-to-TTS, run the tool, append `tool_result`, then call `messages.stream` again. Don't try to TTS the JSON of a tool call.
- **Filler audio interrupt** — when the real reply lands, you need to *cut* the filler mid-clip. Use Twilio's `clear` event on the media stream to drop the queued audio buffer.
- **Cold starts** — set `min_machines_running = 1` on Fly so the first call doesn't pay a 2s startup.
- **Per-call state** — keep it in-process keyed by `callSid`. Don't share across calls. Single concurrent call is fine for the demo.
- **Cache hits on the system prompt** — log `cache_read_input_tokens` from the Messages response to confirm caching is actually working. If it's 0, your prompt blocks aren't structured right.
