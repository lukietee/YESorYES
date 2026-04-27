# YES? or YES!

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
3. The **TV display** subscribes to `options` and renders A vs B with a countdown. **Vision** publishes per-frame fish counts on `fish-pos` at 30 Hz; the display tallies which side has the majority over a 1-second rolling window.
4. When the countdown ends, `/display` publishes a `decisions` event with `{stage, chosen, text, vote}`. The bridge's `wait_for_decision` tool unblocks, Claude announces the winner, then calls `dispatch_action(stage, chosen, text)`.
5. The **remote-agent** is subscribed to `agent-tasks`, picks up the dispatch, and executes a **scripted Playwright + osascript flow** on a second MacBook (e.g. compose an iMessage, set a Reminder, draft an Outlook email, post to LinkedIn). Status updates stream back through Pusher to the TV.

## The three scenarios

All three currently share `stage = "ig-swipe"`; the executed action is selected by the dispatched `text` field, not the stage.

| Scenario | Trigger | Option A (good-ish) | Option B (regrettable) |
|---|---|---|---|
| Breakup | "I broke up with…" | Text coworker | Text ex |
| Meeting | "I forgot a meeting…" | Set a reminder | Email boss to frick off |
| Job loss | "I got laid off…" | Beg for a job on LinkedIn | Post your `.env` on LinkedIn |

Adding a scenario is two files: a new entry in `bridge/src/persona.ts` for the option strings, and a new script in `remote-agent/src/scripted/` registered in `TEXT_SCRIPTS`.

## Layout

```
web/            Next.js + Vercel — TV display + orchestration HTTP API + Redis state
bridge/         Node service on Fly.io — Twilio call audio ↔ Deepgram ↔ Claude ↔ ElevenLabs
vision/         Python on Mac mini — DJI Osmo Pocket 3 capture, OpenCV multi-fish detection,
                live MJPEG preview server on :8765
remote-agent/   Node on remote MacBook — scripted Playwright + osascript runner per scenario
scripts/        Mock event publisher for end-to-end smoke tests
docs/           Per-component docs + hour-by-hour workflow + demo script
```

## Where to start

1. `docs/00-overview.md` — system map and glossary.
2. `docs/03-bridge.md` — call flow, tool calls, persona prompt.
3. `docs/05-remote-agent.md` — scripted runner, adding scenarios.
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
