# Workflow — Hour-by-Hour Timeline

**Assumptions** (adjust the math if any of these change):
- 36-hour hackathon (≈ Friday 7 PM → Sunday 7 AM).
- 2 builders. Designate **A = Frontend/Orchestration** (web app, display, Vercel API, vision) and **B = Audio + Agent** (bridge, remote agent).
- Both builders take a 4-hour sleep block. The plan budgets one each.
- Demo presented at **H+34** with a 2-hour buffer.

If you have a 24-hour event, compress by skipping the polish window (H+22 to H+30) and accepting a rougher demo. If 48 hours, double up on polish + rehearsal time.

## Critical path

```
accounts/setup → vision works → display works ─┐
                                                ├→ full demo loop → polish → rehearsal
            bridge: STT → LLM → TTS works   ───┤
            remote-agent stage prompts work ───┘
```

The bridge is the longest pole. A is mostly unblocked once vision + display work; B should not stop on bridge until it's fully looped.

## Timeline

### H+0 → H+2 — Kickoff & accounts (both)
Sit together for this so nobody duplicates account creation.

- [ ] Create Twilio, Deepgram, ElevenLabs, Anthropic, Pusher, Vercel, Fly accounts.
- [ ] Buy Twilio number; pick ElevenLabs voice (audition 5, pick the deadpan one).
- [ ] Create the repo. Decide monorepo vs four sibling folders. Commit empty scaffolds for `web/`, `bridge/`, `vision/`, `remote-agent/`.
- [ ] Generate `INTERNAL_TOKEN` once, share via 1Password / signed Slack.
- [ ] Stand up Pusher app, save keys to a shared `.env.shared` (gitignored).
- [ ] Provision Vercel KV via Marketplace.
- [ ] Buy guppies + tank if not already bought. Acclimate them. (Don't underestimate this; the fish need to be calm by demo time.)

### H+2 → H+6 — Skeletons (parallel)

**A — web + vision**
- [ ] `npx create-next-app@latest web --ts --app --tailwind`. Add shadcn. Push to Vercel.
- [ ] `lib/pusher.ts`, `lib/kv.ts`, `lib/types.ts`, `lib/auth.ts`.
- [ ] `app/api/options/present/route.ts` + `app/api/options/decision/route.ts` — happy path only, with KV writes + Pusher publish + bearer auth.
- [ ] `vision/main.py` skeleton: capture from default camera, print frame size, no detection yet.

**B — bridge skeleton**
- [ ] `bridge/` Node project with Fastify + WebSocket plugin.
- [ ] `POST /twilio/voice` returns a static TwiML stub. Deploy to Fly. Verify with `curl`.
- [ ] Wire Twilio number → bridge URL. Place a real call → confirm Twilio logs hit.
- [ ] WS `/twilio` accepts the connection and logs `start` events. Hang up cleanly.

### H+6 → H+10 — First isolated wins (parallel)

**A — vision detection**
- [ ] HSV mask + contour detection in `vision/main.py`. Test on a printed orange circle.
- [ ] `calibrate.py` ROI clicker + HSV slider tool.
- [ ] Publish to Pusher `fish-pos`. Verify in Pusher debug console.
- [ ] If you have the actual fish: tune HSV under demo lighting.

**B — bridge audio path (no LLM yet)**
- [ ] Twilio Media Streams WS handler: parse media frames, base64 → bytes.
- [ ] Pipe inbound audio to Deepgram streaming WS. Log transcripts on a real call.
- [ ] Send a canned ElevenLabs `ulaw_8000` clip back to Twilio on the WS. Confirm you hear it.

**Checkpoint: Smoke #1 (vision) and Smoke #3 (bridge STT) green.**

### H+10 → H+14 — Display + bridge brain (parallel)

**A — display page**
- [ ] `app/display/page.tsx` + `DisplayClient.tsx`. Subscribe to `options`, `fish-pos`.
- [ ] Render A/B cards, fish-tally with three icons, 5s countdown.
- [ ] Implement `voteRule` and `/api/decisions/publish`. Wire countdown end.
- [ ] Manual override hotkeys.

**B — Claude in the loop**
- [ ] `claude.ts`: streaming Messages with system prompt + cache_control + tool defs.
- [ ] Plumb: Deepgram transcript → append user message → stream Claude response → ElevenLabs TTS → Twilio.
- [ ] Verify audio is two-way and persona is roughly right.
- [ ] Implement `present_options` + `wait_for_decision` HTTP tool calls (don't worry about decisions completing yet — just verify the bridge calls web).

**Checkpoint: Smoke #2 (display) and Smoke #4 (bridge full) green.**

### H+14 → H+18 — Sleep block #1 (one builder at a time, or both)

If you can both sleep here, do it. If not, the one ahead stays up; the other rests.

### H+18 → H+22 — Bridge ↔ display loop, remote agent skeleton (parallel)

**A — finish display + dispatch endpoint**
- [ ] `agent/dispatch/route.ts`: looks up template, publishes `agent-tasks`.
- [ ] `agent/status/route.ts`: writes KV, republishes `agent-status`.
- [ ] Display: subscribe to `agent-status`, render `ExecutingPanel`.
- [ ] Smoke: full call → see options on TV → countdown → decision → status updates rendered.

**B — remote-agent skeleton**
- [ ] `remote-agent/index.ts`: subscribe to `agent-tasks`, log events.
- [ ] `computerUse.ts`: minimal loop with `computer` tool, run a "open google.com" task on the actual remote MacBook.
- [ ] Verify Screen Recording + Accessibility permissions are working.
- [ ] `status.ts` posts back to `/api/agent/status`.

**Checkpoint: Smoke #5 (bridge ↔ display) and Smoke #6 (agent alone) green.**

### H+22 → H+26 — Stage prompts + first full loop (together)

Sit together. The hard part is making Claude reliably do *each* stage.

- [ ] Write all 4 stage prompts (`ig-swipe`, `book-flight`, `book-activity`, `book-restaurant`) in `remote-agent/stages/`.
- [ ] Write the matching task templates in `web/lib/agentTasks.ts`.
- [ ] Write the persona system prompt in `bridge/src/persona.ts` with explicit stage flow.
- [ ] Run a real call end-to-end. Watch where it derails.
- [ ] Iterate: tighten prompts, add stage transitions, fix tool-call sequencing.

**Checkpoint: Smoke #7 (full loop) green at least once.**

### H+26 → H+30 — Polish + reliability (parallel)

**A — visuals + safety nets**
- [ ] Make `/display` look great on the TV. Big text. Card animations. Lock effect.
- [ ] Pre-render filler audio clips for the bridge.
- [ ] Wire manual override keys + verify they don't break state.
- [ ] Add `/api/state` for display resync.

**B — agent reliability**
- [ ] Per-stage timeouts.
- [ ] Pre-record fallback clips per stage.
- [ ] Log everything; rate-limit status posts.
- [ ] Test each stage individually with sample option pairs.

### H+30 → H+32 — Sleep block #2

Both builders, if at all possible. Demo brain needs to be rested.

### H+32 → H+34 — Rehearsal (together)

- [ ] Run the full demo three times with the planned script.
- [ ] Time each run. Should fit in ~5–7 minutes.
- [ ] Identify any consistent failure → fix or fall back.
- [ ] Set up final live-screen-share from remote MacBook to the demo room.
- [ ] Charge phones. Bring the demo phone *and* a backup.

### H+34 → H+36 — Buffer + demo

- [ ] Final on-site checklist from `06-deployment.md`.
- [ ] Demo. Don't touch anything for 30 minutes before showtime.

## Stand-up cadence

Sync every 4 hours (skip during sleep blocks). 5 minutes max. One question each:
1. Is your current task on track for the checkpoint?
2. Are you blocked? On what?
3. Anything the other builder needs to know?

## Definition of done per checkpoint

| Checkpoint | Done means |
|---|---|
| Smoke #1 | Pusher debug console shows `fish-pos` events with sane counts |
| Smoke #2 | Display countdown end fires `decisions` matching the displayed tally |
| Smoke #3 | Bridge logs Deepgram transcripts on a real call |
| Smoke #4 | Real call: Claude responds in fish persona, you hear ElevenLabs over the phone |
| Smoke #5 | On a real call, options appear on TV and the bridge gets the decision back |
| Smoke #6 | Publish a fake `agent-tasks` event, the remote agent runs it, status updates appear |
| Smoke #7 | One real call drives all 4 stages end-to-end without manual intervention |

If you're behind on a checkpoint by more than an hour, **cut scope** rather than skipping a sleep block. Suggested cuts in order:

1. Drop `book-activity` stage. Demo with 3 stages.
2. Drop the filler audio entirely. Accept dead air during `wait_for_decision`.
3. Drop the screen-share back to the demo room — record a video instead.
4. Stage the remote agent's actions as pre-recorded screen captures triggered on `agent-tasks`.

## Things that look like work but aren't

- Prettier UI on the bridge admin page (there is no admin page, that's fine).
- Per-fish identity tracking. We just count.
- Multi-call support. One call at a time is the demo.
- Test suites. Hackathon. Smoke tests are the test suite.
- Detailed logging dashboards. `fly logs` and `vercel logs` are enough.
