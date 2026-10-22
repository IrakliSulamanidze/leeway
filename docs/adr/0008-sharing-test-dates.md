# 0008. Classmates share test dates with a code and a tap

Date: 2026-10-23. Status: accepted.

## Decision

- A student sends "share" and gets an 8-character code to give one classmate
  in their own chat. The bot never searches for or names anyone.
- The classmate sends the code to the bot and sees exactly what would be
  shared (a short test name and the date, for the courses both take) and what
  never is. They tap Allow, Not now or Block. Only the courses shown at that
  moment are shared; a course added later needs a new Allow. Codes work once,
  for 7 days; at most 5 a day per student and 3 classmates followed at once.
  A used, blocked or already-granted code reads as expired, so a code says
  nothing about who gave it.
- Courses match on the course name both students use, not on IE's calendar
  keys, which are unverified. A "no" is never reported to the asker.
- Shared dates join the follower's "tests" answer, marked "from a classmate";
  two classmates who disagree show both dates. A date the student already has
  is not repeated.
- Either side stops at once ("stop sharing", "stop following"), and
  unlinking WhatsApp ends both.
- The whole feature stays closed until `shared_in_chat` is on in
  `wa.settings`, after Meta confirms its policy on passing information
  between customers allows it.

## Consequences

- No web app change. Stopping one classmate rather than all, a web view of
  shares, and notices when a classmate's date moves come later.
