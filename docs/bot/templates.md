# Reminder templates for Meta

Outside the 24 hours after a student last wrote, WhatsApp only delivers
messages from templates Meta has approved. Submit these four in WhatsApp
Manager, Message templates, once the business is verified. Category:
Utility. Language: English (`en`). Then set `WA_TEMPLATES_READY=true`.

Until then, reminders reach only students who wrote in the last day, as
plain text, which needs no template.

| Name | Body | Example values |
| --- | --- | --- |
| `leeway_evening` | Heads-up for tomorrow: {{1}} | Tomorrow 11:00 Statistics II. Last life, don't skip. |
| `leeway_evening_private` | Heads-up for tomorrow: {{1}}. Send "tomorrow" for details. | 1 thing to check |
| `leeway_weekly` | Your week, {{1}}: {{2}} | Mon 2 Nov to Sun 8 Nov / Statistics II Quiz, Wed 4 Nov · Statistics II: last life |
| `leeway_weekly_private` | Your week, {{1}}: {{2}}. Send "this week" for details. | Mon 2 Nov to Sun 8 Nov / 1 test, 1 course to watch |

The bot fills the values from the web app's rules; they never hold links,
emails or phone numbers, and the private versions name no course.
