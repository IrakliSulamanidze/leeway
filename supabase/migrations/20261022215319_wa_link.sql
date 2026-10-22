-- WhatsApp bot, part 3: linking a WhatsApp number to a Leeway account, the
-- student cap with its waitlist, and the age answer.
--
-- A student who writes to the bot unlinked gets a one-time link to the bot's
-- sign-in page. Signing in there with their Leeway email and password completes
-- the link. The database only accepts that when Supabase holds a session for the
-- account created in the last 15 minutes, so the bot's password alone cannot
-- link someone else's account.

alter table wa.links add column adult boolean;

create table wa.link_tokens (
  token_hash bytea primary key check (octet_length(token_hash) = 32),
  wa_id text not null unique,
  expires_at timestamptz not null,
  failures smallint not null default 0
);

-- Students who linked after the cap was reached, in order of arrival.
create table wa.waitlist (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  wa_id text not null unique,
  joined_at timestamptz not null default now()
);

alter table wa.link_tokens enable row level security;
alter table wa.waitlist enable row level security;

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

-- Stores a fresh link token for an unlinked sender, replacing any earlier one.
-- The bot makes the token and keeps only its hash here.
create function wa_api.issue_link_token(p_wa_id text, p_token_hash bytea) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from wa.links l where l.wa_id = p_wa_id) then
    raise exception 'this number is already linked' using errcode = '23505';
  end if;
  insert into wa.link_tokens (token_hash, wa_id, expires_at)
  values (p_token_hash, p_wa_id, now() + interval '30 minutes')
  on conflict (wa_id) do update
    set token_hash = excluded.token_hash, expires_at = excluded.expires_at, failures = 0;
  delete from wa.link_tokens where expires_at < now() - interval '1 day';
end $$;

-- True while a token can still be used. The sign-in page checks it first.
create function wa_api.link_token_ok(p_token_hash bytea) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from wa.link_tokens t
    where t.token_hash = p_token_hash and t.expires_at > now() and t.failures < 5
  )
$$;

-- Counts a failed sign-in on the page; five burn the token.
create function wa_api.link_failed(p_token_hash bytea) returns void
language sql security definer
set search_path = ''
as $$
  update wa.link_tokens set failures = failures + 1 where token_hash = p_token_hash
$$;

-- Completes a link. Outcomes: 'linked', 'waitlisted' (with place), 'expired',
-- 'no_session', 'account_taken' (the account is linked to another number).
create function wa_api.complete_link(
  p_token_hash bytea, p_user_id uuid, p_session_id uuid,
  out outcome text, out place integer)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_wa_id text;
  v_cap integer;
begin
  select t.wa_id into v_wa_id from wa.link_tokens t
  where t.token_hash = p_token_hash and t.expires_at > now() and t.failures < 5
  for update;
  if v_wa_id is null then
    outcome := 'expired';
    return;
  end if;

  if not exists (
    select 1 from auth.sessions s
    where s.id = p_session_id and s.user_id = p_user_id
      and s.created_at > now() - interval '15 minutes'
  ) then
    outcome := 'no_session';
    return;
  end if;

  if exists (select 1 from wa.links l where l.user_id = p_user_id and l.wa_id <> v_wa_id)
     or exists (select 1 from wa.waitlist w where w.user_id = p_user_id and w.wa_id <> v_wa_id) then
    outcome := 'account_taken';
    return;
  end if;

  delete from wa.link_tokens where token_hash = p_token_hash;

  -- One linker at a time, so two sign-ins cannot both take the last place.
  lock table wa.links in share row exclusive mode;
  select coalesce((s.value #>> '{}')::integer, 50) into v_cap
  from wa.settings s where s.name = 'student_cap';
  if (select count(*) from wa.links l where l.status = 'active') < coalesce(v_cap, 50) then
    insert into wa.links (wa_id, user_id) values (v_wa_id, p_user_id);
    delete from wa.waitlist where user_id = p_user_id;
    insert into wa.audit_log (user_id, event) values (p_user_id, 'linked');
    outcome := 'linked';
  else
    insert into wa.waitlist (user_id, wa_id) values (p_user_id, v_wa_id)
    on conflict (user_id) do nothing;
    insert into wa.audit_log (user_id, event) values (p_user_id, 'waitlisted');
    outcome := 'waitlisted';
    select w.place into place from (
      select wl.user_id, row_number() over (order by wl.id)::integer as place from wa.waitlist wl
    ) w where w.user_id = p_user_id;
  end if;
end $$;

-- Inside a turn: the student's age answer, and whether it is still missing.
create function wa_api.set_adult(p_adult boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
begin
  update wa.links set adult = p_adult where user_id = v_user;
  insert into wa.audit_log (user_id, event, details)
  values (v_user, 'age_answered', jsonb_build_object('adult', p_adult));
end $$;

create function wa_api.my_link() returns table (adult boolean)
language sql stable security definer
set search_path = ''
as $$
  select l.adult from wa.links l where l.user_id = wa.acting_user()
$$;

revoke all on wa.link_tokens, wa.waitlist from public, anon, authenticated, service_role;
revoke execute on function
  wa_api.link_state(text), wa_api.issue_link_token(text, bytea), wa_api.link_token_ok(bytea),
  wa_api.link_failed(bytea), wa_api.complete_link(bytea, uuid, uuid),
  wa_api.set_adult(boolean), wa_api.my_link()
  from public, anon, authenticated, service_role;
grant execute on function
  wa_api.link_state(text), wa_api.issue_link_token(text, bytea), wa_api.link_token_ok(bytea),
  wa_api.link_failed(bytea), wa_api.complete_link(bytea, uuid, uuid),
  wa_api.set_adult(boolean), wa_api.my_link()
  to wa_gateway;
