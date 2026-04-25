# 04 — Orchestration (Vercel: web app + API)

The glue. Hosts the TV display, exposes the HTTP tools the bridge calls, persists per-call state in KV, fans events out via Pusher.

## Tech

- Next.js 16 App Router on Vercel.
- Vercel KV (Upstash Redis via Marketplace) for per-call/per-stage state.
- `pusher` (Node server SDK) for publishing events.
- `vercel.ts` for project config.

## What it owns

| Surface | Type | Caller |
|---|---|---|
| `GET /display` | Page | TV browser |
| `POST /api/options/present` | API | bridge |
| `POST /api/options/decision` | API | bridge (long-poll) |
| `POST /api/agent/dispatch` | API | bridge |
| `POST /api/agent/status` | API | remote-agent |
| `POST /api/decisions/publish` | API | display (publishes the vote result) |
| `GET /api/state` | API | display (resync after disconnect) |

All tool-call endpoints accept a shared-secret `Authorization: Bearer ${INTERNAL_TOKEN}` header. Don't expose them publicly.

## Files

```
web/
├── app/
│   ├── display/                   (see 02-display.md)
│   ├── api/
│   │   ├── options/
│   │   │   ├── present/route.ts
│   │   │   └── decision/route.ts
│   │   ├── agent/
│   │   │   ├── dispatch/route.ts
│   │   │   └── status/route.ts
│   │   ├── decisions/
│   │   │   └── publish/route.ts
│   │   └── state/route.ts
│   └── layout.tsx
├── lib/
│   ├── pusher.ts                  Server publisher singleton
│   ├── kv.ts                      KV client + key helpers
│   ├── stages.ts                  Stage definitions
│   ├── agentTasks.ts              Stage-specific task templates for remote agent
│   ├── auth.ts                    INTERNAL_TOKEN validator
│   └── types.ts                   Shared event payload types
├── vercel.ts
├── package.json
└── .env.example
```

## KV keys

```
call:<sid>:stage              "intro" | "ig-swipe" | ... | "book-restaurant"
call:<sid>:options:<stage>    { option_a, option_b, ts }
call:<sid>:decision:<stage>   { chosen: "A"|"B", text, vote }
call:<sid>:status:<stage>     { latest: string, history: string[] }
current_call_sid              (for /display to know which call to follow)
```

KV TTL: 1 hour per key. Demo doesn't need persistence.

## Stage definitions

```ts
// lib/stages.ts
export const STAGES = ["intro", "ig-swipe", "book-flight", "book-activity", "book-restaurant"] as const;
export type Stage = typeof STAGES[number];

export const STAGE_HINTS: Record<Stage, string> = {
  "intro": "Open call, get the user's situation. No options yet.",
  "ig-swipe": "Two opposite social moves. One healthy, one unhinged.",
  "book-flight": "Two destination cities. Different vibes.",
  "book-activity": "Two date activities. One earnest, one chaotic.",
  "book-restaurant": "Two restaurants. One five-star, one one-star.",
};
```

These hints are folded into Claude's system prompt to keep the demo flow on rails.

## API contracts

### `POST /api/options/present`
```json
// in
{ "callSid": "CA...", "stage": "ig-swipe", "option_a": "Text your ex again", "option_b": "Swipe up on random IG stories" }
// out
{ "ok": true }
```
- Writes to KV.
- Publishes `options` Pusher event.
- Returns immediately (display handles the countdown).

### `POST /api/options/decision`
```json
// in
{ "callSid": "CA...", "stage": "ig-swipe" }
// out (after up to 10s)
{ "chosen": "B", "text": "Swipe up...", "vote": { "L": 4, "R": 26 } }
```
- Long-polls KV for `call:<sid>:decision:<stage>`. Polls every 200ms; gives up at 10s and returns `{ pending: true }` (bridge retries).
- Alternative: subscribe to Pusher server-side and resolve when the event lands.

### `POST /api/agent/dispatch`
```json
// in
{ "callSid": "CA...", "stage": "ig-swipe", "chosen": "B", "text": "Swipe up..." }
// out
{ "ok": true, "taskId": "..." }
```
- Looks up `agentTasks[stage]` template, interpolates `text`, publishes to `agent-tasks` channel.

### `POST /api/agent/status`
```json
// in
{ "taskId": "...", "stage": "ig-swipe", "type": "progress"|"done"|"error", "detail": "DMing @user_42" }
// out
{ "ok": true }
```
- Writes to KV `call:<sid>:status:<stage>`.
- Republishes to `agent-status` Pusher channel.

### `POST /api/decisions/publish`
```json
// in (called from display browser after countdown)
{ "callSid": "CA...", "stage": "ig-swipe", "chosen": "B", "text": "...", "vote": { "L": 4, "R": 26 } }
// out
{ "ok": true }
```
- Writes to KV.
- Publishes `decisions` Pusher event.
- The bridge's `wait_for_decision` long-poll completes on the KV write.

## Agent task templates

```ts
// lib/agentTasks.ts
export const TASK_TEMPLATES: Record<Stage, (chosenText: string) => AgentTask> = {
  "ig-swipe": (text) => ({
    stage: "ig-swipe",
    instruction: `Open Instagram in Chrome (already logged in to the demo account). Find the stories tray. ${text}. DM five accounts asking if they want to grab dinner this weekend. Stop the moment any account replies. Report each DM as a status update.`,
    timeoutSec: 120,
  }),
  // ...
};
```

These get published verbatim to `agent-tasks` and the remote agent consumes them as the user message for its computer-use loop.

## Smoke tests

1. `curl POST /api/options/present` with bearer auth → confirm Pusher debug console shows the event and KV has the key.
2. `curl POST /api/options/decision` → confirm it long-polls and returns when you `curl POST /api/decisions/publish`.
3. `curl POST /api/agent/dispatch` → confirm `agent-tasks` event fires.
4. `curl POST /api/agent/status` → confirm `agent-status` event fires.
5. Open `/display` and `/api/state` → confirm display can resync.

## Pitfalls

- **Vercel function timeout** — the `decision` long-poll endpoint must complete inside the function timeout (300s on Fluid Compute is fine; just don't let it hang forever).
- **Pusher fan-out delay** — typically <100ms but can spike. Don't rely on Pusher for ordering across channels; use the KV write as the source of truth.
- **CORS** — display runs on the same Vercel domain so no CORS needed. Vision and remote-agent are server-side calls so also no CORS.
- **KV cost** — staying inside the free tier is easy at demo volumes; just don't accidentally spam writes from a debug loop.
- **Auth** — INTERNAL_TOKEN protects the API surface from prying eyes. Rotate it after the hackathon.
- **Single-call assumption** — the bridge currently routes by `callSid`. `current_call_sid` in KV gives the display a hint to follow only the active call. If you want to allow multiple concurrent demos, you'll have to scope KV more carefully.
