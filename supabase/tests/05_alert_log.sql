-- alert_log: one push per user per night, enforced in the database; students can't touch it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');

-- The nightly job claims with the secret key (service_role).
set local role service_role;
select is_empty($$ select 1 from public.alert_log $$, 'the log starts empty');
select lives_ok($$ insert into public.alert_log (user_id, night)
  values ('00000000-0000-0000-0000-00000000000a', '2026-11-02') on conflict do nothing $$, 'the first claim works');
select is_empty($$ insert into public.alert_log (user_id, night)
  values ('00000000-0000-0000-0000-00000000000a', '2026-11-02') on conflict do nothing returning user_id $$,
  'a second claim for the same night returns no row');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok($$ select * from public.alert_log $$, '42501', null, 'a student cannot read the alert log');

select * from finish();
rollback;
