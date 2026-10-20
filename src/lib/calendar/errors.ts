// The only messages a feed problem can produce. They are stored in
// calendar_feeds.last_error (the database accepts exactly these strings) and shown
// to the student. Nothing from the URL, the response or the body ever goes in them.
export const FEED_ERRORS = {
  badLink: "That link is not a calendar link we can use.",
  timeout: "The calendar did not answer in time.",
  tooBig: "The calendar is too big.",
  notCalendar: "That link is not a calendar.",
  unreachable: "The calendar could not be reached.",
  unreadable: "The calendar could not be read.",
  glitch: "The calendar changed too much, so we kept your last data.",
} as const;

export type FeedErrorCode = keyof typeof FEED_ERRORS;
export type FeedErrorMessage = (typeof FEED_ERRORS)[FeedErrorCode];

export class FeedError extends Error {
  constructor(readonly code: FeedErrorCode) {
    super(FEED_ERRORS[code]);
    this.name = "FeedError";
  }
}
