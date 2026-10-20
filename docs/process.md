# App delivery pipeline (v1, reusable)

Status: draft for Irakli's sign-off. Owner: the "Delivery pipeline" thread.
First app: Leeway (EdTech Challenge). Written so the same file works for the next app by changing section 1 only.

## 0. The whole thing in six lines
1. Five stages: Spec, Design, Tech plan, Build, Deploy. Nothing ships until the stage before it is signed off. Under a deadline, a stage may start early on the previous stage's recommended defaults (section 8), and it gets re-checked against the signed-off version before its own sign-off.
2. Every stage ends the same way: a panel of 3 fresh reviewer agents (one job each, none wrote the work), one fix round, a report of 40 lines or less, then Irakli's sign-off in words.
3. Thinking work (spec, design, plan, briefs, reviews of documents) happens in the cloud project threads. Anything that installs, builds, tests or touches git happens on Irakli's Mac in ~/code through Remote Control.
4. Everything that can be checked by a script is checked by a script or CI, not by an agent. Agents review only what needs judgment.
5. Code lands as small PRs (one brief each). CI must be green and a fresh code review done (plus a security review when the PR touches auth, data or secrets) before Irakli merges.
6. Nothing is installed, deployed, made public or paid for until Irakli says so in words. Section 9 lists every one of those "go" points.

## 1. Parameters (change these per app)
| Name | Leeway value |
|---|---|
| APP | Leeway |
| DEADLINE | 19:15 UTC (21:15 Madrid), 2026-10-20: everything well built, no cuts for time (section 8) |
| CONTRACT | Grading contract in `CLAUDE.md` (from the brief, never edited) |
| RUBRIC | Brief's 4 criteria: problem 20%, 5-second 20%, sign-up 30%, works 30% |
| SPEC | Claude Doc product spec v1 (https://claude.ai/code/artifact/9ad1976a-eda3-4ea8-818c-bd4f295dccf9) |
| MAC_DIR | `/Users/iraklisulamanidze/code/leeway` (new folder; old prototype is throwaway) |
| TEMPLATE | `~/code/app-template` (Irakli's own: Next 16, Supabase, Tailwind, Vitest, Playwright, `npm run check`, `scripts/new-app.sh`) |
| REPO | https://github.com/IrakliSulamanidze/leeway (to be created private with docs only, Irakli's choice; must be public before submission) |
| STACK | Next.js App Router, Supabase (Auth + Postgres + RLS), Vercel Hobby, GitHub Actions. Stripe only when an app charges money. |

## 2. Who does what
| Actor | Does | Never does |
|---|---|---|
| Irakli | Decides forks, signs off each stage, gives every "go", clicks in Supabase/Vercel/GitHub dashboards, merges PRs | Gets asked open-ended questions; every ask is one word with options |
| Project chat (coordinator) | Routes asks to threads, keeps memory | Does the work |
| Stage thread (cloud) | Writes the stage artifact, runs the reviewer panel, applies the fix round, writes the report | Installs, builds, runs git |
| Reviewer subagent (cloud or Mac) | One job from section 4, reads only the artifact + its checklist, writes a review file | Edits the work; sees the author's conversation |
| Mac build session (Remote Control, MAC_DIR) | Implements one PR brief at a time, runs local checks, opens PRs, runs code reviews as fresh processes | Merges, deploys, pushes to main, edits migrations already applied in prod |
| Scripts + CI (GitHub Actions) | Lint, types, unit, RLS tests, contract check, secret scan, grading-bot simulation | Anything needing judgment |

## 3. Stages and gates
| # | Stage | Output (frozen at sign-off) | Panel (section 4) | Gate |
|---|---|---|---|---|
| 1 | Spec | Claude Doc + `docs/spec.md` snapshot | Rubric grader, harsh product critic, scope cutter | Irakli: "spec signed off" |
| 2 | Design | Design system (tokens), wireframes of `/`, `/signup`, `/login`, `/app`, hi-fi HTML mockups (phone + laptop) of `/` and `/app`, copy deck. As artifacts + `docs/design.md` + `docs/tokens.css` | 5-second stranger, visual design critic | "design signed off" |
| 3 | Tech plan | `docs/tech-plan.md`: data model, migrations, RLS policies, a table mapping each bot step and spec feature to its automated test, CI jobs, ordered PR list with one brief per PR | Architecture, security (RLS + secrets) | "plan signed off" + "go install" |
| 4 | Build | One PR per brief, merged to `main` | Per PR: CI + code review + security review when needed (section 5) | Irakli merges each PR |
| 5 | Deploy | Live URL, public repo, Socratista text | Grading-bot sim on prod + 5-second stranger on prod | "go deploy", then "go submit" |

Snapshot rule: at each sign-off the artifact is copied into the repo's `docs/` (or `/mnt/project-files/<app>/docs/` before the repo exists), so every later session and reviewer reads the same frozen version. Changing a signed-off stage later means a short change note in `docs/changes.md` and Irakli's OK, not a silent edit.

## 4. Reviewer panels
How a panel runs (identical every stage):
1. The stage thread starts the stage's reviewer subagents (2 or 3) in parallel. Each gets: the frozen artifact, the CONTRACT, the RUBRIC, and its own checklist below. Nothing else.
2. Each writes `docs/reviews/<stage>-<role>.md` using template R (section 10). Verdict is one of: PASS, FIX (listed fixes, then pass), BLOCK (a problem that changes the stage's direction).
3. The author applies one fix round for every FIX item it agrees with, and writes one line per item it rejects and why.
4. The thread writes report S (section 10, 40 lines or less) to Irakli: decisions he must make first, then what changed, then what is still weak.
5. No second panel. A BLOCK goes straight to Irakli as a decision.

Checklists (one job each):
- **Spec / Rubric grader:** scores each rubric criterion 25/50/75/100 with the reason, and names the cheapest change that lifts the lowest one.
- **Spec / Harsh critic:** would a real IE student use this weekly over Blackboard? Weakest assumption, and what would kill it.
- **Spec / Release-order and bot-path checker:** checks the build order follows dependencies (the core bot path is built and green first, even though everything ships in one release), and that typing only in `core-input` and one tap on `core-submit` saves exactly one item with no dialog in the way. It never cuts scope; that is Irakli's call.
- **Design / 5-second stranger:** gets only the landing mockup, as a phone screenshot plus its page text with no styling (the AI visitor most likely reads text, not pixels). Writes what it does, who it is for, what to click. Compared with the one-liner. Fails if any of the three is wrong. The problem, audience and button must be real server-rendered text, never inside an image.
- **Design / Visual critic:** does it look like a product a student would trust, is it consistent across screens, is anything confusing on a phone. Mechanical checks (375px no horizontal scroll, tap targets, WCAG AA contrast, only token values) are not its job: they run as scripts on the mockups now and in CI on the real pages later (5.3).
- **Plan / Architecture:** simplest data model that covers the signed-off spec; no table, route or package without a spec reason.
- **Plan / Security:** RLS on every table; policies `to authenticated` with `user_id = auth.uid()` in both `using` and `with check`; `user_id` defaults to `auth.uid()` (so typing only in `core-input` saves); anon reads nothing; only public keys reach the browser; no service-role key anywhere. Also: SSRF in any server fetch (https only, redirects re-checked, private IPs blocked after DNS resolve, time and size caps); `delete_my_account` removes every row; per-user AI caps can't be reset by the user (select-only grant, counted in a security-definer function, pgTAP proves delete/update denied); AI output is structured and confirmed by the user before saving; client queries never select secret columns such as the calendar feed URL; every new table is covered by sim step 6. Night-before alerts: the cron route rejects any request without `Authorization: Bearer $CRON_SECRET`; the secret key stays in that one route and the job only reads what it needs (subscriptions, tomorrow's sessions, lives); `push_subscriptions` is own-row RLS; a dead subscription (404/410 from the push service) is deleted; at most one push per user per night, enforced in the database, not just in code; the notification permission is requested only after the user taps "Turn on alerts". Checks the plan's test-mapping table has no gaps and every PR brief has a script-checkable "done when".

## 5. Build stage in detail
### 5.1 One-time setup (PR 1, after "go install")
Start from Irakli's existing template, not from scratch. The REPO already exists (docs only), so PR 1 copies the template's files into it (a clone of `~/code/app-template` without its `.git`, then `npm install`) instead of running `new-app.sh`, which would create a second repo. The template already gives `npm run check` (typecheck, lint, unit, 40-line output), Playwright, Vitest, a migration folder and an RLS example.
PR 1 then adapts the template to the CONTRACT and adds what it lacks:
- `CLAUDE.md`: the contract block from the brief, word for word, then the template's notes. The old prototype's "Project notes" (plain CSS, `schema.sql`, `absences` table) are not carried over, so no session follows them.
- Switch login from magic link to email + password; `/signup` page; redirect to `/app` after both.
- Remove the waitlist form, its table and the Stripe routes (a waitlist button competes with the one sign-up button, the waitlist table takes anonymous inserts, and Leeway charges nothing).
- Add `.github/workflows/ci.yml` (the template has no CI), `.github/pull_request_template.md`, `scripts/contract-check.mjs`, `e2e/grading-bot.spec.ts`, `supabase/tests/`, `docs/`.
- Extend `scripts/check.sh` with the contract check, so `npm run check` stays the one local command.
- Make the repo public on his go (G1), then turn on protection and secret scanning (the same `gh api` calls as `new-app.sh`): the brief needs a public repo anyway, and on the free GitHub plan both only work on public repos. While it stays private, CI still runs (2,000 free minutes a month) and the local guard hook blocks force-push. Protection on `main`: PR required, no force-push; CI required once it has passed once.
- New packages and tools (each needs his go): dev package `@axe-core/playwright`; `supabase` CLI and `gitleaks` via Homebrew, and Docker Desktop for local Supabase, if missing.

### 5.2 The loop for each PR
1. The plan's next brief (template B) is in `docs/briefs/PR-<n>.md`. Target: under ~300 changed lines, one concern.
2. The Mac build session (the orchestrator) starts a fresh implementer process: `claude -p "Implement docs/briefs/PR-<n>.md" --max-turns 60 --max-budget-usd 8`. It reads only the brief, CLAUDE.md, the spec and design snapshots, and the files the brief names. A separate process, not a subagent, so the caps actually apply.
3. Implementer works on branch `feat/<slug>` (or `fix/`, `chore/`, `ci/`, `test/`, `docs/`) until `npm run check` passes locally (lint, types, unit, contract check, local Supabase + RLS tests, grading-bot sim).
4. The session pushes and opens the PR with the template filled in (what changed, screenshots from Playwright at phone and laptop size, how it was tested).
5. Reviews as fresh headless processes, never the session that wrote the code:
   - Every PR: `claude -p "/code-review medium --comment" --max-turns 30 --max-budget-usd 3 --allowedTools "Read,Grep,Glob,Bash(git diff:*),Bash(git log:*),Bash(gh pr:*)"`. Without `--allowedTools`, headless mode denies `gh` and `git` and the review silently does nothing; without `--comment`, nothing reaches the PR.
   - The code-review prompt carries one extra lens, repo hygiene: anything in the title, body, commit messages or code comments that reads as generated (see 5.7). Same process, no extra agent.
   - When the PR touches `proxy.ts` (Next 16's middleware, either `src/` or root), auth pages, `supabase/`, env handling or API routes: the same with `/security-review`, written to `docs/reviews/PR-<n>-security.md` and posted with `gh pr comment --body-file`.
6. One fix round on the same branch. CI re-runs.
7. The thread sends Irakli one line per PR: link, CI state, review verdicts, anything he must decide. He merges with squash, or says "merge" and the session merges.
8. Two PRs in a row with BLOCK findings stops the queue and goes back to the tech plan.

### 5.3 CI (GitHub Actions, every PR and every push to main)
| Job | What it proves | Tool |
|---|---|---|
| static | format, lint, typecheck and build pass | prettier --check, eslint --max-warnings 0, tsc, next build |
| hygiene | PR title and every commit subject follow 5.7; no emoji; no `console.log`, `debugger` or `TODO` left in `src/` | `scripts/hygiene-check.mjs` + eslint `no-console` |
| unit | pure logic (lives, pace labels, dates) is right | vitest |
| contract | all 10 testids present by name (`signup-email`, `signup-password`, `signup-submit`, `login-email`, `login-password`, `login-submit`, `logout`, `core-input`, `core-submit`, `core-item`); `core-input` is text; no localStorage for user data; `proxy.ts` is where Next loads it | `scripts/contract-check.mjs` |
| secrets | no `sb_secret_`, `service_role` or API keys in git history or in the client bundle (`.next/static`) | gitleaks action (checkout with `fetch-depth: 0`) + grep on build output |
| alerts | the "tomorrow carries a risk" rule (Madrid time, around the 25 Oct clock change); cron route returns 401 without the secret; one push per night per user; 410 deletes the subscription; push sending mocked | vitest + pgTAP |
| ui | 375px: no horizontal scroll, tap targets 44px+; axe-core finds no contrast or label errors | Playwright + `@axe-core/playwright` |
| db + bot-sim (one job) | migrations apply from zero; pgTAP: every public table has `relrowsecurity` on, user B can't see A, anon gets nothing; then the grading steps end to end (5.4) | `supabase start -x studio,imgproxy,inbucket`, `supabase db reset`, `supabase test db`, Playwright vs `next start` |

Only the last job starts a local Supabase in Docker inside the runner (one start, not two). Its keys are read at runtime with `supabase status -o env`, never written into a file, so CI needs no secrets and never touches production. The CI check is marked required on `main` only after it has passed once.

### 5.4 Grading-bot simulation (`e2e/grading-bot.spec.ts`)
One Playwright file that copies the brief's 7 steps, runnable against any URL with `BASE_URL`:
1. Open `/` at laptop (1280px) and phone (iPhone 13) sizes, save screenshots, assert one signup button and no horizontal scroll on the phone.
   Logged out, `/app` must redirect to `/login`.
2. Sign up a fresh random email at `/signup`, expect redirect to `/app`. `logout` must be visible on `/app` and on `/`.
3. Type `QA-<random> grading bot test` into `core-input`, click `core-submit`, expect a `core-item` with that text.
4. Click `logout`; in a new clean browser context try a wrong password (must fail), then the right one; the item is still there.
5. Sign up a second user; that item is not visible.
6. Call the Supabase REST endpoint for every table (the list is read from the migrations, so new tables are covered) with only the publishable key and no session; expect zero rows.
7. Check the repo URL returns public (`gh api repos/<REPO>`; deploy stage only).
Extra assertions: no browser permission prompt fires on any page the bot visits (alerts ask only after the "Turn on alerts" tap); `/manifest.webmanifest` is valid. Step 3 adds exactly one new `core-item` and shows "5 of 6". A second run sets the browser clock past the term end (19 Dec) and repeats steps 2–5. Calendar tests inject a fixture fetcher (the SSRF guard blocks localhost); the contract check fails if that test hook is present in the production build.
Fair-play rule: the app must never detect or special-case test accounts. The sim only uses the public UI and public API.

### 5.5 Database and secrets
- Schema changes only as new files from `supabase migration new <name>`. Applied migrations are never edited.
- Local and CI use the local Supabase keys from `supabase status -o env`, read at runtime and never committed (they include a demo service-role key). `.env.local` stays gitignored.
- Production env vars in Vercel, Production scope only. Browser: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, nothing else. Plus `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (public by design). Server-only: `SITE_URL` (renamed from the template's `NEXT_PUBLIC_SITE_URL`, set after the first deploy, then redeploy), `GEMINI_API_KEY` (G4), `VAPID_PRIVATE_KEY`, `CRON_SECRET`, and `SUPABASE_SECRET_KEY` (G7).
- The secret key exists only for the nightly alert job. It is read in one `server-only` module imported only by `app/api/cron/`; the contract check fails if any other file references it, and the bundle grep fails if it reaches `.next/static`. VAPID keys are generated once with `web-push generate-vapid-keys` on the Mac and pasted into Vercel, never written to a file in the repo. The Stripe names are deleted from `.env.example` in PR 1. The secret key is never copied anywhere.
- Schema: `supabase link` + `supabase db push` to production as migration PRs merge, on Irakli's "go migrate" (one go covers the build window). Migrations stay additive only (no drops, renames or type changes), so a hotfix after go-live never needs a destructive change.
- Fixtures are synthetic: S1 turns the real feed into a sanitized fixture (fake UIDs, no URL or X-WR properties, no personal events). gitleaks gets a custom rule for `ie-lti-icalfeedultra.ie.edu`, so a real feed link can never be committed.

### 5.6 No staging: production is the rehearsal target until Irakli shares the link
Irakli's call (2026-10-20): no staging project. Nobody uses the app until he shares the link, so production stays private by obscurity until then.
- Production is wired up early (prod Supabase + Vercel, after "go deploy"), and every merge to `main` deploys to it.
- After each deploy the bot sim runs against the production URL. On failure, Vercel Instant Rollback goes back to the last green deployment, and the fix comes as a normal PR.
- `vercel.json` sets `git.deploymentEnabled` so only `main` deploys; no previews, so feature branches never reach the production database.
- Bot-sim test accounts pile up in production Auth during the build. They are harmless and are treated like any other user (fair play); Irakli can delete them in the dashboard before sharing.
- "Go-live" means Irakli shares the link and submits. That happens only after a full green sim run on the final commit.

## 6. Deploy stage
Each line is a "go" point; the Mac session prepares, Irakli clicks or confirms.
1. Create the production Supabase project (EU region), turn "Confirm email" OFF, copy URL + publishable key. After the first deploy, set Authentication > URL Configuration: Site URL = the short Vercel link, and add it under Redirect URLs (brief step 6.5).
2. `supabase link` and `supabase db push`.
3. Import the repo in Vercel under the project name from G5 (so the short `<name>.vercel.app` link is right) early in the build, with env vars on Production only (5.5). Every merge to `main` deploys; add `SITE_URL` after the first deploy and redeploy. On the first deploy, a one-route check confirms Vercel's servers can fetch the IE calendar host, before the calendar PRs build on it.
4. Run `BASE_URL=<prod url> npx playwright test e2e/grading-bot.spec.ts`, then the 5-second stranger on the live landing page: a phone screenshot plus the page text fetched with `curl` (no JavaScript).
5. Confirm the repo is public; step 7 of the sim checks it.
6. Draft the Socratista text from the spec one-liner so it matches what the landing page says.
7. Keep-alive: the free Supabase plan pauses projects after about a week without activity, which would break grading. A twice-weekly GitHub Actions cron calls `<SUPABASE_URL>/auth/v1/health` and a `ping()` security-definer function granted to anon (an anon table read returns nothing under RLS and may not count). Irakli also opens the app every few days. GitHub turns off scheduled workflows after 60 days without repo activity, which is longer than the grading window should need ($0).
8. Hard freeze from 19:15 UTC until grades are published: no pushes, no redeploys, no Vercel or Supabase changes (the brief says "Don't push changes").

## 7. Cost (estimates, not measured yet)
Model prices used (Anthropic's price table, October 2026): Opus 5.5 $4 in / $20 out per million tokens; Sonnet 5.5 $2 / $10. If Irakli is on a Claude subscription these become usage-limit share, not dollars.
| Part | Estimate | Cap |
|---|---|---|
| Reviewer subagent (document) | $0.50–1.50 each, about $2–5 per panel | the panel stops and reports if a stage's reviews pass $6 |
| Implementer per PR | $2–6 | `--max-turns 60 --max-budget-usd 8` |
| Code review / security review per PR | $1–2 each | `--max-budget-usd 3` each |
| Whole pipeline, about 15–20 PRs across three releases | about $120–200 | stop and report if a stage runs 50% over its estimate |
| GitHub Actions | $0 (free for public repos) | — |
| Vercel Hobby, Supabase free | $0 | — |
Real numbers: `~/code/scripts/session-cost.py` already measures a session's cost from its transcript; run it after the first panel and the first PR and replace these estimates. (Its prices are Opus 5 rates, $5/$25, a little above Opus 5.5.)
Ladder check: everything a script can do is a script (contract, secrets, bot sim). Only judgment work uses a model.

## 8. Speed: parallel, not cut
Irakli's rule: never cut quality or scope for time; he decides any cut. Speed comes from three things:
- **Overlap stages that don't depend on each other.** Once the spec is locked, Design and Tech plan run at the same time in two cloud threads. Their panels run in parallel too. Only the UI PRs wait for design tokens.
- **Pre-stage the Mac.** PR 1 (template copy, CI, contract check, bot-sim skeleton, local Supabase) needs no product decisions, so it starts as soon as Irakli says "go install", while Design and Plan are still running.
- **Parallel PRs.** The Mac session runs independent PR briefs at the same time, each as its own `claude -p` implementer in a separate `git worktree`, each with its own caps. PRs touching the same files (the migrations, `proxy.ts`) are ordered, never parallel.
Gates, panels, CI and the bot sim are never skipped. The whole app is one release (Irakli's choice), shared once at the end. PRs stay small and merge to `main` continuously, `main` deploys to production straight away (5.6), and the bot sim runs there after every deploy, so problems show up hours before the link is shared.
Server-only secrets: Release 3's AI key and the calendar fetcher run server-side only. The AI key is a Vercel env var without the `NEXT_PUBLIC_` prefix, Production scope, and never in git or the browser bundle (the secrets CI job checks this).

## 8b. Leeway timeline (deadline 19:15 UTC, 21:15 Madrid, 2026-10-20)
| UTC | Cloud threads | Mac | Irakli |
|---|---|---|---|
| 15:20–15:35 | Design + Tech plan start on the spec's recommended defaults | repo push; PR 1 pre-stage | "create it", "go install" |
| 15:35–16:25 | Design (tokens, mockups) and Tech plan (data model, RLS, every PR with a minute budget and dependency lane), panels in parallel | PR 1 CI green; spikes S1 (feed re-fetch + parser, sanitized fixture) and S2 (one Gemini read) | Blackboard onboarding screenshots; G4 Gemini key; G5 project name |
| 16:25–16:45 | re-check design + plan against the signed-off spec | wire production: prod Supabase, Vercel, URL config, Vercel fetch check, first bot sim on the PR 1 shell | sign off spec, design + plan (one message); "go deploy", "go migrate" + dashboard clicks |
| 16:45–18:15 | design fixes as needed | all PRs in parallel lanes, core bot path first; alerts lane (manifest + service worker, subscriptions table, cron route) runs beside the calendar lane and starts its cron PR once calendar sync merges; each merge deploys and re-runs the bot sim on prod | merge PRs as they go green; G7 |
| 18:15 | — | merge cutoff. A PR not green by now stays unmerged | — |
| 18:15–18:45 | 5-second stranger on prod, Socratista text | full prod sim + clock-shifted run, security review of the whole diff since PR 1 | — |
| 18:45–19:15 | — | fix window: fix PR, deploy, sim; Instant Rollback if needed; repo public | share the link, "go submit" by 19:10 |
From 19:15: hard freeze (6.8).

## 9. Decisions and "go" points for Irakli
| ID | Decision | Recommendation |
|---|---|---|
| D1 | The deadline | **given: 19:15 UTC 2026-10-20** (8b) |
| D2 | Sign off this process | yes, after reviewer fixes |
| D3 | Staging | **off**, Irakli's call: production is the rehearsal target until he shares the link (5.6) |
| D4 | Who merges | **Irakli clicks merge** (he sees every change) |
| G1 | Copy the template into REPO + `npm install`, add `@axe-core/playwright`, install Supabase CLI/gitleaks/Docker if missing, make REPO public (recommended now, at the latest before submission) | at plan sign-off |
| G2 | Create prod Supabase project + Vercel link + deploy | at deploy |
| G3 | Submit to Socratista | at deploy |
| G4 | Gemini API key from AI Studio (server-only, for spike S2 and Release 3) | before 16:25 |
| G5 | Vercel project name (decides the short link; `leeway` is a common word and may be taken, fallback `leeway-ie`) | before 17:35 |
| G6 | "go migrate" on production (covers the build window) | 16:25 |
| G7 | Paste `SUPABASE_SECRET_KEY`, `VAPID_PRIVATE_KEY` and `CRON_SECRET` into Vercel (Production, server); add `web-push` package | before the cron PR, about 17:30 |

## 10. Templates
**R — review file (40 lines max)**
```
Stage / Role / Artifact version:
Verdict: PASS | FIX | BLOCK
Findings (most severe first): [severity] what is wrong — evidence (quote, file:line, screenshot) — smallest fix
What is good and must not change:
```
**S — stage report to Irakli (40 lines max)**
```
Decide first: (one-word questions, options one per line, recommendation marked)
Changed in the fix round:
Rejected review items and why:
Still weak:
Cost so far vs estimate:
```
**B — PR brief**
```
PR <n>: <title>
Goal (one sentence) / Spec + design refs / Files to touch / Out of scope
Done when: (script-checkable: tests named, commands that must pass)
Risk: (auth, RLS, data? -> security review yes/no)
```

## 11. Reusing this for the next app
Copy this file, change section 1, keep everything else. After Leeway ships, the generic parts (CI workflow, email + password auth option, contract-check pattern, bot-sim pattern, PR template) go back into `app-template` as one PR, so the next `new-app.sh` starts with them. The contract check and bot sim are written against the CONTRACT, so for apps without the EdTech contract, step 5.4 becomes "the app's core user journey" and the contract job checks that app's own rules. Once this has run once end to end, it should become a skill in ~/code next to /ship-app, with measured costs replacing section 7's estimates.

## 12. What is still weak in this plan
- Costs are estimates; the first panel and first PR will give real numbers and section 7 gets updated.
- Checked against `~/code/app-template` and `~/code/scripts`, but not against the user-level skills (/app-idea, /ship-app, /lean-check) and hooks: they live in `~/.claude`, which this thread can't open. The Mac session reads /ship-app as its first step of the build and reuses whatever overlaps with section 5.
- Local Supabase needs Docker on the Mac; if he doesn't want Docker, CI still works, but local runs would need a hosted dev project.
- Night-before alerts use Vercel Cron, chosen over pg_cron + an Edge Function so the calendar re-sync reuses the app's SSRF-guarded fetcher instead of a second copy in Deno. Hobby cron runs once a day and only within its scheduled hour, and the schedule is UTC: `0 19 * * *` is 21:00 Madrid until 25 Oct, then 20:00. The fix is moving it to `0 20 * * *` on 25 Oct. The job can't be fully tested by the 19:15 deadline, because the first real night run is after it; tests call the route directly.
- iPhone push needs Add to Home Screen on iOS 16.4+, so many iPhone users won't get alerts until they install it.
- Parallel PRs run as separate `claude -p` processes in git worktrees inside one Remote Control session; the Mac's CPU and Docker (one local Supabase per CI run, not per worktree locally) are the limit, and that is untested so far.
- With no staging, a bad merge breaks production until rollback. That's acceptable only because nobody uses the app until Irakli shares it, so the bot sim after every deploy has to stay on.
- About 100 minutes of build time for the whole app, calendar and syllabus included. Nothing half-done merges at the 18:15 cutoff.
