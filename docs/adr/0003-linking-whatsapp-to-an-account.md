# 0003. Linking a WhatsApp number to a Leeway account

Date: 2026-10-23. Status: accepted.

## Context

A student must prove they own a Leeway account and the WhatsApp number before
the bot acts for them, and the web app may not change while it is graded. The
bot holds no service-role key, so it cannot look accounts up itself.

## Decision

Linking takes three steps, so one person must hold both the account and the
phone:

1. An unlinked sender gets a one-time link (256 random bits, valid 30
   minutes) to `/link` on the bot's own domain.
2. The page is plain HTML with no scripts. The student signs in with their
   Leeway email and password; the bot checks them with Supabase Auth server to
   server, never stores them, and ends the session it created. The database
   accepts the sign-in only if Supabase holds that exact session for that
   account, created after the link was issued. The page then shows a 6-digit
   code.
3. The student sends the code from WhatsApp. It counts only from the number
   that asked for the link, so a link forwarded to someone else is useless.

Limits: 5 sign-in attempts per number per day (a new link does not reset
them, and the attempt is taken before the password is checked), 5 wrong codes,
20 sign-in attempts per address per hour, and failed sign-ins all take at
least 600 ms so timing does not reveal whether an email has an account.

Past the student cap (a setting, 50 at launch) students join a waitlist in
order; while anyone waits, newcomers wait too. The web app keeps its
no-waitlist rule. After linking the bot asks once whether the student is 18 or
older.

## Consequences

- Linking needs no change to the web app or its tables.
- The bot's server sees Leeway passwords in transit, so a compromised bot
  could harvest them. A Supabase OAuth flow would avoid that and is the better
  design once the web app can change.
- Typing a Leeway password on a second domain is a habit phishing can exploit,
  and password managers will not offer it there. The page says plainly what it
  is and the code step limits the damage.
- Turning on a CAPTCHA in Supabase Auth would break this flow.
- One account links to one number; changing numbers needs an unlink step (a
  later slice).
