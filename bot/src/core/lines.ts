// Fixed lines, one wording in every personality. Personality lines arrive with
// the reply library; these stay word for word.
export const LINES = {
  help: "Hi, I'm Leeway on WhatsApp. I'm still being set up. Soon you can ask me about your lives, skips, trips and tests right here.",
  notUnderstood: 'I didn\'t get that one. Send "help" to see what I can do.',
  textOnly: "I can only read text messages for now.",
  crisis:
    "I'm really sorry you're going through this. You don't have to handle it alone. In Spain you can call 024 any time, free and confidential. If you're in danger right now, call 112.",
  stopped:
    "Done. I won't send you reminders. You can still ask me anything, and send START to turn reminders back on.",
  started: "Reminders are back on. Send STOP any time to turn them off.",
  paused: "Leeway is taking a short break. Back soon.",
  tooMany:
    "That's a lot of messages for one day. I'll be back for you tomorrow.",
} as const;

export type LineKey = keyof typeof LINES;
