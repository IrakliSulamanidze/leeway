import type { Library, Line } from "./types";

// Lines written ahead of time. A line carries no numbers, names or dates of
// its own: the facts come after it from code, the same in every voice. Funny
// lines tease what a student does, never who they are.
const ok = (text: string): Line => ({ text, approved: true });
const pending = (text: string, swears = false): Line => ({
  text,
  approved: false,
  swears,
});

export const LIBRARY: Library = {
  friendly: {
    lives_ok: [
      ok("Here's where you stand."),
      ok("Looking good overall."),
      ok("Quick check-in:"),
    ],
    lives_tight: [
      ok("Heads up, one course is getting tight."),
      ok("Worth keeping an eye on this:"),
    ],
    skip_saved: [ok("Got it."), ok("All noted."), ok("Done and dusted.")],
    skip_saved_tight: [
      ok("Noted. Go easy on that course from here."),
      ok("Done. That one's getting tight."),
    ],
    skip_ask: [ok("Just checking first."), ok("Before I save it:")],
    skip_already: [ok("No need, it's already there.")],
    week_safe: [ok("Good news."), ok("You've got some room.")],
    week_risky: [
      ok("Hmm, careful with this one."),
      ok("This one needs a think."),
    ],
    tests_some: [
      ok("Here's what's coming up."),
      ok("Worth marking these down:"),
    ],
    tests_none: [ok("Nice, a quiet stretch.")],
    off_topic: [
      ok("Ha, I wish I could help with that."),
      ok("That's a bit outside my lane."),
      ok("Can't do that one, sorry."),
    ],
    not_understood: [
      ok("Sorry, I didn't catch that."),
      ok("Hmm, not sure what you mean."),
    ],
  },
  roast: {
    lives_ok: [
      pending("Somehow you're still alive."),
      pending("Surprisingly not a disaster."),
      pending("Look at you, actually attending things."),
    ],
    lives_tight: [
      pending("Bold strategy. Let's see the damage."),
      pending("Your attendance called. It's worried."),
      pending("You're living dangerously, and it shows."),
    ],
    skip_saved: [
      pending("Logged. Your bed wins again."),
      pending("Noted. Very brave of you."),
      pending("Done. Total commitment to not going."),
      pending("Logged. Hell of a commitment to staying in bed.", true),
    ],
    skip_saved_tight: [
      pending("Done. You're running on fumes now."),
      pending("Logged. Maybe show up to the next one, legend."),
    ],
    skip_ask: [
      pending("Hold on, hero."),
      pending("Before you do something silly:"),
    ],
    skip_already: [
      pending("You already did that. Twice the skip, half the effort."),
    ],
    week_safe: [
      pending("Fine, you can live a little."),
      pending("Relax, you've got wiggle room."),
    ],
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
    off_topic: [
      pending("Nice try. I'm an attendance bot, not your assistant."),
      pending("I don't do homework. I barely do attendance."),
      pending("Not my department. My department is your skipping habit."),
      pending("I'd help, but that's above my pay grade, and I'm not paid."),
      pending("Bold of you to ask an attendance bot that."),
      pending("Ask me something I'm good at. Like judging your attendance."),
    ],
    not_understood: [
      pending("I read that twice and still nothing."),
      pending("Run that by me again, slower."),
      pending("Not sure even you know what that meant."),
    ],
  },
};
