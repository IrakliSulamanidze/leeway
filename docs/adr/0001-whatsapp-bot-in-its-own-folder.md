# 0001. The WhatsApp bot lives in bot/, in this repository

Date: 2026-10-22. Status: accepted.

## Context

Leeway gets a WhatsApp channel. The bot must give the same answers as the web
app, share one database, and must not change the graded web app's build,
pages, crons or tables.

## Decision

- The bot is a separate Next.js app in `bot/`, with its own `package.json`,
  lockfile and, when it ships, its own Vercel project (Root Directory `bot`).
  It has route handlers only.
- It imports the web app's pure rule modules (`src/lib/rules/**`,
  `src/lib/config.ts`) through the `@/` alias, so both channels run the same
  code. Nothing in `src/` imports the bot.
- Its tables go in a separate `wa` schema, in the one migration history under
  `supabase/migrations/`.
- Layout inside `bot/src`: `core/` is pure logic, `ports/` declares what the
  core needs from outside, `adapters/` implements those ports (and fakes for
  tests). Each kind of request is one intent file registered in
  `core/intents/registry.ts`.
- `bot/scripts/boundaries.mjs` enforces this in CI: the bot reaches only the
  allowed shared modules (checked transitively), the core imports no adapters,
  Node built-ins or framework code, and only adapters read `process.env`.

## Consequences

- A rule change in `src/lib/rules` reaches both channels at once, and the bot's
  tests run against it.
- A separate repository was rejected: it would copy the rules (they would
  drift) and split one database's migrations in two.
- Putting the bot inside the web app was rejected: it would change the graded
  build and register the web's crons on the bot's project.
