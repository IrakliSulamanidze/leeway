import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPushEndpoint } from "@/lib/push-hosts";
import { sendToUser, type PushSub, type Sender } from "./push";

// Every test passes its own sender; web-push itself is never called.
vi.mock("web-push", () => ({ sendNotification: vi.fn() }));

const sub = (id: string, endpoint: string, created_at: string): PushSub => ({
  id,
  endpoint,
  p256dh: "p",
  auth: "a",
  created_at,
});
const FCM = "https://fcm.googleapis.com/fcm/send/x";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public");
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("push hosts", () => {
  it("accepts the four push services and nothing else", () => {
    expect(isPushEndpoint(FCM)).toBe(true);
    expect(
      isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x"),
    ).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/x")).toBe(true);
    expect(
      isPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x"),
    ).toBe(true);
    for (const bad of [
      "https://evil.example.com/x",
      "https://fcm.googleapis.com.evil.com/x",
      "https://push.apple.com.evil.com/x",
      "http://fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://user@fcm.googleapis.com/x",
      "https://169.254.169.254/latest",
      "not a url",
    ])
      expect(isPushEndpoint(bad), bad).toBe(false);
  });
});

describe("sendToUser", () => {
  it("never sends to a non-push host", async () => {
    const send = vi.fn<Sender>().mockResolvedValue({});
    const r = await sendToUser(
      [sub("1", "https://evil.example.com/x", "2026-10-01")],
      "hi",
      send,
    );
    expect(send).not.toHaveBeenCalled();
    expect(r).toEqual({ sent: 0, gone: [] });
  });

  it("sends to at most the 5 newest subscriptions", async () => {
    const send = vi.fn<Sender>().mockResolvedValue({});
    const subs = Array.from({ length: 7 }, (_, i) =>
      sub(String(i), `${FCM}${i}`, `2026-10-0${i + 1}`),
    );
    const r = await sendToUser(subs, "hi", send);
    expect(r.sent).toBe(5);
    expect(send.mock.calls.map((c) => c[0].endpoint)).toEqual(
      [6, 5, 4, 3, 2].map((i) => `${FCM}${i}`),
    );
    expect(send.mock.calls[0][2].timeout).toBe(5000);
  });

  it("gives up on a push service after 5 seconds and moves on", async () => {
    vi.useFakeTimers();
    const send = vi
      .fn<Sender>()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({});
    const p = sendToUser(
      [
        sub("slow", `${FCM}a`, "2026-10-02"),
        sub("ok", `${FCM}b`, "2026-10-01"),
      ],
      "hi",
      send,
    );
    await vi.advanceTimersByTimeAsync(4_999);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ sent: 1, gone: [] });
  });

  it("reports 404 and 410 subscriptions as gone", async () => {
    const send = vi
      .fn<Sender>()
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockRejectedValueOnce({ statusCode: 500 });
    const r = await sendToUser(
      [
        sub("a", `${FCM}a`, "2026-10-03"),
        sub("b", `${FCM}b`, "2026-10-02"),
        sub("c", `${FCM}c`, "2026-10-01"),
      ],
      "hi",
      send,
    );
    expect(r).toEqual({ sent: 0, gone: ["a", "b"] });
  });

  it("sends nothing when VAPID keys are not set", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const send = vi.fn<Sender>().mockResolvedValue({});
    expect(await sendToUser([sub("1", FCM, "2026-10-01")], "hi", send)).toEqual(
      {
        sent: 0,
        gone: [],
      },
    );
    expect(send).not.toHaveBeenCalled();
  });
});
