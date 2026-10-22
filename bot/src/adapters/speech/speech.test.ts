import { describe, expect, it } from "vitest";
import { voiceNotes } from ".";

const budget = (spent: number[] = []) => ({
  left: async () => true,
  spend: async (m: number) => void spent.push(m),
});

type Opts = {
  size?: number | null;
  host?: string;
  mime?: string;
  stt?: Response;
};

function fakeMeta(opts: Opts) {
  const calls: string[] = [];
  const f = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://graph.facebook.com"))
      return Response.json({
        url: `https://${opts.host ?? "lookaside.fbsbx.com"}/file`,
        mime_type: opts.mime ?? "audio/ogg; codecs=opus",
        ...(opts.size === null ? {} : { file_size: opts.size ?? 9000 }),
      });
    if (url.endsWith("/file")) {
      expect(init?.redirect).toBe("error");
      return new Response(new Uint8Array(9000));
    }
    if (url.startsWith("https://api.elevenlabs.io"))
      return opts.stt ?? Response.json({ text: " skipped micro " });
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  return { f, calls };
}

describe("voiceNotes", () => {
  it("downloads the note, transcribes it and charges the ceiling by size", async () => {
    const spent: number[] = [];
    const { f } = fakeMeta({});
    expect(
      await voiceNotes("meta-token", "stt-key", budget(spent), f).transcribe(
        "media1",
      ),
    ).toEqual({
      ok: true,
      text: "skipped micro",
    });
    expect(spent).toEqual([500]);
  });

  it("refuses a long note before downloading it", async () => {
    const { f, calls } = fakeMeta({ size: 5_000_000 });
    expect(await voiceNotes("t", "k", budget(), f).transcribe("m")).toEqual({
      ok: false,
      reason: "too_long",
    });
    expect(calls).toHaveLength(1);
  });

  it("never sends the token to a host that isn't Meta's, and only takes audio", async () => {
    for (const bad of [
      { host: "evil.example.com" },
      { mime: "image/png" },
      { size: null },
    ] as Opts[]) {
      const { f, calls } = fakeMeta(bad);
      expect(await voiceNotes("t", "k", budget(), f).transcribe("m")).toEqual({
        ok: false,
        reason: "failed",
      });
      expect(calls).toHaveLength(1);
    }
  });

  it("is off without a key or past the ceiling, and charges a failed transcription", async () => {
    const spent: number[] = [];
    const { f } = fakeMeta({ stt: new Response("no", { status: 500 }) });
    expect(await voiceNotes("t", null, budget(), f).transcribe("m")).toEqual({
      ok: false,
      reason: "off",
    });
    const closed = { left: async () => false, spend: async () => undefined };
    expect(await voiceNotes("t", "k", closed, f).transcribe("m")).toEqual({
      ok: false,
      reason: "off",
    });
    expect(
      await voiceNotes("t", "k", budget(spent), f).transcribe("m"),
    ).toEqual({ ok: false, reason: "failed" });
    expect(spent).toEqual([500]);
  });
});
