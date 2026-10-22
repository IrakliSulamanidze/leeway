# 0002. The bot reaches the database only through wa functions

Date: 2026-10-22. Status: accepted.

## Context

The bot answers for one student at a time, from a public repository, on a
server that could one day be compromised. It must not hold the service-role
key. While the web app is being graded its tables, policies and functions must
not change, so the design in the planning notes (a restrictive policy on every
public table) has to wait.

## Decision

- The bot logs in as `wa_gateway`: no special attributes, no role
  memberships, short statement and lock timeouts. It has no rights on any
  table, and it can use only the `wa_api` schema, whose functions are the
  bot's whole interface. Tables and internal functions live in `wa`, which it
  cannot use. Because Postgres lets everyone execute a new function by
  default, reach is set by schema, and a catalogue test lists every function
  the role can call.
- Every turn is one transaction that starts with `wa_api.begin_turn(wa_id)`. That
  writes a turn grant keyed on the transaction id. Other `wa` functions take
  the student from `wa.acting_user()`, which reads the grant; none takes a user
  id as a parameter. A second `begin_turn` in the same transaction is refused,
  so one transaction cannot act for two students. One exception: rolling back
  to a savepoint taken before the turn also undoes the grant, after which a
  new turn could open. The adapter never uses savepoints; an attacker with the
  password gains nothing from it, because separate transactions already give
  them one student each.
- Student data the bot needs (courses, skips, tests) will be read and written
  by further `wa_api` security-definer functions that start from
  `wa.acting_user()`. The web's tables and functions stay untouched.
- `bot/src/adapters/db.ts` is the only module that talks to Postgres. It opens
  the turn before any work, rolls back on error, drops a connection whose
  rollback failed, verifies the server's certificate against Supabase's CA,
  and never holds a transaction across a model, speech or Meta call.

## Consequences

- The migration is additive: new schemas, a new role, new tables and
  functions. The grading bot checks only the `public` schema, so it never
  sees them.
- Anyone holding the `wa_gateway` password can act for a linked student whose
  WhatsApp number they know, but never for web-only students, never for two
  students in one transaction, and never on the `auth` schema. Checking Meta's signature
  inside the database would close that gap and is planned before a wider launch.
- `supabase/tests/20_wa_core.sql` checks all of this on every CI run.
