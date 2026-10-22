-- WhatsApp bot, part 8: classmates sharing test dates, with consent.
--
-- A student asks for a share code and gives it to a classmate in their own
-- chat; the bot never looks anyone up. The classmate sends the code to the
-- bot, sees exactly what would be shared, and taps Allow, Not now or Block.
-- Only test titles and dates flow, only for courses both have (by the
-- course name both use), and either side can stop at once. A "no" is never
-- reported back: the asker sees nothing either way.
--
-- Classmates' dates appear in chat answers only once wa.settings
-- 'shared_in_chat' is true, after Meta confirms its policy allows it.

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

create table wa.share_blocks (
  grantor_id uuid not null references auth.users (id) on delete cascade,
  requester_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (grantor_id, requester_id)
);

alter table wa.share_codes enable row level security;
alter table wa.share_grants enable row level security;
alter table wa.share_blocks enable row level security;

insert into wa.settings (name, value) values ('shared_in_chat', 'false');

-- Inside a turn: a new code for the acting student, valid 7 days. At most 5
-- a day and 3 classmates followed at once.
create function wa_api.new_share_code(p_code_hash bytea) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
begin
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

-- Courses two students both have, matched on the course name each uses.
create function wa.shared_courses(p_a uuid, p_b uuid) returns table (name text)
language sql stable security definer
set search_path = ''
as $$
  select a.name from public.courses a
  join public.courses b on b.name_key = a.name_key and b.user_id = p_b
  where a.user_id = p_a
  order by a.name
$$;
revoke execute on function wa.shared_courses(uuid, uuid) from public, anon, authenticated, service_role;

-- Inside the classmate's turn: what a code would share. Outcomes: 'ok' (with
-- the courses), 'expired', 'self', 'already', 'nothing_shared'. A blocked
-- asker's code reads as expired.
create function wa_api.share_preview(p_code_hash bytea, out outcome text, out courses text[])
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
  v_owner uuid;
begin
  select c.owner_id into v_owner from wa.share_codes c
  where c.code_hash = p_code_hash and c.used_at is null and c.expires_at > now();
  if v_owner is null
     or exists (select 1 from wa.share_blocks b where b.grantor_id = v_user and b.requester_id = v_owner) then
    outcome := 'expired';
    return;
  end if;
  if v_owner = v_user then
    outcome := 'self';
    return;
  end if;
  if exists (select 1 from wa.share_grants g
             where g.grantor_id = v_user and g.follower_id = v_owner and g.status = 'active') then
    outcome := 'already';
    return;
  end if;
  select array_agg(s.name) into courses from wa.shared_courses(v_user, v_owner) s;
  outcome := case when courses is null then 'nothing_shared' else 'ok' end;
end $$;

-- Inside the classmate's turn: the answer to a code. 'allow' starts sharing,
-- 'block' stops this asker's codes for good, 'not_now' only uses the code.
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
  update wa.share_codes c set used_at = now()
  where c.code_hash = p_code_hash and c.used_at is null and c.expires_at > now()
    and c.owner_id <> v_user
  returning c.owner_id into v_owner;
  if v_owner is null then
    return 'expired';
  end if;
  if p_answer = 'block' then
    insert into wa.share_blocks (grantor_id, requester_id) values (v_user, v_owner) on conflict do nothing;
  elsif p_answer = 'allow' then
    if exists (select 1 from wa.share_blocks b where b.grantor_id = v_user and b.requester_id = v_owner) then
      return 'expired';
    end if;
    if (select count(*) from wa.share_grants g where g.grantor_id = v_user and g.status = 'active') >= 60 then
      return 'full';
    end if;
    if (select count(*) from wa.share_grants g where g.follower_id = v_owner and g.status = 'active') >= 3 then
      return 'full';
    end if;
    insert into wa.share_grants (grantor_id, follower_id) values (v_user, v_owner)
    on conflict (grantor_id, follower_id) do update set status = 'active', created_at = now(), ended_at = null;
  end if;
  insert into wa.audit_log (user_id, event, details)
  values (v_user, 'share_answer', jsonb_build_object('answer', p_answer));
  return p_answer;
end $$;

-- Inside the follower's turn: classmates' tests in a date range, for courses
-- both have, mapped onto the follower's own course. Empty while
-- 'shared_in_chat' is off.
create function wa_api.shared_tests(p_from date, p_to date)
returns table (course_id uuid, title text, on_date date)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
begin
  if coalesce((select s.value from wa.settings s where s.name = 'shared_in_chat'), 'false'::jsonb) <> 'true'::jsonb then
    return;
  end if;
  return query
    select distinct mine.id, a.title, coalesce(a.on_date, (cs.starts_at at time zone 'Europe/Madrid')::date)
    from wa.share_grants g
    join public.courses theirs on theirs.user_id = g.grantor_id
    join public.courses mine on mine.user_id = v_user and mine.name_key = theirs.name_key
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

revoke all on wa.share_codes, wa.share_grants, wa.share_blocks from public, anon, authenticated, service_role;
revoke execute on function
  wa_api.new_share_code(bytea), wa_api.share_preview(bytea), wa_api.answer_share(bytea, text),
  wa_api.shared_tests(date, date), wa_api.stop_sharing(), wa_api.stop_following()
  from public, anon, authenticated, service_role;
grant execute on function
  wa_api.new_share_code(bytea), wa_api.share_preview(bytea), wa_api.answer_share(bytea, text),
  wa_api.shared_tests(date, date), wa_api.stop_sharing(), wa_api.stop_following()
  to wa_gateway;
