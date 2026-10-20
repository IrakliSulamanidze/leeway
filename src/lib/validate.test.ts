import { describe, expect, it } from "vitest";
import { isValidEmail } from "./validate";

describe("isValidEmail", () => {
  it("accepts a normal address", () => {
    expect(isValidEmail("ada@example.com")).toBe(true);
  });
  it("rejects missing parts", () => {
    expect(isValidEmail("ada@")).toBe(false);
    expect(isValidEmail("example.com")).toBe(false);
  });
});
