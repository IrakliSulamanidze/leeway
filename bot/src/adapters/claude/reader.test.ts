import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { claudeReader } from "./reader";

type Create = (body: Record<string, unknown>) => Promise<unknown>;
const client = (create: Create) =>
  ({ messages: { create } }) as unknown as Anthropic;
const usage = { input_tokens: 600, output_tokens: 40 };
const answer = (text: string, stop_reason = "end_turn") => ({
  stop_reason,
  usage,
  content: [
    { type: "thinking", thinking: "" },
    { type: "text", text },
  ],
});
const openBudget = (spent: number[] = []) => ({
  left: async () => true,
  spend: async (m: number) => void spent.push(m),
});

describe("claudeReader", () => {
  it("sends only the message and the date, keeps the request list as an enum, and charges the call", async () => {
    const bodies: Record<string, unknown>[] = [];
    const spent: number[] = [];
    const reader = claudeReader(
      client(
        async (body) => (
          bodies.push(body),
          answer('{"kind":"lives","course":null}')
        ),
      ),
      openBudget(spent),
    );
    expect(await reader.read("am i cooked", "2026-10-26")).toEqual({
      kind: "lives",
      course: null,
    });
    expect(bodies[0].model).toBe("claude-haiku-5-5");
    expect(JSON.stringify(bodies[0].output_config)).toContain(
      '"enum":["lives"',
    );
    expect(JSON.stringify(bodies[0].messages)).toContain("am i cooked");
    expect(bodies[0]).not.toHaveProperty("tools");
    expect(spent).toEqual([80]);
  });

  it("does not call the model once the daily ceiling is reached, or for long messages", async () => {
    let calls = 0;
    const closed = claudeReader(
      client(async () => (calls++, {})),
      {
        left: async () => false,
        spend: async () => undefined,
      },
    );
    expect(await closed.read("hi", "2026-10-26")).toBeNull();
    const open = claudeReader(
      client(async () => (calls++, {})),
      openBudget(),
    );
    expect(await open.read("x".repeat(601), "2026-10-26")).toEqual({
      kind: "unclear",
      course: null,
    });
    expect(calls).toBe(0);
  });

  it("charges a call whose answer is unusable, and reads it as unclear", async () => {
    for (const bad of [
      answer("not json"),
      answer('{"kind":"delete_account","course":null}'),
      answer("", "refusal"),
    ]) {
      const spent: number[] = [];
      const reader = claudeReader(
        client(async () => bad),
        openBudget(spent),
      );
      expect(await reader.read("x", "2026-10-26")).toEqual({
        kind: "unclear",
        course: null,
      });
      expect(spent).toEqual([80]);
    }
  });

  it("reads an outage as unavailable", async () => {
    const down = claudeReader(
      client(async () => Promise.reject(new Error("timeout"))),
      openBudget(),
    );
    expect(await down.read("x", "2026-10-26")).toBeNull();
  });

  it("keeps a good reading when recording the spend fails", async () => {
    const reader = claudeReader(
      client(async () => answer('{"kind":"tests","course":null}')),
      {
        left: async () => true,
        spend: async () => Promise.reject(new Error("db down")),
      },
    );
    expect(await reader.read("any exams", "2026-10-26")).toEqual({
      kind: "tests",
      course: null,
    });
  });
});
