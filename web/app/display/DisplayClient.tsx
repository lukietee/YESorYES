"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pusherClient } from "./lib/pusherClient";
import { OptionCard } from "./components/OptionCard";
import { FishTally } from "./components/FishTally";
import { Countdown } from "./components/Countdown";
import { ExecutingPanel } from "./components/ExecutingPanel";
import { IntroIdle } from "./components/IntroIdle";
import { CameraPreview } from "./components/CameraPreview";
import { voteRule } from "@/lib/voteRule";
import type {
  AgentStatus,
  DecisionPayload,
  FishPos,
  OptionsPayload,
  Choice,
} from "@/lib/types";

type View = "idle" | "countdown" | "decided" | "executing";

const COUNTDOWN_MS = 5000;
const VOTE_WINDOW_MS = 1000;

export function DisplayClient() {
  const [view, setView] = useState<View>("idle");
  const [options, setOptions] = useState<OptionsPayload | null>(null);
  const [latestPos, setLatestPos] = useState<FishPos | null>(null);
  const [decision, setDecision] = useState<DecisionPayload | null>(null);
  const [statusHistory, setStatusHistory] = useState<AgentStatus[]>([]);

  const buffer = useRef<FishPos[]>([]);

  // Resync via /api/state on mount so a browser refresh mid-call recovers
  useEffect(() => {
    let cancelled = false;
    fetch("/api/state")
      .then((r) => r.json())
      .then((s) => {
        if (cancelled) return;
        if (s.idle) return;
        if (s.options) setOptions(s.options);
        if (s.decision) {
          setDecision(s.decision);
          setView("executing");
        } else if (s.options) {
          setView("countdown");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Pusher subscriptions
  useEffect(() => {
    const p = pusherClient();

    const optionsCh = p.subscribe("options");
    optionsCh.bind("present", (data: OptionsPayload) => {
      setOptions(data);
      setDecision(null);
      setStatusHistory([]);
      setView("countdown");
    });

    const fishCh = p.subscribe("fish-pos");
    fishCh.bind("update", (data: FishPos) => {
      setLatestPos(data);
      const cutoff = Date.now() - VOTE_WINDOW_MS - 500;
      buffer.current.push(data);
      buffer.current = buffer.current.filter((f) => f.ts / 1e6 > cutoff);
    });

    const decisionsCh = p.subscribe("decisions");
    decisionsCh.bind("decided", (data: DecisionPayload) => {
      setDecision(data);
      setView("decided");
      // After a beat, transition to executing
      setTimeout(() => setView("executing"), 1500);
    });

    const statusCh = p.subscribe("agent-status");
    statusCh.bind("update", (data: AgentStatus) => {
      setStatusHistory((h) => [...h, data].slice(-32));
      if (data.type === "done" || data.type === "error") {
        // Wait for the next stage's options event to flip view back
        // (don't reset to idle automatically — the bridge is in charge)
      }
    });

    return () => {
      p.unsubscribe("options");
      p.unsubscribe("fish-pos");
      p.unsubscribe("decisions");
      p.unsubscribe("agent-status");
    };
  }, []);

  const finalizeVote = useCallback(async () => {
    if (!options) return;
    const recent = buffer.current.filter(
      (f) => Date.now() - f.ts / 1e6 < VOTE_WINDOW_MS,
    );
    const result = voteRule(recent.length > 0 ? recent : (latestPos ? [latestPos] : []));
    const text = result.chosen === "A" ? options.option_a : options.option_b;

    await fetch("/api/decisions/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callSid: options.callSid,
        stage: options.stage,
        chosen: result.chosen,
        text,
        vote: result.vote,
      }),
    });
  }, [options, latestPos]);

  const forceDecision = useCallback(
    async (chosen: Choice) => {
      if (!options) return;
      const text = chosen === "A" ? options.option_a : options.option_b;
      await fetch("/api/decisions/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          callSid: options.callSid,
          stage: options.stage,
          chosen,
          text,
          vote: { L: 0, R: 0 },
        }),
      });
    },
    [options],
  );

  // Manual override hotkeys. Only allow A/B during countdown — replaying a
  // decision after the bridge already advanced would confuse the conversation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "a" || e.key === "A") && view === "countdown") forceDecision("A");
      if ((e.key === "b" || e.key === "B") && view === "countdown") forceDecision("B");
      if (e.key === "r" || e.key === "R") {
        setView("idle");
        setOptions(null);
        setDecision(null);
        setStatusHistory([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [forceDecision, view]);

  const aState = useMemo(() => cardState("A", view, decision?.chosen), [view, decision]);
  const bState = useMemo(() => cardState("B", view, decision?.chosen), [view, decision]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-ink text-white">
      {view === "idle" && (
        <div className="h-full w-full flex items-center justify-center">
          <IntroIdle />
        </div>
      )}

      {(view === "countdown" || view === "decided") && options && (
        <div className="h-full w-full grid grid-cols-2">
          <OptionCard side="left" label="A" text={options.option_a} state={aState} />
          <OptionCard side="right" label="B" text={options.option_b} state={bState} />
          <div className="absolute inset-0 flex items-start justify-center pointer-events-none pt-12">
            <div className="flex flex-col items-center gap-6">
              {view === "countdown" && (
                <Countdown durationMs={COUNTDOWN_MS} onComplete={finalizeVote} />
              )}
              {view === "decided" && (
                <div className="text-7xl font-black text-win">
                  {decision?.chosen}
                </div>
              )}
              <FishTally latest={latestPos} />
            </div>
          </div>
        </div>
      )}

      {view === "executing" && (
        <div className="h-full w-full flex items-center justify-center">
          <ExecutingPanel history={statusHistory} />
        </div>
      )}

      <CameraPreview size="md" position="bottom-4 right-4" />

      {/* tiny debug strip */}
      <div className="absolute bottom-2 left-4 text-xs text-slate-700 font-mono">
        {view} · stage:{options?.stage ?? "—"} · L{latestPos?.counts.L ?? 0}:R{latestPos?.counts.R ?? 0}
      </div>
    </main>
  );
}

function cardState(
  card: Choice,
  view: View,
  chosen: Choice | undefined,
): "idle" | "active" | "winner" | "loser" {
  if (view === "idle") return "idle";
  if (view === "countdown") return "active";
  if (view === "decided" || view === "executing") {
    if (!chosen) return "active";
    return chosen === card ? "winner" : "loser";
  }
  return "idle";
}
