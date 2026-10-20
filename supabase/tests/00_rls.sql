-- Runs first: every table in the public schema has row level security on,
-- so a table added by any later migration without RLS fails CI. Every
-- security-definer function in public pins search_path to '' and is closed to anon.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is_empty(
  $$ select c.relname from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every public table has row level security on'
);

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not coalesce('search_path=""' = any(p.proconfig), false) $$,
  'every security-definer function sets search_path to empty'
);

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon cannot execute any security-definer function'
);

select * from finish();
rollback;
