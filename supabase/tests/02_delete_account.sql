-- delete_my_account removes the caller and every row they own in all 12 tables;
-- user B is untouched.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- Counts every row a user owns across the 12 app tables.
create function pg_temp.rows_of(p_user uuid) returns int language sql as $$
  select ((select count(*) from public.courses where user_id = p_user)
    + (select count(*) from public.skips where user_id = p_user)
    + (select count(*) from public.calendar_feeds where user_id = p_user)
    + (select count(*) from public.feed_course_map where user_id = p_user)
    + (select count(*) from public.class_sessions where user_id = p_user)
    + (select count(*) from public.assessments where user_id = p_user)
    + (select count(*) from public.syllabus_sessions where user_id = p_user)
    + (select count(*) from public.notices where user_id = p_user)
    + (select count(*) from public.weekly_checks where user_id = p_user)
    + (select count(*) from public.ai_usage where user_id = p_user)
    + (select count(*) from public.push_subscriptions where user_id = p_user)
    + (select count(*) from public.alert_log where user_id = p_user))::int
$$;

-- One row in every table for A, and a skip for B.
insert into public.alert_log (user_id, night) values ('00000000-0000-0000-0000-00000000000a', '2026-11-02');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select public.log_skip('Micro');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select set_config('t.feed', public.connect_feed('https://cal.example.com/a.ics')::text, true);
select set_config('t.course', (select (public.log_skip('Micro')).course_id::text), true);
select public.log_skip('Statistics', p_day => 'tomorrow');
insert into public.feed_course_map (feed_id, source_key, source_hash, course_id, status)
values (current_setting('t.feed')::uuid, 'S1', 'h1', current_setting('t.course')::uuid, 'mapped');
insert into public.class_sessions (feed_id, course_id, uid, original_start, starts_at, ends_at, kind)
values (current_setting('t.feed')::uuid, current_setting('t.course')::uuid, 'U1', now(), now(), now(), 'class');
insert into public.assessments (course_id, session_number, title, source) values (current_setting('t.course')::uuid, 10, 'Midterm', 'syllabus');
insert into public.syllabus_sessions (course_id, session_number, topic) values (current_setting('t.course')::uuid, 1, 'Intro');
insert into public.notices (body) values ('Micro lost a session. Lives now 5.');
insert into public.weekly_checks (week_start) values ('2026-11-02');
insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://fcm.googleapis.com/x', 'p', 'a');
select public.reserve_ai_call();

reset role;
select is(pg_temp.rows_of('00000000-0000-0000-0000-00000000000a'), 14, 'A has a row in every table');
set local role authenticated;
select lives_ok($$ select public.delete_my_account() $$, 'A deletes their account');

reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-00000000000a'), 0, 'A is gone from auth.users');
select is(pg_temp.rows_of('00000000-0000-0000-0000-00000000000a'), 0, 'no rows left for A in any of the 12 tables');
select is((select count(*)::int from public.courses where user_id = '00000000-0000-0000-0000-00000000000b'), 1, 'B keeps their course');
select is((select count(*)::int from public.skips where user_id = '00000000-0000-0000-0000-00000000000b'), 1, 'B keeps their skip');

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'anon cannot call delete_my_account');

select * from finish();
rollback;
