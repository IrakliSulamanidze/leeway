-- WhatsApp bot, part 2: checks that run before a message is read. Message ids
-- and senders are stored only as keyed hashes made by the bot (32 bytes), so
-- these tables hold no phone numbers or Meta ids.

-- Meta redelivers webhooks; a message is handled once. A claim is a lease: if
-- the bot dies mid-message without finishing it, Meta's next retry may claim
-- it again after 30 seconds.
create table wa.seen_messages (
  id_hash bytea primary key check (octet_length(id_hash) = 32),
  seen_at timestamptz not null default now(),
  done_at timestamptz
);
create index seen_messages_seen_at on wa.seen_messages (seen_at);

-- Messages per sender per Madrid day, for the daily cap.
create table wa.sender_days (
  sender_hash bytea not null check (octet_length(sender_hash) = 32),
  day date not null,
  count integer not null default 0,
  primary key (sender_hash, day)
);

-- Senders who sent STOP: no reminders until they send START.
create table wa.opt_outs (
  sender_hash bytea primary key check (octet_length(sender_hash) = 32),
  at timestamptz not null default now()
);

alter table wa.seen_messages enable row level security;
alter table wa.sender_days enable row level security;
alter table wa.opt_outs enable row level security;

insert into wa.settings (name, value) values ('daily_message_cap', '60');

-- True when the bot may handle the message now: it is new, or an earlier
-- attempt neither finished nor released it within 30 seconds. Meta retries
-- for up to 7 days, so entries are kept for 8.
create function wa_api.claim_message(p_id_hash bytea) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_new boolean;
begin
  insert into wa.seen_messages (id_hash) values (p_id_hash)
  on conflict (id_hash) do update set seen_at = now()
    where wa.seen_messages.done_at is null
      and wa.seen_messages.seen_at < now() - interval '30 seconds'
  returning true into v_new;
  delete from wa.seen_messages
  where id_hash in (
    select s.id_hash from wa.seen_messages s
    where s.seen_at < now() - interval '8 days'
    limit 100
    for update skip locked
  );
  return coalesce(v_new, false);
end $$;

-- Marks a message handled for good.
create function wa_api.finish_message(p_id_hash bytea) returns void
language sql security definer
set search_path = ''
as $$
  update wa.seen_messages set done_at = now() where id_hash = p_id_hash
$$;

-- Lets a message that failed be handled again when Meta retries it.
create function wa_api.release_message(p_id_hash bytea) returns void
language sql security definer
set search_path = ''
as $$
  delete from wa.seen_messages where id_hash = p_id_hash
$$;

-- Counts one message from a sender today (Madrid) and returns the new count
-- with the cap from wa.settings.
create function wa_api.count_message(p_sender_hash bytea, out msg_count integer, out cap integer)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Europe/Madrid')::date;
begin
  insert into wa.sender_days (sender_hash, day, count) values (p_sender_hash, v_day, 1)
  on conflict (sender_hash, day) do update set count = wa.sender_days.count + 1
  returning wa.sender_days.count into msg_count;
  -- A setting that is not a whole number falls back to 60 rather than failing
  -- every message.
  select case when s.value #>> '{}' ~ '^[0-9]{1,6}$' then (s.value #>> '{}')::integer end
  into cap
  from wa.settings s where s.name = 'daily_message_cap';
  cap := coalesce(cap, 60);
  delete from wa.sender_days where day < v_day - 2;
end $$;

create function wa_api.set_opt_out(p_sender_hash bytea, p_opted_out boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_opted_out then
    insert into wa.opt_outs (sender_hash) values (p_sender_hash) on conflict do nothing;
  else
    delete from wa.opt_outs where sender_hash = p_sender_hash;
  end if;
end $$;

revoke all on wa.seen_messages, wa.sender_days, wa.opt_outs from public, anon, authenticated, service_role;
revoke execute on function
  wa_api.claim_message(bytea), wa_api.finish_message(bytea), wa_api.release_message(bytea),
  wa_api.count_message(bytea), wa_api.set_opt_out(bytea, boolean)
  from public, anon, authenticated, service_role;
grant execute on function
  wa_api.claim_message(bytea), wa_api.finish_message(bytea), wa_api.release_message(bytea),
  wa_api.count_message(bytea), wa_api.set_opt_out(bytea, boolean)
  to wa_gateway;
