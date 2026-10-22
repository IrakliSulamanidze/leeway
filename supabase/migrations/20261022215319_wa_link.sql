-- WhatsApp bot, part 3: linking a WhatsApp number to a Leeway account, the
-- student cap with its waitlist, and the age answer.
--
-- Linking takes both halves, so one person must hold the account and the
-- phone (docs/adr/0003):
-- 1. An unlinked sender gets a one-time link to the bot's sign-in page.
-- 2. Signing in there with the Leeway email and password shows a 6-digit code.
--    The database accepts the sign-in only with a Supabase session for that
--    account created after the link was issued, so the bot's password alone
--    cannot link someone else's account.
-- 3. The code must come back from the same WhatsApp sender. A link forwarded to
--    someone else is useless: their code would arrive from the wrong number.

alter table wa.links add column adult boolean;

-- One row per unlinked sender. Failed sign-ins are counted per sender and day
-- and survive a new link, so asking again does not reset the limit.
create table wa.link_tokens (
  wa_id text primary key,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  failures smallint not null default 0,
  failed_on date,
  user_id uuid references auth.users (id) on delete cascade,
  code_hash bytea check (octet_length(code_hash) = 32),
  code_expires_at timestamptz,
  code_failures smallint not null default 0
);

-- Students who linked after the cap was reached, in order of arrival.
create table wa.waitlist (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  wa_id text not null unique,
  joined_at timestamptz not null default now()
);

-- Sign-in attempts per address per hour on the link page (address hashed).
create table wa.ip_attempts (
  ip_hash bytea not null check (octet_length(ip_hash) = 32),
  hour timestamptz not null,
  count integer not null default 0,
  primary key (ip_hash, hour)
);

alter table wa.link_tokens enable row level security;
alter table wa.waitlist enable row level security;
alter table wa.ip_attempts enable row level security;

-- Where a sender stands: 'active', 'suspended', 'waitlisted' (with its place in
-- line) or 'none'.
create function wa_api.link_state(p_wa_id text, out state text, out place integer)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  select l.status into state from wa.links l where l.wa_id = p_wa_id;
  if state is not null then
    return;
  end if;
  select w.place into place from (
    select wl.wa_id, row_number() over (order by wl.id)::integer as place from wa.waitlist wl
  ) w where w.wa_id = p_wa_id;
  state := case when place is null then 'none' else 'waitlisted' end;
end $$;

-- Stores a fresh link for an unlinked sender, replacing any earlier one and
-- any sign-in waiting for its code. The bot makes the token; only its hash is kept.
create function wa_api.issue_link_token(p_wa_id text, p_token_hash bytea) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Madrid')::date;
begin
  if exists (select 1 from wa.links l where l.wa_id = p_wa_id)
     or exists (select 1 from wa.waitlist w where w.wa_id = p_wa_id) then
    raise exception 'this number is already linked or waiting' using errcode = '23505';
  end if;
  insert into wa.link_tokens (wa_id, token_hash, issued_at, expires_at)
  values (p_wa_id, p_token_hash, now(), now() + interval '30 minutes')
  on conflict (wa_id) do update set
    token_hash = excluded.token_hash,
    issued_at = excluded.issued_at,
    expires_at = excluded.expires_at,
    failures = case when wa.link_tokens.failed_on < v_today then 0 else wa.link_tokens.failures end,
    user_id = null, code_hash = null, code_expires_at = null, code_failures = 0;
  delete from wa.link_tokens where expires_at < now() - interval '1 day';
end $$;

-- True while a link can still be used for signing in.
create function wa_api.link_token_ok(p_token_hash bytea) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from wa.link_tokens t
    where t.token_hash = p_token_hash and t.expires_at > now() and t.failures < 5
      and t.user_id is null
  )
$$;

-- Takes one of the 5 sign-in attempts a sender has per day, before the
-- password is checked, so parallel requests cannot all slip through.
create function wa_api.take_link_attempt(p_token_hash bytea) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  update wa.link_tokens t
  set failures = t.failures + 1, failed_on = (now() at time zone 'Europe/Madrid')::date
  where t.token_hash = p_token_hash and t.expires_at > now() and t.failures < 5
    and t.user_id is null
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

-- Records a sign-in that worked and the code the student must send back.
-- Outcomes: 'ok', 'expired', 'no_session', 'account_taken'.
create function wa_api.prepare_link(
  p_token_hash bytea, p_user_id uuid, p_session_id uuid, p_code_hash bytea)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row wa.link_tokens;
begin
  select * into v_row from wa.link_tokens t
  where t.token_hash = p_token_hash and t.expires_at > now() and t.user_id is null
  for update;
  if v_row.wa_id is null then
    return 'expired';
  end if;
  if not exists (
    select 1 from auth.sessions s
    where s.id = p_session_id and s.user_id = p_user_id
      and s.created_at >= v_row.issued_at
      and s.created_at > now() - interval '15 minutes'
  ) then
    return 'no_session';
  end if;
  if exists (select 1 from wa.links l where l.user_id = p_user_id)
     or exists (select 1 from wa.waitlist w where w.user_id = p_user_id) then
    return 'account_taken';
  end if;
  update wa.link_tokens set
    failures = greatest(failures - 1, 0),
    user_id = p_user_id, code_hash = p_code_hash,
    code_expires_at = now() + interval '10 minutes', code_failures = 0
  where wa_id = v_row.wa_id;
  return 'ok';
end $$;

-- The code sent back from WhatsApp. Outcomes: 'linked', 'waitlisted' (with
-- place), 'wrong_code', 'no_code', 'account_taken'.
create function wa_api.confirm_link(
  p_wa_id text, p_code_hash bytea, out outcome text, out place integer)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row wa.link_tokens;
  v_cap integer;
begin
  -- One linker at a time: the cap and the one-number-per-account rule hold
  -- even when two codes arrive together.
  lock table wa.links in share row exclusive mode;

  select * into v_row from wa.link_tokens t
  where t.wa_id = p_wa_id and t.user_id is not null and t.code_expires_at > now()
  for update;
  if v_row.wa_id is null then
    outcome := 'no_code';
    return;
  end if;
  if v_row.code_hash <> p_code_hash then
    update wa.link_tokens set
      code_failures = code_failures + 1,
      user_id = case when code_failures + 1 >= 5 then null else user_id end,
      code_hash = case when code_failures + 1 >= 5 then null else code_hash end
    where wa_id = p_wa_id;
    outcome := 'wrong_code';
    return;
  end if;

  delete from wa.link_tokens where wa_id = p_wa_id;
  if exists (select 1 from wa.links l where l.user_id = v_row.user_id or l.wa_id = p_wa_id)
     or exists (select 1 from wa.waitlist w where w.user_id = v_row.user_id or w.wa_id = p_wa_id) then
    outcome := 'account_taken';
    return;
  end if;

  select case when s.value #>> '{}' ~ '^[0-9]{1,6}$' then (s.value #>> '{}')::integer end
  into v_cap from wa.settings s where s.name = 'student_cap';
  -- Nobody jumps the queue: while anyone is waiting, newcomers wait too.
  if (select count(*) from wa.links l where l.status = 'active') < coalesce(v_cap, 50)
     and not exists (select 1 from wa.waitlist) then
    insert into wa.links (wa_id, user_id) values (p_wa_id, v_row.user_id);
    insert into wa.audit_log (user_id, event) values (v_row.user_id, 'linked');
    outcome := 'linked';
  else
    insert into wa.waitlist (user_id, wa_id) values (v_row.user_id, p_wa_id);
    insert into wa.audit_log (user_id, event) values (v_row.user_id, 'waitlisted');
    outcome := 'waitlisted';
    select w.place into place from (
      select wl.user_id, row_number() over (order by wl.id)::integer as place from wa.waitlist wl
    ) w where w.user_id = v_row.user_id;
  end if;
end $$;

-- Counts a sign-in attempt from one address this hour and returns the count.
create function wa_api.count_ip_attempt(p_ip_hash bytea) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into wa.ip_attempts (ip_hash, hour, count) values (p_ip_hash, date_trunc('hour', now()), 1)
  on conflict (ip_hash, hour) do update set count = wa.ip_attempts.count + 1
  returning count into v_count;
  delete from wa.ip_attempts where hour < now() - interval '1 day';
  return v_count;
end $$;

-- Inside a turn: the student's age answer (once), and whether it is missing.
create function wa_api.set_adult(p_adult boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
begin
  update wa.links set adult = p_adult where user_id = v_user and adult is null;
  if not found then
    return;
  end if;
  insert into wa.audit_log (user_id, event, details)
  values (v_user, 'age_answered', jsonb_build_object('adult', p_adult));
end $$;

create function wa_api.my_link() returns table (adult boolean)
language sql stable security definer
set search_path = ''
as $$
  select l.adult from wa.links l where l.user_id = wa.acting_user()
$$;

revoke all on wa.link_tokens, wa.waitlist, wa.ip_attempts from public, anon, authenticated, service_role;
revoke execute on function
  wa_api.link_state(text), wa_api.issue_link_token(text, bytea), wa_api.link_token_ok(bytea),
  wa_api.take_link_attempt(bytea), wa_api.prepare_link(bytea, uuid, uuid, bytea),
  wa_api.confirm_link(text, bytea), wa_api.count_ip_attempt(bytea),
  wa_api.set_adult(boolean), wa_api.my_link()
  from public, anon, authenticated, service_role;
grant execute on function
  wa_api.link_state(text), wa_api.issue_link_token(text, bytea), wa_api.link_token_ok(bytea),
  wa_api.take_link_attempt(bytea), wa_api.prepare_link(bytea, uuid, uuid, bytea),
  wa_api.confirm_link(text, bytea), wa_api.count_ip_attempt(bytea),
  wa_api.set_adult(boolean), wa_api.my_link()
  to wa_gateway;
