/**
 * Twilio Media Streams send and receive base64-encoded μ-law 8kHz audio
 * frames in 20ms chunks (160 bytes per frame).
 *
 * ElevenLabs and Deepgram both accept μ-law 8000 directly, so we mostly
 * pass bytes through without transcoding. These helpers exist for the
 * times we do need to convert (debugging, recording).
 */

export function decodeBase64(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

export function encodeBase64(buf: Buffer): string {
  return buf.toString("base64");
}

// μ-law decode table (G.711)
// Used only if we ever need PCM for debugging / recording.
const MULAW_BIAS = 0x84;

export function mulawToPcm16(mulaw: Buffer): Int16Array {
  const out = new Int16Array(mulaw.length);
  for (let i = 0; i < mulaw.length; i++) {
    let u = ~mulaw[i] & 0xff;
    const sign = u & 0x80;
    const exponent = (u >> 4) & 0x07;
    const mantissa = u & 0x0f;
    let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
    sample -= MULAW_BIAS;
    out[i] = sign ? -sample : sample;
  }
  return out;
}

export function pcm16ToMulaw(pcm: Int16Array): Buffer {
  const out = Buffer.alloc(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    let sample = pcm[i];
    const sign = sample < 0 ? 0x80 : 0;
    if (sign) sample = -sample;
    if (sample > 32635) sample = 32635;
    sample += MULAW_BIAS;
    let exponent = 7;
    for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
    const mantissa = (sample >> (exponent + 3)) & 0x0f;
    out[i] = ~(sign | (exponent << 4) | mantissa) & 0xff;
  }
  return out;
}
