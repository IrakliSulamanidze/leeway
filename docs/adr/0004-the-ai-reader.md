# 0004. The AI reads, code decides

Date: 2026-10-23. Status: accepted.

## Context

Students write in their own words ("am i cooked in micro", "didnt go to stats
today"). Exact commands cover only part of that. A model that answers
directly could get a number wrong or be talked into saying something else,
and the repository is public, so the prompt is not a secret.

## Decision

- Exact commands and buttons never reach a model. Only text that matches no
  command goes to the reader.
- The reader is one Claude Haiku 5.5 call (`bot/src/adapters/claude/reader.ts`)
  with no tools, no history and no student data. It gets the message and
  today's date and returns one request from a fixed list, plus the course
  words for skips, through structured outputs with a hand-written JSON
  schema (the enum keeps it on the list); code checks the answer again.
- Code turns that request into the exact command a student could have typed
  and answers it through the same intent. The model never writes a reply, so
  an instruction hidden in a message has nothing to steer; off-topic and
  attack messages get the same fixed redirect.
- A course name from the reader must be plain words and is matched against
  the student's own courses; it is never shown back. A skip the reader picked
  out always waits for the student's tap, so a misread message cannot change
  their lives.
- Before each call the bot checks a daily ceiling (`ai_daily_cap_micros`,
  $5); past it, free text gets the menu and commands keep working. Each call's
  cost is recorded from its token usage.
- The prompt is versioned (`READER_PROMPT_VERSION`). A change is checked with
  `npm run eval:reader`, which runs the real model on a fixed set of messages,
  slang and attacks included.
- The reader sits behind the `Reader` port, so another model is one adapter.

## Consequences

- A typical message costs about a hundredth of a cent; Meta's fees remain
  most of the bill.
- Requests outside the list (trips, date ranges, misses so far) read as
  unclear until they get their own intents.
- When the model is slow or down, or no API key is set, students still get
  commands and buttons. The call has 3 seconds and no retry, so the webhook
  stays inside Meta's time limit.
