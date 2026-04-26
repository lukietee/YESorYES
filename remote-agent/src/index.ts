import "dotenv/config";
import { createRequire } from "module";
import { runStage } from "./computerUse.js";
import { postStatus } from "./status.js";
import type { Stage } from "./stages/index.js";

// pusher-js's default entry is the browser bundle. Use the Node entry, and
// resolve via createRequire so the CJS constructor isn't wrapped by ESM.
const require = createRequire(import.meta.url);
const { Pusher } = require("pusher-js/node");

interface AgentTask {
  taskId: string;
  callSid: string;
  stage: Stage;
  chosen: "A" | "B";
  instruction: string;
  timeoutSec: number;
}

function main() {
  const required = ["ANTHROPIC_API_KEY", "PUSHER_KEY", "PUSHER_CLUSTER", "WEB_BASE_URL", "INTERNAL_TOKEN"];
  for (const k of required) {
    if (!process.env[k]) {
      console.error(`missing env: ${k}`);
      process.exit(1);
    }
  }

  const pusher = new Pusher(process.env.PUSHER_KEY!, {
    cluster: process.env.PUSHER_CLUSTER!,
  });

  const channel = pusher.subscribe("agent-tasks");
  channel.bind("dispatch", (task: AgentTask) => {
    console.log(`[agent-tasks] received: stage=${task.stage} chosen=${task.chosen} taskId=${task.taskId}`);
    runStage(task).catch(async (e) => {
      console.error("runStage failed", e);
      await postStatus({
        taskId: task.taskId,
        callSid: task.callSid,
        stage: task.stage,
        type: "error",
        detail: e instanceof Error ? e.message : String(e),
      });
    });
  });

  pusher.connection.bind("connected", () => {
    console.log("connected to Pusher, listening on channel `agent-tasks`");
  });
  pusher.connection.bind("error", (err: unknown) => {
    console.error("pusher error", err);
  });

  console.log("remote-agent running — Ctrl-C to stop");
}

main();
