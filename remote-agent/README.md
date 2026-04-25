# remote-agent

Headless Node script. Subscribes to Pusher `agent-tasks`, runs an Anthropic Computer Use loop on this MacBook for each task.

## One-time setup

```bash
brew install cliclick
npm install
cp .env.example .env  # fill in creds
```

Grant the parent process (Terminal/iTerm) permissions in **System Settings → Privacy & Security**:

- Screen Recording
- Accessibility

Restart Terminal after granting.

Pin display resolution to 1920×1080 to match `DISPLAY_WIDTH_PX` / `DISPLAY_HEIGHT_PX` in `.env`.

## Run

```bash
npm run build
npm start
```

Or in dev mode:

```bash
npm run dev
```

## Smoke test

Publish a fake `agent-tasks.dispatch` event from the Pusher debug console with this payload:

```json
{
  "taskId": "test-1",
  "callSid": "demo",
  "stage": "ig-swipe",
  "chosen": "A",
  "instruction": "Open google.com and search for 'fish council'.",
  "timeoutSec": 60
}
```

Confirm the agent picks it up, runs the task, and posts status updates back to the web app.
