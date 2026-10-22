-- WhatsApp bot, part 1: the wa schema, the bot's database role and turn grants.
-- Additive only: no public table, policy or function changes (docs/adr/0002).
--
-- The bot logs in as wa_gateway, which owns nothing and can read no table. It can
-- only call the wa functions granted below. Every turn opens with
-- wa.begin_turn(wa_id), which records which student this transaction acts for;
-- the other wa functions take the student from that grant, never from a
-- parameter, so one transaction can never act for two students.

create schema wa;
revoke all on schema wa from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'wa_gateway') then
    -- LOGIN and a password are set by hand, outside git (docs/bot/database.md).
    create role wa_gateway nologin noinherit nobypassrls;
  end if;
end $$;

alter role wa_gateway set statement_timeout = '3s';
alter role wa_gateway set lock_timeout = '2s';
alter role wa_gateway set idle_in_transaction_session_timeout = '10s';
grant usage on schema wa to wa_gateway;

-- A WhatsApp number linked to one Leeway account. One number per account and
-- one account per number.
create table wa.links (
  wa_id text primary key check (wa_id ~ '^[0-9]{6,20}$'),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz
);

-- One row per transaction that acts for a student. Written only by begin_turn.
create table wa.turn_grants (
  xid xid8 primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index turn_grants_created_at on wa.turn_grants (created_at);

-- Switches that change without a deploy: the kill switch and the student cap.
create table wa.settings (
  name text primary key check (name ~ '^[a-z_]{1,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into wa.settings (name, value) values
  ('paused', 'false'),
  ('student_cap', '50');

-- Append-only record of security and consent events. No message content.
create table wa.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  event text not null check (event ~ '^[a-z_]{1,40}$'),
  details jsonb not null default '{}'
);

alter table wa.links enable row level security;
alter table wa.turn_grants enable row level security;
alter table wa.settings enable row level security;
alter table wa.audit_log enable row level security;

-- Opens a turn for the student linked to p_wa_id. One turn per transaction: a
-- second call in the same transaction is refused, whoever it is for.
create function wa.begin_turn(p_wa_id text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if exists (select 1 from wa.turn_grants g where g.xid = pg_current_xact_id()) then
    raise exception 'a turn is already open in this transaction' using errcode = '25001';
  end if;
  select l.user_id into v_user
  from wa.links l
  where l.wa_id = p_wa_id and l.status = 'active';
  if v_user is null then
    raise exception 'no active link for this number' using errcode = '28000';
  end if;
  insert into wa.turn_grants (xid, user_id) values (pg_current_xact_id(), v_user);
  update wa.links set last_seen_at = now() where wa_id = p_wa_id;
  delete from wa.turn_grants where created_at < now() - interval '1 day';
end $$;

-- The student this transaction acts for. Internal: called by other wa functions,
-- never by the bot directly.
create function wa.acting_user() returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select g.user_id into v_user
  from wa.turn_grants g
  where g.xid = pg_current_xact_id_if_assigned();
  if v_user is null then
    raise exception 'no turn is open in this transaction' using errcode = '28000';
  end if;
  return v_user;
end $$;

-- Reads one switch. Needs no turn: the kill switch is checked before linking.
create function wa.setting(p_name text) returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select s.value from wa.settings s where s.name = p_name
$$;

revoke all on all tables in schema wa from public, anon, authenticated, service_role;
revoke all on all sequences in schema wa from public, anon, authenticated, service_role;
revoke execute on all functions in schema wa from public, anon, authenticated, service_role;
grant execute on function wa.begin_turn(text) to wa_gateway;
grant execute on function wa.setting(text) to wa_gateway;
