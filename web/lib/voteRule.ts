import type { Choice, FishPos } from "./types";

/**
 * Rolling-window vote rule.
 *
 * For each frame in the buffer, count which side has more fish (L → A, R → B,
 * or tie). Take the mode across the buffer. If the per-frame mode is a tie,
 * fall back to whichever side accumulated more total fish-frames across the
 * window. If even that is tied (vanishingly unlikely with 3 healthy guppies),
 * coin-flip and let the caller log it.
 */
export function voteRule(buffer: FishPos[]): {
  chosen: Choice;
  vote: { L: number; R: number };
  fellBack: "perFrame" | "totals" | "coinFlip";
} {
  const totalL = buffer.reduce((s, f) => s + f.counts.L, 0);
  const totalR = buffer.reduce((s, f) => s + f.counts.R, 0);

  let aFrames = 0;
  let bFrames = 0;
  for (const f of buffer) {
    if (f.counts.L > f.counts.R) aFrames++;
    else if (f.counts.R > f.counts.L) bFrames++;
  }

  if (aFrames > bFrames) return { chosen: "A", vote: { L: totalL, R: totalR }, fellBack: "perFrame" };
  if (bFrames > aFrames) return { chosen: "B", vote: { L: totalL, R: totalR }, fellBack: "perFrame" };

  if (totalL > totalR) return { chosen: "A", vote: { L: totalL, R: totalR }, fellBack: "totals" };
  if (totalR > totalL) return { chosen: "B", vote: { L: totalL, R: totalR }, fellBack: "totals" };

  return {
    chosen: Math.random() < 0.5 ? "A" : "B",
    vote: { L: totalL, R: totalR },
    fellBack: "coinFlip",
  };
}
