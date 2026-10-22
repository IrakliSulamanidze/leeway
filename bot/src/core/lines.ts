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
  suspended:
    "This number's link to Leeway is paused. Sign in on the Leeway website to sort it out.",
  askAge: "One quick question before we start: are you 18 or older?",
  ageThanks: 'Thanks. Send "help" to see what I can do.',
  linked: "You're connected to Leeway.",
  wrongCode:
    "That code doesn't match. Check the code on the page and send it again.",
  accountTaken:
    "That Leeway account is already connected to another WhatsApp number. Write from that number instead.",
} as const;

// Lines with a value filled in by code. The value is never typed by a student.
export const linkPrompt = (url: string) =>
  `Welcome to Leeway on WhatsApp. To connect your Leeway account, open this link, sign in, and send me the 6-digit code it shows: ${url}\n\nThe link works for 30 minutes.`;

export const waitlisted = (place: number) =>
  `Leeway's full for now. You're number ${place} on the waitlist. I'll add you when Leeway goes paid, about €3 a month, and message you first.`;

export type LineKey = keyof typeof LINES;
