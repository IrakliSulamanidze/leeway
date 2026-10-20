# Leeway technical plan (stage 3)

Status: SIGNED OFF by Irakli 2026-10-20 16:21 UTC ("plan signed off, go packages": ical.js, pdfjs-dist, web-push approved). Panel fix round applied 16:20 UTC; reviews in docs/reviews/plan-architecture.md and plan-security.md). Owner: the "Leeway technical plan" thread. Written 2026-10-20 16:06–16:20 UTC.
Inputs (frozen): spec "Leeway: Product Spec v1" rev 159 (all 9 decisions approved), `docs/design.md` + `tokens.css` + `mockups.html` (signed off 15:40 UTC), `research/ie-feed-analysis.md`, `reviews/alignment.md`, process.md (sections 3, 4, 5, 8b), the grading contract in the repo's `CLAUDE.md`.
Spike S1 landed (`research/spike-s1.md`) and is folded in (section 9). S2 (one Gemini read) waits on the key (G4).

Paths assume the template's `src/` layout (`src/app`, `src/lib`, `src/components`). If PR 1 lands with a root layout, drop the `src/` prefix everywhere; nothing else changes.

## 0. The plan in eight lines
1. One schema in two additive migrations: core (courses, skips: the graded path) in PR 2, everything else in PR 6. No other PR touches `supabase/migrations/`, so the lanes never collide on the database.
2. Every table: RLS on, own-row policies `to authenticated` with `user_id = (select auth.uid())` in `using` and `with check`, `user_id default auth.uid()`, all grants to `anon` revoked, `on delete cascade` from `auth.users`.
3. Child rows point at their parent through a composite key `(parent_id, user_id)`, so nobody can attach a row to another student's course even by guessing its id.
4. The bot's one tap is one database call: `log_skip(text)` (security invoker, so RLS still applies) creates the course if needed and saves the skip in one transaction, with the Madrid date worked out in the database.
5. Three security-definer functions, each with a pgTAP test: `delete_my_account()`, `reserve_ai_call()`, `feed_url_for_sync(uuid)`. Plus two security-invoker helpers (`log_skip`, `connect_feed`). A pgTAP query proves every definer function has `search_path=''` and no anon execute.
6. Three secrets, each confined to one server module that a script proves only one route imports: `SUPABASE_SECRET_KEY` (nightly cron), `GEMINI_API_KEY` (syllabus read), `VAPID_PRIVATE_KEY` (nightly cron).
7. Interfaces are fixed in this file (tables, functions, module signatures, routes), so PRs stack on each other's branches and run in parallel instead of waiting for merges.
8. Lean build (Irakli, 16:12 UTC): 8 PRs after PR 1, full CI on each, agent reviews only on the four risk areas, one whole-app review before go-live. Section 8 has the honest timing: it fits 85 minutes with 7 implementers at 17:00, then 5–6, and no slack.

## 1. Architecture in one picture
- Next.js 16 App Router on Vercel Hobby. Server components read with the user's cookie session (`@supabase/ssr` server client). Writes go through server actions in `src/app/app/actions.ts` and friends, validated with zod, calling Supabase as the user. RLS applies to every student action.
- Pure rules (lives, pace, dates, near match, session counting, week tools, alert rule) live in `src/lib/rules/*` with no I/O, so they are unit-tested and shared by the page, the preview and the cron job.
- Route handlers (Node runtime) only where a server needs to do something the browser can't: `POST /api/calendar/sync` (fetch a feed), `POST /api/syllabus/read` (call Gemini), `GET /api/cron/nightly` (alerts). Nothing else is an API route.
- Browser gets only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_APP_NAME`.
- No new service. Packages added (each named in its PR brief; Irakli's go is needed: G1/G7): `ical.js` (RRULE, EXDATE, RECURRENCE-ID, VTIMEZONE), `web-push`, `pdfjs-dist`, `zod` if the template lacks it. Gemini is called with plain `fetch` (no SDK). Dates use `Intl` with `Europe/Madrid` (no date library).

## 2. Data model
12 tables, all in `public`. Every table has `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade` and `created_at timestamptz not null default now()` unless stated.

| Table | Columns (besides user_id, created_at) | Keys and checks | Spec reason |
|---|---|---|---|
| `courses` | `id uuid pk default gen_random_uuid()`, `name text`, `name_key text generated always as (public.norm_course_name(name)) stored`, `sessions_typed int null`, `sessions_syllabus int null`, `sessions_calendar int null`, `missed_before int not null default 0` | `unique (user_id, name_key)`, `unique (id, user_id)`; `char_length(name) between 1 and 200`; sessions 1–200; `missed_before between 0 and 200` | Courses with stable id, name matched ignoring case/accents/spaces; session source order typed > syllabus > calendar > 30 |
| `skips` | `id`, `course_id uuid not null`, `text_typed text`, `sessions smallint`, `skip_date date`, `planned boolean not null default false`, `class_session_id uuid null` | FK `(course_id, user_id) → courses(id, user_id) on delete cascade`; FK `(class_session_id, user_id) → class_sessions(id, user_id) on delete set null (class_session_id)` (PG15 column list); `sessions in (1,2)`; `char_length(text_typed) between 1 and 200`; partial `unique (class_session_id) where class_session_id is not null`; index `(user_id, created_at desc)` | One record per save, x2 for a double, text as typed, planned flag, link to a class; tapping Skipped twice adds nothing |
| `calendar_feeds` | `id`, `url text` (secret), `status text default 'new'`, `last_synced_at`, `last_attempt_at`, `last_error text` | `url ~ '^https://'`, `char_length(url) <= 2048`; `status in ('new','ok','failed')`; `last_error` one of the fixed messages; `unique (id, user_id)`; `unique (user_id, url)`; at most 3 per user (checked in `connect_feed`) | Connect by link (IE first; a second or third calendar allowed, deduped), never shown again, "Last synced", failed banner, two-tab guard |
| `feed_course_map` | `id`, `feed_id uuid`, `source_key text`, `source_hash text`, `course_id uuid null`, `status text` | FK `(feed_id, user_id)` cascade; FK `(course_id, user_id)` cascade; `status in ('pending','mapped','ignored')`; `unique (feed_id, source_hash)`; when `status='ignored'`, `source_key` is null (only the hash is kept) | One-time mapping; personal events never stored |
| `class_sessions` | `id`, `feed_id uuid`, `course_id uuid`, `uid text`, `original_start timestamptz`, `starts_at timestamptz`, `ends_at timestamptz`, `all_day boolean`, `kind text`, `session_numbers int[]`, `is_exam_slot boolean default false` | FKs as above, cascade; `kind in ('class','async','extra','exam','deadline')`; `unique (feed_id, uid, original_start)`; `unique (id, user_id)`; index `(user_id, starts_at)` | Today, weekly check, trip check, counting, exam slot, Blackboard items as deadlines |
| `assessments` | `id`, `course_id uuid`, `class_session_id uuid null`, `session_number int null`, `on_date date null`, `title text`, `weight numeric(5,2) null`, `weight_assumed boolean default false`, `source text` | FK `(course_id, user_id)` cascade; FK to class_sessions set null (column list); `source in ('manual','syllabus','feed')`; at least one of session_number/on_date/class_session_id | Test marks, exam days, weights, countdown, "never a test day" |
| `syllabus_sessions` | `id`, `course_id uuid`, `session_number int`, `topic text`, `pre_reading text null`, `probably boolean default false` | FK `(course_id, user_id)` cascade; `unique (course_id, session_number)` | What you'll miss, re-import diff |
| `notices` | `id`, `body text`, `dismissed_at timestamptz null` | `char_length(body) <= 300` | "Micro lost a session. Lives now 5.", planned skip released |
| `weekly_checks` | `week_start date` | `primary key (user_id, week_start)` | "All good" closes the Sunday card |
| `ai_usage` | `day date`, `count int not null default 0` | `primary key (user_id, day)`; `count between 0 and 10` | 10 syllabus reads per student per day, not resettable |
| `push_subscriptions` | `id`, `endpoint text`, `p256dh text`, `auth text` | `unique (user_id, endpoint)`; `endpoint ~ '^https://'` | Night-before alerts |
| `alert_log` | `night date` | `primary key (user_id, night)` | At most one push per user per night, enforced in the database |

Nullability: every column above is `not null` unless marked null or listed as optional (`last_*`, `dismissed_at`, `weight`, `pre_reading`, the three `sessions_*`, `class_session_id`, `course_id` on feed_course_map, `session_number`/`on_date`). `skips.sessions` defaults to 1.
Derived, never stored: lives, lives left, pace label, weeks to go, term dates from the calendar, planned-vs-logged state (a planned skip with `skip_date <= madrid_today()` is a normal skip; computed on read), "estimated" flag (no session source set).
Sessions from a calendar: `sessions_calendar` = number of distinct session numbers (ranges expanded) over the course's `class`/`async` rows, plus one for each unnumbered `async` row (none in IE's feed). `extra`, `exam` and `deadline` rows never change the count, and gaps are not filled in (S1: Comp. Architecture counts 30, not 33). The session an exam covers stays in the count. Written by the sync, never by hand.

## 3. Migrations (additive only)
| File | PR | Contents |
|---|---|---|
| `<ts>_core.sql` | 2 | extension `unaccent` (schema `extensions`); `norm_course_name(text)` (immutable SQL: `lower(regexp_replace(btrim(extensions.unaccent('extensions.unaccent'::regdictionary, $1)), '\s+', ' ', 'g'))`, the two-argument form so the generated column accepts it); `madrid_today()`; `courses`, `skips` (`class_session_id` column without its FK); RLS + grants; `log_skip` (no class linking yet); `delete_my_account` |
| `<ts>_features.sql` | 6 | the other 10 tables; `alter table skips add constraint ... class_session FK` (additive); RLS + grants; `connect_feed`; `feed_url_for_sync`; `reserve_ai_call`; `create or replace log_skip` adding class linking |

Rules: created with `supabase migration new`; never edited after merge; no drops, renames or type changes; a later fix is a new file and goes through the DB lane (PR 2/3 owners) only. Production gets them by `supabase db push` on Irakli's "go migrate" (G6).

## 4. RLS, grants and functions
Standard block for every table `t` (written once per table, checked by `supabase/tests/00_rls.sql`):
```sql
alter table t enable row level security;
revoke all on t from anon;
create policy t_select on t for select to authenticated using (user_id = (select auth.uid()));
create policy t_insert on t for insert to authenticated with check (user_id = (select auth.uid()));
create policy t_update on t for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy t_delete on t for delete to authenticated using (user_id = (select auth.uid()));
```
Exceptions:
- `ai_usage`: `revoke all ... from anon, authenticated; grant select ... to authenticated;` select policy only. Rows change only through `reserve_ai_call()`.
- `alert_log`: `revoke all ... from anon, authenticated;` no policies. Only the cron job (secret key) writes it.
- `calendar_feeds`: `revoke select on calendar_feeds from authenticated; grant select (id, user_id, status, last_synced_at, last_attempt_at, last_error, created_at) on calendar_feeds to authenticated;` so no client query can read `url`, by accident or otherwise. Insert goes through `connect_feed`.
- `weekly_checks`, `notices`: standard block, no update except `notices.dismissed_at` (column grant `update (dismissed_at)`).

Functions (all `set search_path = ''`, fully qualified names, `revoke execute ... from public, anon`; `00_rls.sql` checks this for every `prosecdef` function in `public` through `pg_proc.proconfig` and `has_function_privilege('anon', ...)`):
| Function | Kind | Granted to | What it does | Test |
|---|---|---|---|---|
| `log_skip(p_text text, p_day text default 'today', p_sessions int default 1) returns public.skips` | invoker | authenticated | validates 1–200 chars, `p_day in ('today','tomorrow')`, `p_sessions in (1,2)`; upserts the course by `name_key` (name = trimmed text); inserts the skip with `skip_date = madrid_today() + (p_day='tomorrow')::int`, `planned = p_day='tomorrow'`, `text_typed = p_text`. PR 6's version also links a class that has no skip yet and isn't an exam slot: that day's, else (today only) the latest unmarked one in the past 7 days; never a class already linked, so a second save the same day can't hit the unique index | `01_core.sql`; PR 6 adds "two saves same day both succeed" |
| `delete_my_account() returns void` | definer | authenticated | `delete from auth.users where id = auth.uid()`; every table cascades | `02_delete_account.sql`: all 12 tables hold 0 rows for the caller afterwards; user B untouched |
| `connect_feed(p_url text) returns uuid` | invoker | authenticated | turns `webcal://` into `https://`; rejects (with a fixed message, never echoing the input) anything not `https://`, over 2048 chars, or a 4th feed; `insert ... on conflict (user_id, url) do nothing`, then returns the id, so no constraint error ever carries the URL | `03_calendar.sql` |
| `feed_url_for_sync(p_feed uuid) returns text` | definer | authenticated | returns the url only when `user_id = auth.uid()`; null otherwise, including when `auth.uid()` is null. Never given a user-id argument and never granted to service_role (the cron reads the url directly, see 5.2) | `03_calendar.sql`: own feed returns url, B's feed and no login return null, `select url from calendar_feeds` as authenticated raises permission denied |
| `reserve_ai_call() returns boolean` | definer | authenticated | false when `auth.uid()` is null, or when today's total across all users is ≥ 300 (protects the shared free quota from scripted sign-ups); else `insert ... (auth.uid(), madrid_today(), 1) on conflict do update set count = count + 1 where ai_usage.count < 10 returning true`; false when at 10 | `04_ai_usage.sql`: 10 trues then false; update/delete/insert by authenticated denied; no-login false |

Keep-alive (process 6.7): the nightly cron touches the database every day, so no `ping()` function is needed; the route reads `push_subscriptions` before its Madrid-hour gate. The deploy-stage health check calls `/auth/v1/health` only.
The cron job reads and writes with the secret key, so RLS doesn't bind it. Every admin query carries `.eq('user_id', userId)`, and `sync.test.ts` proves user B's rows are byte-identical after an admin sync of A. It is limited by code to: `push_subscriptions` (read, delete dead), `alert_log` (claim), and per user `courses`, `skips`, `class_sessions`, `assessments`, `calendar_feeds` (read + sync writes). `05_alert_log.sql` proves a second claim for the same night returns no row.

## 5. Modules, routes and secrets
Fixed interfaces (UI PRs build against these):
```ts
// src/lib/rules/dates.ts
madridToday(now?: Date): string            // 'YYYY-MM-DD'
madridTomorrow(now?: Date): string
zonedToUtc(localIso: string, tz: string): Date   // used by the ICS parser
weeksToGo(today: string, termEnd: string): number  // 0 after term end
termDates(sessions: {starts_at: string}[], fallback = CONFIG.term): {start: string; end: string}
// src/lib/rules/lives.ts
sessionsFor(c: CourseRow): {sessions: number; estimated: boolean}
livesFor(sessions: number): number          // floor(sessions * 0.2)
livesLeft(c: CourseRow, skips: SkipRow[]): {left: number; planned: number; used: number}
paceLabel(i: {left: number; lives: number; skipsLast4Weeks: number; weekOfTerm: number; weeksToGo: number; remainingClasses?: number}): 'over'|'out'|'last'|'burning'|'safe'|'attendance-safe'
previewLine(...): {text: string; state: Pace}   // copy from the spec table
// src/lib/rules/match.ts
nearMatch(typed: string, names: string[]): string | null   // normalised edit distance
// src/lib/rules/week.ts
canISkip(range, sessions, courses, skips, assessments): {verdict: string; classes: ...[]}
ifYouHaveToMissOne(week, ...): ...[]       // never test days, never last-life courses
// src/lib/rules/alert.ts
nightAlert(input): string | null            // one message or nothing
// src/lib/calendar/safe-fetch.ts
safeFetch(url: string, opts?: {timeoutMs?: number; maxBytes?: number; maxRedirects?: number}): Promise<{status: number; contentType: string; body: string}>
// src/lib/calendar/parse.ts
parseFeed(ics: string, range: {from: Date; to: Date}): ParsedEvent[]   // expands RRULE/EXDATE/RECURRENCE-ID, maps TZID incl. Windows names
classifyIE(ev: ParsedEvent): {kind; courseKey; sessionNumbers}
// src/lib/calendar/sync.ts
syncFeed(db: SupabaseClient, feedId: string, userId: string, fetcher = safeFetch): Promise<SyncResult>
// src/lib/syllabus/schema.ts  (zod) and src/lib/server/gemini.ts
readSyllabus(text: string): Promise<SyllabusRead>   // server-only, one retry on schema failure
```
Routes and pages: `/`, `/signup`, `/login`, `/app` (Home), `/app/plan`, `/app/settings`, `/app/courses/[id]`, `/app/courses/[id]/syllabus`, `/app/calendar` (connect + mapping), `POST /api/calendar/sync`, `POST /api/syllabus/read`, `GET /api/cron/nightly`, `/manifest.webmanifest` (`src/app/manifest.ts`), `/sw.js` (`public/sw.js`).

Secret confinement (enforced by `scripts/contract-check.mjs`, extended in the PR that adds each secret):
| Secret | Only file that reads it | Only importer | Check |
|---|---|---|---|
| `SUPABASE_SECRET_KEY` | `src/lib/server/admin.ts` (`import 'server-only'`) | `src/app/api/cron/nightly/route.ts` | grep over `src/`: no other file mentions the name or imports `admin` (`e2e/helpers/seed.ts` uses the local key and is outside `src/`); bundle grep on `.next/static` for `sb_secret_` |
| `VAPID_PRIVATE_KEY` | `src/lib/server/push.ts` (`server-only`) | the cron route | same |
| `GEMINI_API_KEY` | `src/lib/server/gemini.ts` (`server-only`) | `src/app/api/syllabus/read/route.ts` | same; without the key the route returns 404 and the import entry is hidden |
| `CRON_SECRET` | the cron route | — | vitest: 401 without or with a wrong `Authorization: Bearer`; 500 and nothing sent when the env var is unset or shorter than 32 chars (so "Bearer undefined" never passes); constant-time compare |

Other enforced rules (contract check): no `calendar_feeds` query selects `*` or `url` in `src/`; errors are logged as `error.code` only (no logging of Supabase error objects); no `localStorage`/`sessionStorage`/`indexedDB` in `src/`; `pdfjs-dist` imported only under `src/app/app/courses/[id]/syllabus/`; no test-only fetcher or env switch in `src/` (sync tests inject the fetcher through `syncFeed`'s parameter, so nothing test-only ships).

### 5.1 Calendar safety (SSRF guard, `safe-fetch.ts`, no new package)
- Accept only `https:` (after `webcal:` → `https:`), port 443 or none, no userinfo, host ≤ 253 chars.
- Resolve with `dns.lookup(host, {all: true})`; reject if any address is outside public space. IPv4: block `0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.168/16, 198.18/15, 224/4, 240/4`. IPv6: allow only `2000::/3`, minus `2001::/32` (Teredo), `2002::/16` (6to4) and `64:ff9b::/96`; IPv4-mapped addresses are checked as IPv4.
- Connect with `node:https` using a `lookup` that returns the vetted address, so a DNS answer can't change between check and connect (rebinding).
- `redirect: manual`, at most 3 hops, each new URL goes through the full check again.
- 5-second total timeout (`AbortSignal.timeout`), no `Accept-Encoding` sent (so the 2 MB cap applies to what is actually read), body read as a stream and aborted past 2 MB, must start with `BEGIN:VCALENDAR` (else "not a calendar").
- Errors are mapped to fixed messages. The URL, the response headers (IE echoes the feed key in `Content-Disposition`) and the body are never logged, returned or stored. A unit test asserts that no `console`/logger call receives them.

### 5.2 Calendar sync (`syncFeed(db, feedId, userId, getUrl, fetcher = safeFetch)`)
`getUrl` is how the caller reads the secret link: the user route passes `rpc('feed_url_for_sync')`; the cron passes an admin `select url from calendar_feeds where id = $1 and user_id = $2`. The definer function never takes a user id.
1. Two-tab guard: `update calendar_feeds set last_attempt_at = now() where id = $1 and (last_attempt_at is null or last_attempt_at < now() - interval '30 seconds') returning id`; no row means another sync is running, return "busy".
2. Get the url with `getUrl`, fetch, parse events from term start − 7 days to term end + 120 days.
3. Classify (IE rules from ie-feed-analysis.md and spike-s1.md: kind from UID shape, LOCATION and SUMMARY; the course key is the UID's course part (`S…`), and an exam's `n-P-C-S` UID links it to its course; other feeds: cleaned titles as course keys). Ignore DTSTAMP and the "Last update" meta event; a change is a diff of SUMMARY, DTSTART, DTEND and LOCATION only. Unmapped course keys go to `feed_course_map` as `pending`; events of `ignored` or `pending` keys are dropped, never stored.
4. Glitch guard: if the new set drops more than 30% of stored future sessions, or parsing fails, set `status='failed'` and keep everything.
5. Upsert by `(feed_id, uid, original_start)`; delete vanished sessions. Before deleting, delete planned future skips linked to them and write a notice; logged skips keep their row (`class_session_id` set null by the FK).
6. Exam slot: a `class` row of the same course starting 30 minutes after an `exam` row's start and overlapping it gets `is_exam_slot = true`. It stays in the session count but is never offered as a skip (Today, trip check, if you have to miss one, last-spare plan).
7. Recount `sessions_calendar` per mapped course; if lives change, write "Micro lost a session. Lives now 5."
8. Link unlinked skips to the same-date class of their course.
9. Same class in two calendars: the week tools and Today dedupe by `(course_id, starts_at)`.
10. "Asks once" questions (a class before a marked test cancelled or added: "Is the Micro midterm still Tue 3 Nov?"; syllabus and calendar counts disagree) are written as `notices` with a link to the course page, once per change.
11. Non-IE feeds: only keys seen on 3 or more events in the range become `pending`, and pending titles are deleted (hash kept as `ignored`) if the student leaves the mapping screen without confirming them.
The page calls `POST /api/calendar/sync` after first paint when `last_synced_at` is older than 15 minutes, and never touches the form state.

### 5.3 Syllabus read
`POST /api/syllabus/read {courseId, text}`: user session required; text 200–60,000 chars (a PDF is turned into text in the browser by pdf.js); `reserve_ai_call()` false → 429 "Syllabus reading is busy..."; Gemini Flash with `responseMimeType: application/json` + `responseSchema`; the system prompt says the text is data; zod validates; one retry; then 422 "mark tests by hand". Nothing is written. The review screen posts the confirmed lines to a server action that writes `assessments`, `syllabus_sessions`, `courses.sessions_syllabus`. Re-import: the action diffs against the current rows and the review screen shows only changed lines. Model name from `GEMINI_MODEL` (server env, default set from S2's result).

### 5.4 Night-before alerts
- `vercel.json` crons: `0 19 * * *` and `0 20 * * *` (UTC). The route works only when the Madrid hour is 21, so it fires at about 21:00 Madrid on both sides of the 25 Oct clock change with no manual edit, and `alert_log` makes a double fire harmless. (Replaces the "move the cron on 25 Oct" note in process 12; sent to the pipeline thread.)
- Route: `CRON_SECRET` must be set and ≥ 32 chars (else 500, nothing sent); `Authorization: Bearer <secret>` compared in constant time, else 401; Node runtime, `maxDuration` 60.
- Fair share: users are processed in random order with a 4-second budget each (their feed sync is cut short and the last synced data used); at most the 5 newest subscriptions per user get a send.
- Push is a second server fetch: `push.ts` sends only to endpoints whose host is a known push service (`fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`), with web-push `timeout` 5 s. The save action rejects any other endpoint host.
- Per user with a subscription: re-sync each feed with `syncFeed(admin, ...)` (keeps last data on failure and says "as of Tue"), compute `nightAlert()`; if there is a message, claim `alert_log (user, madrid_tomorrow_eve)` with `insert ... on conflict do nothing returning`; send only if claimed; on 404/410 delete that subscription.
- The browser asks for notification permission only in the click handler of "Turn on alerts".

## 6. Test map (every bot step and spec feature)
Kinds: U = vitest unit, I = vitest integration against local Supabase (db job), P = pgTAP, E = Playwright (db + bot-sim job), C = contract/hygiene/secrets script.
| What | Test | Kind | PR |
|---|---|---|---|
| Bot 1: landing at 1280px and iPhone 13, one sign-up button, no sideways scroll; logged out `/app` → `/login` | `e2e/grading-bot.spec.ts` "step 1" | E | 1, 4 |
| Bot 2: sign up → `/app`, `logout` visible on `/app` and `/` without reload | "step 2" | E | 1, 4 |
| Bot 3: type `QA-<rand> grading bot test`, one tap → exactly one new `core-item` with that text, "5 of 6", no dialog | "step 3" | E | 4 |
| Bot 4: logout, wrong password fails with message, clean context login, item still there | "step 4" | E | 1, 4 |
| Bot 5: second user can't see the item | "step 5" | E + P `01_core` | 2, 4 |
| Bot 6: every table from the migrations, publishable key, no session → 0 rows or a permission error (both pass; any row fails) | "step 6" | E | 2, 6 |
| Bot 7: repo public | "step 7" (deploy only) | E | 1 |
| No permission prompt on any bot page; manifest valid | "extras" | E | 9 |
| Clock past 19 Dec repeats 2–5 | "clock-shifted" | E | 4 |
| RLS on every table, B can't read/write A, anon gets nothing, cross-user FK insert fails; every definer function has `search_path=''` and no anon execute | `00_rls.sql`, `01_core.sql` | P | 2, 6 |
| `delete_my_account` empties every table for the caller only (PR 6 extends to all 12) | `02_delete_account.sql` | P | 2, 6 |
| Feed url unreadable by client select; `feed_url_for_sync` null for B and without login; `connect_feed` duplicate and bad input give fixed messages without the URL; 4th feed refused | `03_calendar.sql` | P | 6 |
| AI cap 10/day, not resettable, false without login, global ceiling | `04_ai_usage.sql` | P | 6 |
| One alert per night in the database | `05_alert_log.sql` | P | 6 |
| `log_skip` with a calendar: two saves the same day both succeed; links an unlinked class only | `01_core.sql` (PR 6 cases) | P | 6 |
| Lives = floor(20%), source order, estimated flag, missed before, x2 | `lives.test.ts` | U | 3 |
| Pace labels in order, burning-fast from week 4 with 2+ skips, attendance safe | `pace.test.ts` | U | 3 |
| Madrid today/tomorrow at 23:30 UTC and around 25 Oct and 28 Mar; weeks to go 0 after term | `dates.test.ts` | U | 3 |
| Near match ignores case/accents/spaces, exact match returns null | `match.test.ts` | U | 3 |
| Preview lines (new course, existing, last spare, out, over) match spec copy | `preview.test.ts` | U | 3 |
| Today/Tomorrow, Double, reset to Today+single after every save, planned hollow hearts | `e2e/core.spec.ts` "form" | E | 5 |
| Last-spare sheet only on planned saves; never on Today | `e2e/core.spec.ts` "last spare" | E | 5 |
| Chips, near match, space reserved (field and button don't move: bounding box before/after typing) | `e2e/core.spec.ts` "layout" | E | 5 |
| Undo 5 s, delete skip, cancel planned, remove course, failed save keeps text | `e2e/core.spec.ts` "undo/delete/offline" | E | 4, 5 |
| Course cards order, hearts, risk line, empty state | `e2e/core.spec.ts` "cards" | E | 4 |
| Inline row (sessions, missed before), Counting from today, over the limit | `e2e/core.spec.ts` "course row" | E | 5 |
| Settings: delete account signs out and data gone | `e2e/settings.spec.ts` | E | 5 |
| SSRF: http, port ≠ 443, userinfo, private v4, v6 outside 2000::/3, Teredo, 6to4, mapped v4, rebinding, redirect to private, >3 redirects, timeout, 2 MB cap, not-a-calendar; URL and headers never reach a log call | `safe-fetch.test.ts` | U | 6 |
| Parser: IE public fixture (196 events: kinds, doubles 1-2 and triple 12-14, async bare-date TZID, exam UID link, messy `| | , null` titles, distinct-number counts 30/25 and 30-not-33), RRULE/EXDATE/RECURRENCE-ID, Windows TZ, clocks 25 Oct | `parse.test.ts`, `classify.test.ts` | U | 6 |
| Sync: upsert by UID, moved class keeps skip, cancelled releases planned + notice, glitch guard 30%, two concurrent syncs no duplicates, personal events not stored, exam slot, session recount, `last_error` only fixed strings, admin sync of A leaves B's rows byte-identical, cron `getUrl` path works | `tests/integration/sync.test.ts` | I | 6 |
| Connect, mapping (confirm, link, ignore), last synced, failed banner, url never shown again: after connect no request URL and no page HTML contains the feed link, input cleared | `e2e/calendar.spec.ts` "connect" (seeded rows) | E | 7 |
| Today toggles, weekly check from Sunday + All good, attendance safe, past courses | `e2e/calendar.spec.ts` "today" | E | 7 |
| Can I skip this week, trip check + save trip, if you have to miss one (no test days, no exam slots, no last life, "Mark test days first"), dedupe across two calendars | `week.test.ts` + `e2e/plan.spec.ts` | U + E | 7 |
| Manual test marks by date (no calendar) and on a class | `e2e/plan.spec.ts` "tests" | E | 7 |
| Syllabus route: 401 without login, 429 on the 11th, invalid output retried once then 422, no write | `tests/integration/syllabus.test.ts` (Gemini mocked) | I | 8 |
| Import paste + PDF, review confirm line by line, re-import diff, pdf.js not in `/app` chunks | `e2e/syllabus.spec.ts` (route intercepted) + C | E + C | 8 |
| Preview names tests, participation line, exam prep, countdown, "probably" | `preview.test.ts` (syllabus cases) + `e2e/syllabus.spec.ts` | U + E | 8 |
| Alert rule: last life, out, test, planned, nothing on a no-risk night, no calendar case | `alert.test.ts` | U | 9 |
| Push endpoints: non-push-service host rejected on save and on send, 5 s timeout, at most 5 sends per user | `push.test.ts` | U | 9 |
| Cron: 401 without or with a wrong secret, 500 when `CRON_SECRET` unset or short, Madrid-hour gate, one push per night, 410/404 delete subscription, per-user time budget, re-sync really refreshes (not "as of"), push mocked | `tests/integration/cron.test.ts` | I | 9 |
| Turn on alerts asks only after the tap, subscription saved, iPhone help text | `e2e/alerts.spec.ts` | E | 9 |
| Secret confinement (grep scoped to `src/`), no `calendar_feeds` select of `*`/`url`, errors logged as codes only, no localStorage, no test hooks, testids | `contract-check.mjs` | C | 1, 6, 8, 9 |
| 375px no scroll, 44px targets, axe on every page | `e2e/ui.spec.ts` | E | 1, each UI PR adds its page |

## 7. CI jobs
As process 5.3 (static, hygiene, unit, contract, secrets, alerts, ui, db + bot-sim), with these specifics:
- `db + bot-sim` also runs the `I` tests (vitest `tests/integration`) after `supabase test db`, with the local keys from `supabase status -o env` exported only into that step. E2E seed helpers (`e2e/helpers/seed.ts`) use the local secret key to insert calendar rows for a test user; that file lives outside `src/` and the contract check fails if `src/` imports it.
- The `alerts` job of 5.3 is not separate: its tests live in `unit` (`alert.test.ts`) and `db + bot-sim` (`cron.test.ts`, `05_alert_log.sql`). One fewer job, same proof.
- Concurrency group per branch with cancel-in-progress, so a re-push doesn't queue behind its own old run.
- Locally, implementers run `npm run check` (lint, types, unit, contract). Only PRs 2 and 6 run local Supabase; the other worktrees rely on CI for db + e2e, so parallel worktrees don't fight over one Docker database.

## 8. PR list, lanes and timing (lean, Irakli 16:12 UTC)
Irakli chose "Go lean". So: 8 PRs after PR 1, each one concern, bigger than the 300-line guide where splitting would only add merges. Every PR gets full CI (static, hygiene, unit, contract, secrets, ui, db + bot-sim). A fresh agent code + security review runs only on the four risk areas (marked "Rev"): auth/RLS, the calendar fetcher, the AI route, the cron job with the secret key. Then one full code and security review of the whole diff since PR 1 in the production-check window (18:25–18:50 UTC), before go-live.
Build window 17:00–18:25 UTC (19:00–20:25 Madrid), 85 minutes. Budget = implement + local check + CI (+ review and one fix round where marked), wall-clock, before Irakli's merge click.

| PR | Title | Lane | Needs merged | Budget | Rev | Contents (brief has the detail) |
|---|---|---|---|---|---|---|
| 1 | chore: scaffold app from template with CI and grading checks | setup | — | in progress | yes | template, auth, CI, contract check, bot-sim skeleton |
| 2 | feat(db): core tables, RLS and account deletion | DB | 1 | 25 | yes | `_core.sql` (courses, skips, `log_skip`, `delete_my_account`), pgTAP 00–02 |
| 3 | feat: lives, pace and Madrid date rules | rules | 1 | 25 | no | `src/lib/rules/{dates,lives,match,preview}.ts` + unit tests |
| 4 | feat: landing page and log a skip | core | 2, 3 | 45 | no (CI + bot sim prove it) | `/` + `/app`: form, Recent skips (`core-item`), course cards, hearts, preview, risk line, undo, empty/error states; app layout with header `logout` and tabs Home / Settings; Settings page shell |
| 5 | feat: planned skips, course page and account deletion | core | 4 | 40 | no | Tomorrow, Double, chips, near match, last-spare sheet, course page (sessions, missed before, remove, delete/cancel skip), delete account in Settings |
| 6 | feat: calendar data, fetch, parse and sync | calendar | 2 | 50 | yes | `_features.sql` (10 tables, 3 functions, `log_skip` linking) + pgTAP 03–05, safe fetcher, ical.js parser, IE classifier + public fixture, `syncFeed`, `POST /api/calendar/sync` |
| 7 | feat: calendar screens and plan tab | calendar | 3, 5, 6 | 45 | no (assertions added, named in the whole-app review) | `week.ts`, connect + mapping, sync status and notices, Today, weekly check, attendance safe, past courses, test marks, Plan tab (adds the tab) |
| 8 | feat: syllabus import | syllabus | 3, 5, 6 | 45 | yes (route) | `POST /api/syllabus/read` (Gemini, cap, retry), import + review + re-import diff, test names in preview, exam prep, countdown |
| 9 | feat: night-before alerts | alerts | 3, 4, 6 | 40 | yes | `alert.ts`, manifest, service worker, Turn on alerts, subscriptions, cron route, push host allowlist, `vercel.json` crons |

Lanes and order:
- 17:00, 7 implementers at once: 2; 3; 4 (stacked on 2 + 3); 6 (stacked on 2); 7, 8 and 9 (stacked on 6, building their server and data parts first). Stacked means the implementer branches from its parent's branch, builds against the interfaces fixed in section 5, and opens against `main` once the parents merge, rebasing its UI onto 4 or 5 at that point. 5 starts when 4 opens its PR (about 17:40).
- Merge order: 2, 3, 4, 6, 5, then 7, 8, 9 as they go green. Only 2 and 6 touch `supabase/migrations/`, and 6 merges after 2. `src/app/app/page.tsx` is touched by 4, 5 and 7, in that order; `layout.tsx` and the Settings page by 4, then 5, 7 and 9 (one row each).
- The graded path is 1, 2, 3, 4: no calendar, syllabus or alert code on it. It is first in every queue and should be merged and bot-simmed on production by about 17:50 (19:50 Madrid).
- Whatever misses the 18:25 cutoff stays unmerged and invisible: each lane's entry point (Plan tab, calendar row, import button, Turn on alerts) is inside that lane's own PR.

Honest timing:
- Sum of budgets after PR 1: 315 implementer-minutes, about 4 full-time implementers over 85 minutes; peak 7 at once at 17:00, then 5–6. Critical path 2 → 4 → 5 → 7: 25 + 45 + 40, with 7's UI rebase last. Stacking brings the last merges to about 18:15–18:25. It fits, with no slack.
- The plan was ready at 16:20 UTC. If it is signed off and production is wired by about 16:40, the build starts then instead of 17:00, which buys about 20 minutes of slack against the 18:25 cutoff.
- If only 3–4 run at once on the Mac, the last lane PRs (7, 8 or 9) land about 18:45–19:00 (20:45–21:00 Madrid), in the fix window.
- Compared with a 19-PR split, lean removes about 11 merges, 15 agent reviews and most of the CI queueing, so GitHub's 20 concurrent jobs and Irakli's merge clicks stop being bottlenecks.

## 9. Spike results to fold in
- S1 (landed, 16:11 UTC): UIDs stable (208/209, the other is the meta event), so events match by UID. Async sessions continue the course's numbering, so counting distinct numbers is right. Course key = UID course part. Exams have no number, link by UID, and cover the course's last session. No VTIMEZONE, no RRULE; async events put TZID on a bare date without `VALUE=DATE`, so the parser must accept that as an all-day date. Every sync downloads the whole feed (no ETag). Fixture: the Mac session copies `~/code/faltas-research/fixture-public.ics` (renamed courses, fake rooms and UIDs) into `src/lib/calendar/__fixtures__/ie-public.ics` in PR 6. Never `ie-feed*.ics` or `fixture-synthetic.ics`. Still untested: a rescheduled session keeping its UID, and the 25 Oct clock change.
- S2 (waits on G4): sets `GEMINI_MODEL` and the response schema's field list. If no key by 17:35, PR 8 still merges with a mocked test, and the import stays hidden in production until the key is set (spec: "Without a key the import is hidden").

## 10. What is still weak
- The 85-minute window needs 7 implementers at once at 17:00 with stacked branches (section 8). That has never been run on Irakli's Mac.
- Lean reviews: PRs 3, 4, 5 and 7 get no agent review before merge, only CI and the bot sim; the whole-app review at 18:25 is their first read. PR 7 handles the feed link in a form; its brief and e2e pin the risky parts (POST only, never echoed), and the whole-app review checks it by name.
- Up to 3 calendars per student and a 4-second per-user cron budget keep one student from starving the nightly job; at hundreds of users with alerts on, 60 s won't cover everyone (no queue in v1).
- The global AI ceiling (300 reads a day) is a guess at the free tier; S2 or the first day's usage should set it.
- `ical.js` handles RRULE/EXDATE/VTIMEZONE, but feeds without VTIMEZONE (IE's) and Windows zone names need our own mapping; tested on the IE fixture plus one synthetic Google and one Outlook sample, not real ones.
- The nightly job's first real run is after the deadline; it is proven only by calling the route in tests.
- Vercel's servers fetching `ie-lti-icalfeedultra.ie.edu` is untested until the first production deploy check (process 6.3).
- A shared device keeps a push subscription for each user who turned alerts on there (unique per user and endpoint). Logout doesn't unsubscribe in v1.

## 11. Panel fix round (one round, 16:15–16:20 UTC)
Architecture (FIX) and Security (FIX) reviews are in `docs/reviews/plan-architecture.md` and `plan-security.md`. All findings applied except:
- Architecture 5 "cut `connect_feed`": kept, because Security 6 needs it. It validates before inserting and uses `on conflict do nothing`, so no Postgres error ever carries the feed URL into logs.
- Security 5 "one calendar per student": kept up to 3 (the spec's "same class in two calendars" case), with the per-user cron time budget doing the protecting.
Main changes: the second migration moved from PR 2 to PR 6, so the graded path (PR 2) is only two tables; `week.ts` moved to PR 7 and `alert.ts` to PR 9; lane PRs list their real UI dependencies (4 or 5); the cron reads the feed link through a `getUrl` parameter instead of the user-only function; `log_skip` links only unlinked classes; `ping()`, `room` and `label` cut; push host allowlist, `CRON_SECRET` fail-closed, per-user cron budget, global AI ceiling, IPv6 allow-list, and the test-map gaps both reviewers named.
