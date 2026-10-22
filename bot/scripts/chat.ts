// Chat with the bot in a terminal: no Meta account, no AI calls, nothing stored.
// Type a message, or "/tap <button id>" to press a button. Ctrl+D quits.
import { createInterface } from "node:readline";
import { systemClock } from "../src/adapters/clock";
import { handle } from "../src/core/pipeline";
import type { InboundBody, Reply } from "../src/core/types";

const FROM = "34600000000";
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
  const replies = await handle(
    { id: `sim.${++seq}`, from: FROM, at: new Date(), body },
    { clock: systemClock },
  );
  replies.forEach(show);
  rl.prompt();
}
