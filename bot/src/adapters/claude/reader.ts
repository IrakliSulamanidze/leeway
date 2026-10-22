import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Reader, Reading } from "../../ports";
import { log } from "../log";
import { READER_SYSTEM } from "./prompt";

export const READER_MODEL = "claude-haiku-5-5";

const Output = z.object({
  kind: z.enum([
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
  ]),
  course: z.string().max(60).nullable(),
});

// Claude Haiku 5.5 list prices, in millionths of a dollar per token, for
// prompts of 100K tokens or fewer.
const MICROS_PER_INPUT_TOKEN = 0.1;
const MICROS_PER_OUTPUT_TOKEN = 0.5;

export type AiBudget = {
  left(): Promise<boolean>;
  spend(micros: number): Promise<void>;
};

const MAX_MESSAGE_CHARS = 600;

// One model call per message, no tools, no history, no student data: the
// message goes in, a request from a fixed list comes out.
export function claudeReader(client: Anthropic, budget: AiBudget): Reader {
  return {
    async read(text, today): Promise<Reading | null> {
      if (!(await budget.left())) return null;
      try {
        const res = await client.messages.parse({
          model: READER_MODEL,
          max_tokens: 1024,
          output_config: { effort: "low", format: zodOutputFormat(Output) },
          system: [
            {
              type: "text",
              text: READER_SYSTEM,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            {
              role: "user",
              content: `Today is ${today}.\nMessage: ${JSON.stringify(text.slice(0, MAX_MESSAGE_CHARS))}`,
            },
          ],
        });
        const u = res.usage;
        const inputTokens =
          u.input_tokens +
          (u.cache_creation_input_tokens ?? 0) * 1.25 +
          (u.cache_read_input_tokens ?? 0) * 0.1;
        await budget.spend(
          Math.ceil(
            inputTokens * MICROS_PER_INPUT_TOKEN +
              u.output_tokens * MICROS_PER_OUTPUT_TOKEN,
          ),
        );
        if (res.stop_reason === "refusal" || !res.parsed_output)
          return { kind: "unclear", course: null };
        return res.parsed_output;
      } catch (error) {
        log.warn(
          "reader: unavailable",
          error instanceof Anthropic.APIError
            ? `status ${error.status}`
            : "network",
        );
        return null;
      }
    },
  };
}

export function anthropicClient(apiKey: string): Anthropic {
  // Meta waits about 10 s for the webhook; the reader gets a small share.
  return new Anthropic({ apiKey, timeout: 4000, maxRetries: 1 });
}
