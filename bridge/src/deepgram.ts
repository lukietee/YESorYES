import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export interface DeepgramSession {
  sendAudio: (mulaw: Buffer) => void;
  close: () => void;
}

export function openDeepgram(opts: {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (e: unknown) => void;
}): DeepgramSession {
  const client = createClient(process.env.DEEPGRAM_API_KEY!);
  const conn = client.listen.live({
    model: "nova-3",
    encoding: "mulaw",
    sample_rate: 8000,
    channels: 1,
    interim_results: true,
    punctuate: true,
    smart_format: true,
    endpointing: 250,
    vad_events: true,
  });

  conn.on(LiveTranscriptionEvents.Open, () => console.log("[dg] open"));
  conn.on(LiveTranscriptionEvents.Transcript, (data) => {
    const alt = data?.channel?.alternatives?.[0];
    const text: string | undefined = alt?.transcript;
    console.log(`[dg] transcript is_final=${Boolean(data?.is_final)} text=${JSON.stringify(text ?? "")}`);
    if (!text) return;
    opts.onTranscript(text, Boolean(data?.is_final));
  });

  conn.on(LiveTranscriptionEvents.Error, (e) => {
    console.error("[dg] error", e);
    opts.onError?.(e);
  });
  conn.on(LiveTranscriptionEvents.Close, (e) => console.log("[dg] close", e));

  return {
    sendAudio: (mulaw: Buffer) => {
      conn.send(mulaw);
    },
    close: () => {
      try {
        conn.requestClose();
      } catch {}
    },
  };
}
