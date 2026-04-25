# vision

Detect three guppies, count L/R, publish to Pusher at 30 Hz.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in Pusher creds
```

## Calibrate (do this on-site, the night before)

```bash
python calibrate.py
```

1. Click the four corners of the tank in this order: TL, TR, BR, BL. Press `n`.
2. Tune the HSV trackbars and area filters until each guppy is exactly one blob.
3. Press `s` to save `roi.json`.

## Run

```bash
python main.py
```

Hotkeys:
- `q` — quit
- `s` — save current frame to `captures/`
- `1` — force-publish `{L:3, R:0}` (manual override)
- `2` — force-publish `{L:0, R:3}`
- `0` — clear override
