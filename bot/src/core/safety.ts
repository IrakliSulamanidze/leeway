// Messages that are settled before anything else reads them. Matching runs on
// normalised text (normalise.ts).

// Phrases that suggest a student may be at risk. A match always gets the fixed
// crisis line, even when the bot is paused or over a cap. Kept deliberately
// broad: a false match costs one kind message.
const CRISIS = [
  /\bkill(ing)? my ?self\b/,
  /\bsuicid(e|al)\b/,
  /\b(want|wanna|going) to die\b/,
  /\bwanna die\b/,
  /\bend(ing)? (my life|it all)\b/,
  /\bself[- ]?harm/,
  /\bhurt(ing)? my ?self\b/,
  /\bcut(ting)? my ?self\b/,
  /\bno reason to (live|go on)\b/,
  /\bbetter off dead\b/,
  /\bdon'?t want to (live|be alive)\b/,
];

export function isCrisis(text: string): boolean {
  return CRISIS.some((re) => re.test(text));
}

export type OptCommand = "stop" | "start";

// WhatsApp's own opt-out words, matched only as the whole message.
export function optCommand(text: string): OptCommand | null {
  if (text === "stop" || text === "unsubscribe") return "stop";
  if (text === "start") return "start";
  return null;
}
