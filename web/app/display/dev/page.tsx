"use client";

import { useState } from "react";
import { OptionCard } from "../components/OptionCard";
import { FishTally } from "../components/FishTally";
import { Countdown } from "../components/Countdown";
import { ExecutingPanel } from "../components/ExecutingPanel";
import { IntroIdle } from "../components/IntroIdle";
import type { AgentStatus, FishPos } from "@/lib/types";

type View = "idle" | "countdown" | "decided-A" | "decided-B" | "executing";

const SAMPLE_OPTIONS = {
  a: "Text your ex again",
  b: "Swipe up on random IG stories",
};

const SAMPLE_STATUSES: AgentStatus[] = [
  { taskId: "x", callSid: "x", stage: "ig-swipe", type: "progress", detail: "opened Instagram", ts: 0 },
  { taskId: "x", callSid: "x", stage: "ig-swipe", type: "progress", detail: "DMing @demo_friend1", ts: 0 },
  { taskId: "x", callSid: "x", stage: "ig-swipe", type: "progress", detail: "DMing @demo_friend2", ts: 0 },
  { taskId: "x", callSid: "x", stage: "ig-swipe", type: "progress", detail: "@demo_friend2 replied", ts: 0 },
  { taskId: "x", callSid: "x", stage: "ig-swipe", type: "done", detail: "first reply landed, stopping", ts: 0 },
];

export default function DisplayDevPage() {
  const [view, setView] = useState<View>("idle");
  const [tally, setTally] = useState<FishPos>({
    counts: { L: 2, R: 1 },
    total: 3,
    ts: Date.now() * 1e6,
  });
  const [statusStep, setStatusStep] = useState(1);

  const reset = () => {
    setView("idle");
    setStatusStep(1);
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-ink text-white">
      {view === "idle" && (
        <div className="h-full w-full flex items-center justify-center">
          <IntroIdle />
        </div>
      )}

      {(view === "countdown" || view === "decided-A" || view === "decided-B") && (
        <div className="h-full w-full grid grid-cols-2">
          <OptionCard
            side="left"
            label="A"
            text={SAMPLE_OPTIONS.a}
            state={
              view === "countdown"
                ? "active"
                : view === "decided-A"
                  ? "winner"
                  : "loser"
            }
          />
          <OptionCard
            side="right"
            label="B"
            text={SAMPLE_OPTIONS.b}
            state={
              view === "countdown"
                ? "active"
                : view === "decided-B"
                  ? "winner"
                  : "loser"
            }
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-8">
              {view === "countdown" && (
                <Countdown durationMs={5000} onComplete={() => setView("decided-A")} />
              )}
              {view !== "countdown" && (
                <div className="text-7xl font-black text-win">
                  {view === "decided-A" ? "A" : "B"}
                </div>
              )}
              <FishTally latest={tally} />
            </div>
          </div>
        </div>
      )}

      {view === "executing" && (
        <div className="h-full w-full flex items-center justify-center">
          <ExecutingPanel history={SAMPLE_STATUSES.slice(0, statusStep)} />
        </div>
      )}

      {/* dev controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 bg-loss/80 border border-slate-800 rounded-lg p-3 text-xs font-mono">
        <div className="text-slate-500">DEV MODE — preview only</div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setView("idle")} className={btn(view === "idle")}>idle</button>
          <button onClick={() => setView("countdown")} className={btn(view === "countdown")}>countdown</button>
          <button onClick={() => setView("decided-A")} className={btn(view === "decided-A")}>decided A</button>
          <button onClick={() => setView("decided-B")} className={btn(view === "decided-B")}>decided B</button>
          <button onClick={() => setView("executing")} className={btn(view === "executing")}>executing</button>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-slate-500">tally L:R</span>
          {([
            [3, 0],
            [2, 1],
            [1, 2],
            [0, 3],
          ] as const).map(([L, R]) => (
            <button
              key={`${L}-${R}`}
              onClick={() =>
                setTally({ counts: { L, R }, total: L + R, ts: Date.now() * 1e6 })
              }
              className={btn(tally.counts.L === L && tally.counts.R === R)}
            >
              {L}:{R}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-slate-500">exec step</span>
          <button
            onClick={() => setStatusStep((n) => Math.max(1, n - 1))}
            className={btn(false)}
          >
            ←
          </button>
          <span>{statusStep}/{SAMPLE_STATUSES.length}</span>
          <button
            onClick={() => setStatusStep((n) => Math.min(SAMPLE_STATUSES.length, n + 1))}
            className={btn(false)}
          >
            →
          </button>
        </div>
        <button onClick={reset} className={btn(false)}>reset</button>
      </div>
    </main>
  );
}

function btn(active: boolean) {
  return `px-2 py-1 rounded border ${
    active ? "bg-glow/30 border-glow text-glow" : "border-slate-700 hover:bg-slate-800"
  }`;
}
