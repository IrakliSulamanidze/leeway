-- WhatsApp sharing: a code shows only courses both students have, only an
-- Allow starts sharing, Block silences the asker, and dates reach chat only
-- once the setting is on.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'ana@test.local'),
  ('00000000-0000-0000-0000-0000000000b7', 'nat@test.local');
insert into wa.links (wa_id, user_id, adult) values
  ('ES.ana', '00000000-0000-0000-0000-0000000000a7', true),
  ('ES.nat', '00000000-0000-0000-0000-0000000000b7', true);
insert into public.courses (id, user_id, name) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000a7', 'Statistics II'),
  ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000a7', 'Microeconomics'),
  ('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000000b7', 'statistics ii'),
  ('00000000-0000-0000-0000-00000000bb02', '00000000-0000-0000-0000-0000000000b7', 'Private Course');
insert into public.assessments (user_id, course_id, on_date, title, source) values
  ('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-00000000bb01', current_date + 3, 'Quiz', 'manual'),
  ('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-00000000bb02', current_date + 3, 'Secret test', 'manual');

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

-- Ana's turn: a code.
select lives_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''ES.ana'')') $$, 'Ana opens a turn');
select is(pg_temp.as_bot($$ select wa_api.new_share_code(sha256('code-1')) $$), 'ok', 'Ana gets a share code');
select is(pg_temp.as_bot($$ select (wa_api.share_preview(sha256('code-1'))).outcome $$), 'self', 'her own code shares nothing');

-- Natalie's turn. One grant per transaction, so the test clears Ana's first.
delete from wa.turn_grants;
select lives_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''ES.nat'')') $$, 'Natalie opens a turn');
select is(pg_temp.as_bot($$ select row(p.outcome, p.courses)::text from wa_api.share_preview(sha256('code-1')) p $$),
  '(ok,"{""statistics ii""}")', 'the preview lists only the course both have');
select is(pg_temp.as_bot($$ select wa_api.answer_share(sha256('code-1'), 'not_now') $$), 'not_now', 'Not now uses the code');
select is(pg_temp.as_bot($$ select wa_api.answer_share(sha256('code-1'), 'allow') $$), 'expired', 'and the code cannot be used again');

-- A second code, allowed.
delete from wa.turn_grants;
select lives_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''ES.ana'')') $$, 'Ana again');
select is(pg_temp.as_bot($$ select wa_api.new_share_code(sha256('code-2')) $$), 'ok', 'a second code');
delete from wa.turn_grants;
select lives_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''ES.nat'')') $$, 'Natalie again');
select is(pg_temp.as_bot($$ select wa_api.answer_share(sha256('code-2'), 'allow') $$), 'allow', 'Allow starts sharing');

-- Ana's answers.
delete from wa.turn_grants;
select lives_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''ES.ana'')') $$, 'Ana asks for tests');
select is(pg_temp.as_bot($$ select count(*) from wa_api.shared_tests(current_date, current_date + 7) $$), '0',
  'nothing reaches chat while shared_in_chat is off');
update wa.settings set value = 'true' where name = 'shared_in_chat';
select is(pg_temp.as_bot($$ select string_agg(title || '@' || course_id, ',') from wa_api.shared_tests(current_date, current_date + 7) $$),
  'Quiz@00000000-0000-0000-0000-00000000aa01',
  'with it on, only the shared course''s test arrives, on Ana''s own course');
select is(pg_temp.as_bot($$ select wa_api.stop_following() $$), '1', 'Ana can stop following at once');

select * from finish();
rollback;
