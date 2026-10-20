-- The rest of the schema (tech-plan 2-4): calendar, tests, syllabus, notices,
-- weekly checks, AI usage, push and alert log. Every table is locked to its owner,
-- children point at parents through (parent_id, user_id), anon gets nothing.

-- Calendar feeds. The url is a secret: clients can never select it (column grants
-- below); only feed_url_for_sync hands it to the caller's own server request.
create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url text not null check (url ~ '^https://' and char_length(url) <= 2048),
  status text not null default 'new' check (status in ('new', 'ok', 'failed')),
  last_synced_at timestamptz,
  last_attempt_at timestamptz,
  -- Fixed messages only (src/lib/calendar/errors.ts), never anything from the feed.
  last_error text check (last_error in (
    'That link is not a calendar link we can use.',
    'The calendar did not answer in time.',
    'The calendar is too big.',
    'That link is not a calendar.',
    'The calendar could not be reached.',
    'The calendar could not be read.',
    'The calendar changed too much, so we kept your last data.'
  )),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, url)
);

create table public.feed_course_map (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feed_id uuid not null,
  source_key text check (char_length(source_key) between 1 and 300),
  source_hash text not null check (char_length(source_hash) between 1 and 128),
  course_id uuid,
  status text not null default 'pending' check (status in ('pending', 'mapped', 'ignored')),
  created_at timestamptz not null default now(),
  -- An ignored key keeps only its hash, so a personal event's title is never stored.
  check (status <> 'ignored' or source_key is null),
  check (status <> 'mapped' or course_id is not null),
  unique (feed_id, source_hash),
  foreign key (feed_id, user_id) references public.calendar_feeds (id, user_id) on delete cascade,
  foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade
);
create index feed_course_map_user_id_idx on public.feed_course_map (user_id);
create index feed_course_map_course_id_user_id_idx on public.feed_course_map (course_id, user_id);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feed_id uuid not null,
  course_id uuid not null,
  uid text not null check (char_length(uid) between 1 and 1000),
  original_start timestamptz not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  kind text not null check (kind in ('class', 'async', 'extra', 'exam', 'deadline')),
  session_numbers int[] not null default '{}',
  is_exam_slot boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  unique (feed_id, uid, original_start),
  unique (id, user_id),
  foreign key (feed_id, user_id) references public.calendar_feeds (id, user_id) on delete cascade,
  foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade
);
create index class_sessions_user_id_starts_at_idx on public.class_sessions (user_id, starts_at);
create index class_sessions_course_id_starts_at_idx on public.class_sessions (course_id, starts_at);
create index class_sessions_course_id_user_id_idx on public.class_sessions (course_id, user_id);

-- A skip can point at the class it missed; deleting the class keeps the skip.
alter table public.skips add constraint skips_class_session_id_user_id_fkey
  foreign key (class_session_id, user_id) references public.class_sessions (id, user_id)
  on delete set null (class_session_id);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  class_session_id uuid,
  session_number int check (session_number between 1 and 200),
  on_date date,
  title text not null check (char_length(title) between 1 and 200),
  weight numeric(5, 2) check (weight between 0 and 100),
  weight_assumed boolean not null default false,
  source text not null check (source in ('manual', 'syllabus', 'feed')),
  created_at timestamptz not null default now(),
  check (session_number is not null or on_date is not null or class_session_id is not null),
  foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade,
  foreign key (class_session_id, user_id) references public.class_sessions (id, user_id)
    on delete set null (class_session_id)
);
create index assessments_course_id_user_id_idx on public.assessments (course_id, user_id);
create index assessments_class_session_id_user_id_idx on public.assessments (class_session_id, user_id);
create index assessments_user_id_idx on public.assessments (user_id);

create table public.syllabus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  session_number int not null check (session_number between 1 and 200),
  topic text not null check (char_length(topic) between 1 and 500),
  pre_reading text check (char_length(pre_reading) <= 2000),
  probably boolean not null default false,
  created_at timestamptz not null default now(),
  unique (course_id, session_number),
  foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade
);
create index syllabus_sessions_course_id_user_id_idx on public.syllabus_sessions (course_id, user_id);
create index syllabus_sessions_user_id_idx on public.syllabus_sessions (user_id);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notices_user_id_created_at_idx on public.notices (user_id, created_at desc);

create table public.weekly_checks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create table public.ai_usage (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0 check (count between 0 and 10),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index ai_usage_day_idx on public.ai_usage (day);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table public.alert_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  night date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, night)
);

-- Standard block: own rows only, to authenticated, nothing for anon.
do $$
declare
  t text;
begin
  foreach t in array array['calendar_feeds', 'feed_course_map', 'class_sessions', 'assessments',
                           'syllabus_sessions', 'notices', 'weekly_checks', 'push_subscriptions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete', t);
  end loop;
end;
$$;

-- calendar_feeds: no client can read url or change a row. Rows are only added
-- through connect_feed; sync state only moves through claim/finish_feed_sync.
revoke select, insert, update on public.calendar_feeds from authenticated;
grant select (id, user_id, status, last_synced_at, last_attempt_at, last_error, created_at)
  on public.calendar_feeds to authenticated;

-- notices: only dismissing is an update. weekly_checks: insert or delete, no update.
revoke update on public.notices from authenticated;
grant update (dismissed_at) on public.notices to authenticated;
revoke update on public.weekly_checks from authenticated;

-- ai_usage: read your own count; it only changes through reserve_ai_call.
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
create policy ai_usage_select on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));

-- alert_log: only the nightly job (secret key) reads or writes it.
alter table public.alert_log enable row level security;
revoke all on public.alert_log from anon, authenticated;

-- Saves a feed link. Validates first and never lets a constraint error carry the
-- url into a log. A link already saved returns its id; a 4th feed is refused.
-- Security definer because deduping by url has to read url, which no client role
-- may select; the row is always the caller's own (user_id = auth.uid()).
create function public.connect_feed(p_url text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_url text := btrim(coalesce(p_url, ''));
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Log in first.' using errcode = '42501';
  end if;
  if lower(left(v_url, 9)) = 'webcal://' then
    v_url := 'https://' || substr(v_url, 10);
  end if;
  if lower(left(v_url, 8)) <> 'https://' or char_length(v_url) > 2048 then
    raise exception 'Use a calendar link that starts with https:// or webcal://.' using errcode = '22023';
  end if;
  v_url := 'https://' || substr(v_url, 9);

  insert into public.calendar_feeds (user_id, url) values ((select auth.uid()), v_url)
  on conflict (user_id, url) do nothing
  returning id into v_id;
  if v_id is null then
    select f.id into v_id from public.calendar_feeds f
    where f.user_id = (select auth.uid()) and f.url = v_url;
  end if;

  if (select count(*) from public.calendar_feeds f where f.user_id = (select auth.uid())) > 3 then
    raise exception 'You can connect up to 3 calendars.' using errcode = '22023';
  end if;
  return v_id;
end;
$$;

-- The caller's own feed link, for their own sync request. Never takes a user id.
create function public.feed_url_for_sync(p_feed uuid) returns text
language sql stable security definer
set search_path = ''
as $$
  select f.url from public.calendar_feeds f
  where f.id = p_feed and f.user_id = (select auth.uid())
$$;

-- Two-tab guard: claims the caller's own feed for one sync, at most once every
-- 30 seconds by the database clock. False when busy, not theirs or not logged in.
create function public.claim_feed_sync(p_feed uuid) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  update public.calendar_feeds f set last_attempt_at = now()
  where f.id = p_feed and f.user_id = (select auth.uid())
    and (f.last_attempt_at is null or f.last_attempt_at < now() - interval '30 seconds')
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

-- Ends a sync of the caller's own feed: 'ok' clears the error and stamps the time;
-- 'failed' keeps the last good data and stores one of the fixed messages.
create function public.finish_feed_sync(p_feed uuid, p_status text, p_error text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_status is null or p_status not in ('ok', 'failed') then
    raise exception 'Status must be ok or failed.' using errcode = '22023';
  end if;
  update public.calendar_feeds f set
    status = p_status,
    last_error = case when p_status = 'ok' then null else p_error end,
    last_synced_at = case when p_status = 'ok' then now() else f.last_synced_at end
  where f.id = p_feed and f.user_id = (select auth.uid());
end;
$$;

-- One syllabus read: 10 per student per Madrid day, 300 across everyone.
create function public.reserve_ai_call() returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ok boolean;
begin
  if v_uid is null then
    return false;
  end if;
  if (select coalesce(sum(a.count), 0) from public.ai_usage a where a.day = public.madrid_today()) >= 300 then
    return false;
  end if;
  insert into public.ai_usage as a (user_id, day, count) values (v_uid, public.madrid_today(), 1)
  on conflict (user_id, day) do update set count = a.count + 1 where a.count < 10
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

-- log_skip now also links the class it missed: that day's unlinked class of the
-- course (never an exam slot), else for today the latest unlinked one in the past
-- 7 days. A class already linked is never picked, so two saves never collide.
create or replace function public.log_skip(p_text text, p_day text default 'today', p_sessions int default 1)
returns public.skips
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_course uuid;
  v_date date;
  v_class uuid;
  v_skip public.skips;
begin
  if p_text is null or btrim(p_text) = '' or char_length(p_text) > 200 then
    raise exception 'Type a course name (1 to 200 characters).' using errcode = '22023';
  end if;
  if p_day is null or p_day not in ('today', 'tomorrow') then
    raise exception 'Day must be today or tomorrow.' using errcode = '22023';
  end if;
  if p_sessions is null or p_sessions not in (1, 2) then
    raise exception 'Sessions must be 1 or 2.' using errcode = '22023';
  end if;

  insert into public.courses (name) values (btrim(p_text))
  on conflict (user_id, name_key) do nothing
  returning id into v_course;
  if v_course is null then
    select c.id into v_course from public.courses c
    where c.user_id = (select auth.uid()) and c.name_key = public.norm_course_name(btrim(p_text));
  end if;

  v_date := public.madrid_today() + (p_day = 'tomorrow')::int;

  select cs.id into v_class from public.class_sessions cs
  where cs.course_id = v_course and cs.user_id = (select auth.uid())
    and cs.kind in ('class', 'async') and not cs.is_exam_slot
    and (cs.starts_at at time zone 'Europe/Madrid')::date = v_date
    and not exists (select 1 from public.skips s where s.class_session_id = cs.id)
  order by cs.starts_at
  limit 1;

  if v_class is null and p_day = 'today' then
    select cs.id into v_class from public.class_sessions cs
    where cs.course_id = v_course and cs.user_id = (select auth.uid())
      and cs.kind in ('class', 'async') and not cs.is_exam_slot
      and cs.starts_at < now()
      and (cs.starts_at at time zone 'Europe/Madrid')::date >= v_date - 7
      and not exists (select 1 from public.skips s where s.class_session_id = cs.id)
    order by cs.starts_at desc
    limit 1;
  end if;

  insert into public.skips (course_id, text_typed, sessions, skip_date, planned, class_session_id)
  values (v_course, p_text, p_sessions::smallint, v_date, p_day = 'tomorrow', v_class)
  returning * into v_skip;
  return v_skip;
end;
$$;

revoke execute on function public.connect_feed(text) from public, anon;
revoke execute on function public.feed_url_for_sync(uuid) from public, anon, service_role;
revoke execute on function public.reserve_ai_call() from public, anon;
revoke execute on function public.claim_feed_sync(uuid) from public, anon;
revoke execute on function public.finish_feed_sync(uuid, text, text) from public, anon;
grant execute on function public.connect_feed(text) to authenticated;
grant execute on function public.claim_feed_sync(uuid) to authenticated;
grant execute on function public.finish_feed_sync(uuid, text, text) to authenticated;
grant execute on function public.feed_url_for_sync(uuid) to authenticated;
grant execute on function public.reserve_ai_call() to authenticated;
