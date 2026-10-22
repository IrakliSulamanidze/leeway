-- WhatsApp reminders: only the scheduler's secret lists students, and a
-- student gets at most one reminder a day.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f7', 'rem@test.local');
insert into wa.links (wa_id, user_id, adult) values ('ES.remind', '00000000-0000-0000-0000-0000000000f7', true);

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

select throws_ok($$ select pg_temp.as_bot('select count(*) from wa_api.reminder_targets(''anything'')') $$,
  '28000', null, 'with no secret set, nobody is listed');
update wa.settings set value = to_jsonb(encode(sha256(convert_to('s3cret', 'UTF8')), 'hex'))
where name = 'reminder_secret_hash';
select throws_ok($$ select pg_temp.as_bot('select count(*) from wa_api.reminder_targets(''wrong'')') $$,
  '28000', null, 'a wrong secret lists nobody');
select is(pg_temp.as_bot($$ select string_agg(wa_id, ',') from wa_api.reminder_targets('s3cret') $$),
  'ES.remind', 'the right secret lists linked students');

select lives_ok($$ select pg_temp.as_bot('select wa_api.begin_turn(''ES.remind'')') $$, 'a turn opens');
select is(pg_temp.as_bot($$ select wa_api.claim_reminder() $$), 'true', 'the first reminder today is claimed');
select is(pg_temp.as_bot($$ select wa_api.claim_reminder() $$), 'false', 'a second one is not');
select is(pg_temp.as_bot($$ select count(*) from wa_api.reminder_targets('s3cret') $$), '0',
  'a student reminded today is not listed again');
select lives_ok($$ select pg_temp.as_bot('select wa_api.set_hide_details(true)') $$, 'details can be hidden');

select * from finish();
rollback;
