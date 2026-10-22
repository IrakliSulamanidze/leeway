import type { Speech } from "../../ports";
import type { AiBudget } from "../claude/reader";
import { log } from "../log";
import { MICROS_PER_SECOND, scribe } from "./elevenlabs";
import { downloadVoiceNote } from "./meta-media";

// About a minute of WhatsApp voice (Opus, ~16 kbit/s) with room to spare.
export const MAX_VOICE_BYTES = 200_000;
// Charged against the daily AI ceiling as if every note were a minute long.
const MICROS_PER_NOTE = Math.ceil(60 * MICROS_PER_SECOND);

export function voiceNotes(
  metaToken: string,
  sttKey: string | null,
  budget: AiBudget,
  fetchImpl: typeof fetch = fetch,
): Speech {
  return {
    async transcribe(mediaId) {
      if (!sttKey || !(await budget.left()))
        return { ok: false, reason: "off" };
      try {
        const audio = await downloadVoiceNote(
          mediaId,
          metaToken,
          MAX_VOICE_BYTES,
          fetchImpl,
        );
        if (audio === "too_long") return { ok: false, reason: "too_long" };
        const text = await scribe(audio, sttKey, fetchImpl);
        await budget
          .spend(MICROS_PER_NOTE)
          .catch(() => log.error("speech: could not record spend"));
        const trimmed = text.trim();
        return trimmed
          ? { ok: true, text: trimmed.slice(0, 600) }
          : { ok: false, reason: "failed" };
      } catch (error) {
        log.warn(
          "speech: failed",
          error instanceof Error ? error.name : "unknown",
        );
        return { ok: false, reason: "failed" };
      }
    },
  };
}
