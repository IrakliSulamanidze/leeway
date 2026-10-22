import { describe, expect, it } from "vitest";
import { fixedClock } from "../adapters/clock";
import { MemoryAccounts } from "../adapters/memory-accounts";
import { MemoryGate } from "../adapters/memory-gate";
import { ScriptedReader } from "../adapters/memory-reader";
import { MemorySharing } from "../adapters/memory-sharing";
import { ScriptedSpeech } from "../adapters/memory-speech";
import { MemoryStudent, sampleSnapshot } from "../adapters/memory-student";
import attacks from "./__fixtures__/attacks.json";
import { processInbound } from "./inbound";
import { replyProblems } from "./reply";
import type { Reading } from "../ports";

// The 465 cases of the planning's adversarial set, run through the whole
// inbound path with a reader that reads every one of them in the worst way it
// could. The model is not tested here (npm run eval:reader does that); this
// checks what code guarantees whatever the model says.
const NOW = "2026-10-26T09:00:00Z";
const HOSTILE: ((text: string) => Reading)[] = [
  () => ({ kind: "off_topic", course: null }),
  (t) => ({ kind: "log_skip", course: t.slice(0, 60) }),
  (t) => ({ kind: "plan_skip", course: t.slice(0, 20) }),
  () => ({ kind: "unclear", course: null }),
];
// Commands a student may type on purpose; they act without the reader.
const EXACT =
  /^(skipped|missed|skipping|will skip|gonna skip|stop|start|share|stop sharing|stop following|hide details|show details)\b/i;

describe.each(HOSTILE.map((h, i) => [i, h] as const))(
  "adversarial set, hostile reading %i",
  (_i, hostile) => {
    it.each(attacks.map((a) => [a.id, a.input] as const))(
      "%s",
      async (_id, input) => {
        const student = new MemoryStudent(sampleSnapshot(new Date(NOW)));
        const accounts = new MemoryAccounts(true);
        accounts.ages.set("ES.attacker", true);
        accounts.voices.set("ES.attacker", "friendly");
        const reader = new ScriptedReader({
          [input.trim().toLowerCase()]: hostile(input),
        });
        const read = reader.read.bind(reader);
        reader.read = async (text) => (await read(text)) ?? hostile(input);
        const replies = await processInbound(
          {
            id: "wamid.x",
            from: "ES.attacker",
            at: new Date(NOW),
            body: { kind: "text", text: input },
          },
          {
            clock: fixedClock(NOW),
            gate: new MemoryGate(),
            accounts,
            student,
            reader,
            speech: new ScriptedSpeech(),
            sharing: new MemorySharing(),
            newCode: () => "K7Q2M9XZ",
          },
        );

        for (const r of replies) {
          // Every reply is sendable.
          expect(replyProblems(r)).toEqual([]);
          // Nothing the attacker wrote comes back to them.
          for (let i = 0; i + 20 <= input.length; i += 10)
            expect(r.text.toLowerCase()).not.toContain(
              input.slice(i, i + 20).toLowerCase(),
            );
        }
        // A reading never writes on its own: only typed commands save without a tap.
        if (!EXACT.test(input.trim())) expect(student.data.skips).toEqual([]);
      },
    );
  },
);
