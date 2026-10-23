-- WhatsApp bot, part 7: reminders Leeway sends on its own (the evening
-- heads-up and the Sunday look-ahead), at most one a day per student.
--
-- Listing students is more than one turn may do, so the job's function asks
-- for the scheduler's secret, checked against a hash set by hand
-- (docs/bot/runbook.md). The bot's database password alone lists nobody.

alter table wa.links add column hide_details boolean not null default false;
alter table wa.links add column last_reminded_on date;
-- When the student last wrote. Only the inbound path sets it, so a reminder
-- job's own turns never look like the student talking (Meta's 24-hour window).
alter table wa.links add column last_inbound_at timestamptz;

create function wa_api.mark_inbound(p_wa_id text) returns void
language sql security definer
set search_path = ''
as $$
  update wa.links set last_inbound_at = now()
  where wa_id = p_wa_id and (last_inbound_at is null or last_inbound_at < now() - interval '1 minute')
$$;

-- sha256 of the scheduler's secret, as hex in small letters. Empty until set.
insert into wa.settings (name, value) values ('reminder_secret_hash', '""');

-- Linked students who have answered the age question and have not had a
-- reminder today. Opt-outs are keyed by a hash only the bot can make, so the
-- bot drops those itself (wa_api.opted_out).
create function wa_api.reminder_targets(p_secret text)
returns table (wa_id text, last_inbound_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  select s.value #>> '{}' into v_hash from wa.settings s where s.name = 'reminder_secret_hash';
  if coalesce(v_hash, '') = ''
     or encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex') <> v_hash then
    raise exception 'not allowed' using errcode = '28000';
  end if;
  return query
    select l.wa_id, l.last_inbound_at from wa.links l
    where l.status = 'active' and l.adult is not null
      and (l.last_reminded_on is null
           or l.last_reminded_on < (now() at time zone 'Europe/Madrid')::date);
end $$;

create function wa_api.opted_out(p_sender_hash bytea) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from wa.opt_outs o where o.sender_hash = p_sender_hash)
$$;

-- Inside a turn: claims today's reminder. False when one already went out,
-- so two runs on one day send once.
create function wa_api.claim_reminder() returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_done boolean;
begin
  update wa.links set last_reminded_on = v_today
  where user_id = wa.acting_user()
    and (last_reminded_on is null or last_reminded_on < v_today)
  returning true into v_done;
  return coalesce(v_done, false);
end $$;

-- Inside a turn: gives back today's claim when Meta refused the message
-- outright, so a fixed problem does not cost the student a day.
create function wa_api.unclaim_reminder() returns void
language sql security definer
set search_path = ''
as $$
  update wa.links set last_reminded_on = null
  where user_id = wa.acting_user() and last_reminded_on = (now() at time zone 'Europe/Madrid')::date
$$;

-- Inside a turn: show reminder details on the lock screen, or counts only.
create function wa_api.set_hide_details(p_hide boolean) returns void
language sql security definer
set search_path = ''
as $$
  update wa.links set hide_details = p_hide where user_id = wa.acting_user()
$$;

drop function wa_api.my_profile();
create function wa_api.my_profile() returns table (adult boolean, voice text, hide_details boolean)
language sql stable security definer
set search_path = ''
as $$
  select l.adult, l.voice, l.hide_details from wa.links l where l.user_id = wa.acting_user()
$$;

revoke execute on function
  wa_api.reminder_targets(text), wa_api.opted_out(bytea), wa_api.claim_reminder(),
  wa_api.unclaim_reminder(), wa_api.mark_inbound(text), wa_api.set_hide_details(boolean), wa_api.my_profile()
  from public, anon, authenticated, service_role;
grant execute on function
  wa_api.reminder_targets(text), wa_api.opted_out(bytea), wa_api.claim_reminder(),
  wa_api.unclaim_reminder(), wa_api.mark_inbound(text), wa_api.set_hide_details(boolean), wa_api.my_profile()
  to wa_gateway;
