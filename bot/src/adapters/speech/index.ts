import type { Speech } from "../../ports";
import type { AiBudget } from "../claude/reader";
import { log } from "../log";
import { scribe } from "./elevenlabs";
import { downloadVoiceNote } from "./meta-media";

// About a minute of WhatsApp voice (Opus at roughly 16 kbit/s).
export const MAX_VOICE_BYTES = 130_000;
// Download and transcription share one budget, so a voice note leaves time
// for the reader and the reply inside the webhook's limit.
const VOICE_BUDGET_MS = 4_000;
// Charged against the daily AI ceiling by size: an estimate at about $0.40
// an hour of audio and 2 KB a second. Check it against the bill.
const microsFor = (bytes: number) => Math.ceil((bytes / 2000) * (0.4e6 / 3600));

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
      const signal = AbortSignal.timeout(VOICE_BUDGET_MS);
      let charged = 0;
      try {
        const audio = await downloadVoiceNote(
          mediaId,
          metaToken,
          MAX_VOICE_BYTES,
          signal,
          fetchImpl,
        );
        if (audio === "too_long") return { ok: false, reason: "too_long" };
        charged = microsFor(audio.bytes.byteLength);
        const text = (await scribe(audio, sttKey, signal, fetchImpl)).trim();
        return text
          ? { ok: true, text: text.slice(0, 600) }
          : { ok: false, reason: "failed" };
      } catch (error) {
        log.warn(
          "speech: failed",
          error instanceof Error ? error.name : "unknown",
        );
        return { ok: false, reason: "failed" };
      } finally {
        // Every note sent for transcription is charged, failed or not.
        if (charged)
          await budget
            .spend(charged)
            .catch(() => log.error("speech: could not record spend"));
      }
    },
  };
}
