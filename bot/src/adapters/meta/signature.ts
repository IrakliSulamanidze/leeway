import { createHmac, timingSafeEqual } from "node:crypto";

// Meta signs each webhook POST with HMAC-SHA256 of the raw body, keyed with the
// app secret, in X-Hub-Signature-256: "sha256=<hex>". Check it on the raw bytes,
// before parsing anything.
export function validSignature(
  rawBody: Buffer,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const given = Buffer.from(header.slice(7), "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function sameToken(given: string | null, expected: string): boolean {
  if (given === null || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
