# 05 — Remote Agent (headless MacBook, Anthropic Computer Use)

The arms and legs of the fish. Headless Node script that subscribes to `agent-tasks` and runs an Anthropic Computer Use loop on the remote MacBook to carry out whichever option the council just picked.

## Tech

- Node 20+, TypeScript.
- `@anthropic-ai/sdk` with computer-use beta.
- `pusher-js` (subscriber).
- `axios` or `node-fetch` for status posts.
- macOS 14+ on the remote MacBook.

## What it owns

- **Subscribes** to: `agent-tasks` (Pusher channel).
- For each task, drives a Computer Use loop (model: `claude-opus-4-7`).
- **Posts** status updates to `POST /api/agent/status`.

No HTTP server. No UI. Just a long-running process.

## Files

```
remote-agent/
├── src/
│   ├── index.ts              Pusher subscriber + task dispatcher
│   ├── computerUse.ts        Anthropic Computer Use loop
│   ├── tools.ts              computer / bash / text_editor tool wrappers
│   ├── stages/
│   │   ├── ig-swipe.ts       Stage system prompt
│   │   ├── book-flight.ts
│   │   ├── book-activity.ts
│   │   └── book-restaurant.ts
│   └── status.ts             Helper to POST /api/agent/status
├── package.json
└── .env.example
```

## Computer Use loop (sketch)

```ts
async function runStage(task: AgentTask) {
  const stagePrompt = STAGE_PROMPTS[task.stage];
  const messages = [{ role: "user", content: task.instruction }];

  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > task.timeoutSec * 1000) {
      await postStatus({ stage: task.stage, type: "error", detail: "timeout — fish gave up" });
      return;
    }

    const resp = await anthropic.beta.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: stagePrompt,
      tools: [
        { type: "computer_20250124", name: "computer", display_width_px: 1920, display_height_px: 1080 },
        { type: "bash_20250124", name: "bash" },
        { type: "text_editor_20250124", name: "str_replace_editor" },
      ],
      betas: ["computer-use-2025-01-24"],
      messages,
    });

    messages.push({ role: "assistant", content: resp.content });

    const toolUses = resp.content.filter(c => c.type === "tool_use");
    if (toolUses.length === 0) {
      // Final answer — post done and exit
      const finalText = resp.content.find(c => c.type === "text")?.text ?? "";
      await postStatus({ stage: task.stage, type: "done", detail: finalText });
      return;
    }

    const toolResults = [];
    for (const tu of toolUses) {
      const result = await runTool(tu); // screenshots, clicks, typing, bash, etc.
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });

      // Best-effort progress beacon
      if (tu.name === "computer" && tu.input?.action === "screenshot") continue;
      await postStatus({
        stage: task.stage,
        type: "progress",
        detail: summarizeAction(tu),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}
```

`runTool` uses `screencapture`, `cliclick`, and AppleScript under the hood (or a library like `nut-js`). Anthropic publishes a reference Docker image that wraps these — adapt that for native macOS.

## Stage prompts

Keep each one short. The user message (the task instruction from `agentTasks.ts`) does most of the work; the system prompt sets guardrails.

### `stages/ig-swipe.ts`
```
You are a computer-use agent operating a MacBook to demo a hackathon project.

Hard constraints:
- Use Chrome, already open and logged in to the demo Instagram account.
- DM only the accounts in this approved list: @demo_friend1, @demo_friend2, @demo_friend3, @demo_friend4, @demo_friend5. NEVER DM anyone outside this list.
- Send the same friendly message to each: "Hey, would you want to grab dinner this weekend?"
- Stop immediately when any of them replies. Do not retry, do not improvise.
- Speak briefly to yourself between actions; the operator is watching.
```

### `stages/book-flight.ts`
```
Open Google Flights. Search round-trip from {origin} to the destination in the user's instruction. Pick a flight under $400 leaving the next weekend. Add it to the cart but DO NOT submit payment. Take a screenshot of the cart. The "booking" is the screenshot.
```

### `stages/book-activity.ts` and `stages/book-restaurant.ts`
Same pattern. Real OpenTable for restaurants is fine on a friend's name with their consent. Flight + activity stop before payment.

## Pre-flight checklist (the night before)

- [ ] Disable system sleep, disable display sleep, disable screensaver.
- [ ] Sign in to: Instagram (demo throwaway), Google (demo flights account), OpenTable (demo account).
- [ ] Pin display resolution to 1920×1080 (matches `display_width_px` in tool config).
- [ ] System Settings → Privacy & Security → grant Screen Recording + Accessibility to Terminal/iTerm/Node.
- [ ] Test that screenshots, clicks, and keystrokes work via a 30-second smoke run.
- [ ] Set up live screen-share back to the demo room (Zoom, AirPlay to a TV, or QuickTime + cable).
- [ ] Disable notifications (Do Not Disturb on, all Slack/iMessage/email muted).
- [ ] Quit every app except Chrome and Terminal.
- [ ] Pre-record a fallback clip for each stage in case the agent derails mid-demo.

## Smoke tests

1. **Tool wrapper alone**: a script that calls `runTool({type: "tool_use", name: "computer", input: {action: "screenshot"}})` and saves the PNG.
2. **Loop alone**: invoke `runStage()` with a trivial task ("open google.com and search 'fish council'"). Confirm status events appear.
3. **Real stage prompt + dummy task**: run `ig-swipe` against a sandboxed account.
4. **Wired up**: publish a fake `agent-tasks` event from a script → confirm the agent picks it up and runs.

## Pitfalls

- **Permissions are the #1 footgun**. If `screencapture` returns blank or `cliclick` is no-op, it's almost always Screen Recording or Accessibility not granted to the parent process. Restart Terminal after granting.
- **DPR and retina displays** — the model thinks in `display_width_px`/`display_height_px`. If the screen is 2x DPR, you may need to scale tool input. Pinning resolution avoids this.
- **Model wandering** — if Claude keeps clicking the wrong thing, tighten the system prompt with explicit step-by-step ordering or pre-navigate the tab to the right starting URL.
- **Timeouts** — the per-stage hard cap is your friend. Without it, the demo can hang on one bad screen.
- **Status spam** — don't post a status update for every screenshot. Filter to actions that matter.
- **Cost** — Computer Use can rack up tokens fast. Cap `max_tokens` and the loop iteration count (e.g. max 30 iterations per stage).
- **No-UI assumption** — even though there's no UI on this MacBook, the *screen* must still be on and unlocked. Disable the lockscreen for demo day.
