-- RLS guarantees: every public table has RLS on, users see only their own
-- items, and anonymous visitors see nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is_empty(
  $$ select c.relname from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every public table has row level security on'
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into public.items (title) values ('A private item');
select is((select count(*)::int from public.items), 1, 'owner sees own item');
select is((select user_id from public.items limit 1), '00000000-0000-0000-0000-00000000000a'::uuid, 'user_id defaults to auth.uid()');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.items), 0, 'user B cannot see user A items');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*)::int from public.items), 0, 'anon sees nothing');

select * from finish();
rollback;
