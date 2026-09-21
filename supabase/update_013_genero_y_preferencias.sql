-- ============================================================================
-- ACTUALIZACIÓN 013 · Género y a quién quiere conocer cada persona (la plataforma se adapta a sus intereses)
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización (con la 012): ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
--
-- Qué añade:
--   · user_private.gender ('hombre' | 'mujer' | 'no_dice'): PRIVADO, solo lo lee su dueña o dueño. Se pregunta al inscribirse.
--   · user_private.interested_in ('hombres' | 'mujeres' | 'todos'): a quién quiere conocer. También privado.
--   · complete_onboarding() exige ambos datos a quien se inscribe (las personas que ya estaban inscritas no se ven afectadas).
--   · recommend_people() solo muestra a quienes encajan en los DOS sentidos: yo quiero conocerles y ellas/ellos quieren conocerme.
--     Quien aún no indicó su preferencia (personas anteriores a esta actualización) ve a todos; quien busca algo concreto solo ve a quien indicó ese género,
--     así que conviene que las personas ya inscritas completen su género (la interfaz se lo pide).
--   · people_i_may_meet(): los ids de las personas que encajan en ambos sentidos, para filtrar la baraja de /citas sin revelar el género de nadie.
-- ============================================================================

-- ── 1. Columnas privadas ────────────────────────────────────────────────────
alter table public.user_private
  add column if not exists gender text check (gender is null or gender in ('hombre', 'mujer', 'no_dice')),
  add column if not exists interested_in text check (interested_in is null or interested_in in ('hombres', 'mujeres', 'todos'));
grant update (gender, interested_in) on public.user_private to authenticated;

-- ── 2. ¿Encaja el género de la otra persona con lo que yo busco? ────────────
-- Sin preferencia (null) o «todos» encaja cualquiera, incluso quien no dijo su género.
create or replace function public._seek_ok(p_seek text, p_gender text) returns boolean
language sql immutable as $$
  select p_seek is null or p_seek = 'todos' or (p_seek = 'hombres' and p_gender = 'hombre') or (p_seek = 'mujeres' and p_gender = 'mujer');
$$;
revoke execute on function public._seek_ok(text, text) from public, anon, authenticated;

-- ── 3. Personas que encajan en ambos sentidos (solo ids: el género no se revela) ──
create or replace function public.people_i_may_meet() returns setof uuid
language sql stable security definer set search_path = public as $$
  select p.id
    from public.profiles p
    join public.user_private up on up.user_id = p.id
    left join public.user_private yo on yo.user_id = auth.uid()
   where auth.uid() is not null
     and p.id <> auth.uid()
     and public._seek_ok(yo.interested_in, up.gender)
     and public._seek_ok(up.interested_in, yo.gender);
$$;
revoke execute on function public.people_i_may_meet() from public, anon;
grant execute on function public.people_i_may_meet() to authenticated;

-- ── 4. La inscripción pregunta género y a quién quiere conocer ──────────────
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
  if not exists (select 1 from public.user_private where user_id = me and gender is not null) then
    raise exception 'onboarding: cuéntanos si eres hombre o mujer' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.user_private where user_id = me and interested_in is not null) then
    raise exception 'onboarding: elige a quién te gustaría conocer' using errcode = 'P0001';
  end if;
  update public.profiles set onboarding_completed = true where id = me;
  perform public._reward_referral(me);
end $$;

-- ── 5. Las recomendaciones respetan lo que cada persona busca ───────────────
create or replace function public.recommend_people(
  p_min_age int default null, p_max_age int default null,
  p_min_height int default null, p_max_height int default null,
  p_limit int default 24, p_offset int default 0
) returns table (person_id uuid, score int, reasons text[], pct_values int, pct_lifestyle int, pct_relation int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  v_me public.profiles;
  v_ideal text[];
  v_mydoc text[];
  v_iv text[];
  v_il text[];
  v_mv text[];
  v_ml text[];
  v_mr text[];
  v_gender text;
  v_seek text;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into v_me from public.profiles where id = me;
  select public._lex(ideal_partner), public._tags(ideal_values), public._tags(ideal_lifestyle)
    into v_ideal, v_iv, v_il
    from public.user_private where user_id = me;
  select gender, interested_in into v_gender, v_seek from public.user_private where user_id = me;
  v_ideal := coalesce(v_ideal, '{}');
  v_iv := coalesce(v_iv, '{}');
  v_il := coalesce(v_il, '{}');
  v_mydoc := public._doc_lex(v_me);
  v_mv := public._tags(v_me.core_values);
  v_ml := public._tags(v_me.lifestyle);
  v_mr := public._tags(v_me.relations);

  return query
  with cand as (
    select p.id as pid, p.university, p.school, p.interests, p.zones, p.sign,
           public._doc_lex(p) as doc_lex, public._lex(up.ideal_partner) as ideal_lex,
           public._tags(p.core_values) as t_val, public._tags(up.ideal_values) as t_ival,
           public._tags(p.lifestyle) as t_life, public._tags(up.ideal_lifestyle) as t_ilife,
           public._tags(p.relations) as t_rel
      from public.profiles p
      join public.user_private up on up.user_id = p.id
     where p.id <> me
       and p.onboarding_completed
       and public._seek_ok(v_seek, up.gender)      -- a quién quiero conocer yo
       and public._seek_ok(up.interested_in, v_gender) -- y a quién quiere conocer la otra persona
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
      (c.zones && v_me.zones) as same_zone,
      public._afinidad(v_iv, v_mv, c.t_ival, c.t_val)                 as p_val,
      public._afinidad(v_il, v_ml, c.t_ilife, c.t_life)               as p_life,
      public._afinidad('{}'::text[], v_mr, '{}'::text[], c.t_rel)     as p_rel,
      case when c.sign is not null and v_me.sign is not null then public.astral_score(v_me.sign, c.sign, 'pareja') end as astral
      from cand c
  ), scored as (
    select k.pid, k.hits, k.p_val, k.p_life, k.p_rel,
      least(100,
          case when cardinality(v_ideal) = 0 then 0 else round(25 * least(1, k.hits::numeric / greatest(1, least(4, cardinality(v_ideal))))) end
        + case when k.their_n = 0 then 0 else round(10 * least(1, k.rhits::numeric / greatest(1, least(4, k.their_n)))) end
        + round(coalesce(k.p_val, 0) * 0.15)
        + round(coalesce(k.p_life, 0) * 0.12)
        + round(coalesce(k.p_rel, 0) * 0.10)
        + case when k.same_uni then 6 else 0 end
        + case when k.same_school then 3 else 0 end
        + least(2, k.n_int) * 3
        + case when k.same_zone then 6 else 0 end
        + round(coalesce(k.astral, 0) * 0.07)
      )::int as pts,
      array_remove(array[
        case when k.hits > 0 then 'Encaja con ' || k.hits || case when k.hits = 1 then ' rasgo' else ' rasgos' end || ' de tu pareja ideal' end,
        case when coalesce(k.p_val, 0) >= 50 then 'Valores afines' end,
        case when k.same_uni then 'Comparten universidad' end,
        case when k.same_school then 'Fueron al mismo colegio' end,
        case when k.n_int > 0 then 'Intereses en común' end,
        case when coalesce(k.p_life, 0) >= 50 then 'Estilo de vida afín' end,
        case when k.same_zone then 'Misma zona' end,
        case when coalesce(k.p_rel, 0) >= 50 then 'Buscan lo mismo' end,
        case when coalesce(k.astral, 0) >= 75 then 'Gran afinidad astral' end
      ], null) as why
      from calc k
  )
  select s.pid, s.pts, s.why, s.p_val, s.p_life, s.p_rel from scored s
   order by s.pts desc, s.pid
   limit greatest(1, least(coalesce(p_limit, 24), 60)) offset greatest(0, coalesce(p_offset, 0));
end $$;
