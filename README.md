# Leeway

Leeway helps IE bachelor's students see how many classes they can still miss, so they don't fail a course on attendance.

- Live app: not deployed yet
- Status: in planning. Application code lands through pull requests once the spec, design and technical plan are approved.

## Stack

Next.js (App Router, TypeScript), Supabase (Auth, Postgres with row-level security), Vercel.

## Running locally

Instructions will be added with the first application code.

## Environment variables

Set in `.env.local` for local development and in Vercel for production. Values are never committed.

- `NEXT_PUBLIC_SUPABASE_URL` (browser)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (browser)
- `GEMINI_API_KEY` (server only)
- `VAPID_PRIVATE_KEY` (server only)
- `VAPID_SUBJECT` (server only, a `mailto:` address)
- `CRON_SECRET` (server only)
- `SUPABASE_SECRET_KEY` (server only, nightly alert job)

## Docs

- [Product spec](docs/spec.md)
- [Development process](docs/process.md)

## License

[MIT](LICENSE)
