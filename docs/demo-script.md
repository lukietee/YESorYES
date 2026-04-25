# Demo Phone-Call Script

Read or paraphrase the **Caller** lines on the demo phone. The **Fish** lines are roughly what the persona prompt should produce — they're not scripted on the agent side. Adjust delivery if the model lands somewhere different. The visuals column tells you what should be on the TV at that moment.

Total target runtime: **5–7 minutes**. Don't go faster than the agent can execute; the audience needs to watch the remote MacBook do its thing.

---

## Stage 0 · intro (~30s)

| Caller | Fish (roughly) | TV |
|---|---|---|
| *(dial Twilio number, fish picks up)* | "What." or "Council of guppies, what do you want." | idle screen |
| "Bro I just got broken up with by my girlfriend of 5 years, I don't know how to cope." | "Five years. Bold of her. Stand by, we're picking your two paths." | options appear → countdown |

Tool calls expected: `present_options("ig-swipe", ...)` then `wait_for_decision`.

---

## Stage 1 · ig-swipe (~90s)

| Caller | Fish | TV |
|---|---|---|
| *(silence — let the fish do their thing)* | (filler line during voting: "deliberating.") | A: Text your ex again<br>B: Swipe up on random IG stories<br>**5s countdown** |
| | "Council says swipe. Predictable." *(after wait_for_decision)* | winner card scales up |
| | "We're opening Instagram. Mute your phone if you don't want to hear typing." *(after wait_for_agent_status)* | EXECUTING — `opened Instagram` |
| | "DMing five lucky strangers." | EXECUTING — `DMing @demo_friend1` ... |
| | "She replied. Time to fly somewhere." | EXECUTING — `@demo_friend2 replied` |

Tool calls: `present_options` → `wait_for_decision` → `dispatch_action` → `wait_for_agent_status` (until done) → next stage.

---

## Stage 2 · book-flight (~90s)

| Caller | Fish | TV |
|---|---|---|
| | "Where are you taking her? We have suggestions." | A: One-way to Las Vegas<br>B: One-way to Paris<br>**5s countdown** |
| | "Vegas. Of course." | winner card |
| | "Booking your flight. Do not pay attention to the price." | EXECUTING — `searching Google Flights` ... `picked $189 to LAS` |

Optional caller line if there's a long execution lull: "Wait, are we actually flying?" — gives the fish room to land another snarky line.

---

## Stage 3 · book-activity (~90s)

| Caller | Fish | TV |
|---|---|---|
| | "Now what are you doing on this date." | A: Helicopter night tour<br>B: Couples cup-stacking class<br>**5s countdown** |
| | "Cup stacking. Fish chose violence." | winner card |
| | "Booking the cup-stacking class. May god help her." | EXECUTING — `booking activity` |

Pick activity options that *contrast hard* — a chaotic option only works as a punchline if option A is reasonable.

---

## Stage 4 · book-restaurant (the closer, ~90s)

| Caller | Fish | TV |
|---|---|---|
| | "Final stage. Pick a place." | A: Per Se (3 Michelin stars)<br>B: Sammy's Diner (1 star, mostly hair complaints)<br>**5s countdown** |
| | "Sammy's Diner. The fish are committed to the bit." | winner card |
| | "Reserving Sammy's." | EXECUTING — `OpenTable: 7 PM tomorrow, 2 guests` |
| | "Reservation confirmed. Good luck." | EXECUTING — `done · confirmation #...` |
| "...thanks I think?" | "We're three fish. We're not licensed. Hang up." | (hold a beat) |

End the call yourself — fish doesn't initiate hangup.

---

## Failure-mode rescue lines

If the bridge stalls for more than ~5s with no narration:
- Caller: "...you guys still there?"
- Fish (likely response): "Council convening. Patience."

If the remote agent visibly fails:
- Caller: "Did you just crash?"
- Fish: "Tank lost power. Try again."
- Press `R` on the display to reset, then call back.

If the fish parks in the middle and the countdown is about to lock a tie:
- Press `A` or `B` on the display to force a side. (Manual override.)

If a stage's options are too long to read on TV:
- They're already truncated by the prompt. If you see a card overflowing, it's a model regression — accept it for the demo and tweak the persona post-demo.

---

## Pre-call ritual (60s before showtime)

1. Open `/display` on the Mac mini in fullscreen kiosk Chrome.
2. Verify `vision/main.py` is running and `total=3` most frames in the Pusher debug console.
3. Confirm the remote-agent log is showing `connected to Pusher`.
4. Place a 10-second test call. Hang up after the fish's first line. Reset display with `R`.
5. Take a deep breath. You are about to put a goldfish in charge of a real reservation.
