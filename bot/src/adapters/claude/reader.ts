import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Reader, Reading, ReadingKind } from "../../ports";
import { log } from "../log";
import { READER_SYSTEM } from "./prompt";

export const READER_MODEL = "claude-haiku-5-5";

const KINDS = [
  "lives",
  "today",
  "tomorrow",
  "week",
  "tests",
  "log_skip",
  "plan_skip",
  "help",
  "off_topic",
  "unclear",
] as const satisfies readonly ReadingKind[];

// Written by hand rather than generated from zod: the SDK's zod helper turns
// enums into descriptions, and the enum is what keeps the model on the list.
const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: KINDS },
    course: { type: ["string", "null"] },
  },
  required: ["kind", "course"],
  additionalProperties: false,
};

const Output = z.object({
  kind: z.enum(KINDS),
  course: z.string().max(60).nullable(),
});

// Claude Haiku 5.5 list prices, in millionths of a dollar per token, for
// prompts of 100K tokens or fewer.
const MICROS_PER_INPUT_TOKEN = 0.1;
const MICROS_PER_OUTPUT_TOKEN = 0.5;

// Longer messages are not the short asks the reader is for.
const MAX_MESSAGE_CHARS = 600;

export type AiBudget = {
  left(): Promise<boolean>;
  spend(micros: number): Promise<void>;
};

// One model call per message, no tools, no history, no student data: the
// message goes in, a request from a fixed list comes out.
export function claudeReader(client: Anthropic, budget: AiBudget): Reader {
  return {
    async read(text, today): Promise<Reading | null> {
      if (text.length > MAX_MESSAGE_CHARS)
        return { kind: "unclear", course: null };
      if (!(await budget.left())) return null;

      let res: Anthropic.Message;
      try {
        res = await client.messages.create({
          model: READER_MODEL,
          max_tokens: 1024,
          output_config: {
            effort: "low",
            format: { type: "json_schema", schema: SCHEMA },
          },
          system: READER_SYSTEM,
          messages: [
            {
              role: "user",
              content: `Today is ${today}.\nMessage: ${JSON.stringify(text)}`,
            },
          ],
        });
      } catch (error) {
        log.warn(
          "reader: model unavailable",
          error instanceof Anthropic.APIError
            ? `status ${error.status}`
            : "network",
        );
        return null;
      }

      // Every answered call is charged, whatever comes back.
      try {
        await budget.spend(
          Math.ceil(
            res.usage.input_tokens * MICROS_PER_INPUT_TOKEN +
              res.usage.output_tokens * MICROS_PER_OUTPUT_TOKEN,
          ),
        );
      } catch {
        log.error("reader: could not record AI spend");
      }

      const block = res.content.find((b) => b.type === "text");
      if (res.stop_reason !== "end_turn" || !block) {
        log.warn("reader: no answer", res.stop_reason ?? "unknown");
        return { kind: "unclear", course: null };
      }
      try {
        const parsed = Output.safeParse(JSON.parse(block.text));
        if (parsed.success) return parsed.data;
      } catch {
        // falls through
      }
      log.warn("reader: answer outside the list");
      return { kind: "unclear", course: null };
    },
  };
}

export function anthropicClient(apiKey: string): Anthropic {
  // Meta waits about 10 s for the whole webhook, so one try, quickly.
  return new Anthropic({ apiKey, timeout: 3000, maxRetries: 0 });
}
