-- WhatsApp sharing: closed until switched on; a code shows only courses both
-- students have; only an Allow starts sharing, and only for the courses shown
-- then; Block silences the asker; unlinking ends it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'ana@test.local'),
  ('00000000-0000-0000-0000-0000000000b7', 'nat@test.local');
insert into wa.links (wa_id, user_id, adult) values
  ('ES.ana', '00000000-0000-0000-0000-0000000000a7', true),
  ('ES.nat', '00000000-0000-0000-0000-0000000000b7', true);
insert into public.courses (id, user_id, name) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000a7', 'Statistics II'),
  ('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000000b7', 'statistics ii'),
  ('00000000-0000-0000-0000-00000000bb02', '00000000-0000-0000-0000-0000000000b7', 'Private Course');
insert into public.assessments (user_id, course_id, on_date, title, source) values
  ('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-00000000bb01', current_date + 3, 'Quiz: week 3!', 'manual'),
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
-- One turn per transaction, so each step clears the previous student's grant.
create function pg_temp.turn(p_wa_id text) returns void language plpgsql as $f$
begin
  delete from wa.turn_grants;
  perform pg_temp.as_bot(format('select wa_api.begin_turn(%L)', p_wa_id));
end $f$;

select pg_temp.turn('ES.ana');
select is(pg_temp.as_bot($$ select wa_api.new_share_code(sha256('code-0')) $$), 'closed', 'sharing is closed until switched on');
update wa.settings set value = 'true' where name = 'shared_in_chat';

select is(pg_temp.as_bot($$ select wa_api.new_share_code(sha256('code-1')) $$), 'ok', 'Ana gets a share code');
select is(pg_temp.as_bot($$ select (wa_api.share_preview(sha256('code-1'))).outcome $$), 'self', 'her own code shares nothing');

select pg_temp.turn('ES.nat');
select is(pg_temp.as_bot($$ select row(p.outcome, p.courses)::text from wa_api.share_preview(sha256('code-1')) p $$),
  '(ok,"{""statistics ii""}")', 'the preview lists only the course both have');
select is(pg_temp.as_bot($$ select wa_api.answer_share(sha256('code-1'), 'not_now') $$), 'not_now', 'Not now uses the code');
select is(pg_temp.as_bot($$ select wa_api.answer_share(sha256('code-1'), 'allow') $$), 'expired', 'and it cannot be used again');

select pg_temp.turn('ES.ana');
select is(pg_temp.as_bot($$ select wa_api.new_share_code(sha256('code-2')) $$), 'ok', 'a second code');
select pg_temp.turn('ES.nat');
select is(pg_temp.as_bot($$ select wa_api.answer_share(sha256('code-2'), 'allow') $$), 'allow', 'Allow starts sharing');

select pg_temp.turn('ES.ana');
select is(pg_temp.as_bot($$ select string_agg(title || '@' || course_id, ',') from wa_api.shared_tests(current_date, current_date + 7) $$),
  'Quiz week 3@00000000-0000-0000-0000-00000000aa01',
  'only the shared course''s test arrives, on Ana''s own course, with a cleaned short name');
insert into public.courses (user_id, name) values ('00000000-0000-0000-0000-0000000000a7', 'private course');
select is(pg_temp.as_bot($$ select count(*) from wa_api.shared_tests(current_date, current_date + 7) $$), '1',
  'a course Ana adds after the Allow is not shared');

select is(pg_temp.as_bot($$ select wa_api.new_share_code(sha256('code-3')) $$), 'ok', 'a third code');
select pg_temp.turn('ES.nat');
select is(pg_temp.as_bot($$ select (wa_api.share_preview(sha256('code-3'))).outcome $$), 'expired',
  'a code from someone already sharing reads as expired');
select is(pg_temp.as_bot($$ select wa_api.answer_share(sha256('code-3'), 'block') $$), 'block', 'Block is recorded');

select pg_temp.turn('ES.ana');
select is(pg_temp.as_bot($$ select wa_api.new_share_code(sha256('code-4')) $$), 'ok', 'Ana makes another code');
select pg_temp.turn('ES.nat');
select is(pg_temp.as_bot($$ select (wa_api.share_preview(sha256('code-4'))).outcome $$), 'expired',
  'a blocked asker''s codes read as expired');

delete from wa.links where wa_id = 'ES.nat';
select is((select status from wa.share_grants), 'revoked', 'unlinking WhatsApp ends sharing');
select pg_temp.turn('ES.ana');
select is(pg_temp.as_bot($$ select wa_api.stop_following() $$), '0', 'so there is nothing left to stop');

select * from finish();
rollback;
