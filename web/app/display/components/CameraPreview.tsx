"use client";

import { useEffect, useState } from "react";

const STREAM_URL =
  process.env.NEXT_PUBLIC_VISION_PREVIEW_URL ??
  "http://localhost:8765/stream.mjpg";

interface Props {
  /** Tailwind size class on the panel */
  size?: "sm" | "md" | "lg";
  /** Tailwind position classes (defaults to top-right) */
  position?: string;
}

export function CameraPreview({ size = "md", position = "top-4 right-4" }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // Cheap availability probe — try a HEAD-ish fetch with no-cors.
    // If the local vision server isn't running, the image errors out and
    // we hide the panel.
    let cancelled = false;
    const url = STREAM_URL.replace("/stream.mjpg", "/stream.mjpg");
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setAvailable(true);
    };
    img.onerror = () => {
      if (!cancelled) setAvailable(false);
    };
    // Add a cache buster so retries work
    img.src = `${url}?t=${Date.now()}`;
    return () => {
      cancelled = true;
    };
  }, []);

  const dim =
    size === "sm" ? "w-64" : size === "lg" ? "w-[480px]" : "w-80";

  if (available === false) {
    return (
      <div
        className={`absolute ${position} ${dim} rounded-lg border border-slate-800 bg-loss/60 p-2 text-xs font-mono text-slate-500`}
      >
        camera offline · run vision/main.py
      </div>
    );
  }

  return (
    <div
      className={`absolute ${position} ${dim} aspect-video rounded-lg border border-slate-700 bg-black/60 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.4)]`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={STREAM_URL}
        alt="vision feed"
        className="w-full h-full object-cover"
      />
      <div className="absolute top-1.5 left-2 text-[10px] font-mono uppercase tracking-widest text-slate-400/80">
        ● live
      </div>
    </div>
  );
}
