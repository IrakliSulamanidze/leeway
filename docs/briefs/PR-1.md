PR 1: chore: scaffold app from template with CI and grading checks
Status: in progress on the Mac (owner: "Delivery pipeline design" thread). This brief records what later PRs rely on.
Goal: the template adapted to the grading contract, with CI and the bot sim skeleton, so every later PR is checked automatically.
Spec + design refs: process.md 5.1, 5.3, 5.4, 5.5, 5.7; CLAUDE.md contract; tech-plan.md sections 6 and 7.
Files to touch: as briefed by the pipeline thread.
Plan items later PRs need from PR 1 (add here if cheap, otherwise the PR that first needs them adds them):
- CI concurrency group per branch with cancel-in-progress (tech-plan 7).
- `scripts/contract-check.mjs` structured so later PRs append rules (secret confinement, pdfjs location, no test hooks in `src/`).
- `e2e/grading-bot.spec.ts` step 6 reads the table list from `supabase/migrations/*.sql` (`create table` statements).
- `supabase/tests/00_rls.sql`: every table in `public` has `relrowsecurity`.
- Bot sim step 6 passes on "0 rows or a permission error" (anon has no grants), fails on any row.
Out of scope: any product feature.
Done when: `npm run check` passes; CI green on all jobs; contract check finds all 10 testids; bot sim steps 1, 2, 4 pass against `next start`.
Risk: auth pages, env handling, CI secrets -> code + security review yes.
