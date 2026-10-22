import { MetaSendError } from "../meta/cloud-api";

const GRAPH = "https://graph.facebook.com/v25.0";

export type Audio = { bytes: ArrayBuffer; mimeType: string };

// Downloads a voice note from Meta: first its details (the link lasts five
// minutes), then the file. Refuses anything over maxBytes before downloading.
export async function downloadVoiceNote(
  mediaId: string,
  token: string,
  maxBytes: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Audio | "too_long"> {
  const auth = { Authorization: `Bearer ${token}` };
  const info = await fetchImpl(`${GRAPH}/${encodeURIComponent(mediaId)}`, {
    headers: auth,
    signal: AbortSignal.timeout(2000),
  });
  if (!info.ok) throw new MetaSendError(info.status, undefined);
  const meta = (await info.json()) as {
    url?: string;
    mime_type?: string;
    file_size?: number;
  };
  if (!meta.url || !meta.url.startsWith("https://"))
    throw new Error("no media url");
  if ((meta.file_size ?? 0) > maxBytes) return "too_long";

  const file = await fetchImpl(meta.url, {
    headers: auth,
    signal: AbortSignal.timeout(3000),
  });
  if (!file.ok) throw new MetaSendError(file.status, undefined);
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > maxBytes) return "too_long";
  return { bytes, mimeType: meta.mime_type ?? "audio/ogg" };
}
