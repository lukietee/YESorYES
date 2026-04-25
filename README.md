# Guppy Council

Three guppies. One TV. Two MacBooks. A phone number. Decisions get made.

A user calls a Twilio number, talks to a snarky "fish" voice agent, two options appear on a TV behind a fish tank, the guppies vote (majority of which side they're on), and the winning option is then executed by a remote computer-use agent on a separate MacBook in real time.

## Layout

```
web/            Next.js + Vercel — TV display + orchestration HTTP API + Vercel KV
bridge/         Node service on Fly.io — Twilio call audio ↔ Deepgram ↔ Claude ↔ ElevenLabs
vision/         Python on Mac mini — DJI Osmo 3 capture, OpenCV multi-fish detection
remote-agent/   Node on remote MacBook — Anthropic Computer Use loop, no UI
docs/           Architecture + per-component docs + hour-by-hour workflow
```

## Where to start

1. Read `docs/00-overview.md`.
2. Then `docs/workflow.md` for the hour-by-hour build order.
3. Each runtime has its own README inside its folder.

## Tech

- Twilio (phone) → Fly.io bridge → Deepgram (STT) → Claude Haiku 4.5 (brain + tool use) → ElevenLabs (TTS).
- Vercel hosts the Next.js display + orchestration API.
- Pusher Channels for cross-runtime realtime pub/sub.
- Anthropic Computer Use (claude-opus-4-7) drives the remote MacBook.
