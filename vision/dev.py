"""
Dev wrapper: run vision/main.py as a subprocess, restart it when main.py
(or roi.json) changes, and respawn if it crashes. Forwards CLI args.

Usage:
    python dev.py --pretend [--camera 0]

Stops on Ctrl+C.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

WATCH = [
    Path(__file__).with_name("main.py"),
    Path(__file__).with_name("roi.json"),
]
POLL_INTERVAL = 0.5  # seconds between mtime checks
RESPAWN_DELAY = 1.0  # seconds to wait before respawning a dead process


def mtimes() -> dict[Path, float]:
    out: dict[Path, float] = {}
    for p in WATCH:
        try:
            out[p] = p.stat().st_mtime
        except FileNotFoundError:
            out[p] = 0.0
    return out


def spawn(args: list[str]) -> subprocess.Popen:
    print(f"[dev] starting: python main.py {' '.join(args)}")
    return subprocess.Popen(
        [sys.executable, "main.py", *args],
        cwd=str(Path(__file__).parent),
    )


def kill(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    print(f"[dev] stopping pid {proc.pid}")
    try:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=2)
    except ProcessLookupError:
        pass


def main() -> None:
    args = sys.argv[1:]
    proc = spawn(args)
    last = mtimes()

    def shutdown(*_):
        print("\n[dev] shutting down")
        kill(proc)
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            time.sleep(POLL_INTERVAL)

            # Restart on file change.
            now = mtimes()
            changed = [p for p, t in now.items() if t != last.get(p, 0.0)]
            if changed:
                names = ", ".join(p.name for p in changed)
                print(f"[dev] change detected ({names}) — restarting")
                kill(proc)
                last = now
                proc = spawn(args)
                continue

            # Respawn on crash.
            rc = proc.poll()
            if rc is not None:
                print(f"[dev] vision exited with code {rc} — respawning in "
                      f"{RESPAWN_DELAY:g}s")
                time.sleep(RESPAWN_DELAY)
                proc = spawn(args)
                last = mtimes()
    finally:
        kill(proc)


if __name__ == "__main__":
    main()
