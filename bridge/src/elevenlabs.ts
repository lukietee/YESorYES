import WebSocket from "ws";

export interface ElevenSession {
  push: (text: string) => void;
  flush: () => void;
  close: () => void;
}

/**
 * Open a streaming TTS WebSocket to ElevenLabs. Output is μ-law 8kHz so it
 * can be forwarded to Twilio Media Streams without resampling.
 *
 * Pass partial text as it arrives from Claude. Call flush() at the end of
 * an utterance. Audio bytes are returned via onAudio.
 */
export function openElevenLabs(opts: {
  voiceId: string;
  onAudio: (mulaw: Buffer) => void;
  onError?: (e: unknown) => void;
}): ElevenSession {
  const url = new URL(
    `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}/stream-input`,
  );
  url.searchParams.set("model_id", "eleven_flash_v2_5");
  url.searchParams.set("output_format", "ulaw_8000");

  const ws = new WebSocket(url.toString(), {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
  });

  let opened = false;
  const queue: string[] = [];

  ws.on("open", () => {
    opened = true;
    // BOS frame
    ws.send(
      JSON.stringify({
        text: " ",
        voice_settings: { stability: 0.45, similarity_boost: 0.8 },
        generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
      }),
    );
    for (const t of queue) ws.send(JSON.stringify({ text: t }));
    queue.length = 0;
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.audio) {
        opts.onAudio(Buffer.from(msg.audio, "base64"));
      }
    } catch (e) {
      opts.onError?.(e);
    }
  });

  ws.on("error", (e) => opts.onError?.(e));

  return {
    push: (text: string) => {
      if (!text) return;
      const frame = JSON.stringify({ text });
      if (opened) ws.send(frame);
      else queue.push(text);
    },
    flush: () => {
      if (!opened) return;
      ws.send(JSON.stringify({ text: "" })); // EOS for this turn
    },
    close: () => {
      try {
        ws.close();
      } catch {}
    },
  };
}
