import { describe, expect, it } from "vitest";
import { replyProblems } from "./reply";

describe("replyProblems", () => {
  it("accepts a plain line", () => {
    expect(replyProblems({ text: "Hi" })).toEqual([]);
  });

  it("rejects empty text", () => {
    expect(replyProblems({ text: "  " })).toContain("empty text");
  });

  it("caps buttons at three with short unique titles", () => {
    const b = (id: string, title = "Ok") => ({ id, title });
    expect(
      replyProblems({
        text: "Pick",
        buttons: [b("a"), b("b"), b("c"), b("d")],
      }),
    ).toContain("more than 3 buttons");
    expect(
      replyProblems({ text: "Pick", buttons: [b("a", "x".repeat(21))] }),
    ).toHaveLength(1);
    expect(
      replyProblems({ text: "Pick", buttons: [b("a"), b("a")] }),
    ).toContain('duplicate button id "a"');
  });

  it("uses the shorter body limit when buttons are attached", () => {
    const text = "x".repeat(1025);
    expect(replyProblems({ text })).toEqual([]);
    expect(
      replyProblems({ text, buttons: [{ id: "a", title: "Ok" }] }),
    ).toHaveLength(1);
  });
});
