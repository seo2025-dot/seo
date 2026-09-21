-- ============================================================================
-- ACTUALIZACIÓN 012 · Geolocalización e internacionalización: país en perfiles y negocios, ubicación aproximada privada y búsqueda por país
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización (con la 011): ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
--
-- Qué añade:
--   · profiles.country (código ISO de 2 letras): es PÚBLICO (lo ven todas las personas; solo dice el país).
--   · user_private.city / lat / lng / timezone: la ubicación APROXIMADA (2 decimales ≈ 1 km) de la persona. Solo su dueña o dueño la lee
--     (user_private ya solo se lee con `user_id = auth.uid()`). Se escribe únicamente con set_my_location() y se borra con clear_my_location().
--   · providers.country (por defecto EC): en qué país está el negocio. Se puede fijar al crear o editar el perfil.
--   · search_providers() acepta `p_country` para listar solo los negocios de un país (junto con p_lat/p_lng ya ordenaba por cercanía).
-- ============================================================================

-- ── 1. País en perfiles y negocios ──────────────────────────────────────────
alter table public.profiles add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$');
alter table public.providers add column if not exists country text not null default 'EC' check (country ~ '^[A-Z]{2}$');
create index if not exists providers_country_idx on public.providers (country, vertical) where status = 'active';
grant insert (country), update (country) on public.providers to authenticated;

-- ── 2. Ubicación aproximada y privada ───────────────────────────────────────
alter table public.user_private
  add column if not exists city text check (city is null or char_length(city) <= 60),
  add column if not exists lat numeric(5,2) check (lat is null or lat between -90 and 90),
  add column if not exists lng numeric(5,2) check (lng is null or lng between -180 and 180),
  add column if not exists timezone text check (timezone is null or (char_length(timezone) <= 64 and timezone ~ '^[A-Za-z_]+(/[A-Za-z_+0-9-]+){1,2}$')),
  add column if not exists geo_updated timestamptz;

create or replace function public.set_my_location(p_country text, p_city text, p_lat numeric, p_lng numeric, p_timezone text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if p_country is null or p_country !~ '^[A-Z]{2}$' then raise exception 'País no válido' using errcode = '22023'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Coordenadas no válidas' using errcode = '22023'; end if;
  if p_timezone is null or char_length(p_timezone) > 64 or p_timezone !~ '^[A-Za-z_]+(/[A-Za-z_+0-9-]+){1,2}$' then raise exception 'Zona horaria no válida' using errcode = '22023'; end if;
  if char_length(coalesce(p_city, '')) > 60 then raise exception 'La ciudad admite como máximo 60 caracteres' using errcode = '22023'; end if;
  update public.profiles set country = p_country where id = me;
  -- Se guarda redondeada a 2 decimales (≈ 1,1 km) aunque el cliente envíe más precisión.
  insert into public.user_private (user_id, city, lat, lng, timezone, geo_updated)
  values (me, nullif(btrim(coalesce(p_city, '')), ''), round(p_lat, 2), round(p_lng, 2), p_timezone, now())
  on conflict (user_id) do update set city = excluded.city, lat = excluded.lat, lng = excluded.lng, timezone = excluded.timezone, geo_updated = excluded.geo_updated;
end $$;

create or replace function public.clear_my_location() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  update public.profiles set country = null where id = me;
  update public.user_private set city = null, lat = null, lng = null, timezone = null, geo_updated = null where user_id = me;
end $$;

-- ── 3. Búsqueda por país (mismo contrato; un parámetro más al final) ────────
drop function if exists public.search_providers(text, text, text, text, boolean, boolean, boolean, boolean, numeric, numeric, int, int);
create or replace function public.search_providers(
  p_vertical text, p_subtype text default null, p_zone text default null, p_q text default null,
  p_open_now boolean default false, p_delivers boolean default false, p_verified boolean default false, p_on_duty boolean default false,
  p_lat numeric default null, p_lng numeric default null, p_limit int default 24, p_offset int default 0,
  p_country text default null
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
       and (p_country is null or p.country = p_country)
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

-- ── 4. Permisos ─────────────────────────────────────────────────────────────
grant execute on function
  public.search_providers(text, text, text, text, boolean, boolean, boolean, boolean, numeric, numeric, int, int, text)
  to anon, authenticated;
grant execute on function public.set_my_location(text, text, numeric, numeric, text), public.clear_my_location() to authenticated;
