-- WhatsApp bot, part 9: the monthly watch on Meta's bill. Meta has no spending
-- cap, so the bot counts what it sends and warns once a month when the count
-- passes a threshold (setting 'meta_monthly_alert_at').

create table wa.sent_counts (
  month date primary key,
  count integer not null default 0,
  alerted_at timestamptz
);
alter table wa.sent_counts enable row level security;

-- About 1,000 messages a month are free; past 1,500 the bill is a few euros.
insert into wa.settings (name, value) values
  ('meta_monthly_alert_at', '1500'),
  -- Irakli's own WhatsApp id, set by hand; empty means log only.
  ('admin_wa_id', '""');

create function wa_api.count_sent() returns void
language sql security definer
set search_path = ''
as $$
  insert into wa.sent_counts (month, count)
  values (date_trunc('month', now() at time zone 'Europe/Madrid')::date, 1)
  on conflict (month) do update set count = wa.sent_counts.count + 1
$$;

-- Once a month, the first time the count passes the threshold: the count and
-- where to send the warning. Needs the scheduler's secret, like the reminders.
create function wa_api.budget_alert(p_secret text, out sent integer, out admin_wa_id text)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_at integer;
  v_month date := date_trunc('month', now() at time zone 'Europe/Madrid')::date;
begin
  select s.value #>> '{}' into v_hash from wa.settings s where s.name = 'reminder_secret_hash';
  if coalesce(v_hash, '') = ''
     or encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex') <> v_hash then
    raise exception 'not allowed' using errcode = '28000';
  end if;
  select case when s.value #>> '{}' ~ '^[0-9]{1,9}$' then (s.value #>> '{}')::integer end
  into v_at from wa.settings s where s.name = 'meta_monthly_alert_at';
  update wa.sent_counts c set alerted_at = now()
  where c.month = v_month and c.alerted_at is null and c.count >= coalesce(v_at, 1500)
  returning c.count into sent;
  if sent is not null then
    select s.value #>> '{}' into admin_wa_id from wa.settings s where s.name = 'admin_wa_id';
  end if;
end $$;

revoke all on wa.sent_counts from public, anon, authenticated, service_role;
revoke execute on function wa_api.count_sent(), wa_api.budget_alert(text)
  from public, anon, authenticated, service_role;
grant execute on function wa_api.count_sent(), wa_api.budget_alert(text) to wa_gateway;
