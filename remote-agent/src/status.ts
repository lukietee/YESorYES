interface StatusBody {
  taskId: string;
  callSid: string;
  stage: string;
  type: "progress" | "done" | "error";
  detail: string;
}

export async function postStatus(body: StatusBody): Promise<void> {
  const url = `${process.env.WEB_BASE_URL}/api/agent/status`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.INTERNAL_TOKEN}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("postStatus failed:", e);
  }
}
