// Everything the core needs from the outside world. Each port has a production
// adapter and a fake in src/adapters.
import type { Reply } from "../core/types";
import type { Profile } from "../core/voice/apply";
import type { Voice } from "../core/voice/types";
import type { CourseRow, SkipRow } from "@/lib/rules/lives";
import type {
  Range,
  WeekAssessment,
  WeekClass,
  WeekSkip,
} from "@/lib/rules/week";

export interface Clock {
  now(): Date;
}

// Checks that run before any request is read. Senders are WhatsApp ids; the
// adapter stores only a keyed hash of them.
export interface Gate {
  // The kill switch: when on, every message gets one fixed line.
  paused(): Promise<boolean>;
  // Counts this message against the sender's daily cap. Returns how many the
  // sender has sent today, this one included, and the cap.
  countToday(sender: string): Promise<{ count: number; cap: number }>;
  // STOP and START: proactive messages go only to senders who have not opted out.
  setOptOut(sender: string, optedOut: boolean): Promise<void>;
}

export type LinkState =
  | { state: "none" }
  | { state: "active" }
  | { state: "suspended" }
  | { state: "waitlisted"; place: number };

export type LinkResult =
  | { outcome: "linked" | "wrong_code" | "no_code" | "account_taken" }
  | { outcome: "waitlisted"; place: number };

// Who a sender is to Leeway, and the one-time sign-in link for a new sender.
export interface Accounts {
  state(sender: string): Promise<LinkState>;
  // Issues a fresh link (valid 30 minutes) and returns its URL.
  newLinkUrl(sender: string): Promise<string>;
  // The 6-digit code the sign-in page showed, sent back from WhatsApp.
  confirmCode(sender: string, code: string): Promise<LinkResult>;
  // The linked student's answers: 18 or over (null if not given) and the
  // voice they picked (null if not yet).
  profile(sender: string): Promise<Profile>;
  setAdult(sender: string, adult: boolean): Promise<void>;
  setVoice(sender: string, voice: Voice): Promise<void>;
  setHideDetails(sender: string, hide: boolean): Promise<void>;
  // Records that the student wrote just now (Meta's 24-hour window).
  markInbound(sender: string): Promise<void>;
}

// One student's data, in the shapes the web app's rule functions take.
export type Snapshot = {
  courses: (CourseRow & { name: string })[];
  sessions: WeekClass[];
  skips: (SkipRow & WeekSkip & { id: string })[];
  assessments: WeekAssessment[];
};

export type SkipInput = {
  courseId: string;
  classId: string | null;
  day: string;
  sessions: 1 | 2;
};

// Reads and writes for the linked student who sent the message. Each call is
// its own database turn for that student only.
export interface Student {
  snapshot(sender: string, range: Range): Promise<Snapshot>;
  // Saves once per message id: a rerun returns the skip already saved.
  logSkip(sender: string, skip: SkipInput, messageId: string): Promise<string>;
  undoSkip(sender: string, skipId: string): Promise<boolean>;
}

// What the AI reader found in a message: one request from a fixed list, never
// a reply. Code checks it and decides everything else.
export type ReadingKind =
  | "lives"
  | "today"
  | "tomorrow"
  | "week"
  | "tests"
  | "log_skip"
  | "plan_skip"
  | "help"
  | "personal"
  | "off_topic"
  | "unclear";

export type Reading = {
  kind: ReadingKind;
  // The course as the student wrote it ("micro", "stats"), for log_skip and
  // plan_skip. Matched against their courses by code, never shown back.
  course: string | null;
};

export interface Reader {
  // null when the reader is unavailable: over the daily AI ceiling, or the
  // model did not answer in time.
  read(text: string, today: string): Promise<Reading | null>;
}

export type Transcript =
  | { ok: true; text: string }
  | { ok: false; reason: "off" | "too_long" | "failed" };

// Turns a voice note into text. Neither the audio nor the text is kept.
export interface Speech {
  transcribe(mediaId: string): Promise<Transcript>;
}

export type SharePreview =
  | { outcome: "ok"; courses: string[] }
  | { outcome: "expired" | "self" | "nothing_shared" | "closed" };

export type ShareAnswer = "allow" | "not_now" | "block";

// `source` tells classmates apart within one answer; it is not an id.
export type SharedTest = {
  courseId: string;
  title: string;
  onDate: string;
  source: number;
};

// Classmates sharing test dates, with consent. Each call is a turn for the
// sender only; codes are hashed before they leave the process. Everything is
// closed until sharing in chat is switched on.
export interface Sharing {
  newCode(
    sender: string,
    code: string,
  ): Promise<"ok" | "too_many" | "full" | "closed">;
  preview(sender: string, code: string): Promise<SharePreview>;
  answer(
    sender: string,
    code: string,
    answer: ShareAnswer,
  ): Promise<ShareAnswer | "expired" | "closed" | "you_full" | "they_full">;
  sharedTests(
    sender: string,
    range: { from: string; to: string },
  ): Promise<SharedTest[]>;
  stopSharing(sender: string): Promise<number>;
  stopFollowing(sender: string): Promise<number>;
}

export interface Messenger {
  send(to: string, reply: Reply): Promise<void>;
  // A Meta-approved template, for messages outside the 24-hour window after
  // the student last wrote.
  sendTemplate(to: string, name: string, params: string[]): Promise<void>;
}

// What a handler may use. Later ports (store, reader, speech) are added here as
// the features that need them land, so a handler's dependencies stay explicit.
export type Deps = {
  clock: Clock;
  student: Student;
  reader: Reader;
  sharing: Sharing;
  // Makes a fresh share code; random in production, fixed in tests.
  newCode: () => string;
};

export type InboundDeps = Deps & {
  gate: Gate;
  accounts: Accounts;
  speech: Speech;
  // In the pilot on an ordinary number students are linked by hand, so an
  // unknown sender is told how to join instead of getting a sign-in link.
  manualLinking?: boolean;
};
