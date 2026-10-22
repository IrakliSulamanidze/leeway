# 0006. Reminders Leeway sends on its own

Date: 2026-10-23. Status: accepted.

## Decision

- One job a day (Vercel Cron, `bot/vercel.json`) sends each linked student at
  most one reminder: Sundays a look at the week ahead, other days a heads-up
  for tomorrow (or the heads-up when the week holds nothing to flag). The
  heads-up is built from the web app's own night alert (`nightAlert`).
- Nothing goes out between 22:30 and 08:00 in Madrid, whoever starts the job.
  A run stops starting students after 45 seconds and takes them in random
  order, so a slow day never skips the same people; the bot project runs in
  Dublin, next to the database.
- Inside 24 hours of the student's last message (`last_inbound_at`, set only
  when the student writes) the reminder goes as plain text, which needs no template and costs nothing. Outside it, it goes as a
  Meta-approved utility template, once `WA_TEMPLATES_READY` is set.
- Today's reminder is claimed in the database before it is sent, so a second
  run on the same day sends nothing twice. A send Meta refuses outright gives
  the day back; a timeout does not, since the message may have arrived.
- Listing students is beyond what one turn may do, so it needs the
  scheduler's secret, checked against a hash in the database. The bot's
  database password alone lists nobody.
- STOP turns reminders off; "hide details" sends counts only, so a lock screen
  shows no course or test.

## Consequences

- Before Meta verifies the business, only students who wrote in the last day
  get reminders.
- Homework reminders wait for the check on which Blackboard items the IE
  feed carries.
