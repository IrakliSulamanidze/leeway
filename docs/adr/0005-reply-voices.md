# 0005. Reply voices are lines written ahead of time

Date: 2026-10-23. Status: accepted.

## Context

Students pick how the bot talks: Straight, Friendly or Roast (more later).
A live model writing replies could get facts wrong or say something nobody
approved, to students some of whom are 17.

## Decision

- Code writes every reply's facts. A voice may only add one line before
  them, chosen from `bot/src/core/voice/library.ts`; for off-topic and
  not-understood replies the line takes the place of the first sentence.
- Lines hold no numbers, names, dates or placeholders, and tests reject
  digits, links and a list of off-limits topics. Funny lines tease what a
  student does, never who they are.
- A line is sent only when `approved` is true. Irakli approves every Roast
  line; Friendly lines are plain and approved with the code review.
- Lines marked `swears` go only to students who said they are 18 or over.
- The same message always gets the same line (picked from a hash of the
  message id), so a retried message reads the same.
- Crisis, STOP, linking, age and other fixed lines never get a voice.

## Consequences

- Adding a voice is a new key in the library plus Irakli's approval.
- Lines fit the situation, not the exact words a student typed.
