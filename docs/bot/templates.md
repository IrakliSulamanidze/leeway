# Reminder templates for Meta

Outside the 24 hours after a student last wrote, WhatsApp only delivers
messages from templates Meta has approved. Submit these four in WhatsApp
Manager, Message templates, once the business is verified. Category:
Utility. Language: English (`en`). Then set `WA_TEMPLATES_READY=true`.

Until then, reminders reach only students who wrote in the last day, as
plain text, which needs no template.

| Name | Body | Example values |
| --- | --- | --- |
| `leeway_evening` | Leeway heads-up for tomorrow: {{1}} Reply "tomorrow" for the full picture, or STOP to turn reminders off. | Tomorrow 11:00 Statistics II. Last life, don't skip. |
| `leeway_evening_private` | Leeway heads-up for tomorrow: {{1}}. Reply "tomorrow" for details, or STOP to turn reminders off. | 1 thing to check |
| `leeway_weekly` | Leeway look at your week, {{1}}: {{2}}. Reply "this week" for the full picture, or STOP to turn reminders off. | Mon 2 Nov to Sun 8 Nov / Statistics II Quiz, Wed 4 Nov · Statistics II: last life |
| `leeway_weekly_private` | Leeway look at your week, {{1}}: {{2}}. Reply "this week" for details, or STOP to turn reminders off. | Mon 2 Nov to Sun 8 Nov / 1 test, 1 course to watch |

Each body starts and ends with fixed text, as Meta requires. The bot cleans
every value (no line breaks, tabs or runs of spaces, at most 400 characters)
and lists at most six items before "and N more".

The bot fills the values from the web app's rules; they never hold links,
emails or phone numbers, and the private versions name no course.
