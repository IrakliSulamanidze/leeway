-- WhatsApp bot, part 4: the student's own data, read and written inside a turn.
-- The functions take the student from the turn grant (wa.acting_user()) and
-- read or write only that student's rows. The web app's tables, policies and
-- functions are unchanged.

-- One skip per message: a request that runs twice (a Meta retry) finds the
-- skip it already saved.
create table wa.skip_messages (
  msg_hash bytea primary key check (octet_length(msg_hash) = 32),
  skip_id uuid not null references public.skips (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index skip_messages_skip_id on wa.skip_messages (skip_id);
alter table wa.skip_messages enable row level security;

-- Everything the answers need for a date range, in the shapes the web app's
-- rule functions take (src/lib/calendar/load.ts loadWeekData). Classes are
-- loaded from a day before to two days after, as the web does, so Madrid
-- dates at the edges are complete.
create function wa_api.my_snapshot(p_from date, p_to date) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
begin
  if p_to < p_from or p_to - p_from > 120 then
    raise exception 'range must be 0 to 120 days' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'sessions_typed', c.sessions_typed,
        'sessions_syllabus', c.sessions_syllabus, 'sessions_calendar', c.sessions_calendar,
        'missed_before', c.missed_before) order by c.name)
      from public.courses c where c.user_id = v_user), '[]'),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'course_id', s.course_id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
        'all_day', s.all_day, 'kind', s.kind, 'is_exam_slot', s.is_exam_slot,
        'session_numbers', to_jsonb(s.session_numbers)) order by s.starts_at)
      from public.class_sessions s
      where s.user_id = v_user
        and s.starts_at >= (p_from - 1)::timestamptz
        and s.starts_at < (p_to + 2)::timestamptz), '[]'),
    'skips', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'course_id', k.course_id, 'class_session_id', k.class_session_id,
        'skip_date', k.skip_date, 'sessions', k.sessions, 'planned', k.planned))
      from public.skips k where k.user_id = v_user), '[]'),
    'assessments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'course_id', a.course_id, 'class_session_id', a.class_session_id,
        'session_number', a.session_number, 'on_date', a.on_date, 'title', a.title))
      from public.assessments a where a.user_id = v_user), '[]')
  );
end $$;

-- Saves a skip of one class, or of a course on a day when the class is not in
-- the calendar. Dated by the day the student meant, never by when the database
-- runs it (unlike the web's log_skip). Same message twice: same skip.
create function wa_api.log_skip_on(
  p_course uuid, p_class uuid, p_day date, p_sessions integer, p_msg_hash bytea)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
  v_name text;
  v_skip uuid;
begin
  select m.skip_id into v_skip from wa.skip_messages m where m.msg_hash = p_msg_hash;
  if v_skip is not null then
    return v_skip;
  end if;
  if p_sessions not in (1, 2) then
    raise exception 'sessions must be 1 or 2' using errcode = '22023';
  end if;
  select c.name into v_name from public.courses c where c.id = p_course and c.user_id = v_user;
  if v_name is null then
    raise exception 'no such course' using errcode = '22023';
  end if;
  if p_class is not null and not exists (
    select 1 from public.class_sessions s
    where s.id = p_class and s.user_id = v_user and s.course_id = p_course
  ) then
    raise exception 'no such class' using errcode = '22023';
  end if;

  if p_class is not null then
    select k.id into v_skip from public.skips k where k.class_session_id = p_class;
  end if;
  if v_skip is null then
    insert into public.skips (user_id, course_id, text_typed, sessions, skip_date, planned, class_session_id)
    values (v_user, p_course, left(v_name, 200), p_sessions::smallint, p_day,
            p_day > (now() at time zone 'Europe/Madrid')::date, p_class)
    returning id into v_skip;
  end if;
  insert into wa.skip_messages (msg_hash, skip_id) values (p_msg_hash, v_skip);
  return v_skip;
end $$;

-- Undoes a skip the student saved. Only their own.
create function wa_api.undo_skip(p_skip uuid) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_done boolean;
begin
  delete from public.skips k where k.id = p_skip and k.user_id = wa.acting_user()
  returning true into v_done;
  return coalesce(v_done, false);
end $$;

revoke all on wa.skip_messages from public, anon, authenticated, service_role;
revoke execute on function
  wa_api.my_snapshot(date, date), wa_api.log_skip_on(uuid, uuid, date, integer, bytea),
  wa_api.undo_skip(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  wa_api.my_snapshot(date, date), wa_api.log_skip_on(uuid, uuid, date, integer, bytea),
  wa_api.undo_skip(uuid)
  to wa_gateway;
