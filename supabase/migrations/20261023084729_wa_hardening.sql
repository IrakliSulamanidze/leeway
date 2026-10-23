-- WhatsApp bot, part 11: closing gaps found in the pre-launch security pass.

-- The bot reads one switch without a turn: the kill switch. Other settings
-- (the scheduler's secret hash, Irakli's own WhatsApp id) are not readable
-- with the bot's password.
create or replace function wa_api.setting(p_name text) returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select s.value from wa.settings s where s.name = p_name and p_name = 'paused'
$$;

-- A rerun of a message finds only the acting student's own skip.
create or replace function wa_api.log_skip_on(
  p_course uuid, p_class uuid, p_day date, p_sessions integer, p_msg_hash bytea)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_name text;
  v_skip uuid;
  v_class public.class_sessions;
begin
  select m.skip_id into v_skip from wa.skip_messages m
  join public.skips k on k.id = m.skip_id and k.user_id = v_user
  where m.msg_hash = p_msg_hash;
  if v_skip is not null then
    return v_skip;
  end if;
  if p_sessions not in (1, 2) then
    raise exception 'sessions must be 1 or 2' using errcode = '22023';
  end if;
  if p_day not between v_today - 1 and v_today + 1 then
    raise exception 'day must be yesterday, today or tomorrow' using errcode = '22023';
  end if;
  select c.name into v_name from public.courses c where c.id = p_course and c.user_id = v_user;
  if v_name is null then
    raise exception 'no such course' using errcode = '22023';
  end if;
  if p_class is not null then
    select * into v_class from public.class_sessions s
    where s.id = p_class and s.user_id = v_user and s.course_id = p_course
      and s.kind in ('class', 'async') and not s.is_exam_slot
      and (s.starts_at at time zone 'Europe/Madrid')::date = p_day;
    if v_class.id is null then
      raise exception 'no such class on that day' using errcode = '22023';
    end if;
    if p_sessions > greatest(1, least(2, coalesce(array_length(v_class.session_numbers, 1), 1))) then
      raise exception 'that class counts as one session' using errcode = '22023';
    end if;
    select k.id into v_skip from public.skips k where k.class_session_id = p_class;
  else
    if p_sessions <> 1 then
      raise exception 'a skip without a class counts as one session' using errcode = '22023';
    end if;
    select k.id into v_skip from public.skips k
    where k.user_id = v_user and k.course_id = p_course and k.skip_date = p_day
      and k.class_session_id is null
    limit 1;
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

revoke execute on function wa_api.setting(text), wa_api.log_skip_on(uuid, uuid, date, integer, bytea)
  from public, anon, authenticated, service_role;
grant execute on function wa_api.setting(text), wa_api.log_skip_on(uuid, uuid, date, integer, bytea)
  to wa_gateway;
