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
import time
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv
from pusher import Pusher

ROI_PATH = Path(__file__).with_name("roi.json")
CAPTURES_DIR = Path(__file__).with_name("captures")

PUBLISH_HZ = 30
PUBLISH_INTERVAL = 1.0 / PUBLISH_HZ


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


def detect(frame: np.ndarray, cfg: dict, M: np.ndarray) -> tuple[int, int, np.ndarray]:
    warped = cv2.warpPerspective(frame, M, (cfg["warp_w"], cfg["warp_h"]))
    hsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)
    low = np.array(cfg["hsv_low"])
    high = np.array(cfg["hsv_high"])
    mask = cv2.inRange(hsv, low, high)
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    midline = cfg["warp_w"] // 2
    L = R = 0
    viz = warped.copy()
    cv2.line(viz, (midline, 0), (midline, cfg["warp_h"]), (255, 255, 255), 1)

    for c in contours:
        area = cv2.contourArea(c)
        if not (cfg["min_area"] <= area <= cfg["max_area"]):
            continue
        m = cv2.moments(c)
        if m["m00"] == 0:
            continue
        cx = int(m["m10"] / m["m00"])
        cy = int(m["m01"] / m["m00"])
        if cx < midline:
            L += 1
            color = (0, 200, 255)
        else:
            R += 1
            color = (255, 200, 0)
        x, y, w, h = cv2.boundingRect(c)
        cv2.rectangle(viz, (x, y), (x + w, y + h), color, 2)
        cv2.circle(viz, (cx, cy), 3, color, -1)

    cv2.putText(viz, f"L:{L}  R:{R}", (12, 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

    return L, R, viz


def main() -> None:
    load_dotenv()
    p = argparse.ArgumentParser()
    p.add_argument("--camera", type=int, default=int(os.environ.get("CAMERA_INDEX", 0)))
    p.add_argument("--no-display", action="store_true")
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

    last_pub = 0.0
    forced: tuple[int, int] | None = None

    CAPTURES_DIR.mkdir(exist_ok=True)

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                continue

            L, R, viz = detect(frame, cfg, M)
            if forced is not None:
                L, R = forced

            now = time.time()
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
