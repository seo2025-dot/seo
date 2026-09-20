-- ============================================================================
-- ACTUALIZACIÓN 004 · Pareja ideal estructurada y motor de afinidad con desglose
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización (con la 003): ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
--
-- Qué añade:
--   · profiles.core_values      → los valores con los que TÚ te identificas (públicos, se muestran en el perfil).
--   · user_private.ideal_values → los valores que buscas en tu pareja (privados).
--   · user_private.ideal_lifestyle → el estilo de vida que buscas en tu pareja (privado).
--     El «tipo de relación» que buscas sigue siendo profiles.relations (ya era público y filtra en /citas).
--   · recommend_people() devuelve, además del puntaje, el porcentaje de afinidad por dimensión
--     (valores, estilo de vida, tipo de relación) para pintarlo en las tarjetas de /explorar y /citas.
--
-- Privacidad: lo que buscas (ideal_*) solo lo lee su dueño; el motor lo usa dentro de funciones SECURITY DEFINER y
-- solo devuelve porcentajes, nunca los textos ni las listas de la otra persona.
-- ============================================================================

-- ── 1. Columnas nuevas ──────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists core_values text[] not null default '{}'
    check (cardinality(core_values) <= 8 and char_length(array_to_string(core_values, '|')) <= 400);

alter table public.user_private
  add column if not exists ideal_values text[] not null default '{}'
    check (cardinality(ideal_values) <= 8 and char_length(array_to_string(ideal_values, '|')) <= 400),
  add column if not exists ideal_lifestyle text[] not null default '{}'
    check (cardinality(ideal_lifestyle) <= 8 and char_length(array_to_string(ideal_lifestyle, '|')) <= 400);

grant update (core_values) on public.profiles to authenticated;
grant update (ideal_values, ideal_lifestyle) on public.user_private to authenticated;

-- ── 2. Piezas del cálculo ───────────────────────────────────────────────────
-- Etiqueta comparable: sin acentos ni mayúsculas y sin la marca de género/plural final («Casero» = «Casera»).
create or replace function public._tags(p_tags text[]) returns text[]
language sql immutable as $$
  select coalesce(array(
    select distinct regexp_replace(public._norm(x), '[ao]s?$', '')
      from unnest(coalesce(p_tags, '{}'::text[])) x
     where btrim(coalesce(x, '')) <> ''
  ), '{}'::text[]);
$$;

-- Qué parte de lo que se busca aparece en lo que se tiene (0–1). NULL si falta alguno de los dos lados.
create or replace function public._cobertura(p_busca text[], p_tiene text[]) returns numeric
language sql immutable as $$
  select case when cardinality(p_busca) > 0 and cardinality(p_tiene) > 0
              then (select count(*) from unnest(p_busca) x where x = any (p_tiene))::numeric / cardinality(p_busca)
         end;
$$;

-- Afinidad 0–100 en una dimensión. Pesa 70 % lo que TÚ buscas frente a lo que la otra persona tiene, y 30 % lo que ELLA/ÉL
-- busca frente a lo que tú tienes (reciprocidad). Si alguien no dijo qué busca, se compara con lo que ya tiene (afinidad
-- por parecido). NULL cuando no hay datos suficientes de tu lado: es «sin información», no un 0 %.
create or replace function public._afinidad(p_mi_ideal text[], p_mio text[], p_su_ideal text[], p_suyo text[]) returns int
language sql immutable as $$
  with t as (
    select public._cobertura(case when cardinality(p_mi_ideal) > 0 then p_mi_ideal else p_mio end, p_suyo) as a,
           public._cobertura(case when cardinality(p_su_ideal) > 0 then p_su_ideal else p_suyo end, p_mio) as b
  )
  select case when a is null then null
              when b is null then round(100 * a)::int
              else round(100 * (0.7 * a + 0.3 * b))::int
         end
    from t;
$$;

-- Los valores propios también cuentan cuando el texto de la pareja ideal se compara con cómo se describe cada perfil.
create or replace function public._doc_lex(p public.profiles) returns text[]
language sql immutable as $$
  select public._lex(concat_ws(' ', p.bio, p.university, p.school, p.location,
                               array_to_string(p.lifestyle, ' '), array_to_string(p.interests, ' '),
                               array_to_string(p.core_values, ' '),
                               p.professional ->> 'headline'));
$$;

-- ── 3. Motor de recomendación con desglose ──────────────────────────────────
-- El tipo de retorno cambia (columnas nuevas): hay que recrear la función.
drop function if exists public.recommend_people(int, int, int, int, int, int);

-- Devuelve personas ordenadas por afinidad (0–100), con motivos y el porcentaje de cada dimensión.
-- Reparto de los 100 puntos (100 % = encaje total):
--   · 25  lo que TÚ describes como pareja ideal  ↔  cómo se describe cada perfil (texto)
--   · 10  lo que ELLA/ÉL describe como ideal     ↔  cómo te describes tú (texto, reciprocidad)
--   · 15  valores        (pct_values × 15 %)
--   · 12  estilo de vida (pct_lifestyle × 12 %)
--   · 10  tipo de relación (pct_relation × 10 %)
--   · 9   universidad (6) y colegio (3) compartidos
--   · 6   intereses en común (hasta 2)
--   · 6   zona en común
--   · 7   afinidad astral
-- Oculta a quienes ya descartaste. No devuelve ningún texto privado, solo puntajes y motivos genéricos.
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
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into v_me from public.profiles where id = me;
  select public._lex(ideal_partner), public._tags(ideal_values), public._tags(ideal_lifestyle)
    into v_ideal, v_iv, v_il
    from public.user_private where user_id = me;
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

-- ── 4. Privilegios de ejecución ─────────────────────────────────────────────
grant execute on function public.recommend_people(int, int, int, int, int, int) to authenticated;
revoke execute on function
  public._tags(text[]), public._cobertura(text[], text[]), public._afinidad(text[], text[], text[], text[])
  from public, anon, authenticated;
