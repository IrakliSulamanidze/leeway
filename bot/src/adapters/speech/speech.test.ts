import { describe, expect, it } from "vitest";
import { voiceNotes } from ".";

const budget = (spent: number[] = []) => ({
  left: async () => true,
  spend: async (m: number) => void spent.push(m),
});

function fakeMeta(opts: { size?: number; stt?: Response }) {
  const calls: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (url.startsWith("https://graph.facebook.com"))
      return Response.json({
        url: "https://lookaside.example/file",
        mime_type: "audio/ogg",
        file_size: opts.size ?? 9000,
      });
    if (url === "https://lookaside.example/file")
      return new Response(new Uint8Array(9000));
    if (url.startsWith("https://api.elevenlabs.io")) {
      expect((init?.headers as Record<string, string>)["xi-api-key"]).toBe(
        "stt-key",
      );
      return opts.stt ?? Response.json({ text: " skipped micro " });
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  return { f, calls };
}

describe("voiceNotes", () => {
  it("downloads the note, transcribes it and charges the ceiling", async () => {
    const spent: number[] = [];
    const { f } = fakeMeta({});
    const speech = voiceNotes("meta-token", "stt-key", budget(spent), f);
    expect(await speech.transcribe("media1")).toEqual({
      ok: true,
      text: "skipped micro",
    });
    expect(spent).toHaveLength(1);
  });

  it("refuses a long note before downloading it", async () => {
    const { f, calls } = fakeMeta({ size: 5_000_000 });
    expect(
      await voiceNotes("t", "stt-key", budget(), f).transcribe("m"),
    ).toEqual({ ok: false, reason: "too_long" });
    expect(calls).toHaveLength(1);
  });

  it("is off without a key or past the ceiling, and failed when the service errs", async () => {
    const { f } = fakeMeta({ stt: new Response("no", { status: 500 }) });
    expect(await voiceNotes("t", null, budget(), f).transcribe("m")).toEqual({
      ok: false,
      reason: "off",
    });
    const closed = { left: async () => false, spend: async () => undefined };
    expect(await voiceNotes("t", "stt-key", closed, f).transcribe("m")).toEqual(
      { ok: false, reason: "off" },
    );
    expect(
      await voiceNotes("t", "stt-key", budget(), f).transcribe("m"),
    ).toEqual({ ok: false, reason: "failed" });
  });
});
