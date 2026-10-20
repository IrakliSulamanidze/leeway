// Fetches a user-supplied calendar link without letting it reach anything private
// (tech-plan 5.1). Every hop is checked: https on 443 only, no userinfo, every DNS
// answer public, and the socket connects to the vetted address so a second DNS
// answer can't swap it (rebinding). Failures become fixed FeedError messages; the
// URL, response headers and body are never logged, returned in an error or stored.
import { lookup } from "node:dns/promises";
import type { IncomingMessage } from "node:http";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import { FeedError } from "./errors";

export const SAFE_FETCH_DEFAULTS = {
  timeoutMs: 5_000,
  maxBytes: 2 * 1024 * 1024,
  maxRedirects: 3,
};

export type SafeFetchResult = {
  status: number;
  contentType: string;
  body: string;
};
export type Fetcher = typeof safeFetch;

const BLOCKED_V4 = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  BLOCKED_V4.addSubnet(net, bits, "ipv4");

// IPv6: only global unicast 2000::/3, minus Teredo, 6to4 and NAT64 (which can
// all tunnel to an IPv4 address we never checked).
const ALLOWED_V6 = new BlockList();
ALLOWED_V6.addSubnet("2000::", 3, "ipv6");
const BLOCKED_V6 = new BlockList();
BLOCKED_V6.addSubnet("2001::", 32, "ipv6");
BLOCKED_V6.addSubnet("2002::", 16, "ipv6");
BLOCKED_V6.addSubnet("64:ff9b::", 96, "ipv6");

function mappedV4(addr: string): string | null {
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(addr);
  if (dotted) return dotted[1];
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(addr);
  if (!hex) return null;
  const hi = parseInt(hex[1], 16);
  const lo = parseInt(hex[2], 16);
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
}

export function isPublicAddress(addr: string): boolean {
  const family = isIP(addr);
  if (family === 4) return !BLOCKED_V4.check(addr, "ipv4");
  if (family !== 6) return false;
  const v4 = mappedV4(addr);
  if (v4) return isPublicAddress(v4);
  return ALLOWED_V6.check(addr, "ipv6") && !BLOCKED_V6.check(addr, "ipv6");
}

function checkUrl(raw: string): URL {
  const text = raw.trim().replace(/^webcal:/i, "https:");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new FeedError("badLink");
  }
  // URL drops a default :443, so any port left here is another one.
  if (url.protocol !== "https:" || url.port !== "")
    throw new FeedError("badLink");
  if (url.username || url.password) throw new FeedError("badLink");
  if (!url.hostname || url.hostname.length > 253)
    throw new FeedError("badLink");
  return url;
}

type Address = { address: string; family: number };

async function resolvePublic(host: string): Promise<Address> {
  const bare = host.replace(/^\[|\]$/g, "");
  let answers: Address[];
  try {
    answers = await lookup(bare, { all: true, verbatim: true });
  } catch {
    throw new FeedError("unreachable");
  }
  if (!answers.length) throw new FeedError("unreachable");
  if (!answers.every((a) => isPublicAddress(a.address)))
    throw new FeedError("badLink");
  return answers[0];
}

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new FeedError("timeout"));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function get(
  url: URL,
  pinned: Address,
  signal: AbortSignal,
): Promise<IncomingMessage> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  return new Promise((resolve, reject) => {
    const req = request(
      {
        protocol: "https:",
        hostname: host,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        // No Accept-Encoding, so the size cap applies to the bytes we really read.
        headers: {
          Accept: "text/calendar, */*;q=0.1",
          "User-Agent": "Leeway calendar sync",
        },
        servername: isIP(host) ? undefined : host,
        agent: false,
        signal,
        // Connect only to the address we vetted, whatever DNS says now.
        lookup: (_hostname, options, callback) => {
          if ((options as { all?: boolean }).all)
            (callback as (e: null, a: Address[]) => void)(null, [pinned]);
          else callback(null, pinned.address, pinned.family);
        },
      },
      resolve,
    );
    req.on("error", reject);
    req.end();
  });
}

async function readCapped(
  res: IncomingMessage,
  maxBytes: number,
): Promise<string> {
  if (Number(res.headers["content-length"] ?? 0) > maxBytes) {
    res.destroy();
    throw new FeedError("tooBig");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of res) {
    total += (chunk as Buffer).length;
    if (total > maxBytes) {
      res.destroy();
      throw new FeedError("tooBig");
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export async function safeFetch(
  url: string,
  opts: Partial<typeof SAFE_FETCH_DEFAULTS> = {},
): Promise<SafeFetchResult> {
  const { timeoutMs, maxBytes, maxRedirects } = {
    ...SAFE_FETCH_DEFAULTS,
    ...opts,
  };
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    let current = checkUrl(url);
    for (let hop = 0; ; hop++) {
      const pinned = await abortable(resolvePublic(current.hostname), signal);
      const res = await abortable(get(current, pinned, signal), signal);
      const status = res.statusCode ?? 0;
      if (REDIRECTS.has(status)) {
        const location = res.headers.location;
        res.destroy();
        if (hop >= maxRedirects || !location)
          throw new FeedError("unreachable");
        let next: string;
        try {
          next = new URL(location, current).toString();
        } catch {
          throw new FeedError("badLink");
        }
        current = checkUrl(next);
        continue;
      }
      if (status !== 200) {
        res.destroy();
        throw new FeedError(
          status === 404 || status === 410 ? "notCalendar" : "unreachable",
        );
      }
      const body = await abortable(readCapped(res, maxBytes), signal);
      if (!/^﻿?\s*BEGIN:VCALENDAR/i.test(body))
        throw new FeedError("notCalendar");
      return {
        status,
        contentType: String(res.headers["content-type"] ?? ""),
        body,
      };
    }
  } catch (err) {
    if (err instanceof FeedError) throw err;
    throw new FeedError(signal.aborted ? "timeout" : "unreachable");
  }
}
