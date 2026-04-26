import type { FastifyInstance } from "fastify";
import { openDeepgram } from "../deepgram.js";
import { openElevenLabs } from "../elevenlabs.js";
import { runBrainTurn } from "../claude.js";
import { putCall, getCall, dropCall } from "../state.js";
import type Anthropic from "@anthropic-ai/sdk";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID!;

export function registerTwilioStream(app: FastifyInstance) {
  app.get("/twilio", { websocket: true }, (socket, req) => {
    let callSid = "";
    let streamSid = "";
    let dg: ReturnType<typeof openDeepgram> | null = null;
    let tts: ReturnType<typeof openElevenLabs> | null = null;
    let processing = false; // true while a brain turn is in flight
    let pendingTranscript = "";

    const sendToTwilio = (mulawAudio: Buffer) => {
      if (!streamSid) return;
      socket.send(
        JSON.stringify({
          event: "media",
          streamSid,
          media: { payload: mulawAudio.toString("base64") },
        }),
      );
    };

    const newTtsSession = () => {
      tts?.close();
      tts = openElevenLabs({
        voiceId: VOICE_ID,
        onAudio: sendToTwilio,
        onError: (e) => app.log.error({ err: e }, "elevenlabs error"),
      });
      return tts;
    };

    // Closes the current TTS WS (sending EOS) and clears the reference.
    // Used between sub-turns of a brain turn so the next text deltas open
    // a fresh ElevenLabs session — re-using the session after EOS would
    // silently drop audio because stream-input WSes close on EOS.
    const endTtsSession = () => {
      if (!tts) return;
      tts.flush();
      tts.close();
      tts = null;
    };

    const handleFinalUtterance = async (text: string) => {
      const state = getCall(callSid);
      if (!state) return;
      app.log.info({ text, processing }, "[brain] utterance");
      if (processing) {
        pendingTranscript += " " + text;
        return;
      }
      processing = true;
      const t = (pendingTranscript + " " + text).trim();
      pendingTranscript = "";

      state.conversation.push({ role: "user", content: t });

      // Sub-turn boundary: we DON'T pre-allocate a TTS session. Instead,
      // each text delta lazily opens one if needed, and onSubTurnEnd
      // closes it so the next sub-turn opens fresh.
      newTtsSession(); // greeting / first sub-turn always has audio ready
      app.log.info("[brain] turn start");
      try {
        await runBrainTurn(callSid, state.conversation, {
          onTextDelta: (delta) => {
            if (!tts) newTtsSession();
            tts!.push(delta);
          },
          onToolStart: (name) => app.log.info({ name }, "[brain] tool_use"),
          onSubTurnEnd: () => endTtsSession(),
          onEnd: () => endTtsSession(),
        });
        app.log.info("[brain] turn end ok");
      } catch (e) {
        app.log.error({ err: e }, "[brain] turn failed");
      } finally {
        processing = false;
        if (pendingTranscript.trim()) {
          const queued = pendingTranscript.trim();
          pendingTranscript = "";
          app.log.info({ queued }, "[brain] flushing pending");
          handleFinalUtterance(queued);
        }
      }
    };

    socket.on("message", (raw) => {
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (evt.event) {
        case "start": {
          const start = evt.start as {
            streamSid: string;
            callSid: string;
            customParameters?: Record<string, string>;
          };
          streamSid = start.streamSid;
          callSid = start.customParameters?.callSid ?? start.callSid;

          const conversation: Anthropic.MessageParam[] = [];
          putCall({
            callSid,
            streamSid,
            twilioWs: socket as any,
            conversation,
            currentStage: "intro",
            closed: false,
          });

          dg = openDeepgram({
            onTranscript: (text, isFinal) => {
              if (!isFinal) return;
              if (!text.trim()) return;
              handleFinalUtterance(text);
            },
            onError: (e) => app.log.error({ err: e }, "deepgram error"),
          });

          // Greet immediately so there's no awkward silence.
          handleFinalUtterance("(call connected — open with a fish line)");
          break;
        }
        case "media": {
          const media = evt.media as { payload: string };
          if (!media?.payload) return;
          const mulaw = Buffer.from(media.payload, "base64");
          dg?.sendAudio(mulaw);
          break;
        }
        case "stop": {
          dg?.close();
          tts?.close();
          if (callSid) dropCall(callSid);
          break;
        }
      }
    });

    socket.on("close", () => {
      dg?.close();
      tts?.close();
      if (callSid) dropCall(callSid);
    });
  });
}
