import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sameToken, validSignature } from "./signature";

const body = Buffer.from('{"entry":[]}');
const sign = (b: Buffer, key: string) =>
  `sha256=${createHmac("sha256", key).update(b).digest("hex")}`;

describe("validSignature", () => {
  it("accepts Meta's signature over the raw body", () => {
    expect(validSignature(body, sign(body, "s3cret"), "s3cret")).toBe(true);
  });

  it("refuses a wrong key, a changed body, a missing or malformed header", () => {
    expect(validSignature(body, sign(body, "other"), "s3cret")).toBe(false);
    expect(
      validSignature(
        Buffer.from('{"entry":[1]}'),
        sign(body, "s3cret"),
        "s3cret",
      ),
    ).toBe(false);
    expect(validSignature(body, null, "s3cret")).toBe(false);
    expect(validSignature(body, "sha256=zz", "s3cret")).toBe(false);
  });

  it("refuses everything when no secret is configured", () => {
    expect(validSignature(body, sign(body, ""), "")).toBe(false);
  });
});

describe("sameToken", () => {
  it("compares exactly and refuses an empty expected token", () => {
    expect(sameToken("abc", "abc")).toBe(true);
    expect(sameToken("abc ", "abc")).toBe(false);
    expect(sameToken(null, "abc")).toBe(false);
    expect(sameToken("", "")).toBe(false);
  });
});
