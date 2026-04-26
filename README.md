# YES or YES

Three guppies. One TV. Two MacBooks. A phone number. Decisions get made — yes or yes.

A user calls a Twilio number, talks to a snarky "fish" voice agent, two options appear on a TV behind a fish tank, the guppies vote (majority of which side they're on), and the winning option is then executed by a remote computer-use agent on a separate MacBook in real time.

## Layout

```
web/            Next.js + Vercel — TV display + orchestration HTTP API + Redis state
bridge/         Node service on Fly.io — Twilio call audio ↔ Deepgram ↔ Claude ↔ ElevenLabs
vision/         Python on Mac mini — DJI Osmo Pocket 3 capture, OpenCV multi-fish detection,
                live MJPEG preview server on :8765
remote-agent/   Node on remote MacBook — Anthropic Computer Use loop, no UI
scripts/        Mock event publisher for end-to-end smoke tests
docs/           Architecture + per-component docs + hour-by-hour workflow + demo script
```

## Where to start

1. Read `docs/00-overview.md`.
2. Then `docs/workflow.md` for the hour-by-hour build order.
3. Each runtime has its own README inside its folder.

## Tech

- **Twilio** (phone) → **Fly.io bridge** → **Deepgram** (STT) → **Claude Haiku 4.5** (brain + tool use) → **ElevenLabs** (TTS)
- **Vercel** hosts the Next.js display + orchestration API
- **Pusher Channels** for cross-runtime realtime pub/sub
- **Upstash / Redis Cloud** (via Vercel Marketplace) for per-call state
- **Anthropic Computer Use** (claude-opus-4-7) drives the remote MacBook
- **OpenCV + DJI Osmo Pocket 3** for fish position detection

## Quick start (no creds, no fish)

```bash
./setup.sh                                  # installs deps for all four runtimes
cd web && npm run dev
open http://localhost:3000/display/dev      # click-through preview of every TV state
```

## Smoke test the live display (Pusher creds only)

```bash
cd scripts && npm run mock -- demo          # full ig-swipe stage runs on /display
```

## Name

YES or YES — because when you put a goldfish in charge of your life, every option is the right one.
