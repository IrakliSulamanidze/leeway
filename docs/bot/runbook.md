# Running the bot

## Switches

Run in the Supabase SQL editor. Each takes effect on the next message.

| To | SQL |
| --- | --- |
| Pause the bot (every message gets "back soon") | `update wa.settings set value = 'true', updated_at = now() where name = 'paused';` |
| Unpause | `update wa.settings set value = 'false', updated_at = now() where name = 'paused';` |
| Change the daily cap per student | `update wa.settings set value = '80', updated_at = now() where name = 'daily_message_cap';` |
| Change the student cap | `update wa.settings set value = '100', updated_at = now() where name = 'student_cap';` |
| Change the daily AI ceiling ($5 = 5000000; 0 turns the AI off) | `update wa.settings set value = '5000000', updated_at = now() where name = 'ai_daily_cap_micros';` |
| See today's AI spend | `select micros / 1e6 as dollars from wa.ai_spend where day = (now() at time zone 'Europe/Madrid')::date;` |

Crisis replies and STOP confirmations still go out while paused.

## Environment

Set in `bot/.env.local` locally and in the bot's Vercel project. Names are in
`bot/.env.example`.

- `WHATSAPP_APP_SECRET`: Meta app, Settings, Basic, App secret. Signs webhooks.
- `WHATSAPP_VERIFY_TOKEN`: any long random string; the same value goes in
  Meta's webhook settings.
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`: from Meta's API Setup
  page. Production uses a system user's permanent token.
- `WA_HASH_KEY`: a long random string. Message ids and senders are stored as
  keyed hashes; changing the key resets redelivery checks and daily counts.
- `ANTHROPIC_API_KEY`: for the AI reader. Without it the bot answers commands only.
- `WA_DB_URL`, `WA_DB_CA`: see [database.md](database.md).
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`: the web app's public Supabase
  values; the link page signs students in with them.
- `BOT_PUBLIC_URL`: the bot's own address, used in sign-in links.

## Waitlist

Students past the cap are in `wa.waitlist`, oldest first. Raising
`student_cap` lets new sign-ins through; moving waiting students in, and
messaging them, is a later slice (a message offering a place counts as
marketing for Meta, about €0.06 each).

## Connecting Meta

In the Meta app, WhatsApp, Configuration: callback URL
`https://<bot address>/api/wa/webhook`, verify token `WHATSAPP_VERIFY_TOKEN`,
then subscribe to the `messages` field.
