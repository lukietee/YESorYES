"use client";

import type { FishPos } from "@/lib/types";

interface Props {
  latest: FishPos | null;
}

export function FishTally({ latest }: Props) {
  const L = latest?.counts.L ?? 0;
  const R = latest?.counts.R ?? 0;
  const fish = renderFish(L, R);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-12 text-7xl font-black tabular-nums">
        <span className="text-glow">{L}</span>
        <span className="text-slate-600">:</span>
        <span className="text-glow">{R}</span>
      </div>
      <div className="flex items-center gap-1 text-5xl">{fish}</div>
    </div>
  );
}

function renderFish(L: number, R: number) {
  // Render up to 5 fish, distributed by side
  const total = L + R;
  if (total === 0) return <span className="text-slate-700">no fish detected</span>;
  return (
    <>
      {Array.from({ length: L }).map((_, i) => (
        <span key={`l${i}`} className="text-orange-400">🐟</span>
      ))}
      <span className="mx-3 text-slate-700">|</span>
      {Array.from({ length: R }).map((_, i) => (
        <span key={`r${i}`} className="text-orange-400">🐟</span>
      ))}
    </>
  );
}
