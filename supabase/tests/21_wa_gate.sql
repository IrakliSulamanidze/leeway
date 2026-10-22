-- WhatsApp bot gate: redelivered messages are seen once, the daily cap counts
-- per sender and day, and STOP is recorded.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

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

select is(pg_temp.as_bot($$ select wa_api.claim_message(sha256('m1')) $$), 'true', 'a new message is claimed');
select is(pg_temp.as_bot($$ select wa_api.claim_message(sha256('m1')) $$), 'false',
  'a redelivery while the first attempt is running is not');
update wa.seen_messages set seen_at = now() - interval '1 minute' where id_hash = sha256('m1');
select is(pg_temp.as_bot($$ select wa_api.claim_message(sha256('m1')) $$), 'true',
  'an attempt that died without finishing can be claimed again');
select lives_ok($$ select pg_temp.as_bot('select wa_api.finish_message(sha256(''m1''))') $$, 'a message is finished');
update wa.seen_messages set seen_at = now() - interval '1 minute' where id_hash = sha256('m1');
select is(pg_temp.as_bot($$ select wa_api.claim_message(sha256('m1')) $$), 'false',
  'a finished message is never handled again');
select lives_ok($$ select pg_temp.as_bot('select wa_api.release_message(sha256(''m1''))') $$, 'a failed message is released');
select is(pg_temp.as_bot($$ select wa_api.claim_message(sha256('m1')) $$), 'true', 'and can be claimed again');
select throws_ok($$ select pg_temp.as_bot('select wa_api.claim_message(''\x01'')') $$, '23514', null,
  'only 32-byte hashes are stored');

select is(pg_temp.as_bot($$ select row(c.msg_count, c.cap)::text from wa_api.count_message(sha256('s1')) c $$),
  '(1,60)', 'the first message of the day counts 1 against a cap of 60');
select is(pg_temp.as_bot($$ select (wa_api.count_message(sha256('s1'))).msg_count $$), '2', 'the count grows per sender');
select is(pg_temp.as_bot($$ select (wa_api.count_message(sha256('s2'))).msg_count $$), '1', 'and is separate for each sender');

select lives_ok($$ select pg_temp.as_bot('select wa_api.set_opt_out(sha256(''s1''), true)') $$, 'STOP is recorded');
update wa.settings set value = '80.5' where name = 'daily_message_cap';
select is(pg_temp.as_bot($$ select (wa_api.count_message(sha256('s3'))).cap $$), '60',
  'a cap that is not a whole number falls back to 60');

-- The AI ceiling.
update wa.settings set value = '1000' where name = 'ai_daily_cap_micros';
select is(pg_temp.as_bot($$ select wa_api.ai_budget_left() $$), 'true', 'AI budget is open at the start of the day');
select lives_ok($$ select pg_temp.as_bot('select wa_api.add_ai_spend(1000)') $$, 'spend is recorded');
select is(pg_temp.as_bot($$ select wa_api.ai_budget_left() $$), 'false', 'past the ceiling the budget is closed');
select throws_ok($$ select pg_temp.as_bot('select wa_api.add_ai_spend(-1)') $$, '22023', null, 'a negative cost is refused');
select lives_ok($$ select pg_temp.as_bot('select wa_api.add_ai_spend(7300)') $$, 'a minute of voice can be charged');
select throws_ok($$ select pg_temp.as_bot('select wa_api.add_ai_spend(20001)') $$, '22023', null, 'an impossible cost is refused');

select * from finish();
rollback;
