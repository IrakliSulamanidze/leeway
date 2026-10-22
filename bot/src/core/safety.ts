// Messages that are settled before anything else reads them. Matching runs on
// normalised text (normalise.ts).

// Phrases that suggest a student may be at risk. A match always gets the fixed
// crisis line, even when the bot is paused or over a cap. Kept deliberately
// broad: a false match costs one kind message.
const CRISIS = [
  // English
  /\bkill(ing)? my ?self\b/,
  /\bsuicid(e|al)\b/,
  /\b(want|wanna) (to )?die\b/,
  /\bend(ing)? (my life|it all|it)$/,
  /\bend(ing)? my life\b/,
  /\btak(e|ing) my (own )?life\b/,
  /\bself[- ]?harm/,
  /\b(hurt|cut)(ting)? my ?self\b/,
  /\bhang(ing)? my ?self\b/,
  /\boverdos(e|ing)\b/,
  /\bunalive\b/,
  /\b(kms|kys)\b/,
  /\bno reason to (live|go on)\b/,
  /\bbetter off dead\b/,
  /\bdon'?t want to (live|be alive|be here anymore)\b/,
  // Spanish: the bot answers in English, but students in Spain may write this.
  /\bsuicid/,
  /\b(matarme|suicidarme|quitarme la vida)\b/,
  /\b(me )?quiero morir(me)?\b/,
  /\bno quiero (vivir|seguir viviendo)\b/,
  /\bautolesi/,
  /\bhacerme da(ñ|n)o\b/,
  /\bcortarme\b/,
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
