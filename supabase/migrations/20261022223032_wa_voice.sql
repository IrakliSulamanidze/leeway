-- WhatsApp bot, part 6: the voice each student picks for replies.

alter table wa.links add column voice text check (voice in ('straight', 'friendly', 'roast'));

-- Inside a turn: the student's age answer and voice. Replaces my_link.
create function wa_api.my_profile() returns table (adult boolean, voice text)
language sql stable security definer
set search_path = ''
as $$
  select l.adult, l.voice from wa.links l where l.user_id = wa.acting_user()
$$;

create function wa_api.set_voice(p_voice text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := wa.acting_user();
begin
  if p_voice not in ('straight', 'friendly', 'roast') then
    raise exception 'unknown voice' using errcode = '22023';
  end if;
  update wa.links set voice = p_voice where user_id = v_user;
end $$;

drop function wa_api.my_link();

revoke execute on function wa_api.my_profile(), wa_api.set_voice(text)
  from public, anon, authenticated, service_role;
grant execute on function wa_api.my_profile(), wa_api.set_voice(text) to wa_gateway;
