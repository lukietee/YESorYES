# 06 — Deployment & Setup

How to bring everything online, from zero accounts to a live demo. Run through this end-to-end the day before — don't try to set accounts up the morning of.

## Accounts to create

- **Twilio** — buy a phone number, save Account SID + Auth Token.
- **Deepgram** — API key (free tier covers a hackathon).
- **ElevenLabs** — API key, pick a voice ID for the deadpan fish (preview a few; "Drew" or "Adam" or a custom-cloned one if you have time).
- **Anthropic** — single API key, used by both the bridge and the remote agent.
- **Pusher Channels** — create a Channels app, save `app_id`, `key`, `secret`, `cluster`.
- **Vercel** — link the `web/` folder.
- **Vercel KV** — provision via Marketplace (Upstash Redis), it auto-injects KV env vars.
- **Fly.io** — `fly launch` from `bridge/`.

## Environment variables

### `web/.env.local` (mirror to `vercel env`)
```
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
KV_URL=                          # auto-injected by Vercel KV
KV_REST_API_URL=
KV_REST_API_TOKEN=
INTERNAL_TOKEN=                  # generate with: openssl rand -hex 32
```

### `bridge/.env` (mirror to Fly secrets)
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
DEEPGRAM_API_KEY=
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
PUSHER_APP_ID=                   # only if bridge ever publishes directly
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
WEB_BASE_URL=https://<project>.vercel.app
INTERNAL_TOKEN=                  # match web's
```

### `vision/.env`
```
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
```

### `remote-agent/.env`
```
ANTHROPIC_API_KEY=
PUSHER_KEY=
PUSHER_CLUSTER=
WEB_BASE_URL=https://<project>.vercel.app
INTERNAL_TOKEN=
```

## Deploy commands

### web (Vercel)
```bash
cd web
vercel link
vercel env pull .env.local        # after configuring envs in dashboard
vercel --prod
```

### bridge (Fly.io)
```bash
cd bridge
fly launch                        # follow prompts, accept Dockerfile
fly secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... DEEPGRAM_API_KEY=... ANTHROPIC_API_KEY=... ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... PUSHER_KEY=... PUSHER_SECRET=... PUSHER_APP_ID=... PUSHER_CLUSTER=... WEB_BASE_URL=... INTERNAL_TOKEN=...
fly deploy
fly status                        # confirm machine is running
```

In `fly.toml`, set:
```toml
[http_service]
  internal_port = 8080
  force_https = true

[machines]
  min_machines_running = 1        # avoid cold starts during demo
```

### Twilio webhook wiring

In Twilio Console → Phone Numbers → your number → Voice configuration:
- **A call comes in**: Webhook → `https://<bridge-fly-app>.fly.dev/twilio/voice` (POST).

### vision (Mac mini)
```bash
cd vision
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python calibrate.py                # do this on-site
python main.py                     # run during demo
```

### remote-agent (remote MacBook)
```bash
cd remote-agent
npm install
npm run build
node dist/index.js                 # leave running during demo
```

## On-site setup checklist (day-of)

### Hotel room (Mac mini)
- [ ] Tank in front of the TV, fish settled in (don't move them right before demo, they'll hide).
- [ ] DJI Osmo 3 mounted, framing the tank with no glare.
- [ ] Mac mini hooked to TV via HDMI.
- [ ] Chrome in kiosk mode → `https://<project>.vercel.app/display`.
- [ ] `python main.py` running in a Terminal window.
- [ ] Watch `fish-pos` debug events in the Pusher console — confirm total=3 most frames.
- [ ] Test the `A`/`B`/`R` manual override hotkeys on `/display`.

### Remote MacBook
- [ ] All demo accounts logged in.
- [ ] Screen Recording + Accessibility permissions granted.
- [ ] Resolution pinned at 1920×1080.
- [ ] Do Not Disturb on.
- [ ] `node dist/index.js` running.
- [ ] Live screen-share to the demo room verified.

### Demo phone
- [ ] Call Twilio number from your phone — fish picks up. Hang up.
- [ ] Confirm the bridge logs show the call.

### Backups
- [ ] Mobile hotspot ready for both Macs.
- [ ] Pre-recorded fallback clip per stage saved on the remote MacBook.
- [ ] OpenAI Realtime backup bridge deployed (optional but cheap insurance).

## Post-demo

- [ ] Hang up.
- [ ] Stop `vision/main.py` and the remote agent process to avoid surprise costs.
- [ ] Rotate `INTERNAL_TOKEN`, the Anthropic key, and the Twilio Auth Token after the hackathon.
- [ ] Archive the Pusher app, or delete it.
