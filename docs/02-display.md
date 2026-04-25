# 02 — Display (Next.js TV view)

The screen behind the fish tank. Shows option A on the left, option B on the right, a 5s countdown, a live tally of how many fish are on each side, and the executing-action status.

## Tech

- Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui.
- Pusher JS client.
- Runs in Chrome kiosk mode on the Mac mini, fullscreened on the TV via HDMI.

## What it owns

- Page: `/display`.
- **Subscribes** to: `options`, `fish-pos`, `agent-status`.
- **Publishes** to: `decisions` (one event per stage, after countdown ends).

## Files

```
web/app/display/
├── page.tsx                       Server component shell
├── DisplayClient.tsx              Client component, owns Pusher subscriptions
├── components/
│   ├── OptionCard.tsx             Big A/B card
│   ├── FishTally.tsx              L:R count + 3 fish icons
│   ├── Countdown.tsx              5s ring with ms-precision
│   ├── ExecutingPanel.tsx         Status feed during agent execution
│   └── IntroIdle.tsx              Pre-call "waiting for the council" state
├── lib/voteRule.ts                Mode-of-frame-majority over rolling window
└── lib/pusherClient.ts            Singleton Pusher client
```

## State machine

```
idle  →  options received  →  countdown (5s)  →  decision published  →  executing  →  done  →  idle
                                                       ↑
                                                       │ uses voteRule(buffer)
```

- `idle` — show "ready" placeholder + small fish tally so you can see vision is alive.
- `countdown` — render A/B cards, ring timer counting from 5.0s, big L:R tally, fish icons jumping sides on each `fish-pos` tick. **Buffer the last 30 `fish-pos` events**.
- At t=0:
  1. Run `voteRule(buffer)` → `"A"` or `"B"`.
  2. POST to Pusher (server) via `/api/decisions/publish` (or trigger client-side if Pusher client auth allows): `decisions { stage, chosen, text, vote }`.
  3. Animate the lock — winner card scales up, loser fades.
- `executing` — show large status text from `agent-status` (latest event), small spinner. On `agent-status: { type: "done" }`, transition to `done`, then back to `idle` waiting for the next `options` event.

## Vote rule

```ts
// lib/voteRule.ts
function voteRule(buffer: FishPos[]): "A" | "B" {
  const perFrame = buffer.map(f =>
    f.counts.L > f.counts.R ? "A" :
    f.counts.R > f.counts.L ? "B" : "tie"
  );
  const a = perFrame.filter(s => s === "A").length;
  const b = perFrame.filter(s => s === "B").length;
  if (a > b) return "A";
  if (b > a) return "B";
  // Fallback: total fish-frames per side across the window
  const totalL = buffer.reduce((s, f) => s + f.counts.L, 0);
  const totalR = buffer.reduce((s, f) => s + f.counts.R, 0);
  if (totalL > totalR) return "A";
  if (totalR > totalL) return "B";
  return Math.random() < 0.5 ? "A" : "B"; // log this if it ever happens
}
```

## Visual design

- Black background. White options text. Card edges glow blue when active.
- Option A on the left half, option B on the right half — physically aligned with the tank halves below.
- L:R tally: three fish glyphs, each rendered on the side it was last seen. Update every `fish-pos` tick.
- Countdown ring around the center of the screen (between/above the cards).
- Lock animation: winner card scales 1.0 → 1.05 + glow brightens, loser dims to 30% opacity.
- During `executing`: the chosen card stays large, status feed renders below it.

## Manual overrides

- `A` key → force decision A (publish the same event the vote rule would).
- `B` key → force decision B.
- `R` key → reset to idle (in case demo desynced).
- `M` key → mute fish-tally (if it's distracting during a screenshot).

These are demo-day insurance, not for normal use.

## Smoke tests

1. Open `/display`. Without any data, it should show idle state with fish tally at 0:0.
2. From a script, publish a fake `fish-pos` event → tally + fish icons update.
3. Publish a fake `options` event → cards render, countdown starts.
4. Let the countdown end → confirm a `decisions` event fires with the side that had higher counts (or fall back to coin-flip).
5. Publish `agent-status` events → status panel updates.

## Pitfalls

- **Browser tab throttling** — if the display tab loses focus, `requestAnimationFrame` and `setInterval` get throttled. Run Chrome with `--disable-background-timer-throttling --disable-backgrounding-occluded-windows`. Better: keep the tab focused.
- **Pusher reconnection** — on Wi-Fi blip, re-subscribe and re-fetch current stage from `/api/state` to avoid being stuck mid-countdown.
- **Card text length** — Claude can generate long option strings. Truncate to 80 chars with ellipsis or shrink font dynamically, otherwise the cards look terrible.
- **Clock drift** — countdown uses `performance.now()`, not `Date.now()`. Don't rely on the `ts` field of `fish-pos` events for timing the countdown.
