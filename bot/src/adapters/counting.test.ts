import { describe, expect, it } from "vitest";
import { countingMessenger } from "./counting";

describe("countingMessenger", () => {
  it("counts only the messages Meta accepted", async () => {
    let n = 0;
    let fail = false;
    const inner = {
      send: async () => {
        if (fail) throw new Error("refused");
      },
      sendTemplate: async () => undefined,
    };
    const m = countingMessenger(inner, async () => void n++);
    await m.send("x", { text: "hi" });
    await m.sendTemplate("x", "t", []);
    fail = true;
    await expect(m.send("x", { text: "hi" })).rejects.toThrow();
    expect(n).toBe(2);
  });
});
