-- reserve_ai_call: 10 syllabus reads per student per Madrid day, 300 across everyone,
-- false without login, and the count can't be changed or reset by the student.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select bool_and(public.reserve_ai_call()) from generate_series(1, 10)), true, 'the first 10 calls are allowed');
select is(public.reserve_ai_call(), false, 'the 11th call is refused');
select is((select count from public.ai_usage), 10, 'the count stops at 10');
select throws_ok($$ update public.ai_usage set count = 0 $$, '42501', null, 'the count cannot be reset');
select throws_ok($$ delete from public.ai_usage $$, '42501', null, 'the row cannot be deleted');
select throws_ok($$ insert into public.ai_usage (day, count) values (current_date + 1, 0) $$, '42501', null,
  'rows cannot be inserted directly');

set local request.jwt.claims = '{"role":"authenticated"}';
select is(public.reserve_ai_call(), false, 'no login gets false');

-- Global ceiling: 300 reads today across everyone stops new reads.
reset role;
insert into auth.users (id, email)
select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid, 'u' || i || '@test.local'
from generate_series(1, 29) i;
insert into public.ai_usage (user_id, day, count)
select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid, public.madrid_today(), 10
from generate_series(1, 29) i;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select is(public.reserve_ai_call(), false, 'nobody gets a call once 300 are used today');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.reserve_ai_call() $$, '42501', null, 'anon cannot call reserve_ai_call');

select * from finish();
rollback;
