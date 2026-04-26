"use client";

import { useEffect, useRef, useState } from "react";

const PREVIEW_BASE =
  process.env.NEXT_PUBLIC_VISION_PREVIEW_URL ?? "http://localhost:8765";

const POLL_HZ = 10; // single-image poll rate

interface Props {
  size?: "sm" | "md" | "lg";
  position?: string;
}

type State = "loading" | "live" | "offline";

export function CameraPreview({ size = "md", position = "top-4 right-4" }: Props) {
  const [state, setState] = useState<State>("loading");
  const [src, setSrc] = useState<string | null>(null);
  const failures = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `${PREVIEW_BASE}/frame.jpg?t=${Date.now()}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setState("live");
        failures.current = 0;
      } catch {
        failures.current += 1;
        // Tolerate one or two missed frames before flipping to offline
        if (failures.current >= 3) setState("offline");
      }
    };

    const interval = window.setInterval(tick, 1000 / POLL_HZ);
    tick();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const dim = size === "sm" ? "w-64" : size === "lg" ? "w-[480px]" : "w-80";

  return (
    <div
      className={`absolute ${position} ${dim} aspect-video rounded-lg border bg-black/60 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.4)] ${
        state === "live" ? "border-slate-700" : "border-slate-800"
      }`}
    >
      {src && state === "live" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="vision feed"
          className="w-full h-full object-cover"
        />
      )}

      {state === "live" && (
        <div className="absolute top-1.5 left-2 text-[10px] font-mono uppercase tracking-widest text-slate-400/80">
          ● live
        </div>
      )}

      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-slate-600">
          connecting…
        </div>
      )}

      {state === "offline" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs font-mono text-slate-500">
          <div>camera offline</div>
          <div className="text-slate-700">retrying…</div>
        </div>
      )}
    </div>
  );
}
