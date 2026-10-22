import { MetaSendError } from "../meta/cloud-api";

const GRAPH = "https://graph.facebook.com/v25.0";

// Hosts Meta serves media from. The access token goes nowhere else.
const MEDIA_HOSTS = [
  /\.fbsbx\.com$/,
  /\.whatsapp\.net$/,
  /\.facebook\.com$/,
  /\.fbcdn\.net$/,
];

export type Audio = { bytes: ArrayBuffer; mimeType: string };

// Downloads a voice note from Meta: first its details (the link lasts five
// minutes), then the file. Refuses anything over maxBytes or not audio, and
// stops reading once the cap is passed.
export async function downloadVoiceNote(
  mediaId: string,
  token: string,
  maxBytes: number,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<Audio | "too_long"> {
  const auth = { Authorization: `Bearer ${token}` };
  const info = await fetchImpl(`${GRAPH}/${encodeURIComponent(mediaId)}`, {
    headers: auth,
    signal,
  });
  if (!info.ok) throw new MetaSendError(info.status, undefined);
  const meta = (await info.json()) as {
    url?: string;
    mime_type?: string;
    file_size?: number;
  };
  const url = meta.url ? new URL(meta.url) : null;
  if (
    !url ||
    url.protocol !== "https:" ||
    !MEDIA_HOSTS.some((h) => h.test(url.hostname))
  )
    throw new Error("unexpected media address");
  if (!meta.mime_type?.startsWith("audio/")) throw new Error("not audio");
  if (typeof meta.file_size !== "number") throw new Error("no media size");
  if (meta.file_size > maxBytes) return "too_long";

  const file = await fetchImpl(url, {
    headers: auth,
    signal,
    redirect: "error",
  });
  if (!file.ok || !file.body) throw new MetaSendError(file.status, undefined);
  if (Number(file.headers.get("content-length") ?? 0) > maxBytes)
    return "too_long";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of file.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    if (size > maxBytes) return "too_long";
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return { bytes: bytes.buffer, mimeType: meta.mime_type };
}
