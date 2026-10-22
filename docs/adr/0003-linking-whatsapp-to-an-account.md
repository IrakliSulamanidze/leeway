# 0003. Linking a WhatsApp number to a Leeway account

Date: 2026-10-23. Status: accepted.

## Context

A student must prove they own a Leeway account before the bot acts for them,
and the web app may not change while it is graded. The bot holds no
service-role key, so it cannot look accounts up itself.

## Decision

- An unlinked sender gets a one-time link (256 random bits, valid 30 minutes,
  burned after 5 wrong passwords) to `/link` on the bot's own domain.
- The page is plain HTML with no scripts. The student signs in with their
  Leeway email and password; the bot sends them to Supabase Auth server to
  server, never stores them, and ends the session it created.
- `wa_api.complete_link` links the number only if Supabase holds that exact
  session for that account, created in the last 15 minutes. Session ids are
  random and the bot's role cannot read `auth`, so its password alone cannot
  link someone else's account.
- Past the student cap (a setting, 50 at launch) the student joins a waitlist
  and is told their place. The web app keeps its no-waitlist rule.
- After linking, the bot asks once whether the student is 18 or older; the
  funny voices use it to drop swearing for younger students.

## Consequences

- Linking needs no change to the web app or its tables.
- A student linked to one number cannot link a second; they unlink first
  (a later slice).
- Sign-ins on the page are rate-limited per link only. A per-address limit
  belongs at the edge if the page is abused.
