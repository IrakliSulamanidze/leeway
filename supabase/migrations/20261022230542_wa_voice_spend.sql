-- WhatsApp bot, part 10: a voice note can cost more than a text reading
-- (about $0.007 for a minute of audio), so the guard on a single charge rises.

create or replace function wa_api.add_ai_spend(p_micros bigint) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  -- A minute of audio is about 7,000; more means a pricing bug.
  if p_micros < 0 or p_micros > 20000 then
    raise exception 'one call cannot cost that much' using errcode = '22023';
  end if;
  insert into wa.ai_spend (day, micros) values ((now() at time zone 'Europe/Madrid')::date, p_micros)
  on conflict (day) do update set micros = wa.ai_spend.micros + excluded.micros;
end $$;

revoke execute on function wa_api.add_ai_spend(bigint) from public, anon, authenticated, service_role;
grant execute on function wa_api.add_ai_spend(bigint) to wa_gateway;
