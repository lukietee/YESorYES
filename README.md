# YES or YES

Three guppies. One TV. Two MacBooks. A phone number. Decisions get made — yes or yes.

A user calls a Twilio number, talks to a snarky "fish" voice agent, two options appear on a TV behind a fish tank, the guppies vote (majority of which side they're on), and the winning option is then executed by a remote MacBook in real time.

## How a call works

```
caller ── Twilio ──► bridge (Fly.io) ──► Deepgram (STT)
                          ▲                    │
                          │                    ▼
                    ElevenLabs (TTS)     Claude Haiku 4.5
                          ▲                    │
                          └──── tool calls ────┤
                                               ▼
                          web (Vercel) ── Redis ── Pusher Channels
                                               │
                            ┌──────────────────┼─────────────────┐
                            ▼                  ▼                 ▼
                        /display TV       vision (Mac mini)   remote-agent
                       (A/B + countdown)  (OpenCV @ 30 Hz)    (Playwright + osascript)
```

1. **Caller dials** the Twilio number; audio streams into the **bridge**.
2. **Bridge** transcribes with Deepgram, feeds the running transcript to **Claude**, and speaks Claude's replies back via ElevenLabs.
3. Claude listens for whatever mess the caller is in, frames it as a binary choice, and calls `present_options(stage, A, B)`. The bridge POSTs that to the **web** orchestration API, which writes Redis state and publishes to Pusher.
4. The **TV display** subscribes to `options` and renders A vs B with a countdown. **Vision** publishes per-frame fish counts on `fish-pos` at 30 Hz; the display tallies which side has the majority over a 1-second rolling window.
5. When the countdown ends, `/display` publishes a `decisions` event with `{stage, chosen, text, vote}`. The bridge's `wait_for_decision` tool unblocks, Claude announces the winner, then calls `dispatch_action(stage, chosen, text)`.
6. The **remote-agent** is subscribed to `agent-tasks`, picks up the dispatch, and carries the winning option out on a second MacBook — composing an iMessage, setting a Reminder, drafting an Outlook email, posting to LinkedIn, whatever the option calls for. Status updates stream back through Pusher to the TV.

## What the fish can do

The persona is built around real-life "should I, or should I really" moments — breakups, missed meetings, getting laid off, and so on. Claude turns the caller's situation into a pair of options (one defensible, one regrettable), the council picks, and the remote agent makes it happen.

| Vibe | Sample option A | Sample option B |
|---|---|---|
| Just-broke-up energy | Text a coworker | Text the ex |
| Forgot a meeting | Set a reminder | Email your boss to frick off |
| Got laid off | Beg for a job on LinkedIn | Post your `.env` on LinkedIn |

The option set isn't fixed — Claude composes options live from the call, and new outcomes can be wired into the remote agent without touching the bridge.

## Layout

```
web/            Next.js + Vercel — TV display + orchestration HTTP API + Redis state
bridge/         Node service on Fly.io — Twilio call audio ↔ Deepgram ↔ Claude ↔ ElevenLabs
vision/         Python on Mac mini — DJI Osmo Pocket 3 capture, OpenCV multi-fish detection,
                live MJPEG preview server on :8765
remote-agent/   Node on remote MacBook — Playwright + osascript runner that executes the chosen option
scripts/        Mock event publisher for end-to-end smoke tests
docs/           Per-component docs + hour-by-hour workflow + demo script
```

## Where to start

1. `docs/00-overview.md` — system map and glossary.
2. `docs/03-bridge.md` — call flow, tool calls, persona prompt.
3. `docs/05-remote-agent.md` — how the remote agent picks up and runs an option.
4. `docs/workflow.md` — hour-by-hour build order.
5. Each runtime has its own README inside its folder.

## Tech

- **Twilio** (phone) → **Fly.io bridge** → **Deepgram** (STT) → **Claude Haiku 4.5** (brain + tool use) → **ElevenLabs** (TTS)
- **Vercel** hosts the Next.js display + orchestration API
- **Pusher Channels** for cross-runtime realtime pub/sub: `fish-pos`, `options`, `decisions`, `agent-tasks`, `agent-status`
- **Upstash / Redis Cloud** (via Vercel Marketplace) for per-call state
- **Playwright** (headed Chromium) + **osascript** drive the remote MacBook
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
