-- WhatsApp bot, part 5: the daily ceiling on AI spend. The reader asks before
-- each model call and records what the call cost; past the ceiling the bot
-- answers commands and buttons only, until the next Madrid day.

create table wa.ai_spend (
  day date primary key,
  micros bigint not null default 0 check (micros >= 0)
);
alter table wa.ai_spend enable row level security;

-- $5 a day, in millionths of a dollar.
insert into wa.settings (name, value) values ('ai_daily_cap_micros', '5000000');

create function wa_api.ai_budget_left() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select sp.micros from wa.ai_spend sp where sp.day = (now() at time zone 'Europe/Madrid')::date
  ), 0) < coalesce((
    select case when s.value #>> '{}' ~ '^[0-9]{1,12}$' then (s.value #>> '{}')::bigint end
    from wa.settings s where s.name = 'ai_daily_cap_micros'
  ), 5000000)
$$;

create function wa_api.add_ai_spend(p_micros bigint) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  -- One call costs well under a tenth of a cent; more means a pricing bug.
  if p_micros < 0 or p_micros > 5000 then
    raise exception 'one call cannot cost that much' using errcode = '22023';
  end if;
  insert into wa.ai_spend (day, micros) values ((now() at time zone 'Europe/Madrid')::date, p_micros)
  on conflict (day) do update set micros = wa.ai_spend.micros + excluded.micros;
end $$;

revoke all on wa.ai_spend from public, anon, authenticated, service_role;
revoke execute on function wa_api.ai_budget_left(), wa_api.add_ai_spend(bigint)
  from public, anon, authenticated, service_role;
grant execute on function wa_api.ai_budget_left(), wa_api.add_ai_spend(bigint) to wa_gateway;
