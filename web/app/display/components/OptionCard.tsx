"use client";

interface Props {
  side: "left" | "right";
  label: "A" | "B";
  text: string;
  state: "idle" | "active" | "winner" | "loser";
}

export function OptionCard({ side, label, text, state }: Props) {
  // Center each card vertically and pin to the outer edge of its column,
  // leaving the middle of the screen clear for the countdown overlay.
  const align = side === "left"
    ? "items-center justify-start pl-8"
    : "items-center justify-end pr-8";
  const text_align = side === "left" ? "text-right" : "text-left";

  const ring =
    state === "winner"
      ? "border-win shadow-[0_0_60px_rgba(34,211,238,0.5)] animate-lock-in"
      : state === "loser"
        ? "border-slate-800 opacity-30"
        : state === "active"
          ? "border-glow shadow-[0_0_40px_rgba(59,130,246,0.4)]"
          : "border-slate-800";

  return (
    <div className={`flex h-full ${align}`}>
      <div
        className={`relative w-[38vw] h-[60vh] rounded-3xl border-2 bg-loss/40 backdrop-blur p-12 flex flex-col justify-between transition-all duration-300 ${ring}`}
      >
        <div className="text-7xl font-black text-slate-300/70">{label}</div>
        <div className={`text-5xl font-bold leading-tight ${text_align}`}>
          {text}
        </div>
      </div>
    </div>
  );
}
