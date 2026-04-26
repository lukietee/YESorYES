import { getPage } from "./playwrightRunner.js";
import { getScript } from "./scripted/index.js";
import { postStatus } from "./status.js";
import type { Stage } from "./stages/index.js";

interface AgentTask {
  taskId: string;
  callSid: string;
  stage: Stage;
  chosen: "A" | "B";
  instruction: string;
  timeoutSec: number;
}

/**
 * Scripted, deterministic Playwright runner. Way faster than computer-use
 * and reliable for demo. Each (stage, chosen) maps to a hand-written list of
 * steps that drives a headed Chrome window on the laptop.
 */
export async function runScripted(task: AgentTask): Promise<void> {
  console.log("[scripted] runScripted entry", task.stage, task.chosen);
  const script = getScript(task.stage, task.chosen);
  if (!script) {
    console.log("[scripted] no script");
    await postStatus({
      ...statusBase(task),
      type: "error",
      detail: `no script for ${task.stage} ${task.chosen}`,
    });
    return;
  }
  console.log("[scripted] script length", script.length);

  console.log("[scripted] postStatus starting");
  await postStatus({ ...statusBase(task), type: "progress", detail: `starting ${task.stage}` });
  console.log("[scripted] postStatus done");

  let page;
  try {
    console.log("[scripted] launching playwright");
    page = await getPage();
    console.log("[scripted] page acquired");
  } catch (e) {
    console.error("[scripted] launch failed", e);
    await postStatus({
      ...statusBase(task),
      type: "error",
      detail: `playwright launch failed: ${e instanceof Error ? e.message : String(e)}`,
    });
    return;
  }

  try {
    for (const step of script) {
      console.log("[scripted] step:", step.detail);
      await postStatus({ ...statusBase(task), type: "progress", detail: step.detail });
      await step.run(page);
      console.log("[scripted] step done");
    }
    // Hold the result on screen for ~3s so the audience can see it before
    // the call moves on to the next stage.
    await page.waitForTimeout(3000);
    await postStatus({
      ...statusBase(task),
      type: "done",
      detail: `${task.stage} ${task.chosen} — fish are pleased`,
    });
  } catch (e) {
    await postStatus({
      ...statusBase(task),
      type: "error",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

function statusBase(task: AgentTask) {
  return { taskId: task.taskId, callSid: task.callSid, stage: task.stage };
}
