-- ============================================================================
-- ACTUALIZACIÓN 007 · Buscador universal del directorio
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización (con la 006): ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
--
-- Qué añade:
--   · search_directory() → UNA búsqueda para todas las secciones que encuentra negocios Y lo que venden
--     («paracetamol» → farmacias que lo tienen y a qué precio; «ceviche» → restaurantes con ese plato).
--   · Búsqueda sin distinguir acentos ni mayúsculas («cafeteria» encuentra «Cafetería»), con los comodines
--     de LIKE escapados (un «%» o un «_» se buscan literalmente) e índices trigram para que siga rápida.
--   · search_providers() usa esa misma búsqueda (mismo contrato que en la 006).
-- ============================================================================

-- ── 1. Comparación de texto ─────────────────────────────────────────────────
-- Patrón LIKE seguro a partir de lo que escribió la persona: normalizado (sin acentos, minúsculas) y con \ % _ escapados.
create or replace function public._like_pattern(p_q text) returns text
language sql immutable as $$
  select '%' || replace(replace(replace(public._norm(btrim(coalesce(p_q, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%';
$$;

create index if not exists providers_name_norm_trgm_idx on public.providers using gin (public._norm(name) extensions.gin_trgm_ops);
create index if not exists provider_items_name_norm_trgm_idx on public.provider_items using gin (public._norm(name) extensions.gin_trgm_ops);

-- ── 2. search_providers() con búsqueda insensible a acentos ─────────────────
-- Mismo contrato que en la 006 (mismos parámetros y columnas); solo cambia cómo se compara el texto.
create or replace function public.search_providers(
  p_vertical text, p_subtype text default null, p_zone text default null, p_q text default null,
  p_open_now boolean default false, p_delivers boolean default false, p_verified boolean default false, p_on_duty boolean default false,
  p_lat numeric default null, p_lng numeric default null, p_limit int default 24, p_offset int default 0
) returns table (
  id uuid, slug text, vertical text, subtype text, name text, description text, zone text, logo_url text, cover_url text,
  channels text[], open_now boolean, on_duty boolean, verified boolean, rating numeric, reviews_count int,
  delivery_fee numeric, min_order numeric, distance_km numeric, boosted boolean
)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.*,
           public._is_open(p.hours, p.open_24h) as v_open,
           exists (select 1 from public.provider_duty_shifts d where d.provider_id = p.id and now() >= d.starts_at and now() < d.ends_at) as v_duty,
           public._km(p_lat, p_lng, p.lat, p.lng) as v_km
      from public.providers p
     where p.status = 'active'
       and p.vertical = p_vertical
       and (p_subtype is null or p.subtype = p_subtype)
       and (p_zone is null or p_zone = '' or p.zone ilike p_zone)
       and (p_q is null or btrim(p_q) = '' or public._norm(p.name) like public._like_pattern(p_q)
            or public._norm(p.description) like public._like_pattern(p_q))
       and (not p_delivers or 'entrega' = any (p.channels))
       and (not p_verified or p.verified_at is not null)
  )
  select b.id, b.slug, b.vertical, b.subtype, b.name, b.description, b.zone, b.logo_url, b.cover_url, b.channels,
         b.v_open, b.v_duty, b.verified_at is not null, b.rating, b.reviews_count, b.delivery_fee, b.min_order, b.v_km,
         coalesce(b.boosted_until > now(), false)
    from base b
   where (not p_open_now or b.v_open) and (not p_on_duty or b.v_duty)
   order by (b.v_duty and b.verified_at is not null) desc,
            coalesce(b.boosted_until > now(), false) desc,
            b.v_km asc nulls last,
            (b.verified_at is not null) desc, b.rating desc, b.reviews_count desc, b.created_at desc
   limit greatest(1, least(coalesce(p_limit, 24), 60)) offset greatest(0, coalesce(p_offset, 0));
$$;

-- ── 3. Buscador universal ───────────────────────────────────────────────────
-- Devuelve filas de dos tipos:
--   kind = 'provider' → el negocio coincide por nombre, descripción o categoría («farmacia», «tienda de mascotas»)
--   kind = 'item'     → el negocio tiene un producto, plato o servicio que coincide (con su precio); hasta 3 por negocio
-- Orden: nombre que empieza por lo buscado → otros negocios → productos; dentro de cada grupo, de turno verificado,
-- verificados y mejor valorados primero. Mínimo 2 caracteres. Solo perfiles activos y artículos disponibles.
-- Los medicamentos con receta se listan (para informar) pero `requires_prescription` avisa de que no se venden por la app.
create or replace function public.search_directory(p_q text, p_zone text default null, p_vertical text default null, p_limit int default 24)
returns table (
  kind text, provider_id uuid, slug text, vertical text, subtype text, name text, zone text, logo_url text,
  verified boolean, open_now boolean, on_duty boolean, rating numeric,
  item_name text, item_price numeric, requires_prescription boolean
)
language sql stable security definer set search_path = public as $$
  with qq as (
    select public._norm(btrim(coalesce(p_q, ''))) as n, public._like_pattern(p_q) as pat
  ), base as (
    select p.*,
           public._is_open(p.hours, p.open_24h) as v_open,
           exists (select 1 from public.provider_duty_shifts d where d.provider_id = p.id and now() >= d.starts_at and now() < d.ends_at) as v_duty
      from public.providers p
     where p.status = 'active'
       and (p_vertical is null or p.vertical = p_vertical)
       and (p_zone is null or p_zone = '' or p.zone ilike p_zone)
  ), prov as (
    select 'provider'::text as kind, b.id as provider_id, b.slug, b.vertical, b.subtype, b.name, b.zone, b.logo_url,
           b.verified_at is not null as verified, b.v_open as open_now, b.v_duty as on_duty, b.rating::numeric as rating,
           null::text as item_name, null::numeric as item_price, null::boolean as requires_prescription,
           case when starts_with(public._norm(b.name), qq.n) then 1 else 2 end as rk,
           (b.v_duty and b.verified_at is not null) as duty_ok
      from base b, qq
     where char_length(qq.n) >= 2
       and (public._norm(b.name) like qq.pat or public._norm(b.description) like qq.pat or replace(b.subtype, '_', ' ') like qq.pat)
  ), its as (
    select 'item'::text as kind, b.id as provider_id, b.slug, b.vertical, b.subtype, b.name, b.zone, b.logo_url,
           b.verified_at is not null as verified, b.v_open as open_now, b.v_duty as on_duty, b.rating::numeric as rating,
           i.name as item_name, i.price::numeric as item_price, i.requires_prescription,
           3 as rk, (b.v_duty and b.verified_at is not null) as duty_ok,
           row_number() over (partition by b.id order by i.price nulls last, i.name) as rn
      from public.provider_items i join base b on b.id = i.provider_id, qq
     where i.available and char_length(qq.n) >= 2 and public._norm(i.name) like qq.pat
  )
  select u.kind, u.provider_id, u.slug, u.vertical, u.subtype, u.name, u.zone, u.logo_url, u.verified, u.open_now, u.on_duty, u.rating,
         u.item_name, u.item_price, u.requires_prescription
    from (
      select kind, provider_id, slug, vertical, subtype, name, zone, logo_url, verified, open_now, on_duty, rating, item_name, item_price, requires_prescription, rk, duty_ok from prov
      union all
      select kind, provider_id, slug, vertical, subtype, name, zone, logo_url, verified, open_now, on_duty, rating, item_name, item_price, requires_prescription, rk, duty_ok from its where rn <= 3
    ) u
   order by u.rk, u.duty_ok desc, u.verified desc, u.rating desc, u.name, u.item_price nulls last
   limit greatest(1, least(coalesce(p_limit, 24), 50));
$$;

-- ── 4. Privilegios de ejecución ─────────────────────────────────────────────
grant execute on function public.search_directory(text, text, text, int) to anon, authenticated;
grant execute on function
  public.search_providers(text, text, text, text, boolean, boolean, boolean, boolean, numeric, numeric, int, int)
  to anon, authenticated;
revoke execute on function public._like_pattern(text) from public, anon, authenticated;
-- Los índices sobre public._norm(...) se mantienen con los privilegios de quien inserta o edita: sin este permiso, publicar un
-- perfil o un producto fallaría con «permission denied for function _norm». Es una función pura de texto (minúsculas y sin acentos).
grant execute on function public._norm(text) to anon, authenticated;
