-- ============================================================================
-- ACTUALIZACIÓN 002 · Fotos de perfil (máx. 10), onboarding y simulación de personas
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización: ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================================

-- ── 1. Onboarding ───────────────────────────────────────────────────────────
-- Los perfiles que ya existen al aplicar la actualización se consideran completos; los nuevos empiezan en falso.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'onboarding_completed') then
    alter table public.profiles add column onboarding_completed boolean not null default false;
    update public.profiles set onboarding_completed = true;
  end if;
end $$;

-- ── 2. Fotos de perfil: relación 1 → N (máximo 10 por perfil) ───────────────
-- `storage_path` / `thumb_path` son rutas del bucket `media` (<user_id>/fotos/<uuid>.webp) o URLs absolutas (datos de demo).
-- El máximo de 10 lo garantizan: CHECK (sort_order 0..9) + UNIQUE (user_id, sort_order) + la función add_profile_photo().
create table if not exists public.profile_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  sort_order   int  not null check (sort_order between 0 and 9),
  storage_path text not null check (char_length(storage_path) between 3 and 500),
  thumb_path   text not null check (char_length(thumb_path) between 3 and 500),
  width        int  check (width > 0),
  height       int  check (height > 0),
  bytes        int  check (bytes > 0),
  mime         text check (mime in ('image/webp', 'image/jpeg', 'image/png')),
  created_at   timestamptz not null default now(),
  constraint profile_photos_user_order_key unique (user_id, sort_order) deferrable initially immediate
);
create index if not exists profile_photos_user_idx on public.profile_photos (user_id, sort_order);

alter table public.profile_photos enable row level security;
revoke all on public.profile_photos from anon, authenticated;
grant select on public.profile_photos to anon, authenticated;   -- las galerías son públicas; escribir solo vía funciones
drop policy if exists profile_photos_select on public.profile_photos;
create policy profile_photos_select on public.profile_photos for select using (true);

-- Añade una foto en el primer hueco libre (0..9). Serializa subidas concurrentes bloqueando el perfil.
create or replace function public.add_profile_photo(
  p_path text, p_thumb text, p_width int, p_height int, p_bytes int, p_mime text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_slot int;
  v_id uuid;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if p_path not like me::text || '/%' or p_thumb not like me::text || '/%' then
    raise exception 'Las imágenes deben estar en tu carpeta' using errcode = '42501';
  end if;
  perform 1 from public.profiles where id = me for update;
  select g into v_slot from generate_series(0, 9) g
   where not exists (select 1 from public.profile_photos where user_id = me and sort_order = g)
   order by g limit 1;
  if v_slot is null then raise exception 'max_photos: máximo 10 fotos por perfil' using errcode = 'P0001'; end if;
  insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, bytes, mime)
  values (me, v_slot, p_path, p_thumb, p_width, p_height, p_bytes, p_mime)
  returning id into v_id;
  return v_id;
end $$;

-- Borra una foto y compacta el orden. Devuelve las rutas para que el servidor elimine los archivos del almacenamiento.
create or replace function public.delete_profile_photo(p_id uuid)
returns table (storage_path text, thumb_path text)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v public.profile_photos;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = me for update;
  select * into v from public.profile_photos where id = p_id and user_id = me;
  if not found then raise exception 'Foto no encontrada' using errcode = 'P0002'; end if;
  set constraints public.profile_photos_user_order_key deferred;
  delete from public.profile_photos where id = p_id;
  update public.profile_photos set sort_order = sort_order - 1 where user_id = me and sort_order > v.sort_order;
  return query select v.storage_path, v.thumb_path;
end $$;

-- Reordena: recibe TODOS los ids del usuario en el orden deseado (la primera foto es la principal).
create or replace function public.reorder_profile_photos(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_total int;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = me for update;
  select count(*) into v_total from public.profile_photos where user_id = me;
  if coalesce(cardinality(p_ids), 0) <> v_total
     or (select count(distinct x) from unnest(p_ids) x) <> v_total
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.profile_photos where id = x and user_id = me)) then
    raise exception 'La lista debe contener exactamente tus fotos, sin repetir' using errcode = '22023';
  end if;
  set constraints public.profile_photos_user_order_key deferred;
  update public.profile_photos p set sort_order = t.ord - 1
    from unnest(p_ids) with ordinality as t (id, ord)
   where p.id = t.id and p.user_id = me;
end $$;

-- Cierra el onboarding solo si el perfil cumple los mínimos (los valida el servidor, no el cliente).
create or replace function public.complete_onboarding() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  p public.profiles;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into p from public.profiles where id = me;
  if p.display_name is null or char_length(btrim(p.display_name)) < 2 or p.display_name = 'Nuevo usuario' then
    raise exception 'onboarding: falta tu nombre' using errcode = 'P0001';
  end if;
  if p.handle is null then raise exception 'onboarding: falta tu nombre de usuario' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.user_private where user_id = me and birth_date is not null) then
    raise exception 'onboarding: falta tu fecha de nacimiento' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profile_photos where user_id = me) then
    raise exception 'onboarding: sube al menos una foto' using errcode = 'P0001';
  end if;
  update public.profiles set onboarding_completed = true where id = me;
end $$;

-- ── 3. Motor de personas simuladas: acciones de un administrador "como" una persona demo ─
-- swipe_person pasa a apoyarse en _swipe_person(p_me, …) para poder reutilizar la lógica sin duplicarla.
create or replace function public._swipe_person(p_me uuid, p_target uuid, p_action text, p_relation text, p_gratis boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := p_me;
  v_recip boolean;
  v_a uuid; v_b uuid;
  v_chat uuid;
  v_score int;
  v_my_sign text; v_their_sign text;
  v_my_name text; v_their_name text;
  v_demo boolean;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if p_target = me then raise exception 'No puedes hacer swipe sobre ti mismo' using errcode = 'P0001'; end if;
  if p_action not in ('like','pass','super') then raise exception 'Acción inválida' using errcode = '22023'; end if;
  if p_relation not in ('pareja','amistad','roomie','socios') then raise exception 'Relación inválida' using errcode = '22023'; end if;
  select sign, display_name into v_my_sign, v_my_name from public.profiles where id = me;
  select sign, display_name, is_demo into v_their_sign, v_their_name, v_demo from public.profiles where id = p_target;
  if not found then raise exception 'Usuario inexistente' using errcode = 'P0002'; end if;

  if p_action = 'super' and not p_gratis then
    update public.wallets set super_likes = super_likes - 1 where user_id = me and super_likes > 0;
    if not found then raise exception 'no_super_likes' using errcode = 'P0001'; end if;
  end if;

  insert into public.person_swipes (from_user, to_user, action, relation) values (me, p_target, p_action, p_relation)
  on conflict (from_user, to_user) do update set action = excluded.action, relation = excluded.relation, created_at = now();

  if p_action = 'pass' then return jsonb_build_object('result', 'passed'); end if;

  -- SOLO DEMO: los usuarios de demostración (is_demo) corresponden 2 de cada 3 likes para poder probar el flujo con una sola cuenta.
  if v_demo and abs(hashtext(p_target::text)) % 3 <> 1 then
    insert into public.person_swipes (from_user, to_user, action, relation) values (p_target, me, 'like', p_relation)
    on conflict (from_user, to_user) do nothing;
  end if;

  select exists (select 1 from public.person_swipes where from_user = p_target and to_user = me and action in ('like','super')) into v_recip;

  if not v_recip then
    if p_action = 'super' then
      perform public.notify(p_target, 'match-persona', '⭐ ' || v_my_name || ' te envió un Super Like', 'Mira su perfil y devuélvele el like.', '/usuarios/' || me);
    end if;
    return jsonb_build_object('result', 'liked');
  end if;

  v_a := least(me, p_target);
  v_b := greatest(me, p_target);
  v_score := case when v_my_sign is not null and v_their_sign is not null then public.astral_score(v_my_sign, v_their_sign, p_relation) end;

  v_chat := public._ensure_chat('direct', 'direct:' || v_a || ':' || v_b, null, null, 'cita', me, p_target,
                                '¡Hiciste Match con ' || v_their_name || '! Ahora son amigos.');
  insert into public.matches (user_a, user_b, relation, astral_score, chat_id)
  values (v_a, v_b, p_relation, v_score, v_chat)
  on conflict (user_a, user_b) do update set chat_id = excluded.chat_id;

  insert into public.friendships (requester_id, addressee_id, status, responded_at) values (me, p_target, 'accepted', now())
  on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id)) do update set status = 'accepted', responded_at = now();

  perform public.notify(p_target, 'match-persona', '💘 ¡Match con ' || v_my_name || '!', 'Ya pueden chatear.', '/mensajes/' || v_chat);
  perform public.notify(me, 'match-persona', '💘 ¡Match con ' || v_their_name || '!', 'Ya pueden chatear.', '/mensajes/' || v_chat);
  return jsonb_build_object('result', 'match', 'chat_id', v_chat, 'astral_score', v_score);
end $$;

create or replace function public.swipe_person(p_target uuid, p_action text, p_relation text default 'pareja') returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  return public._swipe_person(auth.uid(), p_target, p_action, p_relation, false);
end $$;

-- Solo administradores, y solo "como" perfiles de demostración: like / super / pass / friend_request / message.
create or replace function public.admin_simulate(p_persona uuid, p_action text, p_target uuid, p_body text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_demo boolean;
  v_name text;
  v_chat uuid;
  v_key text;
  v_amigos boolean;
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  select is_demo, display_name into v_demo, v_name from public.profiles where id = p_persona;
  if not found or not v_demo then raise exception 'Solo se puede actuar como una persona simulada' using errcode = '42501'; end if;
  if p_target = p_persona or not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'Destinatario inválido' using errcode = '22023';
  end if;

  if p_action in ('like', 'super', 'pass') then
    return public._swipe_person(p_persona, p_target, p_action, 'pareja', true);

  elsif p_action = 'friend_request' then
    insert into public.friendships (requester_id, addressee_id) values (p_persona, p_target) on conflict do nothing;
    return jsonb_build_object('result', 'sent');

  elsif p_action = 'message' then
    if p_body is null or char_length(btrim(p_body)) = 0 then raise exception 'Escribe el mensaje' using errcode = '22023'; end if;
    v_key := 'direct:' || least(p_persona, p_target) || ':' || greatest(p_persona, p_target);
    select id into v_chat from public.chats where context_key = v_key;
    if v_chat is null then
      select exists (select 1 from public.friendships f where f.status = 'accepted'
                      and ((f.requester_id = p_persona and f.addressee_id = p_target) or (f.requester_id = p_target and f.addressee_id = p_persona)))
        into v_amigos;
      if not v_amigos then raise exception 'no_chat: aún no son amigos ni hay match' using errcode = 'P0001'; end if;
      v_chat := public._ensure_chat('direct', v_key, null, null, null, p_persona, p_target, 'Ahora son amigos en la comunidad.');
    end if;
    insert into public.messages (chat_id, sender_id, kind, body) values (v_chat, p_persona, 'text', left(btrim(p_body), 4000));
    return jsonb_build_object('result', 'sent', 'chat_id', v_chat);
  end if;

  raise exception 'Acción inválida' using errcode = '22023';
end $$;

-- ── 4. Privilegios de ejecución ─────────────────────────────────────────────
grant execute on function
  public.add_profile_photo(text, text, int, int, int, text), public.delete_profile_photo(uuid),
  public.reorder_profile_photos(uuid[]), public.complete_onboarding(),
  public.swipe_person(uuid, text, text), public.admin_simulate(uuid, text, uuid, text)
  to authenticated;
revoke execute on function public._swipe_person(uuid, uuid, text, text, boolean) from public, anon, authenticated;
