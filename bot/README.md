# Leeway on WhatsApp

The WhatsApp channel for Leeway. A student asks about lives, skips, trips and
tests in a chat; the answers come from the same rule code as the web app.

Why it lives here and how it is split: [ADR 0001](../docs/adr/0001-whatsapp-bot-in-its-own-folder.md).

## Layout

```
app/api/wa/         route handlers: health, and the Meta webhook
src/core/           pure logic: safety checks, the inbound order, intents, reply limits
src/core/intents/   one file per kind of request, listed in registry.ts
src/ports/          what the core needs from outside (clock, messenger, ...)
src/adapters/       database, Meta, webhook, wiring, and fakes for tests
scripts/            chat simulator, boundary check, check script
```

## Commands

Run from `bot/`.

- `npm run chat` talk to the bot in the terminal. No Meta account, no AI calls.
  Type a message, or `/tap <button id>` to press a button.
- `npm run check` types, lint, unit tests and boundaries, in at most 40 lines
  (formatting is checked from the repository root).
- `npm run build` production build.
- `npm run dev` local server on port 3100; `GET /api/wa/health` answers.

How to pause the bot, change caps and connect Meta: [runbook](../docs/bot/runbook.md).

## Adding a request type

1. Write its tests next to the other intents.
2. Add `src/core/intents/<name>.ts` exporting an `Intent`.
3. List it in `src/core/intents/registry.ts`, before any more general intent.

Every reply passes `replyProblems` (WhatsApp's length and button limits)
before it can be sent.
