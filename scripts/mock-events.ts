/**
 * Drives the live display from the command line by publishing fake events to
 * the real Pusher app. Use this for end-to-end smoke tests when the bridge
 * and remote agent aren't running yet.
 *
 * Usage:
 *   pnpm install --filter scripts
 *   cd scripts
 *   cp .env.example .env  # fill in Pusher creds
 *   npm run mock -- options
 *   npm run mock -- decide A
 *   npm run mock -- status "DMing @demo_friend1"
 *   npm run mock -- demo  # runs a full scripted sequence
 */

import "dotenv/config";
import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

const CALL_SID = "MOCK_CALL";
const STAGE = "ig-swipe";

async function trigger(channel: string, event: string, data: unknown) {
  await pusher.trigger(channel, event, data as object);
  console.log(`✔  ${channel}/${event}`, JSON.stringify(data).slice(0, 100));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function options() {
  await trigger("options", "present", {
    callSid: CALL_SID,
    stage: STAGE,
    option_a: "Text your ex again",
    option_b: "Swipe up on random IG stories",
  });
}

async function decide(chosen: "A" | "B") {
  const text =
    chosen === "A" ? "Text your ex again" : "Swipe up on random IG stories";
  await trigger("decisions", "decided", {
    callSid: CALL_SID,
    stage: STAGE,
    chosen,
    text,
    vote: { L: chosen === "A" ? 24 : 4, R: chosen === "B" ? 24 : 4 },
  });
}

async function status(detail: string, type: "progress" | "done" | "error" = "progress") {
  await trigger("agent-status", "update", {
    taskId: "MOCK_TASK",
    callSid: CALL_SID,
    stage: STAGE,
    type,
    detail,
    ts: Date.now(),
  });
}

async function fishPos(L: number, R: number) {
  await trigger("fish-pos", "update", {
    counts: { L, R },
    total: L + R,
    ts: Date.now() * 1e6, // vision sends nanoseconds
  });
}

async function demo() {
  console.log("→ scenario: full ig-swipe stage, options to executing");
  await options();
  // Drift the fish around during the countdown
  for (let i = 0; i < 25; i++) {
    const L = i < 10 ? 2 : i < 20 ? 1 : 0;
    const R = 3 - L;
    await fishPos(L, R);
    await sleep(180);
  }
  // Display will publish its own decision via voteRule, so we wait a moment
  // and then start streaming statuses.
  await sleep(2500);
  for (const line of [
    "opened Instagram",
    "DMing @demo_friend1",
    "DMing @demo_friend2",
    "DMing @demo_friend3",
    "@demo_friend2 replied",
  ]) {
    await status(line);
    await sleep(900);
  }
  await status("first reply landed, stopping", "done");
  console.log("→ done");
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "options":
      await options();
      break;
    case "decide":
      await decide((args[0] as "A" | "B") ?? "A");
      break;
    case "status":
      await status(args.join(" ") || "fish is doing fish things");
      break;
    case "fish":
      await fishPos(Number(args[0] ?? 2), Number(args[1] ?? 1));
      break;
    case "demo":
      await demo();
      break;
    default:
      console.error(
        "usage: npm run mock -- <options|decide A|B|status TEXT|fish L R|demo>",
      );
      process.exitCode = 1;
  }
  process.exit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
