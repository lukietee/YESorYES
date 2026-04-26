"""
Capture from camera, detect guppies, publish counts to Pusher at ~30 Hz.

Run:
    python main.py [--camera 0] [--no-display]

Hotkeys (when --display is on):
    q   quit
    s   save current frame to captures/
    1   force-publish counts {L: 3, R: 0}  (manual override for demo)
    2   force-publish counts {L: 0, R: 3}
    0   stop forcing
"""

from __future__ import annotations

import argparse
import json
import os
import socketserver
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv
from pusher import Pusher

ROI_PATH = Path(__file__).with_name("roi.json")
CAPTURES_DIR = Path(__file__).with_name("captures")

PUBLISH_HZ = 30
PUBLISH_INTERVAL = 1.0 / PUBLISH_HZ

# Sliding window for per-side count smoothing. We take the MAX L and MAX R
# seen in this window so a fish briefly turning head-on (or hidden behind
# the filter for a frame or two) doesn't drop the count. Capped at
# total_fish so smoothing can never overcount.
SMOOTH_WINDOW_FRAMES = 18  # ~0.6s at 30fps

# Pretend-mode round pacing. The web display runs a 5s countdown after
# receiving `options:present`, then ~1.5s reveal of the winner. Give it a
# little extra so the next round's options arrive after the reveal.
PRETEND_ROUND_SECONDS = 7.5

# Pretend option pairs — rotated each round. The agent integration will
# replace this with options pulled from the bridge over the `options`
# channel (this script will simply stop publishing).
PRETEND_OPTIONS: list[tuple[str, str]] = [
    ("Pizza", "Sushi"),
    ("Beach", "Mountains"),
    ("Cats", "Dogs"),
    ("Coffee", "Tea"),
    ("Morning", "Night"),
]
PRETEND_STAGE = "ig-swipe"

PREVIEW_PORT = 8765
PREVIEW_FPS = 15
PREVIEW_QUALITY = 70  # JPEG quality 0-100


# Latest frame for the MJPEG server. Single producer (capture loop), many
# consumers (HTTP clients). One bytes object swap per frame is atomic enough
# under CPython, so a lock just keeps the swap visible promptly.
_frame_lock = threading.Lock()
_latest_jpeg: bytes | None = None


def update_preview(viz: np.ndarray) -> None:
    global _latest_jpeg
    ok, buf = cv2.imencode(".jpg", viz, [cv2.IMWRITE_JPEG_QUALITY, PREVIEW_QUALITY])
    if not ok:
        return
    with _frame_lock:
        _latest_jpeg = buf.tobytes()


class _PreviewHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):  # silence stdlib access logs
        pass

    def _send_cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_GET(self) -> None:
        # /frame.jpg → latest single JPEG (browser polls this on a timer)
        # /stream.mjpg → multipart stream (kept for non-browser tools / fallback)
        if self.path.startswith("/frame.jpg"):
            self._serve_single_jpeg()
        elif self.path.startswith("/stream.mjpg"):
            self._serve_mjpeg()
        else:
            self.send_error(404)

    def _serve_single_jpeg(self) -> None:
        with _frame_lock:
            jpeg = _latest_jpeg
        if jpeg is None:
            self.send_error(503, "no frame yet")
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(jpeg)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self._send_cors()
        self.end_headers()
        try:
            self.wfile.write(jpeg)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _serve_mjpeg(self) -> None:
        self.send_response(200)
        self.send_header("Cache-Control", "no-cache, private")
        self.send_header("Pragma", "no-cache")
        self.send_header("Connection", "close")
        self._send_cors()
        self.send_header(
            "Content-Type",
            "multipart/x-mixed-replace; boundary=frame",
        )
        self.end_headers()
        delay = 1.0 / PREVIEW_FPS
        try:
            while True:
                with _frame_lock:
                    jpeg = _latest_jpeg
                if jpeg is None:
                    time.sleep(0.05)
                    continue
                self.wfile.write(b"--frame\r\n")
                self.wfile.write(b"Content-Type: image/jpeg\r\n")
                self.wfile.write(f"Content-Length: {len(jpeg)}\r\n\r\n".encode())
                self.wfile.write(jpeg)
                self.wfile.write(b"\r\n")
                time.sleep(delay)
        except (BrokenPipeError, ConnectionResetError):
            return


class _ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


def start_preview_server() -> None:
    server = _ThreadingServer(("0.0.0.0", PREVIEW_PORT), _PreviewHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    print(f"preview at http://localhost:{PREVIEW_PORT}/frame.jpg (poll) "
          f"and /stream.mjpg (multipart)")


def load_cfg() -> dict:
    if not ROI_PATH.exists():
        raise SystemExit(f"missing {ROI_PATH}. run `python calibrate.py` first.")
    return json.loads(ROI_PATH.read_text())


def make_pusher() -> Pusher:
    return Pusher(
        app_id=os.environ["PUSHER_APP_ID"],
        key=os.environ["PUSHER_KEY"],
        secret=os.environ["PUSHER_SECRET"],
        cluster=os.environ["PUSHER_CLUSTER"],
        ssl=True,
    )


def detect(frame: np.ndarray, cfg: dict, M: np.ndarray) -> tuple[int, int, np.ndarray, np.ndarray]:
    warped = cv2.warpPerspective(frame, M, (cfg["warp_w"], cfg["warp_h"]))
    hsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)
    low = np.array(cfg["hsv_low"])
    high = np.array(cfg["hsv_high"])
    mask = cv2.inRange(hsv, low, high)
    open_k = np.ones((3, 3), np.uint8)
    close_k = np.ones((15, 15), np.uint8)
    # Open with small kernel to drop salt-and-pepper noise, then aggressive
    # close + dilate so nearby blobs (one fruit split by glare/reflection)
    # fuse into a single contour.
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, open_k, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_k, iterations=3)
    mask = cv2.dilate(mask, np.ones((7, 7), np.uint8), iterations=1)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    midline = cfg["warp_w"] // 2
    L = R = 0
    viz = warped.copy()
    cv2.line(viz, (midline, 0), (midline, cfg["warp_h"]), (255, 255, 255), 1)

    max_aspect = cfg.get("max_aspect", 3.0)
    total_fish = cfg.get("total_fish", 3)
    # x-tolerance for matching a blob to its vertical mirror. ~8% of width.
    mirror_dx_tol = cfg.get("mirror_dx_tol", int(cfg["warp_w"] * 0.08))
    # Two blobs whose centroids sit within this radius are treated as the
    # same fish (glare/reflection split), regardless of vertical position.
    dedupe_radius = cfg.get("dedupe_radius", int(cfg["warp_w"] * 0.05))

    candidates: list[dict] = []
    for c in contours:
        area = cv2.contourArea(c)
        if not (cfg["min_area"] <= area <= cfg["max_area"]):
            continue
        x, y, w, h = cv2.boundingRect(c)
        if w == 0 or h == 0:
            continue
        aspect = max(w / h, h / w)
        if aspect > max_aspect:
            continue
        m = cv2.moments(c)
        if m["m00"] == 0:
            continue
        cx = int(m["m10"] / m["m00"])
        cy = int(m["m01"] / m["m00"])
        candidates.append({"x": x, "y": y, "w": w, "h": h,
                           "cx": cx, "cy": cy, "area": area})

    # Rank blobs by "fish-likeness" (bigger and higher = more likely real)
    # and greedily accept up to total_fish, skipping any blob too close to
    # one already kept (mirror reflection or glare split).
    candidates.sort(key=lambda b: b["area"] - b["cy"] * 0.5, reverse=True)
    kept: list[dict] = []
    for b in candidates:
        if len(kept) >= total_fish:
            break
        too_close = False
        for k in kept:
            dx = abs(b["cx"] - k["cx"])
            dy = abs(b["cy"] - k["cy"])
            # Vertical mirror: same x, any y difference.
            if dx < mirror_dx_tol and b["cy"] > k["cy"]:
                too_close = True
                break
            # General duplicate: blobs sitting on top of each other.
            if dx * dx + dy * dy < dedupe_radius * dedupe_radius:
                too_close = True
                break
        if too_close:
            continue
        kept.append(b)

    # Belt-and-suspenders: never emit more than total_fish, no matter what.
    kept = kept[:total_fish]

    for b in kept:
        if b["cx"] < midline:
            L += 1
            color = (0, 200, 255)
        else:
            R += 1
            color = (255, 200, 0)
        cv2.rectangle(viz, (b["x"], b["y"]),
                      (b["x"] + b["w"], b["y"] + b["h"]), color, 2)
        cv2.circle(viz, (b["cx"], b["cy"]), 3, color, -1)

    cv2.putText(viz, f"L:{L}  R:{R}", (12, 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

    return L, R, viz, mask


def main() -> None:
    load_dotenv()
    p = argparse.ArgumentParser()
    p.add_argument("--camera", type=int, default=int(os.environ.get("CAMERA_INDEX", 0)))
    p.add_argument("--no-display", action="store_true")
    p.add_argument(
        "--pretend",
        action="store_true",
        help="Drive the display with rotating pretend options every "
             f"{PRETEND_ROUND_SECONDS:g}s (bypasses the bridge).",
    )
    args = p.parse_args()

    cfg = load_cfg()
    corners = np.array(cfg["corners"], dtype=np.float32)
    dst = np.array(
        [[0, 0], [cfg["warp_w"], 0], [cfg["warp_w"], cfg["warp_h"]], [0, cfg["warp_h"]]],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(corners, dst)

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise SystemExit(f"could not open camera {args.camera}")
    cap.set(cv2.CAP_PROP_FPS, 30)

    pusher = make_pusher()
    print(f"publishing to Pusher channel 'fish-pos' at {PUBLISH_HZ} Hz")

    start_preview_server()

    last_pub = 0.0
    last_preview = 0.0
    preview_interval = 1.0 / PREVIEW_FPS
    forced: tuple[int, int] | None = None

    # Pretend-mode round state. Publishing the first options immediately
    # would race with the page mounting; give the display a beat to subscribe.
    next_round_at = time.time() + 1.5 if args.pretend else float("inf")
    round_idx = 0

    # Per-side count history for temporal smoothing.
    history: deque[tuple[int, int]] = deque(maxlen=SMOOTH_WINDOW_FRAMES)
    total_fish = cfg.get("total_fish", 3)

    CAPTURES_DIR.mkdir(exist_ok=True)

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                continue

            raw_L, raw_R, viz, mask = detect(frame, cfg, M)
            history.append((raw_L, raw_R))

            # Take the per-side max across the smoothing window so a brief
            # head-on / glare miss doesn't drop the count. Cap the sum at
            # total_fish — if smoothing would push us over, trim from the
            # side whose smoothed value is most inflated vs. this frame.
            sm_L = max(h[0] for h in history)
            sm_R = max(h[1] for h in history)
            if sm_L + sm_R > total_fish:
                excess = sm_L + sm_R - total_fish
                # Inflation = how much smoothing added over the live frame.
                inflate_L = sm_L - raw_L
                inflate_R = sm_R - raw_R
                if inflate_L >= inflate_R:
                    sm_L = max(0, sm_L - excess)
                else:
                    sm_R = max(0, sm_R - excess)
            L, R = sm_L, sm_R

            if forced is not None:
                L, R = forced

            now = time.time()
            if now - last_preview >= preview_interval:
                last_preview = now
                update_preview(viz)
            if now - last_pub >= PUBLISH_INTERVAL:
                last_pub = now
                payload = {
                    "counts": {"L": L, "R": R},
                    "total": L + R,
                    "ts": time.time_ns(),
                }
                try:
                    pusher.trigger("fish-pos", "update", payload)
                except Exception as e:  # network blip
                    print(f"pusher publish failed: {e}")

            # Pretend mode: kick off a new round every PRETEND_ROUND_SECONDS.
            # The web display owns the countdown + decision publish; vision
            # only fires `options:present` so the UI cycles.
            if args.pretend and now >= next_round_at:
                opt_a, opt_b = PRETEND_OPTIONS[round_idx % len(PRETEND_OPTIONS)]
                options_payload = {
                    "callSid": f"pretend-{int(now)}",
                    "stage": PRETEND_STAGE,
                    "option_a": opt_a,
                    "option_b": opt_b,
                }
                print(f"[round {round_idx}] options: A={opt_a!r}  B={opt_b!r}")
                try:
                    pusher.trigger("options", "present", options_payload)
                except Exception as e:
                    print(f"pusher options publish failed: {e}")
                round_idx += 1
                next_round_at = now + PRETEND_ROUND_SECONDS

            if not args.no_display:
                cv2.imshow("vision", viz)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    break
                if key == ord("s"):
                    path = CAPTURES_DIR / f"frame_{int(now)}.png"
                    cv2.imwrite(str(path), viz)
                    print(f"saved {path}")
                if key == ord("1"):
                    forced = (3, 0)
                    print("forcing L:3 R:0")
                if key == ord("2"):
                    forced = (0, 3)
                    print("forcing L:0 R:3")
                if key == ord("0"):
                    forced = None
                    print("override cleared")
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
