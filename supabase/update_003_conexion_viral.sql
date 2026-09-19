-- ============================================================================
-- ACTUALIZACIÓN 003 · Perfil académico, pareja ideal, motor de recomendación,
--                     referidos (red de invitaciones), retos diarios y métricas de comunidad
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización: ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
--
-- Privacidad: universidad, colegio y estatura son públicos (sirven para filtrar y coincidir). La descripción de la
-- "pareja ideal" vive en user_private: solo su dueño la lee; el motor de recomendación la usa dentro de funciones
-- SECURITY DEFINER y jamás la devuelve.
-- ============================================================================

-- ── 1. Columnas nuevas ──────────────────────────────────────────────────────
-- Son NULL para perfiles anteriores (no se les bloquea); el onboarding las exige a los nuevos (complete_onboarding).
alter table public.profiles
  add column if not exists university text check (university is null or char_length(university) between 2 and 120),
  add column if not exists school     text check (school is null or char_length(school) between 2 and 120),
  add column if not exists height_cm  int  check (height_cm is null or height_cm between 120 and 230),
  add column if not exists referral_code text;

update public.profiles set referral_code = substr(md5(id::text || clock_timestamp()::text), 1, 10) where referral_code is null;
alter table public.profiles alter column referral_code set default substr(md5(gen_random_uuid()::text), 1, 10);
alter table public.profiles alter column referral_code set not null;
create unique index if not exists profiles_referral_code_key on public.profiles (referral_code);
create index if not exists profiles_age_height_idx on public.profiles (age, height_cm) where onboarding_completed;

alter table public.user_private
  add column if not exists ideal_partner text check (ideal_partner is null or char_length(ideal_partner) <= 1000);

grant update (university, school, height_cm) on public.profiles to authenticated;
grant update (ideal_partner) on public.user_private to authenticated;

-- ── 2. Motor de recomendación ───────────────────────────────────────────────
-- Normaliza (minúsculas, sin acentos) y extrae los conceptos de un texto: lexemas del diccionario español
-- (sin palabras vacías ni ruido). Es lo que se compara entre "lo que busco" y "lo que cada perfil cuenta de sí".
create or replace function public._norm(t text) returns text
language sql immutable as $$
  select btrim(regexp_replace(translate(lower(coalesce(t, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou'), '\s+', ' ', 'g'));
$$;

create or replace function public._lex(t text) returns text[]
language sql immutable as $$
  select coalesce(array(
    select l from unnest(tsvector_to_array(to_tsvector('spanish', public._norm(t)))) l
     where char_length(l) > 2 and l ~ '^[a-z0-9]+$'
  ), '{}'::text[]);
$$;

-- Texto público con el que un perfil "se describe": bio, formación, lugar, estilo de vida, intereses y titular profesional.
create or replace function public._doc_lex(p public.profiles) returns text[]
language sql immutable as $$
  select public._lex(concat_ws(' ', p.bio, p.university, p.school, p.location,
                               array_to_string(p.lifestyle, ' '), array_to_string(p.interests, ' '),
                               p.professional ->> 'headline'));
$$;

-- Devuelve personas ordenadas por compatibilidad (0–100) con sus motivos, aplicando filtros de edad y estatura.
--   · 40 pts  lo que TÚ describes como pareja ideal  ↔  cómo se describe cada perfil
--   · 15 pts  lo que ELLA/ÉL describe como ideal      ↔  cómo te describes tú (reciprocidad)
--   · hasta 45 pts  universidad y colegio compartidos, intereses, estilo de vida, zonas, tipo de relación, afinidad astral
-- Oculta a quienes ya descartaste. No devuelve ningún texto privado, solo puntaje y motivos genéricos.
create or replace function public.recommend_people(
  p_min_age int default null, p_max_age int default null,
  p_min_height int default null, p_max_height int default null,
  p_limit int default 24, p_offset int default 0
) returns table (person_id uuid, score int, reasons text[])
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  v_me public.profiles;
  v_ideal text[];
  v_mydoc text[];
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into v_me from public.profiles where id = me;
  select public._lex(ideal_partner) into v_ideal from public.user_private where user_id = me;
  v_ideal := coalesce(v_ideal, '{}');
  v_mydoc := public._doc_lex(v_me);

  return query
  with cand as (
    select p.id as pid, p.university, p.school, p.interests, p.lifestyle, p.zones, p.relations, p.sign,
           public._doc_lex(p) as doc_lex, public._lex(up.ideal_partner) as ideal_lex
      from public.profiles p
      join public.user_private up on up.user_id = p.id
     where p.id <> me
       and p.onboarding_completed
       and (p_min_age is null or p.age >= p_min_age)
       and (p_max_age is null or p.age <= p_max_age)
       and (p_min_height is null or p.height_cm >= p_min_height)
       and (p_max_height is null or p.height_cm <= p_max_height)
       and not exists (select 1 from public.person_swipes s where s.from_user = me and s.to_user = p.id and s.action = 'pass')
  ), calc as (
    select c.pid,
      (select count(*)::int from unnest(v_ideal) x where x = any (c.doc_lex))    as hits,
      (select count(*)::int from unnest(c.ideal_lex) x where x = any (v_mydoc))  as rhits,
      cardinality(c.ideal_lex) as their_n,
      (v_me.university is not null and c.university is not null and public._norm(v_me.university) = public._norm(c.university)) as same_uni,
      (v_me.school is not null and c.school is not null and public._norm(v_me.school) = public._norm(c.school)) as same_school,
      cardinality(array(select unnest(c.interests) intersect select unnest(v_me.interests))) as n_int,
      cardinality(array(select unnest(c.lifestyle) intersect select unnest(v_me.lifestyle))) as n_life,
      (c.zones && v_me.zones) as same_zone,
      (c.relations && v_me.relations) as same_rel,
      case when c.sign is not null and v_me.sign is not null then public.astral_score(v_me.sign, c.sign, 'pareja') end as astral
      from cand c
  ), scored as (
    select k.pid, k.hits,
      least(100,
          case when cardinality(v_ideal) = 0 then 0 else round(40 * least(1, k.hits::numeric / greatest(1, least(4, cardinality(v_ideal))))) end
        + case when k.their_n = 0 then 0 else round(15 * least(1, k.rhits::numeric / greatest(1, least(4, k.their_n)))) end
        + case when k.same_uni then 12 else 0 end
        + case when k.same_school then 6 else 0 end
        + least(2, k.n_int) * 4
        + least(3, k.n_life) * 2
        + case when k.same_zone then 6 else 0 end
        + case when k.same_rel then 6 else 0 end
        + round(coalesce(k.astral, 0) * 0.06)
      )::int as pts,
      array_remove(array[
        case when k.hits > 0 then 'Encaja con ' || k.hits || case when k.hits = 1 then ' rasgo' else ' rasgos' end || ' de tu pareja ideal' end,
        case when k.same_uni then 'Comparten universidad' end,
        case when k.same_school then 'Fueron al mismo colegio' end,
        case when k.n_int > 0 then 'Intereses en común' end,
        case when k.n_life > 0 then 'Estilo de vida afín' end,
        case when k.same_zone then 'Misma zona' end,
        case when k.same_rel then 'Buscan lo mismo' end,
        case when coalesce(k.astral, 0) >= 75 then 'Gran afinidad astral' end
      ], null) as why
      from calc k
  )
  select s.pid, s.pts, s.why from scored s
   order by s.pts desc, s.pid
   limit greatest(1, least(coalesce(p_limit, 24), 60)) offset greatest(0, coalesce(p_offset, 0));
end $$;

-- ── 3. Referidos: red de invitaciones con recompensas de estatus ────────────
create table if not exists public.referrals (
  referred_id uuid primary key references public.profiles (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  rewarded_at timestamptz,                                    -- se paga cuando el invitado completa su perfil (anti-abuso)
  check (referred_id <> referrer_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;
grant select on public.referrals to authenticated;
drop policy if exists referrals_select on public.referrals;
create policy referrals_select on public.referrals for select using (referrer_id = auth.uid() or referred_id = auth.uid());

-- Enlaza a un usuario recién creado con quien lo invitó. No lanza errores (un código inválido nunca bloquea el registro).
create or replace function public._link_referral(p_user uuid, p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_ref uuid;
  v_n int;
begin
  if p_code is null or btrim(p_code) = '' then return false; end if;
  select id into v_ref from public.profiles where referral_code = lower(btrim(p_code));
  if v_ref is null or v_ref = p_user then return false; end if;
  if not exists (select 1 from public.profiles where id = p_user and created_at > now() - interval '7 days') then return false; end if;
  insert into public.referrals (referred_id, referrer_id) values (p_user, v_ref) on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

-- Para registros con OAuth o desde otro navegador: el cliente guarda el código y lo aplica al iniciar sesión.
create or replace function public.apply_referral(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  return public._link_referral(auth.uid(), p_code);
end $$;

-- Paga al invitador (y da la bienvenida al invitado) UNA sola vez, cuando el invitado completa su perfil.
-- Hitos de la red: 3 → +50 · 5 → +100 · 10 → +250 · 20 → +600 monedas extra.
create or replace function public._reward_referral(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ref uuid;
  v_n int;
  v_bonus int;
  v_nombre text;
begin
  select referrer_id into v_ref from public.referrals where referred_id = p_user and rewarded_at is null;
  if v_ref is null then return; end if;
  perform 1 from public.wallets where user_id = v_ref for update;         -- serializa pagos concurrentes al mismo invitador
  update public.referrals set rewarded_at = now() where referred_id = p_user and rewarded_at is null;
  if not found then return; end if;

  perform public._earn(v_ref, 50, 'referral');
  perform public._earn(p_user, 25, 'referred_welcome');
  select count(*)::int into v_n from public.referrals where referrer_id = v_ref and rewarded_at is not null;
  v_bonus := case v_n when 3 then 50 when 5 then 100 when 10 then 250 when 20 then 600 else 0 end;
  if v_bonus > 0 then perform public._earn(v_ref, v_bonus, 'referral_milestone:' || v_n); end if;

  select display_name into v_nombre from public.profiles where id = p_user;
  perform public.notify(v_ref, 'recompensa',
    '🌱 ' || v_nombre || ' se unió gracias a ti',
    '+50 monedas' || case when v_bonus > 0 then ' y +' || v_bonus || ' por el hito de ' || v_n || ' invitados' else '' end || '.',
    '/invitar');
end $$;

create or replace function public.referral_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  return jsonb_build_object(
    'code', (select referral_code from public.profiles where id = me),
    'invited', (select count(*)::int from public.referrals where referrer_id = me),
    'confirmed', (select count(*)::int from public.referrals where referrer_id = me and rewarded_at is not null),
    'coins_earned', coalesce((select sum(delta)::int from public.wallet_ledger where user_id = me and (reason = 'referral' or reason like 'referral_milestone:%')), 0)
  );
end $$;

create or replace function public.referral_leaderboard(p_limit int default 10)
returns table (display_name text, handle text, avatar_url text, confirmed int)
language sql stable security definer set search_path = public as $$
  select p.display_name, p.handle, p.avatar_url, count(*)::int
    from public.referrals r join public.profiles p on p.id = r.referrer_id
   where r.rewarded_at is not null
   group by p.id
   order by count(*) desc, min(r.rewarded_at)
   limit greatest(1, least(coalesce(p_limit, 10), 25));
$$;

-- ── 4. Retos diarios (los premios los paga solo el servidor, una vez por reto y día) ─
create table if not exists public.daily_challenge_claims (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  challenge_id text not null,
  day          date not null default current_date,
  claimed_at   timestamptz not null default now(),
  primary key (user_id, challenge_id, day)
);
alter table public.daily_challenge_claims enable row level security;
revoke all on public.daily_challenge_claims from anon, authenticated;
grant select on public.daily_challenge_claims to authenticated;
drop policy if exists daily_claims_select on public.daily_challenge_claims;
create policy daily_claims_select on public.daily_challenge_claims for select using (user_id = auth.uid());

-- Catálogo (mantener en sync con src/lib/retos.ts). El orden es el de la pantalla.
create or replace function public._challenge_catalog() returns table (id text, prize int, ord int)
language sql immutable as $$
  select * from (values ('checkin', 5, 1), ('conectar', 10, 2), ('publicar', 15, 3), ('mensaje', 10, 4),
                        ('reflexion', 5, 5), ('invitar', 30, 6), ('completo', 25, 7)) as c (id, prize, ord);
$$;

create or replace function public._challenge_done(p_user uuid, p_id text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return case p_id
    when 'checkin'   then exists (select 1 from public.wallets where user_id = p_user and last_checkin = current_date)
    when 'conectar'  then (select count(*) from public.person_swipes where from_user = p_user and created_at::date = current_date) >= 3
    when 'publicar'  then exists (select 1 from public.posts where author_id = p_user and created_at::date = current_date)
                       or exists (select 1 from public.listings where owner_id = p_user and created_at::date = current_date)
    when 'mensaje'   then (select count(*) from public.messages where sender_id = p_user and kind = 'text' and created_at::date = current_date) >= 2
    when 'reflexion' then true                                                    -- autodeclarado: leer la reflexión del día
    when 'invitar'   then exists (select 1 from public.referrals where referrer_id = p_user and rewarded_at::date = current_date)
    when 'completo'  then (select count(*) from public.daily_challenge_claims
                            where user_id = p_user and day = current_date and challenge_id in ('checkin','conectar','publicar','mensaje','reflexion')) = 5
    else false
  end;
end $$;

create or replace function public.daily_challenges_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'prize', c.prize,
             'done', public._challenge_done(me, c.id),
             'claimed', exists (select 1 from public.daily_challenge_claims k where k.user_id = me and k.challenge_id = c.id and k.day = current_date))
           order by c.ord)
      from public._challenge_catalog() c), '[]'::jsonb);
end $$;

create or replace function public.claim_daily_challenge(p_id text) returns int
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_prize int;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select prize into v_prize from public._challenge_catalog() where id = p_id;
  if v_prize is null then raise exception 'Reto inexistente' using errcode = '22023'; end if;
  perform 1 from public.wallets where user_id = me for update;
  if not public._challenge_done(me, p_id) then raise exception 'El reto aún no está cumplido' using errcode = 'P0001'; end if;
  insert into public.daily_challenge_claims (user_id, challenge_id) values (me, p_id);   -- la PK impide cobrarlo dos veces el mismo día
  perform public._earn(me, v_prize, 'daily:' || p_id);
  return v_prize;
end $$;

-- ── 5. Métricas reales de la comunidad (prueba social sin cifras inventadas) ─
create or replace function public.community_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'members',     (select count(*)::int from public.profiles where onboarding_completed and not is_demo),
    'new_7d',      (select count(*)::int from public.profiles where onboarding_completed and not is_demo and created_at > now() - interval '7 days'),
    'matches_7d',  (select count(*)::int from public.matches where created_at > now() - interval '7 days'),
    'invites_ok',  (select count(*)::int from public.referrals where rewarded_at is not null)
  );
$$;

-- Lo que hay esperándote ahora mismo (datos reales para el panel "hoy depende de ti").
create or replace function public.opportunity_snapshot() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  return jsonb_build_object(
    'likes_pending', (select count(*)::int from public.person_swipes s
                       where s.to_user = me and s.action in ('like','super')
                         and not exists (select 1 from public.person_swipes r where r.from_user = me and r.to_user = s.from_user)),
    'new_people_7d', (select count(*)::int from public.profiles p
                       where p.id <> me and p.onboarding_completed and p.created_at > now() - interval '7 days'
                         and not exists (select 1 from public.person_swipes r where r.from_user = me and r.to_user = p.id))
  );
end $$;

-- ── 6. Alta y onboarding: código de invitación y campos obligatorios ────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name   text;
  v_handle text;
begin
  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
                     nullif(new.raw_user_meta_data ->> 'name', ''),
                     nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                     'Nuevo usuario');
  v_handle := '@' || left(lower(regexp_replace(coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'user'), '[^a-zA-Z0-9_]+', '_', 'g')), 30)
              || '_' || substr(replace(new.id::text, '-', ''), 1, 5);

  insert into public.profiles (id, display_name, handle, avatar_url, email_verified)
  values (new.id, left(v_name, 60), v_handle, nullif(new.raw_user_meta_data ->> 'avatar_url', ''), new.email_confirmed_at is not null);
  insert into public.user_private (user_id) values (new.id);
  insert into public.wallets (user_id) values (new.id);
  insert into public.wallet_ledger (user_id, delta, reason) values (new.id, 20, 'welcome');

  begin   -- un código de invitación inválido nunca debe impedir el registro
    perform public._link_referral(new.id, new.raw_user_meta_data ->> 'ref');
  exception when others then null;
  end;
  return new;
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
  if p.university is null or btrim(p.university) = '' then
    raise exception 'onboarding: falta tu universidad' using errcode = 'P0001';
  end if;
  if p.school is null or btrim(p.school) = '' then
    raise exception 'onboarding: falta tu colegio' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.user_private where user_id = me and char_length(btrim(coalesce(ideal_partner, ''))) >= 20) then
    raise exception 'onboarding: describe a tu pareja ideal (mínimo 20 caracteres)' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profile_photos where user_id = me) then
    raise exception 'onboarding: sube al menos una foto' using errcode = 'P0001';
  end if;
  update public.profiles set onboarding_completed = true where id = me;
  perform public._reward_referral(me);
end $$;

-- ── 7. Privilegios de ejecución ─────────────────────────────────────────────
grant execute on function
  public.recommend_people(int, int, int, int, int, int), public.apply_referral(text), public.referral_stats(),
  public.referral_leaderboard(int), public.daily_challenges_status(), public.claim_daily_challenge(text),
  public.opportunity_snapshot(), public.complete_onboarding()
  to authenticated;
grant execute on function public.community_stats() to anon, authenticated;
revoke execute on function
  public._norm(text), public._lex(text), public._doc_lex(public.profiles), public._link_referral(uuid, text),
  public._reward_referral(uuid), public._challenge_catalog(), public._challenge_done(uuid, text)
  from public, anon, authenticated;
