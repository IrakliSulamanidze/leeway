-- delete_my_account removes the caller and every row they own; user B is untouched.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select public.log_skip('Micro');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select public.log_skip('Micro');
select public.log_skip('Statistics', p_day => 'tomorrow');
select lives_ok($$ select public.delete_my_account() $$, 'A deletes their account');

reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-00000000000a'), 0, 'A is gone from auth.users');
select is(
  (select count(*)::int from public.courses where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from public.skips where user_id = '00000000-0000-0000-0000-00000000000a'),
  0, 'no rows left for A in any table');
select is((select count(*)::int from public.courses where user_id = '00000000-0000-0000-0000-00000000000b'), 1, 'B keeps their course');
select is((select count(*)::int from public.skips where user_id = '00000000-0000-0000-0000-00000000000b'), 1, 'B keeps their skip');

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'anon cannot call delete_my_account');

select * from finish();
rollback;
