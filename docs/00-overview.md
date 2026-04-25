# 00 — Overview

The Guppy Council. Three guppies. One TV. Two MacBooks. Limitless poor decisions.

## What it is

Hackathon demo: a user calls a phone number, talks to a "fish" voice agent. Two options appear on a TV behind a fish tank. Three guppies vote (majority of "which side is each fish on"). The winning option is then executed by a computer-use agent on a remote MacBook in real time.

## Four runtimes, one realtime bus

| Runtime | Where it runs | Owns |
|---|---|---|
| **web** | Vercel | TV display page, orchestration HTTP API, Vercel KV state |
| **bridge** | Fly.io | Twilio call audio ↔ Deepgram ↔ Claude Haiku 4.5 ↔ ElevenLabs |
| **vision** | Mac mini (hotel room) | DJI Osmo 3 capture, OpenCV multi-fish detection |
| **remote-agent** | Remote MacBook (no UI) | Anthropic Computer Use loop on macOS |

Realtime bus: **Pusher Channels**. Five channels: `fish-pos`, `options`, `decisions`, `agent-tasks`, `agent-status`.

## End-to-end flow

```
phone call
   ↓
Twilio  →  bridge (Fly.io)  ←→  Deepgram + Claude + ElevenLabs
              │
              │  HTTP: present_options, wait_for_decision, dispatch_action
              ↓
         web (Vercel) — KV state — Pusher pub/sub
              │
              ├──→ /display on TV (subscribes to options + fish-pos)
              │       ↑
              │       └── vision.py publishes fish-pos at 30 Hz
              │
              └──→ remote-agent on second MacBook
                       (subscribes to agent-tasks, runs computer-use loop)
```

## Per-doc map

- **01-vision.md** — Mac mini OpenCV: detect 3 fish, count L/R, publish at 30 Hz.
- **02-display.md** — Next.js `/display` page: A/B cards, 5s countdown, vote rule, publishes decision.
- **03-bridge.md** — Fly.io Node service: Twilio Media Streams ↔ STT ↔ LLM ↔ TTS.
- **04-orchestration.md** — Vercel API routes, KV state, Pusher publishing, stage state machine.
- **05-remote-agent.md** — Headless Node script with Anthropic Computer Use, one prompt per stage.
- **06-deployment.md** — Account setup, env vars, deploy commands, on-site setup checklist.
- **workflow.md** — Hour-by-hour timeline, builder splits, critical path.

## Glossary

- **Stage** — one segment of the call: `intro`, `ig-swipe`, `book-flight`, `book-activity`, `book-restaurant`.
- **Vote rule** — at countdown end, mode of per-frame majorities over a 1-second rolling window.
- **Tool calls** — Claude function calls from inside the bridge: `present_options`, `wait_for_decision`, `dispatch_action`, `report_done`.
- **Decision** — `{stage, chosen: "A"|"B", text, vote: {L, R}}` event published by `/display`.

## Non-goals (don't get sucked into these)

- Per-fish identity tracking. We just count blobs per side.
- A pretty admin UI. KV + Pusher debug console is enough during the build.
- Persisting calls beyond the demo. KV is ephemeral demo state.
- Real reservations or DMs to strangers. Staged demo accounts only — see 05-remote-agent.md.
