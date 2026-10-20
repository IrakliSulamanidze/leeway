PR 2: feat(db): core tables, RLS and account deletion
Lane: DB. Needs merged: 1. Budget: 25 min. Review: code + security (auth/RLS).
Goal: the two tables the graded path needs, locked down, proven by pgTAP.
Spec + design refs: tech-plan.md sections 2 (courses, skips rows), 3 (`_core.sql`), 4; spec "Privacy and security", "Data rules across features".
Files to touch: `supabase/migrations/<ts>_core.sql` (via `supabase migration new core`), `supabase/tests/00_rls.sql` (extend), `01_core.sql`, `02_delete_account.sql`, generated `src/lib/db/types.ts` (`supabase gen types typescript --local`).
Must hold:
- `courses` and `skips` exactly as tech-plan 2 (not-null columns, composite FK `(course_id, user_id)`, `class_session_id uuid null` with no FK yet).
- `norm_course_name` uses `extensions.unaccent('extensions.unaccent'::regdictionary, $1)` so the generated column accepts it.
- Standard RLS block on both tables; `log_skip` (invoker, no class linking) and `delete_my_account` (definer): `set search_path = ''`, execute revoked from public/anon, granted to authenticated.
- `00_rls.sql` also checks every `prosecdef` function in `public` has `search_path=""` and anon can't execute it.
Out of scope: the other 10 tables (PR 6), any UI.
Done when: `supabase db reset` applies from zero; `supabase test db` passes 00–02, including: B can't select/insert/update/delete A's rows; anon gets nothing; a skip with B's course_id as A fails; `log_skip('QA-1 test')` and `log_skip('  qa-1 TÉST ')` give 1 course and 2 skips; `log_skip(p_day=>'tomorrow')` sets planned and Madrid tomorrow; `delete_my_account()` leaves 0 rows for A and B untouched; `npm run check` and CI green; bot sim step 6 covers both tables.
Risk: RLS and data -> security review yes.
