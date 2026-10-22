# 0007. Voice notes are transcribed, then read as text

Date: 2026-10-23. Status: accepted.

## Decision

- Only a linked student's voice note is transcribed; unlinked senders get
  the usual code-only replies. It is transcribed before the age or voice
  question, so a spoken crisis or STOP is handled like a typed one.
- The bot downloads the note from Meta right away (Meta's link lasts five
  minutes), only from Meta's own hosts and only audio, stops reading past
  about a minute, and sends it to ElevenLabs Scribe (`scribe_v2`, English).
  Download and transcription share four seconds, so the reply still fits
  Meta's time limit.
- The transcript goes down the same path as typed text: commands, then the AI
  reader. Neither the audio nor the transcript is stored, logged or shown
  back.
- Each note sent for transcription is charged to the daily AI ceiling by its
  size, failed or not. Without `ELEVENLABS_API_KEY`, or past the ceiling, the
  student is asked to type, so a crisis in a voice note then goes unheard
  until they type.
- The vendor sits behind the `Speech` port, so the planned accuracy test on
  real IE voice notes can swap it without touching the core.
