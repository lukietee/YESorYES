# Demo-day setup

This guides a fresh agent (or a human) through standing up the YES or YES demo across **two Macs**:

- **Mac mini** — sits in the hotel room. Runs **bridge + ngrok + vision** and drives the TV browser pointed at `/display`. This is the orchestration hub.
- **MacBook (this laptop)** — sits anywhere with internet (e.g. another building). Runs **remote-agent**. Claude computer-use will drive *this* MacBook's screen.

Everything is glued together by **Vercel prod web** (`https://ye-sor-yes.vercel.app`) and **Pusher Channels** (cloud). Geography doesn't matter — only that both Macs have internet.

If you are an agent reading this: do exactly what the section for your machine says. Ask the user when you need a secret you don't have. Do not invent values.

---

## 0. Shared facts (both machines)

- Repo: `https://github.com/lukietee/YESorYES` — work on the `lucas` branch unless told otherwise.
- Vercel prod: `https://ye-sor-yes.vercel.app`
- Pusher: cloud, channels `fish-pos`, `options`, `decisions`, `agent-tasks`, `agent-status`.
- Twilio number: `+1 (657) 286-7162`. Webhook URL is `https://imprudent-feminism-lazily.ngrok-free.dev/twilio/voice`. **Do not change it in the Twilio console** — instead, make sure that ngrok subdomain is being tunneled by whichever Mac is running bridge.
- `INTERNAL_TOKEN` must match across **bridge**, **remote-agent**, and **Vercel prod env**. Default value used in this codebase: `professorkpop`. If Vercel still has a different value, either push `professorkpop` to Vercel (`cd web && vercel env add INTERNAL_TOKEN production`, then `vercel --prod`) or set the bridge/agent envs to whatever Vercel has. Never proceed with a mismatch — every bridge → web call will 401.

---

## 1. Mac mini (orchestration hub) — `bridge + ngrok + vision + TV display`

### 1.1 Repo
```bash
cd ~/Desktop                                # or wherever code lives
[ -d YESorYES ] || git clone https://github.com/lukietee/YESorYES.git
cd YESorYES
git checkout lucas
git pull
```

### 1.2 Bridge
```bash
cd bridge
npm install
```

Create `bridge/.env` if it does not exist. Ask the user to paste the secret values (do not commit this file — it is gitignored).

```env
PORT=8080
TWILIO_ACCOUNT_SID=<from user>
TWILIO_AUTH_TOKEN=<from user>
DEEPGRAM_API_KEY=<from user>
ANTHROPIC_API_KEY=<from user>
ELEVENLABS_API_KEY=<from user>
ELEVENLABS_VOICE_ID=<from user — the fish voice>
WEB_BASE_URL=https://ye-sor-yes.vercel.app
INTERNAL_TOKEN=professorkpop
# Leave PUBLIC_HOST unset so the bridge falls back to req.headers.host (= ngrok host)
```

Verify by running:
```bash
npm run dev
```
Expect:
```
bridge listening on :8080
```
If it crashes with a missing env, ask the user for the value. Leave the bridge running; open a new terminal for ngrok.

### 1.3 ngrok
```bash
which ngrok || brew install ngrok
```
Authenticate once (the auth token is on the user's account — ask them for it, then):
```bash
ngrok config add-authtoken <token>
```
Then tunnel the **reserved subdomain** to the bridge's port:
```bash
ngrok http --url=https://imprudent-feminism-lazily.ngrok-free.dev 8080
```
> If `--url` is rejected on an older ngrok, use `--domain=imprudent-feminism-lazily.ngrok-free.dev`. Both work.

Verify from this same machine:
```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://imprudent-feminism-lazily.ngrok-free.dev/healthz   # → 200
curl -sS -X POST -H "content-type: application/x-www-form-urlencoded" -d "CallSid=TEST" \
  https://imprudent-feminism-lazily.ngrok-free.dev/twilio/voice                                       # → TwiML <Response><Connect><Stream …>
```

If the laptop is still tunneling the same subdomain, ngrok will refuse on the Mac mini. Tell the user to kill ngrok on the laptop first.

### 1.4 Vision
```bash
cd ../vision
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
The `vision/.env` should already exist (gitignored) with valid Pusher creds. If not, ask the user.

For a real demo (no rotating sample options):
```bash
python main.py --camera 0
```

For a self-driving "pretend" demo (rotates a handful of sample option pairs every 7.5s, ignores the bridge):
```bash
python main.py --pretend --camera 0
```

### 1.5 TV display
On whatever browser is plugged into the TV in the hotel room, open:
```
https://ye-sor-yes.vercel.app/display
```
You should see "the council awaits your worst decision". Pressing `r` resets both client and server state. Pressing `a`/`b` during a countdown forces a winner.

### 1.6 Smoke check
1. From the Mac mini, place a call to `+1 (657) 286-7162`.
2. Watch the bridge logs (`tail -f` on its output) — you should see `/twilio/voice` POST → `/twilio` WS → Deepgram transcripts.
3. Hear the goldfish persona over the phone. The Mac mini's display should remain idle until Claude calls `present_options`.

---

## 2. MacBook (remote-controlled target) — `remote-agent` only

### 2.1 Repo
```bash
cd /Users/lukiet/Desktop/YESorYES   # already cloned
git checkout lucas && git pull
```

### 2.2 Stop bridge / web on this laptop (Mac mini owns them now)
```bash
pkill -f "tsx watch src/index.ts" || true   # bridge
# Web dev (port 3000) can keep running as a backup, or kill it the same way.
```

### 2.3 macOS permissions (one-time, **must be done by the human**)
1. System Settings → Privacy & Security → **Screen Recording** → toggle on for the terminal app you'll use (Terminal.app, iTerm, Warp, etc.)
2. System Settings → Privacy & Security → **Accessibility** → toggle on for the same app.
3. Quit the terminal app fully and reopen it, otherwise the permission won't take effect.

Verify:
```bash
screencapture -x /tmp/_perm_test.png && echo "screen ok" || echo "NO SCREEN PERM"
```

### 2.4 remote-agent env + boot
```bash
cd /Users/lukiet/Desktop/YESorYES/remote-agent
npm install

# Point at prod web
sed -i '' 's|^WEB_BASE_URL=.*|WEB_BASE_URL=https://ye-sor-yes.vercel.app|' .env
# INTERNAL_TOKEN must match the bridge/Vercel value (default professorkpop)
grep ^INTERNAL_TOKEN= .env

npm run dev
```
Expect:
```
remote-agent running — Ctrl-C to stop
connected to Pusher, listening on channel `agent-tasks`
```

### 2.5 Smoke check
From any machine with internet:
```bash
curl -X POST https://ye-sor-yes.vercel.app/api/agent/dispatch \
  -H "authorization: Bearer professorkpop" \
  -H "content-type: application/json" \
  -d '{"stage":"ig-swipe","chosen":"A","text":"open google.com","callSid":"smoke"}'
```
The remote-agent log on this MacBook should print:
```
[agent-tasks] received: stage=ig-swipe chosen=A taskId=…
```
Then Claude (`claude-sonnet-4-5` — claude-opus-4-7 does not support computer-use) will start driving the screen. You should see the cursor move and Chrome open `google.com`. Status updates flow back to `https://ye-sor-yes.vercel.app/display`.

If it hangs without taking a screenshot, the perms in 2.3 didn't stick — quit the terminal app fully and reopen.

---

## 3. End-to-end demo

With both machines green:
1. Mac mini's TV browser is on `/display` (idle).
2. Mac mini bridge + ngrok + vision running.
3. MacBook remote-agent running.
4. Place a call to `+1 (657) 286-7162`. Tell the fish your problem.
5. The fish presents two options → display flips to countdown.
6. Either let the fish vote (vision running) or press `a`/`b` on the display to force.
7. Bridge dispatches the chosen option → MacBook screen lights up with Claude doing the action → status streams to display.
8. Press `r` on the display between calls to wipe state.

---

## 4. Common gotchas (from a previous setup pass)

- **`/twilio/voice` returns 415**: bridge is missing the urlencoded content-type parser. Already in `bridge/src/index.ts`. Just `git pull`.
- **DeepgramError "API key required"** on first WebSocket: bridge isn't loading `.env`. Already fixed via `import "dotenv/config"` in `bridge/src/index.ts`.
- **Greeting plays but second turn is silent**: ElevenLabs WS closes after `{text:""}` EOS. Already fixed — fresh TTS session per turn in `bridge/src/twilio/stream.ts`.
- **`computer_20250124` not supported**: model was `claude-opus-4-7`; opus does not support computer-use. Already changed to `claude-sonnet-4-5` in `remote-agent/src/computerUse.ts`.
- **Display shows "Pizza vs Sushi" / "Cats vs Dogs"**: those are pretend-mode sample options from `vision/main.py:52`. Either stop pretend mode or swap the sample list.
- **Stale "Dogs" decision sticks across refresh**: pre-fix bug. Press `r` on `/display` (now wired to `DELETE /api/state`).

---

## 5. If you are an agent following this doc

- Run commands one section at a time. Verify each `→ 200` / expected log before moving on.
- If a value is missing (a secret, the ngrok auth token, etc.), ask the user — do not improvise.
- Do **not** modify `web/.env.local` or Vercel env without explicit user approval.
- After both 1.x and 2.x sections are green, post a one-paragraph status to the user listing what's running and where.
