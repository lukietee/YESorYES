## Inspiration

We wanted the most unhinged possible use of 36 hours. The premise: take an actual fish tank with three real guppies and put it in charge of a real human's real life — over the phone, in real time, with real consequences on a real MacBook. No prompt, no UI, no off-ramp. The fish decide, your computer obeys.

## What it does

You call a Twilio number. A snarky AI fish picks up. You tell it about something going on in your life — a breakup, a meeting you forgot, the job you just lost. The fish picks two options for you, one slightly bad and one catastrophically bad, and shows them on a TV mounted behind a real fish tank. Three guppies swim around. Whichever side of the tank the majority of fish are on when the countdown ends, *that* is the option that wins. A second MacBook then actually does the thing — sends the iMessage, drafts the Outlook email, posts to LinkedIn — while you watch on the TV.

The fish are not a metaphor. The fish are the decision-maker.

## How we built it

Four runtimes glued together with a realtime bus:

- **bridge** (Node on Fly.io) — Twilio Media Streams ↔ Deepgram (STT) ↔ Claude Haiku 4.5 ↔ ElevenLabs (TTS). Claude is locked to three hardcoded scenarios and exposes four tools: `present_options`, `wait_for_decision`, `dispatch_action`, `report_done`.
- **vision** (Python on a Mac mini) — DJI Osmo Pocket 3 capture, OpenCV blob detection across the tank, publishing per-frame fish-position counts at 30 Hz.
- **web** (Next.js on Vercel) — `/display` page rendered on the TV, orchestration HTTP API, Redis state, Pusher pub/sub. Implements the vote rule (1-second rolling majority).
- **remote-agent** (Node on a second MacBook) — subscribes to dispatch events, runs scripted Playwright + osascript flows per scenario. Originally Anthropic Computer Use; we rewrote it as scripted runners after "60 seconds of an LLM clicking around" got too slow for a live demo.

Five Pusher channels tie it together: `fish-pos`, `options`, `decisions`, `agent-tasks`, `agent-status`.

## Challenges we ran into

- **Fish do not respect software deadlines.** Real guppies sometimes hover dead-center for 5 seconds while a countdown ticks. We added a 1-second rolling-majority vote rule so a single confused fish doesn't tie the election.
- **OpenCV kept fusing two close fish into one blob.** Beefed up morphology with dilation and split logic.
- **LinkedIn hydrates *after* the share-box renders**, so `click("Start a post")` would fire on a not-yet-interactive element. Added overlay-dismissal and a `force: true` click fallback.
- **Claude wanted to freelance on options.** Locking the persona to three verbatim, non-negotiable scenarios fixed the drift.
- **An unmatched dispatch text once silently fell through to a default stage script that opened twitter.com.** We removed the fallback entirely so unrecognized text now no-ops instead of going to the wrong site.

## Accomplishments that we're proud of

- A real phone number that, when called, results in a real LinkedIn post written by an AI being approved by three real fish.
- Sub-second perceived latency end-to-end on the call.
- A scripted Playwright runner that completes a full scenario in ~5 seconds (down from ~60s of computer-use clicking around).
- Three guppies who, against all odds, made decisions we did not regret in front of an audience.

## What we learned

- Realtime fan-out across four runtimes is much easier with one Pusher channel per concern than one giant channel-of-everything.
- "Computer use" is great for capability demos and miserable for live demos. Scripted automation, when the surface area is fixed, wins on speed and reliability every time.
- Fish are surprisingly good product managers. Decisive. No scope creep.

## What's next for YES? or YES!

- More scenarios. Currently three (breakup, meeting, job loss); want to ship a fourth before anyone reasonable can stop us.
- Per-fish identity tracking, so you can vote with a *specific* guppy instead of a per-side blob count.
- A leaderboard of regrets.
