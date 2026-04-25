# 01 — Vision (Mac mini, OpenCV)

Detect the three guppies, count how many are on each side of the tank midline, publish at 30 Hz.

## Tech

- Python 3.11+, `opencv-python`, `numpy`, `pusher` (server SDK).
- DJI Osmo 3 in webcam mode (USB) or via NDI → OBS Virtual Camera.

## What it owns

- Channel: **publishes** to `fish-pos`.
- Payload: `{ counts: { L: number, R: number }, total: number, ts: number }`.

## Files

```
vision/
├── main.py            capture loop + detection + publish
├── calibrate.py       interactive ROI + HSV slider tool
├── roi.json           (gitignored) calibration output
├── requirements.txt
└── README.md          how to run, key bindings
```

## Implementation steps

1. **Capture** — `cv2.VideoCapture(camera_index)`. Confirm Osmo 3 shows up; pick the right index. Lock to 30 fps.
2. **Calibration** — `calibrate.py`:
   - Show first frame; user clicks 4 corners of the tank → save as `roi.json`.
   - Live HSV sliders (`H_low, S_low, V_low, H_high, S_high, V_high`) overlaid on the masked output → write tuned values to `roi.json`.
   - Save `MIN_AREA`, `MAX_AREA` for contour size filtering (calibrate while fish are swimming so you see the actual blob sizes).
3. **Detection loop** (`main.py`):
   1. Read frame → warp to ROI rectangle → convert BGR→HSV.
   2. `cv2.inRange(hsv, low, high)` → mask.
   3. Morph: `cv2.morphologyEx(MORPH_OPEN)` then `MORPH_CLOSE` (3×3 kernel) to clean noise.
   4. `cv2.findContours(RETR_EXTERNAL)` → keep contours with `MIN_AREA <= area <= MAX_AREA`.
   5. For each contour, `cv2.moments` → centroid x. Side = `L` if `x < width/2`, else `R`.
   6. Build `{counts: {L, R}, total: L+R, ts: time.time_ns()}`.
4. **Publish** — Pusher trigger on channel `fish-pos`, event `update`. Throttle to ~30 Hz; if frames come faster, drop.
5. **Local debug overlay** — small OpenCV window: ROI, mask, contour boxes with colored side tags, current counts in big text. Hotkey `q` to quit, `s` to save a frame for debugging.

## Smoke tests

- Test with a printed orange circle on paper; move it across the line → events flip L↔R.
- Test with three orange circles at once → counts match.
- Test with the actual fish tank → tune HSV until you reliably get total=3 most frames.

## Pitfalls

- **Glare on the tank glass** — kills the mask. Reposition the camera off-axis or add a polarizer filter.
- **Fish color similar to gravel** — color mask alone won't work. Add background subtraction (`cv2.createBackgroundSubtractorMOG2`) and AND it with the color mask.
- **Two fish overlapping** — one merged blob over `MAX_AREA`. Either raise `MAX_AREA` (then accept the merged blob counts as 1 — you'll undercount) or apply watershed/distance-transform to split. Easiest fix: raise `MAX_AREA` and accept the rolling vote will still work because most frames will have them separated.
- **Pusher rate limits** — free tier is 200k messages/day; 30 Hz × 1 channel × demo time is fine but don't accidentally start two publishers.
- **DJI Osmo 3** — confirm it presents as a UVC webcam. If not, use OBS Virtual Camera as a bridge.
- **HSV wraparound for red fish** — red hue wraps at 0/180 in OpenCV. Use two ranges (`0-10` and `170-180`) and OR the masks.

## Manual override

Have a CLI hotkey in `main.py` to publish a forced `{counts: {L: 3, R: 0}}` or `{L: 0, R: 3}` to handle "fish all hiding behind the plant" demo emergencies. Don't tell anyone.
