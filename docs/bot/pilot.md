# Pilot on an ordinary WhatsApp number

A small test with a handful of invited students, before the Cloud API is set
up (business verification, a domain, templates). The bot logic is the same;
only the way messages get in and out changes.

**This breaks WhatsApp's terms.** It uses Baileys, an unofficial client that
logs in as a linked device. WhatsApp can ban the number at any time, without
warning, and the ban is usually permanent. Use a spare SIM, never a number
anyone depends on, and keep the pilot small.

## What is different from the Cloud API path

| | Cloud API | Pilot |
|---|---|---|
| Runs as | Vercel functions (webhook, daily cron) | one always-on process (`npm run pilot`) |
| Buttons | tap buttons | "Reply with a number" lists, valid 15 minutes |
| Linking | sign-in page and a 6-digit code | by hand in SQL; unknown numbers get "ask for an invite" |
| Reminders | text inside 24 hours, template outside | always text, 20:00 Madrid |
| Voice notes | transcribed | not transcribed (no speech key in the pilot) |
| Groups | not possible | ignored |

To look less like a script, the bot only ever replies, shows "typing", and
waits one to two seconds before each message.

## Before the first run

1. The `wa` migrations are on the database (needs a "go migrate" while the
   web app is being graded), and `wa_gateway` has a password (runbook.md).
2. `.env` next to the process, never in git:
   - `WA_DB_URL`, `WA_DB_CA`: the bot's database login (database.md)
   - `WA_HASH_KEY`: 32+ random bytes, the same value for the life of the bot
   - `WA_PILOT_NUMBER`: the pilot phone's number with country code, digits only
   - `CRON_SECRET`: the reminder secret whose hash is in `wa.settings`
   - `ANTHROPIC_API_KEY`: optional; without it the bot understands only fixed phrases
   - `WA_SESSION_DIR`: optional; defaults to `~/.leeway-whatsapp-session`
3. On the pilot phone: WhatsApp installed on the spare SIM, used normally for
   a few days first (a brand-new number that starts answering at once looks
   like spam).

## Pairing

```bash
cd bot && npm run pilot
```

The first run prints an 8-character code. On the pilot phone: WhatsApp,
Settings, Linked devices, Link a device, Link with phone number instead, and
type the code. The session is saved in `WA_SESSION_DIR`; keep that folder
private (it is a full login to the number) and out of git and backups that
others can read.

If the bot prints "logged out", WhatsApp ended the session: delete the folder
and pair again. If it happens more than once, stop the pilot.

## Adding a student

The student writes to the pilot number from their phone and must already have
a Leeway account. Then, as the database owner (Supabase SQL editor):

```sql
insert into wa.links (wa_id, user_id)
select '34600111222', id from auth.users where email = 'student@example.com';
```

`wa_id` is their number with country code, digits only. The bot then asks
their age question and they can use it. To remove someone:
`delete from wa.links where wa_id = '34600111222';`

Sending STOP still works and is kept.

## Running it on the server

On the Hetzner box, as an unprivileged user, with the repo checked out and
`npm ci` run in `bot/`:

```ini
# /etc/systemd/system/leeway-pilot.service
[Unit]
Description=Leeway WhatsApp pilot
After=network-online.target

[Service]
User=leeway
WorkingDirectory=/home/leeway/leeway/bot
EnvironmentFile=/home/leeway/leeway-pilot.env
ExecStart=/usr/bin/npm run pilot
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
```

Pair once by hand (`npm run pilot` in a terminal) before enabling the
service, since the pairing code is printed to the terminal. Then
`systemctl enable --now leeway-pilot` and `journalctl -u leeway-pilot` for
the log. Only one copy may run per number.

## Stopping

`systemctl stop leeway-pilot`, then unlink the device on the phone. The pause
switch in runbook.md answers every message with "back soon" without
stopping the process.
