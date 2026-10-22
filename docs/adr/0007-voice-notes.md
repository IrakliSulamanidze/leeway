# 0007. Voice notes are transcribed, then read as text

Date: 2026-10-23. Status: accepted.

## Decision

- Only a linked student's voice note is transcribed; unlinked senders get
  the usual code-only replies.
- The bot downloads the note from Meta right away (Meta's link lasts five
  minutes), refuses anything over about a minute, and sends it to ElevenLabs
  Scribe (`scribe_v2`, English), the planning research's first pick.
- The transcript goes down the same path as typed text: the crisis check,
  then commands, then the AI reader. Neither the audio nor the transcript is
  stored, logged or shown back.
- Each note is charged to the daily AI ceiling as a full minute. Without
  `ELEVENLABS_API_KEY`, or past the ceiling, the student is asked to type.
- The vendor sits behind the `Speech` port, so the planned accuracy test on
  real IE voice notes can swap it without touching the core.
