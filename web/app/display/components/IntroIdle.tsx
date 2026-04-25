"use client";

export function IntroIdle() {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-9xl">🐟🐟🐟</div>
      <div className="text-6xl font-black tracking-tight">The Guppy Council</div>
      <div className="text-2xl text-slate-500 uppercase tracking-[0.4em] animate-pulse-slow">
        awaiting caller
      </div>
    </div>
  );
}
