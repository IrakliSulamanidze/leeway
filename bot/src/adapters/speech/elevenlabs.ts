import type { Audio } from "./meta-media";

const URL = "https://api.elevenlabs.io/v1/speech-to-text";

// ElevenLabs Scribe, the planning research's first pick for accented English.
// Price as published: about $0.40 an hour of audio.
export const MICROS_PER_SECOND = 0.4e6 / 3600;

export async function scribe(
  audio: Audio,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const form = new FormData();
  form.set("model_id", "scribe_v2");
  form.set("language_code", "en");
  form.set(
    "file",
    new Blob([audio.bytes], { type: audio.mimeType }),
    "note.ogg",
  );
  const res = await fetchImpl(URL, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`speech-to-text answered ${res.status}`);
  const json = (await res.json()) as { text?: unknown };
  if (typeof json.text !== "string")
    throw new Error("speech-to-text gave no text");
  return json.text;
}
