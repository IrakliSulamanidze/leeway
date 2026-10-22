-- WhatsApp linking: a link needs a live token and a fresh Supabase session for
-- the same account; the student cap sends later students to the waitlist.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'link-a@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'link-b@test.local'),
  ('00000000-0000-0000-0000-0000000000d3', 'link-c@test.local');
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000d1', now(), now()),
  ('00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-0000000000d2', now(), now()),
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

select is(pg_temp.as_bot($$ select (wa_api.link_state('ES.aaa')).state $$), 'none', 'an unknown sender is not linked');
select lives_ok($$ select pg_temp.as_bot('select wa_api.issue_link_token(''ES.aaa'', sha256(''t-a''))') $$,
  'a link token is issued');
select is(pg_temp.as_bot($$ select wa_api.link_token_ok(sha256('t-a')) $$), 'true', 'the token is usable');

select is(pg_temp.as_bot($$ select (wa_api.complete_link(sha256('t-a'),
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000005b')).outcome $$),
  'no_session', 'another account''s session does not link');
select is(pg_temp.as_bot($$ select (wa_api.complete_link(sha256('nope'),
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000005a')).outcome $$),
  'expired', 'an unknown token does not link');
select is(pg_temp.as_bot($$ select (wa_api.complete_link(sha256('t-a'),
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000005a')).outcome $$),
  'linked', 'a fresh session for the account links it');
select is(pg_temp.as_bot($$ select (wa_api.link_state('ES.aaa')).state $$), 'active', 'the number is now active');
select is(pg_temp.as_bot($$ select (wa_api.complete_link(sha256('t-a'),
    '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000005a')).outcome $$),
  'expired', 'a token links once');
select throws_ok($$ select pg_temp.as_bot('select wa_api.issue_link_token(''ES.aaa'', sha256(''t-a2''))') $$,
  '23505', null, 'a linked number gets no new token');

select lives_ok($$ select pg_temp.as_bot('select wa_api.issue_link_token(''ES.ccc'', sha256(''t-c''))') $$,
  'a second sender gets a token');
select is(pg_temp.as_bot($$ select (wa_api.complete_link(sha256('t-c'),
    '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-00000000005c')).outcome $$),
  'no_session', 'a session older than 15 minutes does not link');

select lives_ok($$ select pg_temp.as_bot('select wa_api.issue_link_token(''ES.bbb'', sha256(''t-b''))') $$,
  'a third sender gets a token');
select is(pg_temp.as_bot($$ select row(c.outcome, c.place)::text from wa_api.complete_link(sha256('t-b'),
    '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000005b') c $$),
  '(waitlisted,1)', 'past the cap a student joins the waitlist, first in line');
select is(pg_temp.as_bot($$ select row(s.state, s.place)::text from wa_api.link_state('ES.bbb') s $$),
  '(waitlisted,1)', 'and is told their place');

select lives_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''ES.aaa'')') $$, 'the linked student opens a turn');
select lives_ok($$ select pg_temp.as_bot('select wa_api.set_adult(true)') $$, 'and answers the age question');

select * from finish();
rollback;
