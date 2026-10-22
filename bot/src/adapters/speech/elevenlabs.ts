import type { Audio } from "./meta-media";

const URL = "https://api.elevenlabs.io/v1/speech-to-text";

// ElevenLabs Scribe (API reference: elevenlabs.io/docs/api-reference/speech-to-text).
export async function scribe(
  audio: Audio,
  apiKey: string,
  signal: AbortSignal,
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
    signal,
  });
  if (!res.ok) throw new Error(`speech-to-text answered ${res.status}`);
  const json = (await res.json()) as { text?: unknown };
  if (typeof json.text !== "string")
    throw new Error("speech-to-text gave no text");
  return json.text;
}
