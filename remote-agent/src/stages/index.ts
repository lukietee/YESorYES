import { IG_SWIPE } from "./ig-swipe.js";
import { BOOK_FLIGHT } from "./book-flight.js";
import { BOOK_ACTIVITY } from "./book-activity.js";
import { BOOK_RESTAURANT } from "./book-restaurant.js";

export const STAGE_PROMPTS = {
  intro: "no-op",
  "ig-swipe": IG_SWIPE,
  "book-flight": BOOK_FLIGHT,
  "book-activity": BOOK_ACTIVITY,
  "book-restaurant": BOOK_RESTAURANT,
} as const;

export type Stage = keyof typeof STAGE_PROMPTS;
