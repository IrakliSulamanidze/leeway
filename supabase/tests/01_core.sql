-- Courses and skips: log_skip matches course names, user B can't read or
-- write A's rows, and anonymous visitors get nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- User A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok($$ select public.log_skip('QA-1 test') $$, 'log_skip saves a skip');
select lives_ok($$ select public.log_skip('  qa-1 TÉST ') $$, 'log_skip matches the same course');
select is((select count(*)::int from public.courses), 1, 'case, accents and spaces give one course');
select is((select count(*)::int from public.skips), 2, 'two saves give two skips');
select is((select name from public.courses), 'QA-1 test', 'course name is the first text, trimmed');
select is((select text_typed from public.skips order by created_at, text_typed limit 1),
  '  qa-1 TÉST ', 'text_typed keeps the text as typed');
select ok((select bool_and(not planned and skip_date = (now() at time zone 'Europe/Madrid')::date and sessions = 1)
  from public.skips), 'a today skip is not planned, dated Madrid today, one session');

select is((select (s).planned from (select public.log_skip('Micro', p_day => 'tomorrow') as s) t),
  true, 'a tomorrow skip is planned');
select is((select skip_date from public.skips where text_typed = 'Micro'),
  (now() at time zone 'Europe/Madrid')::date + 1, 'a tomorrow skip is dated Madrid tomorrow');
select is((select (s).sessions from (select public.log_skip('Micro', p_sessions => 2) as s) t),
  2::smallint, 'a double skip counts two sessions');

select throws_ok($$ select public.log_skip('   ') $$, '22023', null, 'blank text is refused');
select throws_ok($$ select public.log_skip(repeat('x', 201)) $$, '22023', null, 'text over 200 chars is refused');
select throws_ok($$ select public.log_skip('Micro', p_day => 'yesterday') $$, '22023', null, 'unknown day is refused');
select throws_ok($$ select public.log_skip('Micro', p_sessions => 3) $$, '22023', null, 'three sessions is refused');

select set_config('t.course_a', (select id::text from public.courses where name = 'QA-1 test'), true);

-- User B
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.courses), 0, 'B cannot see A''s courses');
select is((select count(*)::int from public.skips), 0, 'B cannot see A''s skips');
select throws_ok(
  $$ insert into public.skips (course_id, text_typed) values (current_setting('t.course_a')::uuid, 'sneaky') $$,
  '23503', null, 'B cannot add a skip to A''s course');
select throws_ok(
  $$ insert into public.courses (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'planted') $$,
  '42501', null, 'B cannot insert a course as A');
update public.courses set name = 'hijacked';
update public.skips set text_typed = 'hijacked';
delete from public.skips;
delete from public.courses;

-- Back to A: nothing changed
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select count(*)::int from public.courses where name <> 'hijacked'), 2, 'B could not update or delete A''s courses');
select is((select count(*)::int from public.skips where text_typed <> 'hijacked'), 4, 'B could not update or delete A''s skips');

-- Anonymous visitor
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select count(*) from public.courses $$, '42501', null, 'anon cannot read courses');
select throws_ok($$ select count(*) from public.skips $$, '42501', null, 'anon cannot read skips');
select throws_ok($$ select public.log_skip('anon') $$, '42501', null, 'anon cannot call log_skip');

select * from finish();
rollback;
