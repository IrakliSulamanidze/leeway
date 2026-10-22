-- WhatsApp student data: a turn reads and writes only its own student's rows,
-- and skips are dated as asked, bounded and saved once.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'Europe/Madrid')::date $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'st-a@test.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'st-b@test.local');
insert into wa.links (wa_id, user_id) values ('ES.studenta', '00000000-0000-0000-0000-0000000000e1');
insert into public.courses (id, user_id, name) values
  ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000e1', 'Microeconomics'),
  ('00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-0000000000e2', 'Statistics II');
insert into public.calendar_feeds (id, user_id, url) values
  ('00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-0000000000e1', 'https://example.test/a.ics');
insert into public.class_sessions (id, user_id, feed_id, course_id, uid, original_start, starts_at, ends_at, kind, session_numbers)
select '00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-00000000f0a1', '00000000-0000-0000-0000-00000000c0a1', 'u1', t, t, t + interval '90 minutes', 'class', '{7}'
from (select (pg_temp.today() + time '10:00') at time zone 'Europe/Madrid' as t) x;
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

select throws_ok($$ select pg_temp.as_bot('select wa_api.my_snapshot(current_date, current_date + 6)') $$,
  '28000', null, 'no data without a turn');
select lives_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''ES.studenta'')') $$, 'student A opens a turn');

select is(pg_temp.as_bot(format('select jsonb_array_length(wa_api.my_snapshot(%L, %L) -> %L)', pg_temp.today(), pg_temp.today() + 6, 'courses')),
  '1', 'the snapshot holds only the student''s own courses');
select is(pg_temp.as_bot(format('select wa_api.my_snapshot(%L, %L) #>> %L', pg_temp.today(), pg_temp.today(), '{courses,0,name}')),
  'Microeconomics', 'and they are A''s');
select is(pg_temp.as_bot(format('select jsonb_array_length(wa_api.my_snapshot(%L, %L) -> %L)', pg_temp.today(), pg_temp.today(), 'skips')),
  '0', 'B''s skip is not in A''s snapshot');
select is(pg_temp.as_bot(format('select jsonb_array_length(wa_api.my_snapshot(%L, %L) -> %L)', pg_temp.today(), pg_temp.today(), 'sessions')),
  '1', 'classes in the range are included');

select throws_ok(format($$ select pg_temp.as_bot('select wa_api.log_skip_on(''00000000-0000-0000-0000-00000000c0b1'', null, ''%s'', 1, sha256(''x''))') $$, pg_temp.today()),
  '22023', null, 'a turn cannot skip another student''s course');
select throws_ok($$ select pg_temp.as_bot('select wa_api.log_skip_on(''00000000-0000-0000-0000-00000000c0a1'', null, ''1900-01-01'', 1, sha256(''old''))') $$,
  '22023', null, 'a skip far in the past is refused');
select throws_ok(format($$ select pg_temp.as_bot('select wa_api.log_skip_on(''00000000-0000-0000-0000-00000000c0a1'', ''00000000-0000-0000-0000-0000000005a1'', ''%s'', 2, sha256(''x2''))') $$, pg_temp.today()),
  '22023', null, 'a single class cannot cost two sessions');

select set_config('t.skip', pg_temp.as_bot(format('select wa_api.log_skip_on(%L, %L, %L, 1, sha256(%L))',
  '00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000005a1', pg_temp.today(), 'm1')), true);
select is(pg_temp.as_bot(format('select wa_api.log_skip_on(%L, %L, %L, 1, sha256(%L))',
  '00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000005a1', pg_temp.today(), 'm1')),
  current_setting('t.skip'), 'the same message saves the same skip again');
select is((select skip_date from public.skips where id = current_setting('t.skip')::uuid), pg_temp.today(),
  'the skip is dated the day the student meant');
select is(
  pg_temp.as_bot(format('select wa_api.log_skip_on(%L, null, %L, 1, sha256(%L))', '00000000-0000-0000-0000-00000000c0a1', pg_temp.today() + 1, 'n1')),
  pg_temp.as_bot(format('select wa_api.log_skip_on(%L, null, %L, 1, sha256(%L))', '00000000-0000-0000-0000-00000000c0a1', pg_temp.today() + 1, 'n2')),
  'two messages for the same course and day without a class save one skip');

select is(pg_temp.as_bot($$ select wa_api.undo_skip('00000000-0000-0000-0000-000000000000') $$), 'false',
  'undo of a skip that is not theirs does nothing');
select is(pg_temp.as_bot(format('select wa_api.undo_skip(%L)', current_setting('t.skip'))), 'true',
  'the student can undo their own skip');

select * from finish();
rollback;
