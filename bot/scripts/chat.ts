// Chat with the bot in a terminal: no Meta account, no AI calls, nothing stored.
// Type a message, or "/tap <button id>" to press a button. Ctrl+D quits.
import { createInterface } from "node:readline";
import { systemClock } from "../src/adapters/clock";
import { MemoryAccounts } from "../src/adapters/memory-accounts";
import { MemoryGate } from "../src/adapters/memory-gate";
import { MemoryStudent, sampleSnapshot } from "../src/adapters/memory-student";
import { ScriptedReader } from "../src/adapters/memory-reader";
import { ScriptedSpeech } from "../src/adapters/memory-speech";
import { MemorySharing } from "../src/adapters/memory-sharing";
import { anthropicClient, claudeReader } from "../src/adapters/claude/reader";
import { processInbound } from "../src/core/inbound";
import type { InboundBody, Reply } from "../src/core/types";

const FROM = "34600000000";
const gate = new MemoryGate();
// The simulator plays a linked student; the age question comes first.
const accounts = new MemoryAccounts(true);
const student = new MemoryStudent(sampleSnapshot(new Date()));
// With ANTHROPIC_API_KEY set, free text goes to the real reader (a cent buys
// about a hundred messages); without it, only commands work.
let spent = 0;
const reader = process.env.ANTHROPIC_API_KEY
  ? claudeReader(anthropicClient(process.env.ANTHROPIC_API_KEY), {
      left: async () => spent < 50_000,
      spend: async (micros) => void (spent += micros),
    })
  : new ScriptedReader();
let seq = 0;

function show(reply: Reply) {
  process.stdout.write(`\nLeeway: ${reply.text}\n`);
  if (reply.buttons?.length)
    process.stdout.write(
      `        ${reply.buttons.map((b) => `[${b.title}] (${b.id})`).join("  ")}\n`,
    );
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "\nyou: ",
});
process.stdout.write('Leeway chat simulator. Try "help". Ctrl+D quits.\n');
rl.prompt();
for await (const line of rl) {
  const tap = /^\/tap\s+(\S+)$/.exec(line.trim());
  const body: InboundBody = tap
    ? { kind: "button", id: tap[1] }
    : { kind: "text", text: line };
  const replies = await processInbound(
    { id: `sim.${++seq}`, from: FROM, at: new Date(), body },
    {
      clock: systemClock,
      gate,
      accounts,
      student,
      reader,
      sharing: new MemorySharing(),
      newCode: () => "K7Q2M9XZ",
      speech: new ScriptedSpeech(),
    },
  );
  replies.forEach(show);
  rl.prompt();
}
