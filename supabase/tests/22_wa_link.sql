-- WhatsApp linking: a sign-in needs a session made after the link was issued,
-- the code must come back from the same sender, attempts are limited, and the
-- student cap sends later students to the waitlist in order.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'link-a@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'link-b@test.local'),
  ('00000000-0000-0000-0000-0000000000d3', 'link-c@test.local');
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000005c', '00000000-0000-0000-0000-0000000000d3', now() - interval '1 hour', now());
update wa.settings set value = '1' where name = 'student_cap';

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

-- A: link, sign in, send the code back.
select is(pg_temp.as_bot($$ select (wa_api.link_state('ES.aaa')).state $$), 'none', 'an unknown sender is not linked');
select lives_ok($$ select pg_temp.as_bot('select wa_api.issue_link_token(''ES.aaa'', sha256(''t-a''))') $$, 'a link is issued');
-- Sessions made after the link, as a sign-in on the page would.
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1', clock_timestamp(), now()),
  ('00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-0000000000d2', clock_timestamp(), now());
select is(pg_temp.as_bot($$ select wa_api.take_link_attempt(sha256('t-a')) $$), 'true', 'a sign-in attempt is taken first');
select is(pg_temp.as_bot($$ select wa_api.prepare_link(sha256('t-a'), '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-00000000005b', sha256('code-a')) $$),
  'no_session', 'another account''s session does not count');
select is(pg_temp.as_bot($$ select wa_api.prepare_link(sha256('t-a'), '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-00000000005a', sha256('code-a')) $$),
  'ok', 'a session made after the link counts');
select is(pg_temp.as_bot($$ select wa_api.link_token_ok(sha256('t-a')) $$), 'false', 'the link is used up');
select is(pg_temp.as_bot($$ select (wa_api.confirm_link('ES.zzz', sha256('code-a'))).outcome $$), 'no_code',
  'the code from another number links nothing (a forwarded link is useless)');
select is(pg_temp.as_bot($$ select (wa_api.confirm_link('ES.aaa', sha256('wrong'))).outcome $$), 'wrong_code',
  'a wrong code is refused');
select is(pg_temp.as_bot($$ select (wa_api.confirm_link('ES.aaa', sha256('code-a'))).outcome $$), 'linked',
  'the right code from the same number links');
select is(pg_temp.as_bot($$ select (wa_api.link_state('ES.aaa')).state $$), 'active', 'the number is active');
select throws_ok($$ select pg_temp.as_bot('select wa_api.issue_link_token(''ES.aaa'', sha256(''t-a2''))') $$,
  '23505', null, 'a linked number gets no new link');

-- C: a session older than the link does not count.
select lives_ok($$ select pg_temp.as_bot('select wa_api.issue_link_token(''ES.ccc'', sha256(''t-c''))') $$, 'C gets a link');
select is(pg_temp.as_bot($$ select wa_api.prepare_link(sha256('t-c'), '00000000-0000-0000-0000-0000000000d3',
    '00000000-0000-0000-0000-00000000005c', sha256('code-c')) $$),
  'no_session', 'a session from before the link does not count');

-- Attempts: five a day per sender, and a new link does not reset them.
select pg_temp.as_bot($$ select wa_api.take_link_attempt(sha256('t-c')) $$) from generate_series(1, 5);
select is(pg_temp.as_bot($$ select wa_api.take_link_attempt(sha256('t-c')) $$), 'false', 'the sixth attempt is refused');
select lives_ok($$ select pg_temp.as_bot('select wa_api.issue_link_token(''ES.ccc'', sha256(''t-c2''))') $$, 'C asks for a new link');
select is(pg_temp.as_bot($$ select wa_api.take_link_attempt(sha256('t-c2')) $$), 'false',
  'and still has no attempts left today');

-- B: past the cap, B waits.
select lives_ok($$ select pg_temp.as_bot('select wa_api.issue_link_token(''ES.bbb'', sha256(''t-b''))') $$, 'B gets a link');
update wa.link_tokens set issued_at = now() - interval '1 minute' where wa_id = 'ES.bbb';
select is(pg_temp.as_bot($$ select wa_api.prepare_link(sha256('t-b'), '00000000-0000-0000-0000-0000000000d2',
    '00000000-0000-0000-0000-00000000005b', sha256('code-b')) $$), 'ok', 'B signs in');
select is(pg_temp.as_bot($$ select row(c.outcome, c.place)::text from wa_api.confirm_link('ES.bbb', sha256('code-b')) c $$),
  '(waitlisted,1)', 'past the cap B joins the waitlist, first in line');
select is(pg_temp.as_bot($$ select row(s.state, s.place)::text from wa_api.link_state('ES.bbb') s $$),
  '(waitlisted,1)', 'and is told their place');
update wa.settings set value = '5' where name = 'student_cap';
select is((select count(*)::int from wa.waitlist), 1, 'raising the cap does not drop anyone from the line');
select throws_ok($$ select pg_temp.as_bot('select wa_api.issue_link_token(''ES.bbb'', sha256(''t-b2''))') $$,
  '23505', null, 'a waiting number gets no new link');

-- Age, once.
select lives_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''ES.aaa'')') $$, 'A opens a turn');
select lives_ok($$ select pg_temp.as_bot('select wa_api.set_adult(true)') $$, 'and answers the age question');

select * from finish();
rollback;
