"use client";

import type { AgentStatus } from "@/lib/types";

interface Props {
  history: AgentStatus[];
}

export function ExecutingPanel({ history }: Props) {
  const latest = history[history.length - 1];
  const recent = history.slice(-5);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-2xl uppercase tracking-[0.4em] text-slate-500">
        Executing
      </div>
      <div className="text-5xl font-bold text-center max-w-3xl">
        {latest?.detail ?? "fish is thinking…"}
      </div>
      <div className="flex flex-col gap-1 text-lg text-slate-500 font-mono">
        {recent.map((s, i) => (
          <div key={i} className={i === recent.length - 1 ? "text-glow" : ""}>
            › {s.detail}
          </div>
        ))}
      </div>
    </div>
  );
}
