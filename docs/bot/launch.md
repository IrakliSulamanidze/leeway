# Launch steps

In order. Nothing here happens before Irakli says grading is over, and each
step that touches the live database, Vercel or Meta waits for his word.

## 1. Database ("go migrate")

1. `supabase db push` from `main` after `feat/whatsapp-bot` is merged. All bot
   migrations are additive: new `wa` and `wa_api` schemas, a role, functions.
2. `supabase test db` against a local copy first; the grading-bot simulation
   in CI must stay green.
3. Give `wa_gateway` a login ([database.md](database.md)).
4. Set the scheduler secret's hash, and `admin_wa_id` if you want the monthly
   bill warning on WhatsApp ([runbook.md](runbook.md)).

## 2. Meta

1. A domain with a one-page Leeway site (Meta does not accept `vercel.app`).
2. Business verification in Meta Business settings, Security center.
3. The production number: a SIM never used on WhatsApp, display name
   "Leeway", billing in EUR.
4. A system user with a permanent token for the WhatsApp account.
5. Submit the four reminder templates ([templates.md](templates.md)).
6. Publish the app, then in WhatsApp, Configuration, set the callback URL to
   `https://<bot address>/api/wa/webhook` with the verify token, and subscribe
   to `messages`.

## 3. Vercel

1. A new project from this repository with Root Directory `bot`, region
   Dublin, "Include files outside the Root Directory" on, Node 22.
2. The environment variables in `bot/.env.example`.
3. An Ignored Build Step on both projects so bot commits do not redeploy the
   web app and the reverse.

## 4. Smoke test, on your own phone

1. `GET /api/wa/health` answers `ok`.
2. Write "hi": a sign-in link arrives. Sign in, send the code, answer age and
   voice.
3. "lives", "tomorrow", "skipped micro" then Undo, a voice note, "do my
   homework", STOP and START.
4. Pause with the kill switch and check the "back soon" line, then unpause.

## 5. Students

1. Your 5 users, then classmates. The cap stops at 50 and starts the
   waitlist.
2. Watch the AI spend and Meta's count daily for the first week.
