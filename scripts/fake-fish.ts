/**
 * Continuously publishes synthetic fish-pos events at 30 Hz with the fish
 * drifting back and forth across the midline. Use this to test the display
 * (fish tally + vote rule) without running the real vision pipeline.
 *
 *   npm run fake-fish -- --side both
 *   npm run fake-fish -- --side left   # park 3 fish on the left
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

const HZ = 30;
const INTERVAL = 1000 / HZ;

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
};

const mode = arg("--side", "both"); // both | left | right | drift
const total = Number(arg("--total", "3"));

let t = 0;

async function tick() {
  let L = 0;
  let R = 0;
  switch (mode) {
    case "left":
      L = total;
      break;
    case "right":
      R = total;
      break;
    case "drift": {
      // Slow sine: most weight on one side then the other
      const x = Math.sin(t / 30);
      L = x > 0 ? Math.round(total * x) : 0;
      R = total - L;
      break;
    }
    default: {
      // Random walk that mostly distributes 3 fish
      const r = Math.random();
      L = r < 0.33 ? 1 : r < 0.66 ? 2 : 3;
      R = Math.max(0, total - L);
    }
  }

  await pusher.trigger("fish-pos", "update", {
    counts: { L, R },
    total: L + R,
    ts: Date.now() * 1e6,
  });
  t++;
}

console.log(`publishing fake fish-pos at ${HZ} Hz, mode=${mode}, total=${total}`);
console.log("Ctrl-C to stop.");

setInterval(() => {
  tick().catch((e) => console.error(e));
}, INTERVAL);
