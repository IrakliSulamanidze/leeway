-- Core of the graded path (tech-plan 2-4): courses and skips, locked to their owner,
-- plus log_skip (one tap = one call) and delete_my_account.
create extension if not exists unaccent with schema extensions;

-- Course names match ignoring case, accents and extra spaces. The two-argument
-- unaccent names its dictionary, so the function is safe to mark immutable.
create function public.norm_course_name(p_name text) returns text
language sql immutable strict parallel safe
set search_path = ''
as $$
  select lower(regexp_replace(btrim(extensions.unaccent('extensions.unaccent'::regdictionary, p_name)), '\s+', ' ', 'g'))
$$;

create function public.madrid_today() returns date
language sql stable parallel safe
set search_path = ''
as $$
  select (now() at time zone 'Europe/Madrid')::date
$$;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  name_key text not null generated always as (public.norm_course_name(name)) stored,
  sessions_typed int check (sessions_typed between 1 and 200),
  sessions_syllabus int check (sessions_syllabus between 1 and 200),
  sessions_calendar int check (sessions_calendar between 1 and 200),
  missed_before int not null default 0 check (missed_before between 0 and 200),
  created_at timestamptz not null default now(),
  unique (user_id, name_key),
  unique (id, user_id)
);

-- class_session_id gets its foreign key to class_sessions in the features migration.
create table public.skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  text_typed text not null check (char_length(text_typed) between 1 and 200),
  sessions smallint not null default 1 check (sessions in (1, 2)),
  skip_date date not null default public.madrid_today(),
  planned boolean not null default false,
  class_session_id uuid,
  created_at timestamptz not null default now(),
  foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade
);
create unique index skips_class_session_id_key on public.skips (class_session_id)
  where class_session_id is not null;
create index skips_user_id_created_at_idx on public.skips (user_id, created_at desc);
create index skips_course_id_user_id_idx on public.skips (course_id, user_id);

alter table public.courses enable row level security;
revoke all on public.courses from anon;
create policy courses_select on public.courses for select to authenticated using (user_id = (select auth.uid()));
create policy courses_insert on public.courses for insert to authenticated with check (user_id = (select auth.uid()));
create policy courses_update on public.courses for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy courses_delete on public.courses for delete to authenticated using (user_id = (select auth.uid()));

alter table public.skips enable row level security;
revoke all on public.skips from anon;
create policy skips_select on public.skips for select to authenticated using (user_id = (select auth.uid()));
create policy skips_insert on public.skips for insert to authenticated with check (user_id = (select auth.uid()));
create policy skips_update on public.skips for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy skips_delete on public.skips for delete to authenticated using (user_id = (select auth.uid()));

-- One tap: find or create the course by its normalised name, then save the skip.
-- Security invoker, so RLS applies to both writes.
create function public.log_skip(p_text text, p_day text default 'today', p_sessions int default 1)
returns public.skips
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_course uuid;
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

  insert into public.skips (course_id, text_typed, sessions, skip_date, planned)
  values (v_course, p_text, p_sessions::smallint,
          public.madrid_today() + (p_day = 'tomorrow')::int, p_day = 'tomorrow')
  returning * into v_skip;
  return v_skip;
end;
$$;

-- Deletes the caller's auth user; every table cascades from auth.users.
create function public.delete_my_account() returns void
language sql security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.norm_course_name(text) from public, anon;
revoke execute on function public.madrid_today() from public, anon;
revoke execute on function public.log_skip(text, text, int) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.norm_course_name(text) to authenticated;
grant execute on function public.madrid_today() to authenticated;
grant execute on function public.log_skip(text, text, int) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
