"""
Calibrate the tank ROI and HSV color mask.

Usage:
    python calibrate.py [--camera 0]

Phase 1 (ROI):  Click 4 corners of the tank in this order:
    top-left, top-right, bottom-right, bottom-left
    Press 'n' when done to advance to phase 2.

Phase 2 (HSV):  Use the trackbars to dial in the mask so only the fish are white.
    Adjust MIN_AREA / MAX_AREA so each guppy is exactly one blob.
    Press 's' to save roi.json and exit.
    Press 'q' to quit without saving.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROI_PATH = Path(__file__).with_name("roi.json")


def click_roi(camera_index: int) -> np.ndarray:
    """Returns the 4 corner points of the tank as a (4,2) float array."""
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError(f"could not open camera {camera_index}")

    points: list[tuple[int, int]] = []

    def on_click(event, x, y, _flags, _param):
        if event == cv2.EVENT_LBUTTONDOWN and len(points) < 4:
            points.append((x, y))

    cv2.namedWindow("calibrate-roi")
    cv2.setMouseCallback("calibrate-roi", on_click)

    print("phase 1: click TL, TR, BR, BL of the tank, then press 'n'")
    while True:
        ok, frame = cap.read()
        if not ok:
            continue

        for i, p in enumerate(points):
            cv2.circle(frame, p, 6, (0, 255, 255), -1)
            cv2.putText(frame, str(i + 1), (p[0] + 10, p[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        if len(points) == 4:
            cv2.polylines(frame, [np.array(points, dtype=np.int32)], True, (0, 255, 255), 2)

        cv2.imshow("calibrate-roi", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("n") and len(points) == 4:
            break
        if key == ord("q"):
            cap.release()
            cv2.destroyAllWindows()
            sys.exit(0)
        if key == ord("u") and points:
            points.pop()  # undo last click

    cap.release()
    cv2.destroyAllWindows()
    return np.array(points, dtype=np.float32)


def tune_hsv(camera_index: int, corners: np.ndarray) -> dict:
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError(f"could not open camera {camera_index}")

    win = "calibrate-hsv"
    cv2.namedWindow(win)

    # Default to "orange-ish" guppies under warm lighting
    cv2.createTrackbar("H_low", win, 5, 179, lambda _: None)
    cv2.createTrackbar("S_low", win, 100, 255, lambda _: None)
    cv2.createTrackbar("V_low", win, 100, 255, lambda _: None)
    cv2.createTrackbar("H_high", win, 25, 179, lambda _: None)
    cv2.createTrackbar("S_high", win, 255, 255, lambda _: None)
    cv2.createTrackbar("V_high", win, 255, 255, lambda _: None)
    cv2.createTrackbar("MIN_AREA", win, 80, 5000, lambda _: None)
    cv2.createTrackbar("MAX_AREA", win, 2000, 20000, lambda _: None)

    # Compute the perspective warp once
    target_w, target_h = 960, 480
    dst = np.array([[0, 0], [target_w, 0], [target_w, target_h], [0, target_h]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(corners, dst)

    print("phase 2: tune the trackbars until each fish is exactly one blob.")
    print("press 's' to save, 'q' to quit without saving.")

    while True:
        ok, frame = cap.read()
        if not ok:
            continue

        warped = cv2.warpPerspective(frame, M, (target_w, target_h))
        hsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)

        low = np.array([
            cv2.getTrackbarPos("H_low", win),
            cv2.getTrackbarPos("S_low", win),
            cv2.getTrackbarPos("V_low", win),
        ])
        high = np.array([
            cv2.getTrackbarPos("H_high", win),
            cv2.getTrackbarPos("S_high", win),
            cv2.getTrackbarPos("V_high", win),
        ])
        min_area = cv2.getTrackbarPos("MIN_AREA", win)
        max_area = cv2.getTrackbarPos("MAX_AREA", win)

        mask = cv2.inRange(hsv, low, high)
        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        viz = warped.copy()
        midline = target_w // 2
        cv2.line(viz, (midline, 0), (midline, target_h), (255, 255, 255), 1)
        L = R = 0
        for c in contours:
            area = cv2.contourArea(c)
            if not (min_area <= area <= max_area):
                continue
            M_ = cv2.moments(c)
            if M_["m00"] == 0:
                continue
            cx = int(M_["m10"] / M_["m00"])
            cy = int(M_["m01"] / M_["m00"])
            side = "L" if cx < midline else "R"
            if side == "L":
                L += 1
            else:
                R += 1
            x, y, w, h = cv2.boundingRect(c)
            color = (0, 200, 255) if side == "L" else (255, 200, 0)
            cv2.rectangle(viz, (x, y), (x + w, y + h), color, 2)
            cv2.putText(viz, side, (cx, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

        cv2.putText(viz, f"L:{L}  R:{R}", (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

        combo = np.hstack([viz, cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)])
        cv2.imshow(win, combo)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            cap.release()
            cv2.destroyAllWindows()
            sys.exit(0)
        if key == ord("s"):
            cap.release()
            cv2.destroyAllWindows()
            return {
                "corners": corners.tolist(),
                "hsv_low": low.tolist(),
                "hsv_high": high.tolist(),
                "min_area": int(min_area),
                "max_area": int(max_area),
                "warp_w": target_w,
                "warp_h": target_h,
            }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--camera", type=int, default=0)
    args = p.parse_args()

    corners = click_roi(args.camera)
    cfg = tune_hsv(args.camera, corners)

    ROI_PATH.write_text(json.dumps(cfg, indent=2))
    print(f"saved {ROI_PATH}")


if __name__ == "__main__":
    main()
