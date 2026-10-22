# The bot's database login

The migration creates `wa_gateway` without a login. To let the bot connect,
after the migration is applied and only when Irakli says so:

1. Connect with `psql` as `postgres` and run `\password wa_gateway`, then
   `alter role wa_gateway login;`. `\password` sends only a hash, so the
   password never lands in statement logs. Keep it in a password manager; never
   put it in git or a chat.
2. Build the connection string for Supabase's transaction pooler (port 6543)
   with user `wa_gateway.<project ref>` and that password.
3. In the Supabase dashboard, Database settings, SSL, download the CA
   certificate. The bot verifies the server against it.
4. Set `WA_DB_URL` to the connection string and `WA_DB_CA` to the certificate's
   PEM text: in `bot/.env.local` for local work, and in the bot's Vercel
   project settings for production.

To revoke access at once: `alter role wa_gateway nologin;`

Locally, `supabase db reset --local` applies the migration and
`supabase test db` runs the checks. A local `WA_DB_URL` needs no certificate.
Never run `supabase db push` from a bot branch: migrations reach the live
database only on Irakli's "go migrate".
