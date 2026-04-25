"use client";

import { useEffect, useState } from "react";

interface Props {
  durationMs: number;
  onComplete: () => void;
}

export function Countdown({ durationMs, onComplete }: Props) {
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const left = Math.max(0, durationMs - (now - start));
      setRemaining(left);
      if (left > 0) raf = requestAnimationFrame(tick);
      else onComplete();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  const seconds = (remaining / 1000).toFixed(1);
  const pct = remaining / durationMs;
  const circumference = 2 * Math.PI * 110;
  const dashoffset = circumference * (1 - pct);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="240" height="240" className="-rotate-90">
        <circle
          cx="120"
          cy="120"
          r="110"
          fill="none"
          stroke="rgb(30 41 59)"
          strokeWidth="10"
        />
        <circle
          cx="120"
          cy="120"
          r="110"
          fill="none"
          stroke="rgb(34 211 238)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ transition: "stroke-dashoffset 80ms linear" }}
        />
      </svg>
      <div className="absolute text-7xl font-black tabular-nums">{seconds}</div>
    </div>
  );
}
