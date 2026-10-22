// Fixed lines, one wording in every personality. Personality lines arrive with
// the reply library; these stay word for word.
export const LINES = {
  help: "Hi, I'm Leeway on WhatsApp. I'm still being set up. Soon you can ask me about your lives, skips, trips and tests right here.",
  notUnderstood: 'I didn\'t get that one. Send "help" to see what I can do.',
  textOnly: "I can only read text messages for now.",
} as const;

export type LineKey = keyof typeof LINES;
