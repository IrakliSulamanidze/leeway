-- Calendar feeds: the url is never readable by a client, feed_url_for_sync hands it
-- only to its owner, connect_feed dedupes, caps at 3 and answers with fixed messages.
-- Plus: B can't read, change or attach to A's rows in any of the new tables.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select set_config('t.feed_a', public.connect_feed('webcal://cal.example.com/feed?key=secret-a')::text, true);
select is(public.connect_feed('webcal://cal.example.com/feed?key=secret-a')::text, current_setting('t.feed_a'),
  'connecting the same link again returns the same feed');
select is(public.connect_feed('HTTPS://cal.example.com/feed?key=secret-a')::text, current_setting('t.feed_a'),
  'the scheme is matched ignoring case');
select is((select count(*)::int from public.calendar_feeds), 1, 'duplicates add no row');
select is((select status from public.calendar_feeds), 'new', 'a new feed starts as new');

select throws_ok($$ select public.connect_feed('http://cal.example.com/feed?key=leak-me') $$,
  '22023', 'Use a calendar link that starts with https:// or webcal://.', 'http is refused with a fixed message');
select throws_ok($$ select public.connect_feed('https://cal.example.com/' || repeat('k', 2050)) $$,
  '22023', 'Use a calendar link that starts with https:// or webcal://.', 'a link over 2048 chars is refused');
select throws_ok($$ select public.connect_feed(null) $$,
  '22023', 'Use a calendar link that starts with https:// or webcal://.', 'no link is refused');

select set_config('t.feed_2', public.connect_feed('https://two.example.com/a.ics')::text, true);
select isnt(current_setting('t.feed_2'), current_setting('t.feed_a'), 'a second feed is allowed');
select lives_ok($$ select public.connect_feed('https://three.example.com/a.ics') $$, 'a third feed is allowed');
select throws_ok($$ select public.connect_feed('https://four.example.com/a.ics') $$,
  '22023', 'You can connect up to 3 calendars.', 'a fourth feed is refused');
select is((select count(*)::int from public.calendar_feeds), 3, 'the fourth feed was not saved');
select is(public.connect_feed('https://two.example.com/a.ics')::text, current_setting('t.feed_2'),
  'reconnecting a saved feed still works at the cap');

select is(public.feed_url_for_sync(current_setting('t.feed_a')::uuid),
  'https://cal.example.com/feed?key=secret-a', 'the owner gets their own url, webcal turned into https');
select throws_ok($$ select url from public.calendar_feeds $$, '42501', null, 'selecting url is denied');
select throws_ok($$ select * from public.calendar_feeds $$, '42501', null, 'selecting * is denied');
select lives_ok($$ select id, status, last_synced_at, last_attempt_at, last_error from public.calendar_feeds $$,
  'the status columns are readable');
select throws_ok($$ update public.calendar_feeds set url = 'https://evil.example.com/' $$, '42501', null,
  'the url cannot be changed');
select throws_ok($$ insert into public.calendar_feeds (url) values ('https://direct.example.com/') $$, '42501', null,
  'feeds can only be added through connect_feed');
select throws_ok($$ update public.calendar_feeds set last_error = 'free text from the feed' $$, '23514', null,
  'last_error takes fixed messages only');

-- A's rows in the other tables, for B to try.
insert into public.courses (name) values ('Micro');
select set_config('t.course_a', (select id::text from public.courses where name = 'Micro'), true);
insert into public.class_sessions (feed_id, course_id, uid, original_start, starts_at, ends_at, kind)
values (current_setting('t.feed_a')::uuid, current_setting('t.course_a')::uuid, 'UID-1',
        '2026-11-02 09:00+01', '2026-11-02 09:00+01', '2026-11-02 10:20+01', 'class');
insert into public.feed_course_map (feed_id, source_key, source_hash, course_id, status)
values (current_setting('t.feed_a')::uuid, 'S1', 'h1', current_setting('t.course_a')::uuid, 'mapped');
insert into public.assessments (course_id, on_date, title, source)
values (current_setting('t.course_a')::uuid, '2026-11-03', 'Midterm', 'manual');
insert into public.syllabus_sessions (course_id, session_number, topic) values (current_setting('t.course_a')::uuid, 1, 'Intro');
insert into public.notices (body) values ('Micro lost a session. Lives now 5.');
insert into public.weekly_checks (week_start) values ('2026-11-02');
insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://fcm.googleapis.com/x', 'p', 'a');
select throws_ok($$ insert into public.feed_course_map (feed_id, source_hash, status, source_key) values
  (current_setting('t.feed_a')::uuid, 'h2', 'ignored', 'Dentist') $$, '23514', null,
  'an ignored key cannot keep its title');
select throws_ok($$ update public.notices set body = 'changed' $$, '42501', null, 'a notice body cannot be changed');
select lives_ok($$ update public.notices set dismissed_at = now() $$, 'a notice can be dismissed');

-- User B
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is(public.feed_url_for_sync(current_setting('t.feed_a')::uuid), null, 'B gets no url for A''s feed');
select is(
  (select count(*)::int from public.calendar_feeds) + (select count(*)::int from public.feed_course_map)
  + (select count(*)::int from public.class_sessions) + (select count(*)::int from public.assessments)
  + (select count(*)::int from public.syllabus_sessions) + (select count(*)::int from public.notices)
  + (select count(*)::int from public.weekly_checks) + (select count(*)::int from public.push_subscriptions),
  0, 'B sees none of A''s rows in any new table');
insert into public.courses (name) values ('B course');
select throws_ok($$ insert into public.class_sessions (feed_id, course_id, uid, original_start, starts_at, ends_at, kind)
  values (current_setting('t.feed_a')::uuid, (select id from public.courses), 'X', now(), now(), now(), 'class') $$,
  '23503', null, 'B cannot attach a class to A''s feed');
select throws_ok($$ insert into public.assessments (course_id, on_date, title, source)
  values (current_setting('t.course_a')::uuid, '2026-11-03', 'Fake', 'manual') $$,
  '23503', null, 'B cannot add a test to A''s course');
update public.class_sessions set starts_at = now();
delete from public.feed_course_map;
delete from public.notices;
update public.calendar_feeds set status = 'failed';

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is(
  (select count(*)::int from public.class_sessions where starts_at = '2026-11-02 09:00+01')
  + (select count(*)::int from public.feed_course_map) + (select count(*)::int from public.notices)
  + (select count(*)::int from public.calendar_feeds where status = 'new'),
  6, 'B changed and deleted nothing of A''s');

-- No login, anon and service_role
set local request.jwt.claims = '{"role":"authenticated"}';
select is(public.feed_url_for_sync(current_setting('t.feed_a')::uuid), null, 'no login gets no url');
reset role;
select ok(not has_function_privilege('service_role', 'public.feed_url_for_sync(uuid)', 'execute'),
  'service_role cannot call feed_url_for_sync');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.feed_url_for_sync(gen_random_uuid()) $$, '42501', null, 'anon cannot call feed_url_for_sync');

select * from finish();
rollback;
