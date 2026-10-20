import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEED_ERRORS } from "./errors";

// DNS and HTTPS are replaced by a fake internet: hosts map to addresses, and
// "host/path" maps to a response. Nothing touches the network.
type Route = {
  status?: number;
  headers?: Record<string, string>;
  chunks?: string[];
  hang?: boolean;
  // DNS answers this address from the moment the connection starts.
  rebindTo?: string;
};
const dns = new Map<string, string[]>();
const routes = new Map<string, Route>();
const calls: {
  host: string;
  path: string;
  headers: Record<string, string>;
  pinned: string;
}[] = [];

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => {
    const answers = dns.get(host);
    if (!answers)
      throw Object.assign(new Error(`ENOTFOUND ${host}`), {
        code: "ENOTFOUND",
      });
    return answers.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    }));
  }),
}));

vi.mock("node:https", () => ({
  request: vi.fn((options, onResponse) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      const rebind = routes.get(`${options.hostname}${options.path}`)?.rebindTo;
      if (rebind) dns.set(options.hostname, [rebind]);
      options.lookup(options.hostname, {}, (_err: unknown, address: string) => {
        calls.push({
          host: options.hostname,
          path: options.path,
          headers: options.headers,
          pinned: address,
        });
        const route = routes.get(`${options.hostname}${options.path}`) ?? {
          status: 404,
        };
        const signal: AbortSignal = options.signal;
        if (route.hang) {
          signal.addEventListener("abort", () =>
            req.emit("error", new Error("aborted")),
          );
          return;
        }
        const res = Readable.from(
          (route.chunks ?? []).map((c) => Buffer.from(c)),
        ) as Readable & {
          statusCode: number;
          headers: Record<string, string>;
        };
        res.statusCode = route.status ?? 200;
        res.headers = route.headers ?? {};
        onResponse(res);
      });
    };
    return req;
  }),
}));

const { safeFetch, isPublicAddress, SAFE_FETCH_DEFAULTS } =
  await import("./safe-fetch");
const { lookup } = await import("node:dns/promises");

const ICS = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n";
const SECRET = "k3y-SECRET-123";
const FEED = `https://cal.example.com/feed?key=${SECRET}`;

beforeEach(() => {
  vi.clearAllMocks();
  dns.clear();
  routes.clear();
  calls.length = 0;
  dns.set("cal.example.com", ["93.184.216.34"]);
  routes.set(`cal.example.com/feed?key=${SECRET}`, {
    headers: {
      "content-type": "text/calendar",
      "content-disposition": `attachment; filename="${SECRET}.ics"`,
    },
    chunks: [ICS],
  });
});
afterEach(() => vi.restoreAllMocks());

async function failure(url: string, opts?: Parameters<typeof safeFetch>[1]) {
  return safeFetch(url, opts).then(
    () => "no error",
    (e: Error) => e.message,
  );
}

describe("safeFetch", () => {
  it("fetches a public https calendar, webcal included", async () => {
    const res = await safeFetch(FEED.replace("https:", "webcal:"));
    expect(res).toEqual({
      status: 200,
      contentType: "text/calendar",
      body: ICS,
    });
    expect(calls[0].pinned).toBe("93.184.216.34");
  });

  it("uses 5 s, 2 MB and 3 redirects by default", () => {
    expect(SAFE_FETCH_DEFAULTS).toEqual({
      timeoutMs: 5000,
      maxBytes: 2 * 1024 * 1024,
      maxRedirects: 3,
    });
  });

  it("refuses http, other ports and userinfo before any lookup", async () => {
    for (const url of [
      "http://cal.example.com/feed",
      "https://cal.example.com:8443/feed",
      "https://cal.example.com:80/feed",
      "https://user:pw@cal.example.com/feed",
      "https://user@cal.example.com/feed",
      "ftp://cal.example.com/feed",
      "not a url",
      `https://${"a".repeat(250)}.com/feed`,
    ])
      expect(await failure(url)).toBe(FEED_ERRORS.badLink);
    expect(lookup).not.toHaveBeenCalled();
    expect(
      await safeFetch("https://cal.example.com:443/feed?key=" + SECRET),
    ).toMatchObject({ status: 200 });
  });

  it("blocks every private or special IPv4 range", async () => {
    const blocked = [
      "0.1.2.3",
      "10.0.0.1",
      "100.64.0.1",
      "100.127.255.254",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.0.0.8",
      "192.168.1.1",
      "198.18.0.1",
      "198.19.255.255",
      "224.0.0.1",
      "240.0.0.1",
      "255.255.255.255",
    ];
    for (const ip of blocked) expect(isPublicAddress(ip), ip).toBe(false);
    for (const ip of [
      "93.184.216.34",
      "8.8.8.8",
      "100.128.0.1",
      "172.32.0.1",
      "198.20.0.1",
    ])
      expect(isPublicAddress(ip), ip).toBe(true);
    dns.set("cal.example.com", ["93.184.216.34", "10.0.0.5"]);
    expect(await failure(FEED)).toBe(FEED_ERRORS.badLink);
    expect(calls).toHaveLength(0);
  });

  it("allows only 2000::/3 for IPv6, minus Teredo and 6to4, and checks mapped IPv4 as IPv4", () => {
    for (const ip of [
      "::1",
      "::",
      "fe80::1",
      "fc00::1",
      "fd12::1",
      "ff02::1",
      "64:ff9b::a00:1",
      "100::1",
    ])
      expect(isPublicAddress(ip), ip).toBe(false);
    for (const ip of ["2001:0:4136:e378::1", "2002:a00:1::1"])
      expect(isPublicAddress(ip), ip).toBe(false);
    for (const ip of [
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "::ffff:7f00:1",
      "::ffff:a9fe:a9fe",
    ])
      expect(isPublicAddress(ip), ip).toBe(false);
    expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicAddress("2a00:1450:4001:80b::200e")).toBe(true);
    expect(isPublicAddress("not-an-ip")).toBe(false);
  });

  it("refuses IP literals in private space", async () => {
    dns.set("127.0.0.1", ["127.0.0.1"]);
    dns.set("::1", ["::1"]);
    expect(await failure("https://127.0.0.1/feed")).toBe(FEED_ERRORS.badLink);
    expect(await failure("https://[::1]/feed")).toBe(FEED_ERRORS.badLink);
  });

  it("connects to the vetted address even if DNS changes its answer (rebinding)", async () => {
    routes.get(`cal.example.com/feed?key=${SECRET}`)!.rebindTo = "127.0.0.1";
    await safeFetch(FEED);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(dns.get("cal.example.com")).toEqual(["127.0.0.1"]);
    expect(calls[0].pinned).toBe("93.184.216.34");
  });

  it("follows redirects through the same checks, at most 3", async () => {
    dns.set("hop.example.com", ["93.184.216.35"]);
    routes.set("hop.example.com/1", {
      status: 302,
      headers: { location: "/2" },
    });
    routes.set("hop.example.com/2", {
      status: 301,
      headers: { location: FEED },
    });
    expect((await safeFetch("https://hop.example.com/1")).body).toBe(ICS);

    dns.set("inside.example.com", ["10.1.2.3"]);
    routes.set("hop.example.com/private", {
      status: 302,
      headers: { location: "https://inside.example.com/x" },
    });
    expect(await failure("https://hop.example.com/private")).toBe(
      FEED_ERRORS.badLink,
    );
    routes.set("hop.example.com/http", {
      status: 307,
      headers: { location: "http://cal.example.com/x" },
    });
    expect(await failure("https://hop.example.com/http")).toBe(
      FEED_ERRORS.badLink,
    );

    for (let i = 0; i < 4; i++)
      routes.set(`hop.example.com/loop${i}`, {
        status: 302,
        headers: { location: `/loop${i + 1}` },
      });
    routes.set("hop.example.com/loop4", { chunks: [ICS] });
    calls.length = 0;
    expect(await failure("https://hop.example.com/loop0")).toBe(
      FEED_ERRORS.unreachable,
    );
    expect(calls).toHaveLength(4);
    expect((await safeFetch("https://hop.example.com/loop1")).body).toBe(ICS);
  });

  it("gives up after the timeout", async () => {
    routes.set("cal.example.com/slow", { hang: true });
    expect(
      await failure("https://cal.example.com/slow", { timeoutMs: 50 }),
    ).toBe(FEED_ERRORS.timeout);
  });

  it("caps the body at 2 MB and never asks for compression", async () => {
    const big = "BEGIN:VCALENDAR\r\n" + "X".repeat(1024 * 1024);
    routes.set("cal.example.com/big", { chunks: [big, big] });
    expect(await failure("https://cal.example.com/big")).toBe(
      FEED_ERRORS.tooBig,
    );
    routes.set("cal.example.com/declared", {
      headers: { "content-length": String(3 * 1024 * 1024) },
      chunks: [ICS],
    });
    expect(await failure("https://cal.example.com/declared")).toBe(
      FEED_ERRORS.tooBig,
    );
    for (const call of calls)
      expect(
        Object.keys(call.headers).map((h) => h.toLowerCase()),
      ).not.toContain("accept-encoding");
  });

  it("refuses something that is not a calendar", async () => {
    routes.set("cal.example.com/page", { chunks: ["<html>hello</html>"] });
    expect(await failure("https://cal.example.com/page")).toBe(
      FEED_ERRORS.notCalendar,
    );
    expect(await failure("https://cal.example.com/missing")).toBe(
      FEED_ERRORS.notCalendar,
    );
    routes.set("cal.example.com/down", { status: 500 });
    expect(await failure("https://cal.example.com/down")).toBe(
      FEED_ERRORS.unreachable,
    );
    expect(await failure("https://nowhere.example.com/feed")).toBe(
      FEED_ERRORS.unreachable,
    );
  });

  it("never passes the URL or response headers to a log call, nor into an error", async () => {
    const spies = (
      ["log", "info", "warn", "error", "debug", "trace"] as const
    ).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    routes.set(`cal.example.com/feed?key=${SECRET}-html`, {
      headers: {
        "content-disposition": `attachment; filename="${SECRET}.ics"`,
      },
      chunks: ["nope"],
    });
    const errors: unknown[] = [];
    await safeFetch(FEED);
    for (const url of [
      `${FEED}-html`,
      `http://cal.example.com/?key=${SECRET}`,
      `https://x.invalid/?key=${SECRET}`,
    ])
      await safeFetch(url).catch((e) => errors.push(e));
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(errors).toHaveLength(3);
    for (const e of errors)
      expect(JSON.stringify(e) + String(e) + (e as Error).stack).not.toContain(
        SECRET,
      );
  });
});
