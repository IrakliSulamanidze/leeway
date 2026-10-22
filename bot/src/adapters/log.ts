// The bot's only logger. Structured lines on stderr, which Vercel keeps.
// Never log message text, phone numbers, user ids or secrets.
/* eslint-disable no-console */
export const log = {
  warn: (event: string, detail?: string) =>
    console.warn(`wa ${event}`, detail ?? ""),
  error: (event: string, detail?: string) =>
    console.error(`wa ${event}`, detail ?? ""),
};
