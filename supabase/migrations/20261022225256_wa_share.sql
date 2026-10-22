-- WhatsApp bot, part 8: classmates sharing test dates, with consent.
--
-- A student asks for a share code and gives it to a classmate in their own
-- chat; the bot never looks anyone up. The classmate sends the code to the
-- bot, sees exactly which courses would be shared, and taps Allow, Not now or
-- Block. Only a short test name and its date flow, only for the courses shown
-- at that moment, and either side can stop at once. A "no" is never reported.
--
-- All of it stays closed until wa.settings 'shared_in_chat' is true, after
-- Meta confirms its policy allows passing this between customers.

create table wa.share_codes (
  code_hash bytea primary key check (octet_length(code_hash) = 32),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index share_codes_owner on wa.share_codes (owner_id, created_at);

create table wa.share_grants (
  grantor_id uuid not null references auth.users (id) on delete cascade,
  follower_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  primary key (grantor_id, follower_id),
  check (grantor_id <> follower_id)
);
create index share_grants_follower on wa.share_grants (follower_id) where status = 'active';

-- The courses the classmate agreed to, fixed at the moment of Allow. A course
-- added later is never shared without a new Allow.
create table wa.share_grant_courses (
  grantor_id uuid not null,
  follower_id uuid not null,
  name_key text not null,
  primary key (grantor_id, follower_id, name_key),
  foreign key (grantor_id, follower_id) references wa.share_grants (grantor_id, follower_id) on delete cascade
);

create table wa.share_blocks (
  grantor_id uuid not null references auth.users (id) on delete cascade,
  requester_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (grantor_id, requester_id)
);

alter table wa.share_codes enable row level security;
alter table wa.share_grants enable row level security;
alter table wa.share_grant_courses enable row level security;
alter table wa.share_blocks enable row level security;

insert into wa.settings (name, value) values ('shared_in_chat', 'false');

create function wa.sharing_open() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select s.value = 'true'::jsonb from wa.settings s where s.name = 'shared_in_chat'), false)
$$;

-- A student who unlinks WhatsApp stops sharing and following: the chat was
-- their only way to stop it.
create function wa.end_shares_on_unlink() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update wa.share_grants set status = 'revoked', ended_at = now()
  where status = 'active' and (grantor_id = old.user_id or follower_id = old.user_id);
  return old;
end $$;
create trigger links_end_shares after delete on wa.links
  for each row execute function wa.end_shares_on_unlink();

-- Courses two students both have, matched on the course name each uses.
create function wa.shared_courses(p_a uuid, p_b uuid) returns table (name text, name_key text)
language sql stable security definer
set search_path = ''
as $$
  select a.name, a.name_key from public.courses a
  join public.courses b on b.name_key = a.name_key and b.user_id = p_b
  where a.user_id = p_a
  order by a.name
$$;
revoke execute on function wa.shared_courses(uuid, uuid), wa.sharing_open(), wa.end_shares_on_unlink()
  from public, anon, authenticated, service_role;

-- Inside a turn: a new code for the acting student, valid 7 days. At most 5
-- a day and 3 classmates followed at once.
create function wa_api.new_share_code(p_code_hash bytea) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
begin
  if not wa.sharing_open() then
    return 'closed';
  end if;
  if (select count(*) from wa.share_codes c
      where c.owner_id = v_user and c.created_at > now() - interval '1 day') >= 5 then
    return 'too_many';
  end if;
  if (select count(*) from wa.share_grants g
      where g.follower_id = v_user and g.status = 'active') >= 3 then
    return 'full';
  end if;
  insert into wa.share_codes (code_hash, owner_id, expires_at)
  values (p_code_hash, v_user, now() + interval '7 days');
  delete from wa.share_codes where expires_at < now() - interval '30 days';
  return 'ok';
end $$;

-- Inside the classmate's turn: what a code would share. Outcomes: 'ok' (with
-- the courses), 'expired', 'self', 'nothing_shared', 'closed'. A used,
-- blocked or already-granted code reads as expired, so a code says nothing
-- about who gave it.
create function wa_api.share_preview(p_code_hash bytea, out outcome text, out courses text[])
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
  v_owner uuid;
begin
  if not wa.sharing_open() then
    outcome := 'closed';
    return;
  end if;
  select c.owner_id into v_owner from wa.share_codes c
  where c.code_hash = p_code_hash and c.used_at is null and c.expires_at > now();
  if v_owner = v_user then
    outcome := 'self';
    return;
  end if;
  if v_owner is null
     or exists (select 1 from wa.share_blocks b where b.grantor_id = v_user and b.requester_id = v_owner)
     or exists (select 1 from wa.share_grants g
                where g.grantor_id = v_user and g.follower_id = v_owner and g.status = 'active') then
    outcome := 'expired';
    return;
  end if;
  select array_agg(s.name) into courses from wa.shared_courses(v_user, v_owner) s;
  outcome := case when courses is null then 'nothing_shared' else 'ok' end;
end $$;

-- Inside the classmate's turn: the answer to a code. Outcomes: the answer
-- given, 'expired', 'closed', 'you_full' (the classmate shares with 60
-- already), 'they_full' (the asker follows 3). A full outcome leaves the code
-- unused.
create function wa_api.answer_share(p_code_hash bytea, p_answer text) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
  v_owner uuid;
begin
  if p_answer not in ('allow', 'not_now', 'block') then
    raise exception 'unknown answer' using errcode = '22023';
  end if;
  if not wa.sharing_open() then
    return 'closed';
  end if;
  select c.owner_id into v_owner from wa.share_codes c
  where c.code_hash = p_code_hash and c.used_at is null and c.expires_at > now() and c.owner_id <> v_user
  for update;
  if v_owner is null
     or exists (select 1 from wa.share_blocks b where b.grantor_id = v_user and b.requester_id = v_owner) then
    return 'expired';
  end if;

  if p_answer = 'allow' then
    -- One answer at a time per asker, so their follow limit holds.
    perform pg_advisory_xact_lock(hashtext('wa_share:' || v_owner::text));
    if (select count(*) from wa.share_grants g where g.grantor_id = v_user and g.status = 'active') >= 60 then
      return 'you_full';
    end if;
    if (select count(*) from wa.share_grants g where g.follower_id = v_owner and g.status = 'active') >= 3 then
      return 'they_full';
    end if;
    insert into wa.share_grants (grantor_id, follower_id) values (v_user, v_owner)
    on conflict (grantor_id, follower_id) do update set status = 'active', created_at = now(), ended_at = null;
    delete from wa.share_grant_courses where grantor_id = v_user and follower_id = v_owner;
    insert into wa.share_grant_courses (grantor_id, follower_id, name_key)
    select v_user, v_owner, s.name_key from wa.shared_courses(v_user, v_owner) s;
  elsif p_answer = 'block' then
    insert into wa.share_blocks (grantor_id, requester_id) values (v_user, v_owner) on conflict do nothing;
  end if;

  update wa.share_codes set used_at = now() where code_hash = p_code_hash;
  insert into wa.audit_log (user_id, event, details)
  values (v_user, 'share_answer', jsonb_build_object('answer', p_answer));
  return p_answer;
end $$;

-- Inside the follower's turn: classmates' tests in a date range, only for
-- the courses each classmate agreed to, mapped onto the follower's own
-- course. The name is cut to a short label and the classmate is only a
-- number within this answer. Empty while sharing is closed.
create function wa_api.shared_tests(p_from date, p_to date)
returns table (course_id uuid, title text, on_date date, source integer)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
begin
  if not wa.sharing_open() then
    return;
  end if;
  return query
    select distinct mine.id,
      left(regexp_replace(a.title, '[^[:alnum:] ]', '', 'g'), 40),
      coalesce(a.on_date, (cs.starts_at at time zone 'Europe/Madrid')::date),
      (dense_rank() over (order by g.grantor_id))::integer
    from wa.share_grants g
    join wa.share_grant_courses gc on gc.grantor_id = g.grantor_id and gc.follower_id = g.follower_id
    join public.courses theirs on theirs.user_id = g.grantor_id and theirs.name_key = gc.name_key
    join public.courses mine on mine.user_id = v_user and mine.name_key = gc.name_key
    join public.assessments a on a.course_id = theirs.id and a.user_id = g.grantor_id
    left join public.class_sessions cs on cs.id = a.class_session_id and cs.user_id = g.grantor_id
    where g.follower_id = v_user and g.status = 'active'
      and coalesce(a.on_date, (cs.starts_at at time zone 'Europe/Madrid')::date) between p_from and p_to;
end $$;

-- Inside a turn: stop everything the student shares, or everything they follow.
create function wa_api.stop_sharing() returns integer
language sql security definer
set search_path = ''
as $$
  with ended as (
    update wa.share_grants set status = 'revoked', ended_at = now()
    where grantor_id = wa.acting_user() and status = 'active'
    returning 1
  ) select count(*)::integer from ended
$$;

create function wa_api.stop_following() returns integer
language sql security definer
set search_path = ''
as $$
  with ended as (
    update wa.share_grants set status = 'revoked', ended_at = now()
    where follower_id = wa.acting_user() and status = 'active'
    returning 1
  ) select count(*)::integer from ended
$$;

revoke all on wa.share_codes, wa.share_grants, wa.share_grant_courses, wa.share_blocks
  from public, anon, authenticated, service_role;
revoke execute on function
  wa_api.new_share_code(bytea), wa_api.share_preview(bytea), wa_api.answer_share(bytea, text),
  wa_api.shared_tests(date, date), wa_api.stop_sharing(), wa_api.stop_following()
  from public, anon, authenticated, service_role;
grant execute on function
  wa_api.new_share_code(bytea), wa_api.share_preview(bytea), wa_api.answer_share(bytea, text),
  wa_api.shared_tests(date, date), wa_api.stop_sharing(), wa_api.stop_following()
  to wa_gateway;
