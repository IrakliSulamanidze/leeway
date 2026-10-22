import type { Library, Line } from "./types";

// Lines written ahead of time. A line carries no numbers, names or dates of
// its own: the facts come after it from code, the same in every voice. Funny
// lines tease what a student does, never who they are, never cheer a skip on,
// and never assume why a class was missed.
const ok = (text: string): Line => ({ text, approved: true });
const pending = (text: string, swears = false): Line => ({
  text,
  approved: false,
  swears,
});

export const LIBRARY: Library = {
  friendly: {
    lives_ok: [ok("Here's where you stand."), ok("Quick check-in:")],
    lives_tight: [
      ok("Heads up, one course is getting tight."),
      ok("Worth keeping an eye on this:"),
    ],
    skip_saved: [ok("Got it."), ok("All noted.")],
    skip_saved_tight: [ok("Noted. Go easy on that course from here.")],
    skip_ask: [ok("Just checking first."), ok("Before I save it:")],
    skip_already: [ok("No need, it's already there.")],
    week_safe: [ok("Here's the week.")],
    week_risky: [
      ok("Hmm, careful with this one."),
      ok("This one needs a think."),
    ],
    tests_some: [
      ok("Here's what's coming up."),
      ok("Worth marking these down:"),
    ],
    tests_none: [ok("A quiet stretch for tests.")],
  },
  roast: {
    lives_ok: [
      pending("Look who's been showing up."),
      pending("Surprisingly not a disaster."),
      pending("Look at you, actually attending things."),
    ],
    lives_tight: [
      pending("Bold strategy. Let's see the damage."),
      pending("Your attendance called. It's worried."),
    ],
    skip_saved: [
      pending("Logged. Noted for the record."),
      pending("Noted. The class will survive without you."),
      pending("Logged. Hell of a week you're having.", true),
    ],
    skip_saved_tight: [
      pending("Done. You're running on fumes now."),
      pending("Logged. Maybe show up to the next one, legend."),
    ],
    skip_ask: [
      pending("Hold on, hero."),
      pending("Before you do something silly:"),
    ],
    skip_already: [pending("Already there. Nice try at a double.")],
    week_safe: [pending("Here's your week. Try to show up anyway.")],
    week_risky: [
      pending("Oh, this is going to hurt."),
      pending("Bad idea incoming."),
      pending("Damn, this week is rough.", true),
    ],
    tests_some: [
      pending("Brace yourself."),
      pending("Bad news: school still exists."),
    ],
    tests_none: [pending("No tests. Don't get used to it.")],
  },
};
