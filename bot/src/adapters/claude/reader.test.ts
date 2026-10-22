import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { claudeReader } from "./reader";

type Parse = (body: Record<string, unknown>) => Promise<unknown>;
const client = (parse: Parse) =>
  ({ messages: { parse } }) as unknown as Anthropic;
const usage = {
  input_tokens: 600,
  output_tokens: 40,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
};

describe("claudeReader", () => {
  it("sends only the message and the date, and records the cost", async () => {
    const bodies: Record<string, unknown>[] = [];
    const spent: number[] = [];
    const reader = claudeReader(
      client(async (body) => {
        bodies.push(body);
        return {
          stop_reason: "end_turn",
          usage,
          parsed_output: { kind: "lives", course: null },
        };
      }),
      { left: async () => true, spend: async (m) => void spent.push(m) },
    );
    expect(await reader.read("am i cooked", "2026-10-26")).toEqual({
      kind: "lives",
      course: null,
    });
    expect(bodies[0].model).toBe("claude-haiku-5-5");
    expect(JSON.stringify(bodies[0].messages)).toContain("am i cooked");
    expect(bodies[0]).not.toHaveProperty("tools");
    expect(spent).toEqual([80]);
  });

  it("does not call the model once the daily ceiling is reached", async () => {
    let called = false;
    const reader = claudeReader(
      client(async () => ((called = true), {})),
      { left: async () => false, spend: async () => undefined },
    );
    expect(await reader.read("hi", "2026-10-26")).toBeNull();
    expect(called).toBe(false);
  });

  it("reads a refusal as unclear and an outage as unavailable", async () => {
    const budget = { left: async () => true, spend: async () => undefined };
    const refused = claudeReader(
      client(async () => ({
        stop_reason: "refusal",
        usage,
        parsed_output: null,
      })),
      budget,
    );
    expect(await refused.read("x", "2026-10-26")).toEqual({
      kind: "unclear",
      course: null,
    });
    const down = claudeReader(
      client(async () => Promise.reject(new Error("timeout"))),
      budget,
    );
    expect(await down.read("x", "2026-10-26")).toBeNull();
  });
});
