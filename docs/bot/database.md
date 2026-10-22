# The bot's database login

The migration creates `wa_gateway` without a login. To let the bot connect,
after the migration is applied and only when Irakli says so:

1. In the Supabase SQL editor, run
   `alter role wa_gateway with login password '<a long random password>';`
   Keep the password in a password manager. Never put it in git or a chat.
2. Build the connection string for Supabase's transaction pooler (port 6543)
   with user `wa_gateway.<project ref>` and that password.
3. Put it in `WA_DB_URL`: in `bot/.env.local` for local work, and in the bot's
   Vercel project settings for production.

To revoke access at once: `alter role wa_gateway nologin;`

Locally, `supabase db reset --local` applies the migration and
`supabase test db` runs the checks. Never run `supabase db push` from a bot
branch: migrations reach the live database only on Irakli's "go migrate".
