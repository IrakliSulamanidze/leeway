# 0006. Reminders Leeway sends on its own

Date: 2026-10-23. Status: accepted.

## Decision

- One job a day (Vercel Cron, `bot/vercel.json`) sends each linked student at
  most one reminder: Sundays a look at the week ahead, other days a heads-up
  for tomorrow. The heads-up is the web app's own night alert (`nightAlert`),
  so both channels say the same thing.
- Inside 24 hours of the student's last message the reminder goes as plain
  text, which needs no template and costs nothing. Outside it, it goes as a
  Meta-approved utility template, once `WA_TEMPLATES_READY` is set.
- Today's reminder is claimed in the database before it is sent, so a second
  run on the same day sends nothing twice. A failed send is not retried.
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
