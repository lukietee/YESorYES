/**
 * Pre-rendered filler clips for `wait_for_decision`. Generated once at
 * startup via ElevenLabs and cached as μ-law 8kHz buffers.
 *
 * For the hackathon MVP we just let Claude narrate filler inline (it's good
 * at this), but if dead air becomes a problem during voting, render real
 * audio clips here and pipe them to Twilio while the tool call is pending.
 */

export const FILLER_LINES = [
  "let us consult the void.",
  "the council convenes.",
  "give us a second, big-brain time.",
  "stand by, decisions in progress.",
  "fish are deliberating.",
];

// TODO(hackathon): pre-render these to μ-law 8kHz with ElevenLabs at startup
// and queue one whenever wait_for_decision is in flight.
