import type { Stage } from "./types";

interface TaskTemplate {
  instruction: (chosenText: string) => string;
  timeoutSec: number;
}

export const TASK_TEMPLATES: Record<Stage, TaskTemplate> = {
  intro: {
    instruction: () => "no-op",
    timeoutSec: 1,
  },
  "ig-swipe": {
    instruction: (text) =>
      `Open Instagram in Chrome (already logged in to the demo account). The fish council chose: "${text}". Execute that. If the choice is to DM strangers, only DM the approved demo accounts (see system prompt). Send a friendly message asking if they want to grab dinner this weekend. Stop the moment any reply lands. Post each DM as a status update.`,
    timeoutSec: 120,
  },
  "book-flight": {
    instruction: (text) =>
      `Open Google Flights in Chrome. Search a one-way flight from your current city to the destination implied by: "${text}". Pick the cheapest option leaving in the next 7 days. Add it to the cart but DO NOT submit payment. Take a screenshot. Post the screenshot path as the final status.`,
    timeoutSec: 120,
  },
  "book-activity": {
    instruction: (text) =>
      `Find and "book" the activity described in: "${text}". Use Google or the activity site already logged in. Pick a real listing in the destination city, fill out the booking form up to the payment step, take a screenshot, do NOT submit payment.`,
    timeoutSec: 120,
  },
  "book-restaurant": {
    instruction: (text) =>
      `Open OpenTable in Chrome (already signed in to the demo account). Find the restaurant matching: "${text}" in the destination city. Book a table for 2 for tomorrow night at 7 PM. If a real reservation would charge a card or require a deposit, stop one click before the charge and screenshot the confirmation page instead.`,
    timeoutSec: 150,
  },
};
