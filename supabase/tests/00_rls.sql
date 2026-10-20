-- Runs first: every table in the public schema has row level security on,
-- so a table added by any later migration without RLS fails CI.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select is_empty(
  $$ select c.relname from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every public table has row level security on'
);

select * from finish();
rollback;
