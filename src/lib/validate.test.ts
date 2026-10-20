import { describe, expect, it } from "vitest";
import { isValidEmail, isValidPassword } from "./validate";

describe("isValidEmail", () => {
  it("accepts a normal address", () => {
    expect(isValidEmail("ada@example.com")).toBe(true);
  });
  it("rejects missing parts", () => {
    expect(isValidEmail("ada@")).toBe(false);
    expect(isValidEmail("example.com")).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("needs at least 6 characters", () => {
    expect(isValidPassword("12345")).toBe(false);
    expect(isValidPassword("123456")).toBe(true);
  });
});
