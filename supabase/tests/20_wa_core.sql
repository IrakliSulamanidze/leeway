-- WhatsApp bot core: the wa schema is closed to web roles, the bot's role reaches
-- only its two functions, and a transaction acts for at most one student.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'wa-a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'wa-b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'wa-c@test.local');
insert into wa.links (wa_id, user_id, status) values
  ('34600000001', '00000000-0000-0000-0000-0000000000a1', 'active'),
  ('34600000002', '00000000-0000-0000-0000-0000000000b1', 'active'),
  ('34600000003', '00000000-0000-0000-0000-0000000000c1', 'suspended');

-- Catalogue
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'wa' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every wa table has row level security on');
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('wa', 'wa_api') and p.prosecdef
       and not coalesce('search_path=""' = any(p.proconfig), false) $$,
  'every wa and wa_api definer function sets search_path to empty');
select ok(not has_schema_privilege('anon', 'wa', 'usage')
  and not has_schema_privilege('authenticated', 'wa', 'usage')
  and not has_schema_privilege('service_role', 'wa', 'usage')
  and not has_schema_privilege('anon', 'wa_api', 'usage')
  and not has_schema_privilege('authenticated', 'wa_api', 'usage')
  and not has_schema_privilege('service_role', 'wa_api', 'usage'),
  'web roles cannot use the wa or wa_api schemas');
-- What the bot's role can reach, across the whole database.
select set_eq(
  $$ select nspname::text from pg_namespace
     where has_schema_privilege('wa_gateway', oid, 'usage') and nspname !~ '^pg_(temp|toast_temp)_' $$,
  array['pg_catalog', 'information_schema', 'public', 'wa_api'],
  'wa_gateway can use only the catalog, public and wa_api schemas');
select set_eq(
  $$ select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname not in ('pg_catalog', 'information_schema')
       and has_schema_privilege('wa_gateway', n.oid, 'usage')
       and has_function_privilege('wa_gateway', p.oid, 'execute') $$,
  array['wa_api.begin_turn', 'wa_api.setting', 'wa_api.claim_message', 'wa_api.finish_message',
        'wa_api.release_message', 'wa_api.count_message', 'wa_api.set_opt_out', 'wa_api.link_state',
        'wa_api.issue_link_token', 'wa_api.link_token_ok', 'wa_api.link_failed', 'wa_api.complete_link',
        'wa_api.set_adult', 'wa_api.my_link'],
  'outside the catalog, wa_gateway can call exactly the wa_api functions listed here');
select is_empty(
  $$ select n.nspname || '.' || c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_temp_'
       and has_schema_privilege('wa_gateway', n.oid, 'usage')
       and c.relkind in ('r', 'v', 'm', 'p', 'f', 'S')
       and (has_table_privilege('wa_gateway', c.oid, 'select, insert, update, delete, truncate, references, trigger')
         or (c.relkind = 'S' and has_sequence_privilege('wa_gateway', c.oid, 'usage, select, update'))) $$,
  'wa_gateway has no rights on any table, view or sequence it can reach');
select is_empty(
  $$ select rolname from pg_roles where rolname = 'wa_gateway'
       and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication or rolinherit) $$,
  'wa_gateway has no special attributes');
select is_empty(
  $$ select r.rolname from pg_auth_members m join pg_roles r on r.oid = m.roleid
     where m.member = 'wa_gateway'::regrole $$,
  'wa_gateway is a member of no role');
select ok(not has_schema_privilege('wa_gateway', 'wa', 'usage'),
  'wa_gateway cannot use the wa schema, so nothing added there is callable');
select throws_ok(
  $$ insert into wa.links (wa_id, user_id) values ('+34 600', '00000000-0000-0000-0000-0000000000a1') $$,
  '23514', null, 'a WhatsApp id is a user id or digits only');
select lives_ok(
  $$ insert into wa.links (wa_id, user_id)
     values ('ES.13491208655302741918', '00000000-0000-0000-0000-0000000000a1')
     on conflict (user_id) do nothing $$,
  'a business-scoped user id is a valid WhatsApp id');

-- As the bot. pgTAP keeps its bookkeeping in tables the bot's role cannot write,
-- so each check switches role only around the statement under test. The grant
-- lets this test session switch to the role; it is rolled back with the test.
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

select is(pg_temp.as_bot($$ select wa_api.setting('paused') $$), 'false', 'the bot starts unpaused');
select is(pg_temp.as_bot($$ select wa_api.setting('student_cap') $$), '50', 'the student cap starts at 50');
select throws_ok($$ select pg_temp.as_bot('select count(*) from wa.links') $$, '42501', null,
  'the bot cannot read links');
select throws_ok($$ select pg_temp.as_bot('select wa.acting_user()') $$, '42501', null,
  'the bot cannot call acting_user');
select throws_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''34699999999'')') $$, '28000', null,
  'an unlinked number gets no turn');
select throws_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''34600000003'')') $$, '28000', null,
  'a suspended link gets no turn');
select lives_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''34600000001'')') $$,
  'a linked number opens a turn');
select throws_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''34600000002'')') $$, '25001', null,
  'a second turn in the same transaction is refused, even for another student');

select is(wa.acting_user(), '00000000-0000-0000-0000-0000000000a1'::uuid,
  'the turn acts for the student whose number opened it');

select * from finish();
rollback;
