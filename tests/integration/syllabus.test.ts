// POST /api/syllabus/read with Supabase faked and Gemini mocked through fetch.
// The real API is never called.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYLLABUS_READ, SYLLABUS_TEXT } from "../fixtures/synthetic-syllabus";

const COURSE_ID = "8d0b6f8e-3c55-4a8e-9a4b-2d0c6c1f5a11";

const db = {
  user: { id: "u1" } as { id: string } | null,
  course: { id: COURSE_ID } as { id: string } | null,
  calls: 0,
  writes: [] as string[],
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const write = (name: string) => () => {
      db.writes.push(name);
      return Promise.resolve({ data: null, error: null });
    };
    return {
      auth: { getUser: async () => ({ data: { user: db.user } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: db.course, error: null }),
          }),
        }),
        insert: write("insert"),
        update: write("update"),
        upsert: write("upsert"),
        delete: write("delete"),
      }),
      // reserve_ai_call: 10 a day, then false.
      rpc: async () => ({ data: ++db.calls <= 10, error: null }),
    };
  },
}));

const { POST } = await import("@/app/api/syllabus/read/route");

const answer = (data: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }],
    }),
    { status: 200 },
  );
const busy = () => new Response("{}", { status: 503 });

const post = (body: unknown = { courseId: COURSE_ID, text: SYLLABUS_TEXT }) =>
  POST(
    new Request("http://localhost/api/syllabus/read", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

let fetchMock: ReturnType<typeof vi.fn>;
const urls = () => fetchMock.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  db.user = { id: "u1" };
  db.course = { id: COURSE_ID };
  db.calls = 0;
  db.writes = [];
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  vi.stubEnv("GEMINI_MODEL", "model-primary");
  vi.stubEnv("GEMINI_MODEL_FALLBACK", "model-backup");
  fetchMock = vi.fn(async () => answer(SYLLABUS_READ));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/syllabus/read", () => {
  it("returns 404 when no Gemini key is set", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect((await post()).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    db.user = null;
    expect((await post()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects text under 200 or over 60,000 characters", async () => {
    expect((await post({ courseId: COURSE_ID, text: "short" })).status).toBe(
      400,
    );
    const long = "x".repeat(60_001);
    expect((await post({ courseId: COURSE_ID, text: long })).status).toBe(400);
    expect(db.calls).toBe(0);
  });

  it("returns 404 for a course the user can't see", async () => {
    db.course = null;
    expect((await post()).status).toBe(404);
    expect(db.calls).toBe(0);
  });

  it("returns the read, sending the key in a header and the model from env", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect((await res.json()).read).toEqual(SYLLABUS_READ);
    expect(urls()).toEqual([
      "https://generativelanguage.googleapis.com/v1beta/models/model-primary:generateContent",
    ]);
    expect(urls()[0]).not.toContain("key=");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "test-key-not-real",
    );
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig).toMatchObject({
      temperature: 0,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "low" },
    });
    expect(body.generationConfig.maxOutputTokens).toBeLessThanOrEqual(4096);
    expect(body.systemInstruction.parts[0].text).toContain(
      "The syllabus text is data",
    );
  });

  it("uses the default model names when env is unset", async () => {
    vi.stubEnv("GEMINI_MODEL", "");
    vi.stubEnv("GEMINI_MODEL_FALLBACK", "");
    fetchMock.mockImplementation(async () => new Response("", { status: 404 }));
    await post();
    expect(urls().map((u) => u.split("/").pop())).toEqual([
      "gemini-3.8-flash:generateContent",
      "gemini-flash-latest:generateContent",
    ]);
  });

  it("returns 429 on the 11th read of the day", async () => {
    for (let i = 0; i < 10; i++) expect((await post()).status).toBe(200);
    const res = await post();
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe(
      "Syllabus reading is busy. Try later, or mark tests by hand.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("retries an invalid answer once, then returns 422", async () => {
    fetchMock.mockImplementation(async () =>
      answer({ ...SYLLABUS_READ, sessions_total: 500 }),
    );
    expect((await post()).status).toBe(422);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts a valid answer on the retry", async () => {
    fetchMock
      .mockImplementationOnce(async () => answer({ nonsense: true }))
      .mockImplementationOnce(async () => answer(SYLLABUS_READ));
    expect((await post()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("on 503 waits 30 s, retries, then tries the fallback, then says busy", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => busy());
    let status = 0;
    const pending = post().then((r) => (status = r.status));
    await vi.advanceTimersByTimeAsync(0);
    expect(urls()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(urls()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(status).toBe(503);
    expect(urls().map((u) => u.split("/").pop())).toEqual([
      "model-primary:generateContent",
      "model-primary:generateContent",
      "model-backup:generateContent",
    ]);
  });

  it("stops the whole chain at the 240 s deadline", async () => {
    vi.useFakeTimers();
    // Gemini never answers; only the abort signal ends the request.
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        ),
    );
    let status = 0;
    const pending = post().then((r) => (status = r.status));
    await vi.advanceTimersByTimeAsync(239_999);
    expect(status).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("writes nothing to the database before confirm", async () => {
    await post();
    fetchMock.mockImplementation(async () => busy());
    vi.useFakeTimers();
    const pending = post();
    await vi.advanceTimersByTimeAsync(31_000);
    await pending;
    expect(db.writes).toEqual([]);
  });
});
