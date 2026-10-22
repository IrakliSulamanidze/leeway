-- WhatsApp student data: a turn reads and writes only its own student's rows,
-- skips are dated as asked and saved once per message.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'st-a@test.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'st-b@test.local');
insert into wa.links (wa_id, user_id) values ('ES.studenta', '00000000-0000-0000-0000-0000000000e1');
insert into public.courses (id, user_id, name) values
  ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000e1', 'Microeconomics'),
  ('00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-0000000000e2', 'Statistics II');
insert into public.calendar_feeds (id, user_id, url) values
  ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-0000000000e1', 'https://example.test/a.ics');
insert into public.class_sessions (id, user_id, feed_id, course_id, uid, original_start, starts_at, ends_at, kind, session_numbers) values
  ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000f0a1',
   '00000000-0000-0000-0000-00000000c0a1', 'u1', '2026-11-03 08:00Z', '2026-11-03 08:00Z', '2026-11-03 09:30Z', 'class', '{7}');
insert into public.skips (user_id, course_id, text_typed) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000c0b1', 'Statistics II');

grant wa_gateway to postgres;
create function pg_temp.as_bot(p_sql text) returns text
language plpgsql as $f$
declare
  v text;
begin
  set local role wa_gateway;
  execute p_sql into v;
  reset role;
  return v;
end $f$;

select throws_ok($$ select pg_temp.as_bot('select wa_api.my_snapshot(''2026-11-02'', ''2026-11-08'')') $$,
  '28000', null, 'no data without a turn');
select lives_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''ES.studenta'')') $$, 'student A opens a turn');

select is(pg_temp.as_bot($$ select jsonb_array_length(wa_api.my_snapshot('2026-11-02', '2026-11-08') -> 'courses') $$),
  '1', 'the snapshot holds only the student''s own courses');
select is(pg_temp.as_bot($$ select wa_api.my_snapshot('2026-11-02', '2026-11-08') #>> '{courses,0,name}' $$),
  'Microeconomics', 'and they are A''s');
select is(pg_temp.as_bot($$ select jsonb_array_length(wa_api.my_snapshot('2026-11-02', '2026-11-08') -> 'skips') $$),
  '0', 'B''s skip is not in A''s snapshot');
select is(pg_temp.as_bot($$ select jsonb_array_length(wa_api.my_snapshot('2026-11-02', '2026-11-08') -> 'sessions') $$),
  '1', 'classes in the range are included');

select throws_ok($$ select pg_temp.as_bot('select wa_api.log_skip_on(''00000000-0000-0000-0000-00000000c0b1'', null, ''2026-11-03'', 1, sha256(''x''))') $$,
  '22023', null, 'a turn cannot skip another student''s course');
select set_config('t.skip', pg_temp.as_bot($$ select wa_api.log_skip_on('00000000-0000-0000-0000-00000000c0a1',
  '00000000-0000-0000-0000-0000000005a1', '2026-11-03', 1, sha256('m1')) $$), true);
select is(pg_temp.as_bot($$ select wa_api.log_skip_on('00000000-0000-0000-0000-00000000c0a1',
  '00000000-0000-0000-0000-0000000005a1', '2026-11-03', 1, sha256('m1')) $$), current_setting('t.skip'),
  'the same message saves the same skip again');
select is((select skip_date::text from public.skips where id = current_setting('t.skip')::uuid), '2026-11-03',
  'the skip is dated the day the student meant');
select is(pg_temp.as_bot($$ select wa_api.undo_skip((select '00000000-0000-0000-0000-000000000000'::uuid)) $$), 'false',
  'undo of a skip that is not theirs does nothing');
select is(pg_temp.as_bot(format('select wa_api.undo_skip(%L)', current_setting('t.skip'))), 'true',
  'the student can undo their own skip');

select * from finish();
rollback;
