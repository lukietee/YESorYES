import type { Stage } from "./types";

export const STAGE_ORDER: readonly Stage[] = [
  "intro",
  "ig-swipe",
  "book-flight",
  "book-activity",
  "book-restaurant",
];

export const STAGE_HINTS: Record<Stage, string> = {
  intro:
    "Open the call. Let the user describe their situation. Do not present options yet.",
  "ig-swipe":
    "Two opposite social moves in response to the user's situation. One healthy, one unhinged. Each label <= 80 chars.",
  "book-flight":
    "Two destination cities for a one-way flight. Make them clearly different vibes (e.g. Las Vegas vs Paris).",
  "book-activity":
    "Two date activities for the trip. One earnest, one chaotic. Quick, specific, evocative.",
  "book-restaurant":
    "Two restaurants for the date dinner. One five-star, one one-star. Real names if you can be specific.",
};

export function nextStage(current: Stage): Stage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}
