-- ============================================================================
-- Inmobiliaria.social · Esquema completo para Supabase (PostgreSQL)
--
-- CÓMO APLICARLO: Supabase Dashboard > SQL Editor > New query > pega TODO este archivo > Run.
-- Es seguro ejecutarlo en un proyecto nuevo. NO lo ejecutes dos veces (fallaría al recrear tablas).
--
-- Contenido:
--   1. Tablas: profiles, listings (oferta y demanda), matches, jobs, chats, messages, notifications,
--      comunidad, reseñas, recompensas, KYC.
--   2. Funciones: motor de coincidencias oferta ↔ demanda, compatibilidad astral, RPC (chat, ofertas, KYC, monedas…).
--   3. Seguridad: Row Level Security en TODAS las tablas + privilegios por columna.
--   4. Storage (buckets `media` y `kyc`) y Realtime.
--   5. Fotos de perfil (máx. 10), onboarding y simulación de personas (actualización 002, al final).
--
-- Tras ejecutarlo, para hacerte administrador (revisar KYC) sustituye tu correo y ejecuta:
--   insert into public.app_admins (user_id) select id from auth.users where email = 'tu@correo.com';
-- ============================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ── Utilidades ──────────────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── Perfiles ("profiles") ──────────────────────────────────────────────────────
-- Datos públicos del perfil. Nada sensible vive aquí (ver user_private y kyc_submissions).
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text not null default 'Nuevo usuario' check (char_length(display_name) between 1 and 60),
  handle            text unique check (handle ~ '^@[a-z0-9_.]{2,40}$'),
  bio               text not null default '' check (char_length(bio) <= 300),
  location          text not null default '' check (char_length(location) <= 60),
  avatar_url        text,
  interests         text[] not null default '{}',   -- roomie, inversor, comprador, amigos, anfitrion, inquilino
  zones             text[] not null default '{}',
  relations         text[] not null default '{}',   -- pareja, amistad, roomie, socios
  lifestyle         text[] not null default '{}',
  budget            text check (char_length(budget) <= 60),
  age               int check (age is null or age between 18 and 100),
  sign              text check (sign in ('aries','tauro','geminis','cancer','leo','virgo','libra','escorpio','sagitario','capricornio','acuario','piscis')),
  professional      jsonb check (professional is null or jsonb_typeof(professional) = 'object'),  -- {headline, skills[], portfolio[]}
  -- Campos que SOLO modifican funciones del servidor (ver privilegios de columna en 0003):
  badges            text[] not null default array['explorador'],
  email_verified    boolean not null default false,
  phone_verified    boolean not null default false,
  identity_verified boolean not null default false,
  kyc_status        text not null default 'none' check (kyc_status in ('none','pending','verified','rejected')),
  rating            numeric(2,1) not null default 0 check (rating between 0 and 5),
  reviews_count     int not null default 0 check (reviews_count >= 0),
  response_rate     int not null default 100 check (response_rate between 0 and 100),
  trust_score       int not null default 40 check (trust_score between 0 and 100),   -- puntaje de confianza P2P (lo calcula el servidor)
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Datos privados (solo el propio usuario).
create table public.user_private (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  birth_date date check (birth_date is null or birth_date >= date '1900-01-01'),
  phone      text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,20}$'),
  updated_at timestamptz not null default now()
);
create trigger user_private_updated_at before update on public.user_private for each row execute function public.set_updated_at();


-- La app es solo para adultos: se valida en un trigger porque CHECK no admite expresiones dependientes del reloj.
create or replace function public.enforce_adult() returns trigger
language plpgsql as $$
begin
  if new.birth_date is not null and new.birth_date > (current_date - interval '18 years')::date then
    raise exception 'Debes ser mayor de 18 años' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger user_private_adult before insert or update of birth_date on public.user_private
  for each row execute function public.enforce_adult();
create table public.app_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);

-- ── KYC ─────────────────────────────────────────────────────────────────────
-- Las imágenes están en el bucket privado `kyc` (ruta = <user_id>/<archivo>); aquí solo se guardan las rutas.
create table public.kyc_submissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  doc_path    text not null,
  selfie_path text not null,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason      text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  check (doc_path like user_id::text || '/%' and selfie_path like user_id::text || '/%')
);
create index kyc_pending_idx on public.kyc_submissions (created_at) where status = 'pending';
create unique index kyc_one_pending_per_user on public.kyc_submissions (user_id) where status = 'pending';

-- ── Ofertas y demandas (inmuebles, vehículos, negocios) ─────────────────────
create table public.listings (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  kind           text not null check (kind in ('offer','demand')),
  category       text not null check (category in ('property','vehicle','business')),
  operation      text check (operation in ('sale','rent')),      -- en demandas: sale = quiero comprar, rent = quiero alquilar
  subtype        text not null default '' check (char_length(subtype) <= 60),  -- casa/villa/… · auto/moto/… · rubro
  title          text not null check (char_length(title) between 3 and 120),
  description    text not null default '' check (char_length(description) <= 2000),
  price          numeric(14,2) check (price > 0),                -- ofertas: precio / inversión
  budget_max     numeric(14,2) check (budget_max > 0),           -- demandas: presupuesto máximo
  currency       text not null default 'USD' check (currency in ('USD','EUR','ARS','MXN')),
  zone           text not null default '' check (char_length(zone) <= 80),
  area           numeric(10,2) check (area > 0),                 -- m² de la oferta
  min_area       numeric(10,2) check (min_area > 0),             -- m² mínimos de la demanda
  attrs          jsonb not null default '{}' check (jsonb_typeof(attrs) = 'object'),  -- dormitorios, baños, marca, año, km, extras…
  images         text[] not null default '{}' check (cardinality(images) <= 8),
  flash_discount int check (flash_discount between 1 and 90),
  flash_until    timestamptz,
  boosted_until  timestamptz,
  status         text not null default 'active' check (status in ('active','paused','closed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint offer_has_price   check (kind <> 'offer'  or price is not null),
  constraint demand_has_budget check (kind <> 'demand' or budget_max is not null),
  constraint demand_no_business check (kind <> 'demand' or category <> 'business'),
  constraint operation_required check (category = 'business' or operation is not null)
);
create trigger listings_updated_at before update on public.listings for each row execute function public.set_updated_at();

-- Índices del motor de coincidencias.
create index listings_match_idx  on public.listings (kind, category, operation, subtype) where status = 'active';
create index listings_offer_price_idx  on public.listings (currency, price)      where kind = 'offer'  and status = 'active';
create index listings_demand_budget_idx on public.listings (currency, budget_max) where kind = 'demand' and status = 'active';
create index listings_zone_trgm_idx on public.listings using gin (zone extensions.gin_trgm_ops);
create index listings_owner_idx   on public.listings (owner_id);
create index listings_created_idx on public.listings (created_at desc);
create index listings_boost_idx   on public.listings (boosted_until desc) where boosted_until is not null;

-- Pares oferta↔demanda que coinciden (los mantiene el trigger del motor).
create table public.listing_matches (
  offer_id   uuid not null references public.listings (id) on delete cascade,
  demand_id  uuid not null references public.listings (id) on delete cascade,
  score      int not null check (score between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (offer_id, demand_id)
);
create index listing_matches_demand_idx on public.listing_matches (demand_id);

-- Guardados y descartes de ofertas (base del swipe de /match).
create table public.listing_swipes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  action     text not null check (action in ('save','pass')),
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index listing_swipes_saved_idx on public.listing_swipes (user_id) where action = 'save';

-- ── Citas y compatibilidad astral ───────────────────────────────────────────
create table public.person_swipes (
  from_user  uuid not null references public.profiles (id) on delete cascade,
  to_user    uuid not null references public.profiles (id) on delete cascade,
  action     text not null check (action in ('like','pass','super')),
  relation   text not null default 'pareja' check (relation in ('pareja','amistad','roomie','socios')),
  created_at timestamptz not null default now(),
  primary key (from_user, to_user),
  check (from_user <> to_user)
);
create index person_swipes_to_idx on public.person_swipes (to_user, action);

create table public.matches (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references public.profiles (id) on delete cascade,
  user_b       uuid not null references public.profiles (id) on delete cascade,
  relation     text not null default 'pareja' check (relation in ('pareja','amistad','roomie','socios')),
  astral_score int check (astral_score between 0 and 100),
  chat_id      uuid,
  created_at   timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
create index matches_b_idx on public.matches (user_b);

create table public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);

-- ── Servicios y empleos ─────────────────────────────────────────────────────
create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('gig','vacancy')),
  title         text not null check (char_length(title) between 5 and 120),
  description   text not null default '' check (char_length(description) <= 2000),
  category      text check (category in ('fotografia','arquitectura','plomeria','legal','tarot','diseno','mudanzas')),  -- gigs
  price_from    numeric(12,2) check (price_from > 0),                                                                  -- gigs
  currency      text not null default 'USD' check (currency in ('USD','EUR','ARS','MXN')),
  delivery_days int check (delivery_days >= 1),                                                                        -- gigs
  job_type      text check (job_type in ('tiempo-completo','contrato','proyecto')),                                   -- vacantes
  modality      text check (modality in ('remoto','presencial','hibrido')),                                          -- vacantes
  location      text not null default '',
  budget_text   text,                                                                                                  -- vacantes
  skills        text[] not null default '{}',
  image_url     text,
  sales_count   int not null default 0,
  status        text not null default 'active' check (status in ('active','paused','closed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint gig_fields check (kind <> 'gig' or (category is not null and price_from is not null and delivery_days is not null)),
  constraint vacancy_fields check (kind <> 'vacancy' or (job_type is not null and modality is not null))
);
create trigger jobs_updated_at before update on public.jobs for each row execute function public.set_updated_at();
create index jobs_kind_idx on public.jobs (kind, status, created_at desc);
create index jobs_owner_idx on public.jobs (owner_id);

create table public.job_applications (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'applied' check (status in ('applied','shortlisted','hired','rejected')),
  created_at   timestamptz not null default now(),
  unique (job_id, applicant_id)
);
create index job_applications_applicant_idx on public.job_applications (applicant_id);

-- ── Mensajería ──────────────────────────────────────────────────────────────
create table public.chats (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('listing','gig','job','direct')),
  listing_id      uuid references public.listings (id) on delete set null,
  job_id          uuid references public.jobs (id) on delete set null,
  origin          text check (origin in ('cita','match')),
  context_key     text not null unique,     -- evita chats duplicados: listing:<id>:<comprador>, direct:<a>:<b>…
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index chats_last_message_idx on public.chats (last_message_at desc);

alter table public.matches add constraint matches_chat_fk foreign key (chat_id) references public.chats (id) on delete set null;

create table public.chat_members (
  chat_id      uuid not null references public.chats (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at    timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index chat_members_user_idx on public.chat_members (user_id);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.chats (id) on delete cascade,
  sender_id  uuid references public.profiles (id) on delete set null,   -- null = mensaje del sistema
  kind       text not null default 'text' check (kind in ('text','offer','quote','system')),
  body       text not null default '' check (char_length(body) <= 4000),
  amount     numeric(14,2) check (amount > 0),
  currency   text check (currency in ('USD','EUR','ARS','MXN')),
  days       int check (days >= 1),
  status     text check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  constraint text_has_body    check (kind not in ('text','system') or char_length(btrim(body)) > 0),
  constraint deal_fields      check ((kind in ('offer','quote') and amount is not null and currency is not null and status is not null)
                                  or (kind in ('text','system') and amount is null and status is null))
);
create index messages_chat_idx on public.messages (chat_id, created_at desc);

-- ── Notificaciones ──────────────────────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in ('match-demanda','match-persona','solicitud','oferta','kyc','recompensa','sistema')),
  title      text not null,
  body       text not null default '',
  href       text,
  data       jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ── Comunidad ───────────────────────────────────────────────────────────────
create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('historia','consulta','propiedad','experiencia')),
  body       text not null check (char_length(btrim(body)) between 1 and 600),
  zone       text check (char_length(zone) <= 80),
  image_url  text,
  created_at timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx  on public.posts (author_id);

create table public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);

-- ── Reseñas y reputación ────────────────────────────────────────────────────
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  target_id  uuid not null references public.profiles (id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  comment    text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (author_id, target_id),
  check (author_id <> target_id)
);
create index reviews_target_idx on public.reviews (target_id);

-- ── Recompensas ─────────────────────────────────────────────────────────────
create table public.wallets (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  coins            int not null default 20 check (coins >= 0),
  streak           int not null default 0 check (streak between 0 and 7),
  last_checkin     date,
  last_spin        date,
  super_likes      int not null default 1 check (super_likes >= 0),
  premium_readings int not null default 0 check (premium_readings >= 0),
  updated_at       timestamptz not null default now()
);
create trigger wallets_updated_at before update on public.wallets for each row execute function public.set_updated_at();

create table public.wallet_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  delta      int not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index wallet_ledger_user_idx on public.wallet_ledger (user_id, created_at desc);

create table public.missions_claimed (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  mission_id text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, mission_id)
);

create table public.tarot_draws (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  cards      int[] not null check (cardinality(cards) in (1, 3)),
  premium    boolean not null default false,
  created_at timestamptz not null default now()
);
create index tarot_draws_user_idx on public.tarot_draws (user_id, premium, created_at desc);

-- ── Alta automática de perfil al registrarse en Supabase Auth ───────────────
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
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Puntaje de confianza P2P (0–100) ────────────────────────────────────────
-- Mantener idéntico a puntajeConfianza() de src/lib/confianza.ts (hay test de paridad).
create or replace function public.compute_trust_score(p public.profiles) returns int
language sql stable as $$
  select greatest(0, least(100,
      30
    + case when p.identity_verified then 25 else 0 end
    + case when p.phone_verified    then 8  else 0 end
    + case when p.email_verified    then 7  else 0 end
    + case when p.reviews_count > 0 then round(p.rating / 5 * 20)::int else 0 end
    + round(p.response_rate * 0.06)::int
    + greatest(0, least(4, extract(year from now())::int - extract(year from p.created_at)::int))
  ));
$$;

create or replace function public.profiles_set_trust() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.trust_score := public.compute_trust_score(new);
  return new;
end $$;
create trigger profiles_trust before insert or update on public.profiles
  for each row execute function public.profiles_set_trust();

create or replace function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles set email_verified = true where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_updated after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_updated();


-- ============================================================================
-- Funciones: helpers, compatibilidad astral, motor de coincidencias y RPC
-- ============================================================================

-- ── Helpers usados por las políticas RLS ────────────────────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

create or replace function public.is_chat_member(p_chat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_members where chat_id = p_chat and user_id = auth.uid());
$$;

create or replace function public.shares_chat_with(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.chat_members a
    join public.chat_members b on a.chat_id = b.chat_id
    where a.user_id = auth.uid() and b.user_id = p_other
  );
$$;

-- ── Compatibilidad astral (port de src/lib/astrologia.ts → sinastria) ───────
-- Debe mantenerse idéntica al código TypeScript: hay un test de paridad en supabase/tests.
create or replace function public.js_hash(p_text text) returns bigint
language plpgsql immutable as $$
declare
  h bigint := 0;
  i int;
begin
  for i in 1 .. char_length(p_text) loop
    h := (h * 31 + ascii(substr(p_text, i, 1))) % 4294967296;
  end loop;
  return h;
end $$;

create or replace function public.astral_score(p_a text, p_b text, p_ctx text default 'pareja') returns int
language plpgsql immutable set search_path = public as $$
declare
  signs text[] := array['aries','tauro','geminis','cancer','leo','virgo','libra','escorpio','sagitario','capricornio','acuario','piscis'];
  elems text[] := array['fuego','tierra','aire','agua','fuego','tierra','aire','agua','fuego','tierra','aire','agua'];
  mods  text[] := array['cardinal','fijo','mutable','cardinal','fijo','mutable','cardinal','fijo','mutable','cardinal','fijo','mutable'];
  afin  jsonb  := '{"fuego":{"fuego":84,"aire":90,"tierra":58,"agua":50},
                    "aire":{"fuego":90,"aire":82,"tierra":56,"agua":62},
                    "tierra":{"fuego":58,"aire":56,"tierra":86,"agua":91},
                    "agua":{"fuego":50,"aire":62,"tierra":91,"agua":85}}';
  ia int := array_position(signs, p_a);
  ib int := array_position(signs, p_b);
  ea text; eb text; par text;
  base int; jitter int; score int;
begin
  if ia is null or ib is null then
    return null;
  end if;
  ea := elems[ia];
  eb := elems[ib];
  base := (afin -> ea ->> eb)::int;
  par := case when ea collate "C" <= eb collate "C" then ea || '+' || eb else eb || '+' || ea end;

  if p_ctx = 'socios' then
    if par = 'fuego+tierra' then base := 92;
    elsif par = 'agua+tierra' then base := 90;
    elsif par = 'fuego+fuego' then base := 80;
    end if;
  elsif p_ctx = 'roomie' then
    if par = 'tierra+tierra' then base := base + 4; end if;
    if par = 'fuego+fuego' then base := base - 8; end if;
  elsif p_ctx = 'amistad' and (ea = 'aire' or eb = 'aire') then
    base := base + 4;
  end if;

  if p_ctx = 'pareja' and abs(ia - ib) = 6 then base := base + 7; end if;
  if mods[ia] = mods[ib] and p_a <> p_b then base := base - 3; end if;

  jitter := (public.js_hash(case when p_a collate "C" <= p_b collate "C" then p_a || '-' || p_b else p_b || '-' || p_a end) % 11)::int - 5;
  score := greatest(35, least(99, base + jitter));
  return score;
end $$;

-- ── Motor de coincidencias oferta ↔ demanda ─────────────────────────────────
create or replace function public.effective_price(l public.listings) returns numeric
language sql stable as $$
  select case
    when l.flash_discount is not null and l.flash_until is not null and l.flash_until > now()
      then round(l.price * (1 - l.flash_discount / 100.0))
    else l.price
  end;
$$;

-- ¿Este inventario cubre lo que pide esta demanda?
create or replace function public.offer_fits_demand(o public.listings, d public.listings) returns boolean
language sql stable as $$
  select o.kind = 'offer' and d.kind = 'demand'
     and o.status = 'active' and d.status = 'active'
     and o.owner_id <> d.owner_id
     and o.category = d.category
     and o.operation is not distinct from d.operation
     and (d.subtype = '' or o.subtype = d.subtype)
     and (d.zone = '' or o.zone ilike '%' || d.zone || '%')
     and o.currency = d.currency
     and public.effective_price(o) <= d.budget_max
     and (d.min_area is null or o.area is null or o.area >= d.min_area);
$$;

create or replace function public.match_score(o public.listings, d public.listings) returns int
language sql stable as $$
  select least(100,
      50
    + case when d.subtype <> '' and o.subtype = d.subtype then 15 else 0 end
    + case when d.zone <> '' and lower(o.zone) = lower(d.zone) then 15 else 0 end
    + least(20, greatest(0, round(20 * (1 - public.effective_price(o) / d.budget_max)))::int)
  );
$$;

-- Ofertas que satisfacen una demanda (usa listings_match_idx y el índice trigram de zona).
create or replace function public.find_offers_for_demand(p_demand uuid)
returns setof public.listings
language sql stable set search_path = public as $$
  select o.*
  from public.listings d
  join public.listings o
    on o.kind = 'offer' and o.status = 'active'
   and o.category = d.category
   and o.operation is not distinct from d.operation
  where d.id = p_demand and d.kind = 'demand'
    and public.offer_fits_demand(o, d)
  order by public.match_score(o, d) desc, o.created_at desc;
$$;

-- Demandas que encajan con una oferta.
create or replace function public.find_demands_for_offer(p_offer uuid)
returns setof public.listings
language sql stable set search_path = public as $$
  select d.*
  from public.listings o
  join public.listings d
    on d.kind = 'demand' and d.status = 'active'
   and d.category = o.category
   and d.operation is not distinct from o.operation
  where o.id = p_offer and o.kind = 'offer'
    and public.offer_fits_demand(o, d)
  order by public.match_score(o, d) desc, d.created_at desc;
$$;

create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text default '', p_href text default null, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, href, data)
  values (p_user, p_type, p_title, p_body, p_href, coalesce(p_data, '{}'));
$$;

-- Recalcula los pares de un anuncio y avisa (en tiempo real vía `notifications`) solo de los pares nuevos.
create or replace function public.refresh_listing_matches(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  r public.listings;
  n_new int := 0;
  n_total int := 0;
begin
  select * into l from public.listings where id = p_id;
  if not found then return 0; end if;

  if l.status <> 'active' then
    delete from public.listing_matches where offer_id = l.id or demand_id = l.id;
    return 0;
  end if;

  if l.kind = 'offer' then
    delete from public.listing_matches m
     where m.offer_id = l.id
       and not exists (select 1 from public.listings d where d.id = m.demand_id and public.offer_fits_demand(l, d));

    for r in select d.* from public.find_demands_for_offer(l.id) d loop
      n_total := n_total + 1;
      insert into public.listing_matches (offer_id, demand_id, score)
      values (l.id, r.id, public.match_score(l, r))
      on conflict (offer_id, demand_id) do update set score = excluded.score;
      -- Solo se notifica el par la primera vez (el aviso guarda offer_id/demand_id en `data`).
      if not exists (select 1 from public.notifications n
                      where n.user_id = r.owner_id and n.type = 'match-demanda'
                        and n.data ->> 'offer_id' = l.id::text and n.data ->> 'demand_id' = r.id::text) then
        n_new := n_new + 1;
        perform public.notify(r.owner_id, 'match-demanda',
          '⚡ Una oferta coincide con tu búsqueda',
          'Se publicó "' || l.title || '" que encaja con lo que buscas.',
          '/mercado/' || l.id, jsonb_build_object('offer_id', l.id, 'demand_id', r.id));
      end if;
    end loop;

    if n_new > 0 then
      perform public.notify(l.owner_id, 'match-demanda',
        '🔥 ' || n_new || case when n_new = 1 then ' comprador busca' else ' compradores buscan' end || ' algo como tu anuncio',
        'Tu publicación "' || l.title || '" coincide con búsquedas activas.',
        '/mercado/' || l.id, jsonb_build_object('offer_id', l.id, 'count', n_new));
    end if;

  else  -- demand
    delete from public.listing_matches m
     where m.demand_id = l.id
       and not exists (select 1 from public.listings o where o.id = m.offer_id and public.offer_fits_demand(o, l));

    for r in select o.* from public.find_offers_for_demand(l.id) o loop
      n_total := n_total + 1;
      insert into public.listing_matches (offer_id, demand_id, score)
      values (r.id, l.id, public.match_score(r, l))
      on conflict (offer_id, demand_id) do update set score = excluded.score;
      if not exists (select 1 from public.notifications n
                      where n.user_id = r.owner_id and n.type = 'match-demanda'
                        and n.data ->> 'offer_id' = r.id::text and n.data ->> 'demand_id' = l.id::text) then
        n_new := n_new + 1;
        perform public.notify(r.owner_id, 'match-demanda',
          '🔥 Un comprador busca algo como tu anuncio',
          'Hay una búsqueda activa que coincide con "' || r.title || '".',
          '/mercado/' || r.id, jsonb_build_object('offer_id', r.id, 'demand_id', l.id));
      end if;
    end loop;

    if n_new > 0 then
      perform public.notify(l.owner_id, 'match-demanda',
        '⚡ ' || n_new || case when n_new = 1 then ' oferta coincide' else ' ofertas coinciden' end || ' con tu búsqueda',
        'Ya puedes contactar con los dueños.',
        '/mercado', jsonb_build_object('demand_id', l.id, 'count', n_new));
    end if;
  end if;

  return n_total;
end $$;

create or replace function public.listings_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_listing_matches(new.id);
  return null;
end $$;

create trigger listings_match_after_insert after insert on public.listings
  for each row execute function public.listings_after_write();
create trigger listings_match_after_update after update of status, price, budget_max, zone, subtype, operation, currency, area, min_area, flash_discount, flash_until on public.listings
  for each row execute function public.listings_after_write();

-- Nº de compradores que buscan cada oferta (agregado, sin datos personales).
create or replace function public.demand_counts_for_offers()
returns table (offer_id uuid, buyers int)
language sql stable security definer set search_path = public as $$
  select m.offer_id, count(*)::int
  from public.listing_matches m
  join public.listings o on o.id = m.offer_id and o.status = 'active'
  group by m.offer_id;
$$;

-- ── Chats ───────────────────────────────────────────────────────────────────
-- Uso interno: crea (o devuelve) el chat con `p_context_key`. No se expone al cliente.
create or replace function public._ensure_chat(
  p_kind text, p_key text, p_listing uuid, p_job uuid, p_origin text, p_creator uuid, p_other uuid, p_system_msg text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_chat uuid;
begin
  select id into v_chat from public.chats where context_key = p_key;
  if v_chat is not null then return v_chat; end if;

  insert into public.chats (kind, listing_id, job_id, origin, context_key, created_by)
  values (p_kind, p_listing, p_job, p_origin, p_key, p_creator)
  returning id into v_chat;
  insert into public.chat_members (chat_id, user_id) values (v_chat, p_creator), (v_chat, p_other);
  if p_system_msg is not null then
    insert into public.messages (chat_id, sender_id, kind, body) values (v_chat, null, 'system', p_system_msg);
  end if;
  return v_chat;
end $$;

-- Abre (idempotente) un chat de negociación sobre una oferta/demanda, un servicio o una conversación directa.
create or replace function public.open_chat(p_kind text, p_ref uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  l public.listings;
  j public.jobs;
  v_name text;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;

  if p_kind = 'listing' then
    select * into l from public.listings where id = p_ref and status = 'active';
    if not found then raise exception 'Anuncio no disponible' using errcode = 'P0002'; end if;
    if l.owner_id = me then raise exception 'No puedes chatear contigo mismo' using errcode = 'P0001'; end if;
    select display_name into v_name from public.profiles where id = l.owner_id;
    return public._ensure_chat('listing', 'listing:' || l.id || ':' || me, l.id, null, null, me, l.owner_id,
                               'Guardaste esta oferta y conectaste con ' || v_name || '.');

  elsif p_kind = 'gig' then
    select * into j from public.jobs where id = p_ref and kind = 'gig' and status = 'active';
    if not found then raise exception 'Servicio no disponible' using errcode = 'P0002'; end if;
    if j.owner_id = me then raise exception 'No puedes contratarte a ti mismo' using errcode = 'P0001'; end if;
    select display_name into v_name from public.profiles where id = j.owner_id;
    return public._ensure_chat('gig', 'gig:' || j.id || ':' || me, null, j.id, null, me, j.owner_id,
                               'Solicitaste una cotización a ' || v_name || '.');

  elsif p_kind = 'direct' then
    if p_ref = me then raise exception 'No puedes chatear contigo mismo' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.friendships f
                    where f.status = 'accepted'
                      and ((f.requester_id = me and f.addressee_id = p_ref) or (f.requester_id = p_ref and f.addressee_id = me))) then
      raise exception 'Solo puedes chatear con tus amigos' using errcode = '42501';
    end if;
    return public._ensure_chat('direct', 'direct:' || least(me, p_ref) || ':' || greatest(me, p_ref), null, null, null, me, p_ref,
                               'Ahora son amigos en la comunidad.');
  end if;

  raise exception 'Tipo de chat inválido' using errcode = '22023';
end $$;

-- Postularse a una vacante (o pedir cotización de un gig ya se hace con open_chat + application).
create or replace function public.apply_job(p_job uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  j public.jobs;
  v_chat uuid;
  v_key text;
  v_name text;
  v_me_name text;
  v_new boolean;
  v_rows int;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into j from public.jobs where id = p_job and status = 'active';
  if not found then raise exception 'Publicación no disponible' using errcode = 'P0002'; end if;
  if j.owner_id = me then raise exception 'No puedes postularte a tu propia publicación' using errcode = 'P0001'; end if;

  insert into public.job_applications (job_id, applicant_id) values (j.id, me)
  on conflict (job_id, applicant_id) do nothing;
  get diagnostics v_rows = row_count;
  v_new := v_rows > 0;

  select display_name into v_name from public.profiles where id = j.owner_id;
  select display_name into v_me_name from public.profiles where id = me;

  if j.kind = 'vacancy' then
    v_key := 'job:' || j.id || ':' || me;
    v_chat := public._ensure_chat('job', v_key, null, j.id, null, me, j.owner_id, 'Te postulaste a "' || j.title || '".');
    if v_new then
      insert into public.messages (chat_id, sender_id, kind, body)
      values (v_chat, me, 'text', 'Hola ' || split_part(v_name, ' ', 1) || ', me interesa la vacante "' || j.title || '". Adjunto mi perfil profesional de la app.');
      perform public.notify(j.owner_id, 'sistema', '📋 Nueva postulación', v_me_name || ' se postuló a "' || j.title || '".', '/mensajes/' || v_chat);
    end if;
  else
    v_chat := public.open_chat('gig', j.id);
  end if;
  return v_chat;
end $$;

-- Responder (aceptar/rechazar) una oferta o cotización recibida.
create or replace function public.respond_offer(p_message uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.messages;
  c public.chats;
  v_name text;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into m from public.messages where id = p_message for update;
  if not found or m.kind not in ('offer','quote') then raise exception 'Mensaje inválido' using errcode = '22023'; end if;
  if not public.is_chat_member(m.chat_id) then raise exception 'Sin acceso' using errcode = '42501'; end if;
  if m.sender_id = me then raise exception 'No puedes responder a tu propia oferta' using errcode = '42501'; end if;
  if m.status <> 'pending' then raise exception 'La oferta ya fue respondida' using errcode = 'P0001'; end if;

  update public.messages set status = case when p_accept then 'accepted' else 'rejected' end where id = m.id;
  select * into c from public.chats where id = m.chat_id;
  select display_name into v_name from public.profiles where id = me;

  if p_accept then
    insert into public.messages (chat_id, sender_id, kind, body)
    values (m.chat_id, null, 'system',
            case when m.kind = 'quote' then '✅ Cotización aceptada. El trabajo queda contratado (el pago se gestiona fuera de la app).'
                 else '🤝 Acuerdo alcanzado. Confirmen documentos y pago fuera de la app.' end);
    if m.kind = 'quote' and c.job_id is not null then
      update public.jobs set sales_count = sales_count + 1 where id = c.job_id;
      update public.job_applications set status = 'hired' where job_id = c.job_id and applicant_id = me;
    end if;
  end if;

  if m.sender_id is not null then
    perform public.notify(m.sender_id, 'oferta',
      case when p_accept then '🤝 ' || v_name || ' aceptó tu ' || case when m.kind = 'quote' then 'cotización' else 'oferta' end
           else v_name || ' rechazó tu ' || case when m.kind = 'quote' then 'cotización' else 'oferta' end end,
      '', '/mensajes/' || m.chat_id);
  end if;
end $$;

create or replace function public.mark_chat_read(p_chat uuid) returns void
language sql security definer set search_path = public as $$
  update public.chat_members set last_read_at = now() where chat_id = p_chat and user_id = auth.uid();
$$;

create or replace function public.touch_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.chats set last_message_at = new.created_at where id = new.chat_id;
  return null;
end $$;
create trigger messages_touch_chat after insert on public.messages for each row execute function public.touch_chat();

-- Lista de chats del usuario con último mensaje y no leídos (respeta RLS: security invoker).
create or replace function public.get_my_chats() returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.last_message_at desc), '[]'::jsonb)
  from (
    select c.id, c.kind, c.listing_id, c.job_id, c.origin, c.last_message_at,
      (select m2.user_id from public.chat_members m2 where m2.chat_id = c.id and m2.user_id <> auth.uid() limit 1) as other_id,
      (select count(*) from public.messages x
        where x.chat_id = c.id and x.sender_id is not null and x.sender_id <> auth.uid() and x.created_at > cm.last_read_at)::int as unread,
      (select to_jsonb(lm) from (
          select id, sender_id, kind, body, amount, currency, days, status, created_at
          from public.messages where chat_id = c.id order by created_at desc limit 1) lm) as last_message
    from public.chats c
    join public.chat_members cm on cm.chat_id = c.id and cm.user_id = auth.uid()
  ) t;
$$;

-- ── Amistad ─────────────────────────────────────────────────────────────────
create or replace function public.friendship_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then return new; end if;   -- p. ej. amistad creada por un match
    select display_name into v_name from public.profiles where id = new.requester_id;
    perform public.notify(new.addressee_id, 'solicitud', '🤝 ' || v_name || ' quiere ser tu amigo/a', '', '/mensajes');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    select display_name into v_name from public.profiles where id = new.addressee_id;
    perform public.notify(new.requester_id, 'solicitud', '✅ ' || v_name || ' aceptó tu solicitud', 'Ya pueden chatear.', '/mensajes');
    perform public._ensure_chat('direct', 'direct:' || least(new.requester_id, new.addressee_id) || ':' || greatest(new.requester_id, new.addressee_id),
                                null, null, null, new.requester_id, new.addressee_id, 'Ahora son amigos en la comunidad.');
    new.responded_at := now();
  elsif tg_op = 'UPDATE' and old.status = 'pending' then
    new.responded_at := now();
  end if;
  return new;
end $$;
create trigger friendships_notify_ins after insert on public.friendships for each row execute function public.friendship_notify();
create trigger friendships_notify_upd before update on public.friendships for each row execute function public.friendship_notify();

-- ── Citas: swipe con match mutuo ────────────────────────────────────────────
create or replace function public.swipe_person(p_target uuid, p_action text, p_relation text default 'pareja') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
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

  if p_action = 'super' then
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

create or replace function public.reset_swipes() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.listing_swipes where user_id = auth.uid() and action = 'pass';
  delete from public.person_swipes p
   where p.from_user = auth.uid()
     and not exists (select 1 from public.matches m where (m.user_a = p.from_user and m.user_b = p.to_user) or (m.user_b = p.from_user and m.user_a = p.to_user));
end $$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

-- ── KYC ─────────────────────────────────────────────────────────────────────
create or replace function public.submit_kyc(p_doc_path text, p_selfie_path text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_id uuid;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if p_doc_path not like me::text || '/%' or p_selfie_path not like me::text || '/%' then
    raise exception 'Las imágenes deben estar en tu carpeta' using errcode = '42501';
  end if;
  if (select identity_verified from public.profiles where id = me) then
    raise exception 'Tu identidad ya está verificada' using errcode = 'P0001';
  end if;
  insert into public.kyc_submissions (user_id, doc_path, selfie_path) values (me, p_doc_path, p_selfie_path) returning id into v_id;
  update public.profiles set kyc_status = 'pending' where id = me;
  return v_id;
end $$;

create or replace function public.review_kyc(p_submission uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.kyc_submissions;
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  select * into s from public.kyc_submissions where id = p_submission for update;
  if not found or s.status <> 'pending' then raise exception 'Solicitud no pendiente' using errcode = 'P0001'; end if;

  update public.kyc_submissions set status = case when p_approve then 'approved' else 'rejected' end,
         reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now() where id = s.id;
  update public.profiles set kyc_status = case when p_approve then 'verified' else 'rejected' end,
         identity_verified = p_approve where id = s.user_id;
  perform public.notify(s.user_id, 'kyc',
    case when p_approve then '🛡️ Identidad verificada' else 'No pudimos verificar tu identidad' end,
    case when p_approve then 'Ya tienes la insignia azul.' else coalesce(p_reason, 'Vuelve a intentarlo con fotos más nítidas.') end,
    '/verificacion');
end $$;

-- ── Reseñas → reputación ────────────────────────────────────────────────────
create or replace function public.recompute_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_target uuid := coalesce(new.target_id, old.target_id);
begin
  update public.profiles u set
    rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.target_id = v_target), 0),
    reviews_count = (select count(*) from public.reviews r where r.target_id = v_target)
  where u.id = v_target;
  return null;
end $$;
create trigger reviews_rating after insert or update or delete on public.reviews for each row execute function public.recompute_rating();

-- ── Recompensas (todas las mutaciones de monedas ocurren aquí, nunca en el cliente) ─
create or replace function public._spend(p_user uuid, p_amount int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.wallets set coins = coins - p_amount where user_id = p_user and coins >= p_amount;
  if not found then raise exception 'insufficient_coins' using errcode = 'P0001'; end if;
  insert into public.wallet_ledger (user_id, delta, reason) values (p_user, -p_amount, p_reason);
end $$;

create or replace function public._earn(p_user uuid, p_amount int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.wallets set coins = coins + p_amount where user_id = p_user;
  insert into public.wallet_ledger (user_id, delta, reason) values (p_user, p_amount, p_reason);
end $$;

create or replace function public.daily_checkin() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  w public.wallets;
  v_streak int;
  v_amount int;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into w from public.wallets where user_id = me for update;
  if w.last_checkin = current_date then raise exception 'already_claimed' using errcode = 'P0001'; end if;
  v_streak := case when w.last_checkin = current_date - 1 then least(w.streak + 1, 7) else 1 end;
  v_amount := 10 + 2 * (v_streak - 1);
  update public.wallets set streak = v_streak, last_checkin = current_date where user_id = me;
  perform public._earn(me, v_amount, 'daily_checkin');
  return jsonb_build_object('amount', v_amount, 'streak', v_streak);
end $$;

create or replace function public.spin_wheel() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  segs int[] := array[5, 10, 20, 50, 10, 100, 5, 25];   -- mismo orden que SEGMENTOS_RULETA
  w public.wallets;
  v_total numeric := 0;
  v_r numeric;
  v_idx int := 0;
  i int;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into w from public.wallets where user_id = me for update;
  if w.last_spin = current_date then raise exception 'already_spun' using errcode = 'P0001'; end if;
  -- Probabilidad inversa al valor: los premios grandes son raros.
  for i in 1 .. array_length(segs, 1) loop v_total := v_total + 1.0 / segs[i]; end loop;
  v_r := random() * v_total;
  for i in 1 .. array_length(segs, 1) loop
    v_r := v_r - 1.0 / segs[i];
    if v_r <= 0 then
      v_idx := i;
      exit;
    end if;
  end loop;
  if v_idx = 0 then v_idx := array_length(segs, 1); end if;
  update public.wallets set last_spin = current_date where user_id = me;
  perform public._earn(me, segs[v_idx], 'wheel');
  return jsonb_build_object('index', v_idx - 1, 'amount', segs[v_idx]);
end $$;

-- Costes: boost 100 · pack de 3 super likes 60 · tirada premium 50 (mantener en sync con src/lib/recompensas.ts)
create or replace function public.redeem_boost(p_listing uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_until timestamptz;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if not exists (select 1 from public.listings where id = p_listing and owner_id = me and kind = 'offer') then
    raise exception 'Solo puedes destacar tus propias ofertas' using errcode = '42501';
  end if;
  perform public._spend(me, 100, 'boost');
  update public.listings set boosted_until = greatest(now(), coalesce(boosted_until, now())) + interval '24 hours'
   where id = p_listing returning boosted_until into v_until;
  return v_until;
end $$;

create or replace function public.redeem_super_likes() returns int
language plpgsql security definer set search_path = public as $$
declare v_total int;
begin
  perform public._spend(auth.uid(), 60, 'super_likes');
  update public.wallets set super_likes = super_likes + 3 where user_id = auth.uid() returning super_likes into v_total;
  return v_total;
end $$;

create or replace function public.redeem_premium_reading() returns int
language plpgsql security definer set search_path = public as $$
declare v_total int;
begin
  perform public._spend(auth.uid(), 50, 'premium_reading');
  update public.wallets set premium_readings = premium_readings + 1 where user_id = auth.uid() returning premium_readings into v_total;
  return v_total;
end $$;

-- Tarot: 1 carta gratis cada 24 h, o 3 cartas consumiendo una tirada premium.
create or replace function public.draw_tarot(p_premium boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_cards int[];
  v_last timestamptz;
  v_ts timestamptz := now();
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if p_premium then
    update public.wallets set premium_readings = premium_readings - 1 where user_id = me and premium_readings > 0;
    if not found then raise exception 'no_premium_readings' using errcode = 'P0001'; end if;
    select array_agg(n) into v_cards from (select n from generate_series(0, 21) n order by random() limit 3) s;
  else
    select max(created_at) into v_last from public.tarot_draws where user_id = me and not premium;
    if v_last is not null and v_last > now() - interval '24 hours' then
      raise exception 'cooldown:%', extract(epoch from (v_last + interval '24 hours' - now()))::int using errcode = 'P0001';
    end if;
    v_cards := array[floor(random() * 22)::int];
  end if;
  insert into public.tarot_draws (user_id, cards, premium, created_at) values (me, v_cards, p_premium, v_ts);
  return jsonb_build_object('cards', to_jsonb(v_cards), 'premium', p_premium, 'created_at', v_ts);
end $$;

create or replace function public.claim_mission(p_mission text) returns int
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  u public.profiles;
  v_ok boolean;
  v_prize int;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into u from public.profiles where id = me;
  case p_mission
    when 'perfil'   then v_ok := cardinality(u.zones) > 0 and cardinality(u.interests) > 0 and u.display_name <> 'Nuevo usuario'; v_prize := 30;
    when 'kyc'      then v_ok := u.identity_verified; v_prize := 100;
    when 'publicar' then v_ok := exists (select 1 from public.listings where owner_id = me); v_prize := 50;
    when 'guardar'  then v_ok := exists (select 1 from public.listing_swipes where user_id = me and action = 'save'); v_prize := 15;
    when 'tarot'    then v_ok := exists (select 1 from public.tarot_draws where user_id = me); v_prize := 20;
    when 'amigo'    then v_ok := exists (select 1 from public.friendships where status = 'accepted' and me in (requester_id, addressee_id)); v_prize := 25;
    else raise exception 'Misión inexistente' using errcode = '22023';
  end case;
  if not v_ok then raise exception 'La misión aún no está cumplida' using errcode = 'P0001'; end if;
  insert into public.missions_claimed (user_id, mission_id) values (me, p_mission);   -- PK impide reclamarla dos veces
  perform public._earn(me, v_prize, 'mission:' || p_mission);
  return v_prize;
end $$;

-- ── Privilegios de ejecución ────────────────────────────────────────────────
-- Por defecto Supabase concede EXECUTE a anon/authenticated sobre las funciones nuevas: lo cerramos y abrimos solo lo necesario.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Helpers que usan las políticas RLS y consultas públicas de solo lectura.
grant execute on function public.is_admin(), public.is_chat_member(uuid), public.shares_chat_with(uuid),
                          public.astral_score(text, text, text), public.js_hash(text),
                          public.effective_price(public.listings) to anon, authenticated;
grant execute on function public.demand_counts_for_offers() to anon, authenticated;
-- Funciones puras que llaman find_offers_for_demand / find_demands_for_offer (se ejecutan con los permisos del llamante).
grant execute on function public.offer_fits_demand(public.listings, public.listings),
                          public.match_score(public.listings, public.listings) to authenticated;

-- RPC del cliente (requieren sesión).
grant execute on function
  public.open_chat(text, uuid), public.apply_job(uuid), public.respond_offer(uuid, boolean), public.mark_chat_read(uuid),
  public.get_my_chats(), public.swipe_person(uuid, text, text), public.reset_swipes(), public.mark_notifications_read(),
  public.submit_kyc(text, text), public.review_kyc(uuid, boolean, text),
  public.daily_checkin(), public.spin_wheel(), public.redeem_boost(uuid), public.redeem_super_likes(),
  public.redeem_premium_reading(), public.draw_tarot(boolean), public.claim_mission(text),
  public.find_offers_for_demand(uuid), public.find_demands_for_offer(uuid)
  to authenticated;


-- ============================================================================
-- Seguridad: privilegios mínimos + Row Level Security
--
-- Principios:
--  · Todo cerrado por defecto; solo se abre lo necesario.
--  · Los campos de confianza (verificaciones, reputación, monedas) NUNCA los escribe el cliente:
--    se protegen con privilegios por columna y solo cambian mediante funciones SECURITY DEFINER.
--  · Los chats solo son visibles para sus miembros; los datos privados, solo para su dueño.
-- ============================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

alter table public.profiles             enable row level security;
alter table public.user_private      enable row level security;
alter table public.app_admins        enable row level security;
alter table public.kyc_submissions   enable row level security;
alter table public.listings          enable row level security;
alter table public.listing_matches   enable row level security;
alter table public.listing_swipes    enable row level security;
alter table public.person_swipes     enable row level security;
alter table public.matches           enable row level security;
alter table public.friendships       enable row level security;
alter table public.jobs              enable row level security;
alter table public.job_applications  enable row level security;
alter table public.chats             enable row level security;
alter table public.chat_members      enable row level security;
alter table public.messages          enable row level security;
alter table public.notifications     enable row level security;
alter table public.posts             enable row level security;
alter table public.post_likes        enable row level security;
alter table public.post_comments     enable row level security;
alter table public.reviews           enable row level security;
alter table public.wallets           enable row level security;
alter table public.wallet_ledger     enable row level security;
alter table public.missions_claimed  enable row level security;
alter table public.tarot_draws       enable row level security;

-- ── users: perfil público; el propio usuario solo edita campos NO sensibles ──
grant select on public.profiles to anon, authenticated;
grant update (display_name, handle, bio, location, avatar_url, interests, zones, relations, lifestyle, budget, age, sign, professional)
  on public.profiles to authenticated;
create policy profiles_select on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ── user_private: solo el dueño ─────────────────────────────────────────────
grant select, update (birth_date, phone) on public.user_private to authenticated;
create policy user_private_select on public.user_private for select to authenticated using (user_id = auth.uid());
create policy user_private_update on public.user_private for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- app_admins: sin políticas ni privilegios (se consulta solo a través de is_admin()).

-- ── KYC: el usuario ve sus solicitudes; los administradores, todas ──────────
grant select on public.kyc_submissions to authenticated;
create policy kyc_select on public.kyc_submissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ── listings ────────────────────────────────────────────────────────────────
grant select on public.listings to anon, authenticated;
grant insert (owner_id, kind, category, operation, subtype, title, description, price, budget_max, currency, zone, area, min_area,
              attrs, images, flash_discount, flash_until)
  on public.listings to authenticated;
grant update (operation, subtype, title, description, price, budget_max, currency, zone, area, min_area, attrs, images,
              flash_discount, flash_until, status)
  on public.listings to authenticated;
grant delete on public.listings to authenticated;
create policy listings_select on public.listings for select using (status = 'active' or owner_id = auth.uid());
create policy listings_insert on public.listings for insert to authenticated with check (owner_id = auth.uid());
create policy listings_update on public.listings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy listings_delete on public.listings for delete to authenticated using (owner_id = auth.uid());

-- Coincidencias: solo las ven los dueños de alguno de los dos lados.
grant select on public.listing_matches to authenticated;
create policy listing_matches_select on public.listing_matches for select to authenticated
  using (exists (select 1 from public.listings l where l.id in (offer_id, demand_id) and l.owner_id = auth.uid()));

-- UPDATE completo (no solo `action`): PostgREST implementa upsert con ON CONFLICT DO UPDATE de todas las columnas del payload.
-- La política de abajo impide igualmente escribir filas de otros usuarios.
grant select, insert, update, delete on public.listing_swipes to authenticated;
create policy listing_swipes_all on public.listing_swipes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Personas: swipes y matches (las escrituras pasan por swipe_person) ──────
grant select on public.person_swipes to authenticated;
create policy person_swipes_select on public.person_swipes for select to authenticated using (from_user = auth.uid());

grant select on public.matches to authenticated;
create policy matches_select on public.matches for select to authenticated using (auth.uid() in (user_a, user_b));

grant select, insert (requester_id, addressee_id, status), update (status), delete on public.friendships to authenticated;
create policy friendships_select on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));
create policy friendships_insert on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy friendships_respond on public.friendships for update to authenticated
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status in ('accepted','rejected'));
create policy friendships_delete on public.friendships for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- ── jobs ────────────────────────────────────────────────────────────────────
grant select on public.jobs to anon, authenticated;
grant insert (owner_id, kind, title, description, category, price_from, currency, delivery_days, job_type, modality, location,
              budget_text, skills, image_url)
  on public.jobs to authenticated;
grant update (title, description, category, price_from, currency, delivery_days, job_type, modality, location, budget_text,
              skills, image_url, status)
  on public.jobs to authenticated;
grant delete on public.jobs to authenticated;
create policy jobs_select on public.jobs for select using (status = 'active' or owner_id = auth.uid());
create policy jobs_insert on public.jobs for insert to authenticated with check (owner_id = auth.uid());
create policy jobs_update on public.jobs for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy jobs_delete on public.jobs for delete to authenticated using (owner_id = auth.uid());

grant select, update (status) on public.job_applications to authenticated;
create policy applications_select on public.job_applications for select to authenticated
  using (applicant_id = auth.uid() or exists (select 1 from public.jobs j where j.id = job_id and j.owner_id = auth.uid()));
create policy applications_update on public.job_applications for update to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.owner_id = auth.uid()))
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.owner_id = auth.uid()));

-- ── Mensajería: solo miembros ───────────────────────────────────────────────
grant select on public.chats to authenticated;
create policy chats_select on public.chats for select to authenticated using (public.is_chat_member(id));

grant select, update (last_read_at) on public.chat_members to authenticated;
create policy chat_members_select on public.chat_members for select to authenticated using (public.is_chat_member(chat_id));
create policy chat_members_update on public.chat_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert (chat_id, sender_id, kind, body, amount, currency, days, status) on public.messages to authenticated;
create policy messages_select on public.messages for select to authenticated using (public.is_chat_member(chat_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_chat_member(messages.chat_id)
    and exists (
      select 1 from public.chats c
      where c.id = messages.chat_id
        and (
             (messages.kind = 'text'  and messages.status is null)
          or (messages.kind = 'offer' and messages.status = 'pending' and c.kind = 'listing')                           -- ofertas: chats de anuncios
          or (messages.kind = 'quote' and messages.status = 'pending' and c.kind = 'gig' and c.created_by <> auth.uid()) -- cotizaciones: solo el freelancer
        )
    )
  );
-- No hay UPDATE/DELETE de mensajes para clientes: el estado de una oferta cambia solo vía respond_offer().

-- ── Notificaciones ──────────────────────────────────────────────────────────
grant select, update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Comunidad ───────────────────────────────────────────────────────────────
grant select on public.posts, public.post_likes, public.post_comments to anon, authenticated;
grant insert (author_id, kind, body, zone, image_url), delete on public.posts to authenticated;
grant insert (post_id, user_id), delete on public.post_likes to authenticated;
grant insert (post_id, author_id, body), delete on public.post_comments to authenticated;
create policy posts_select on public.posts for select using (true);
create policy posts_insert on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid());
create policy post_likes_select on public.post_likes for select using (true);
create policy post_likes_insert on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy post_likes_delete on public.post_likes for delete to authenticated using (user_id = auth.uid());
create policy post_comments_select on public.post_comments for select using (true);
create policy post_comments_insert on public.post_comments for insert to authenticated with check (author_id = auth.uid());
create policy post_comments_delete on public.post_comments for delete to authenticated using (author_id = auth.uid());

-- ── Reseñas: solo entre personas que han conversado ─────────────────────────
grant select on public.reviews to anon, authenticated;
grant insert (author_id, target_id, rating, comment), update (rating, comment), delete on public.reviews to authenticated;
create policy reviews_select on public.reviews for select using (true);
create policy reviews_insert on public.reviews for insert to authenticated
  with check (author_id = auth.uid() and public.shares_chat_with(target_id));
create policy reviews_update on public.reviews for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy reviews_delete on public.reviews for delete to authenticated using (author_id = auth.uid());

-- ── Recompensas: solo lectura propia (las mutaciones son RPC) ───────────────
grant select on public.wallets, public.wallet_ledger, public.missions_claimed, public.tarot_draws to authenticated;
create policy wallets_select on public.wallets for select to authenticated using (user_id = auth.uid());
create policy ledger_select on public.wallet_ledger for select to authenticated using (user_id = auth.uid());
create policy missions_select on public.missions_claimed for select to authenticated using (user_id = auth.uid());
create policy tarot_select on public.tarot_draws for select to authenticated using (user_id = auth.uid());


-- ============================================================================
-- Storage (buckets protegidos) y Realtime
-- ============================================================================

-- `media`: imágenes públicas (avatares, anuncios, publicaciones, portafolios). Ruta obligatoria: <user_id>/<archivo>
-- `kyc`:   documentos de identidad y selfies. PRIVADO: solo el dueño y los administradores.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true,  5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('kyc',   'kyc',   false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- media: lectura pública, escritura solo en la carpeta propia.
create policy media_read on storage.objects for select using (bucket_id = 'media');
create policy media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_update_own on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- kyc: el usuario sube y ve lo suyo (no puede modificarlo ni borrarlo); los administradores ven y borran todo.
create policy kyc_read on storage.objects for select to authenticated
  using (bucket_id = 'kyc' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy kyc_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);
create policy kyc_delete_admin on storage.objects for delete to authenticated
  using (bucket_id = 'kyc' and public.is_admin());

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'messages', 'notifications', 'chat_members', 'chats', 'wallets', 'profiles', 'listings', 'listing_matches',
    'jobs', 'posts', 'post_likes', 'post_comments', 'friendships', 'matches'
  ] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ACTUALIZACION-002-INICIO (contenido idéntico a supabase/update_002_fotos_onboarding.sql)
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
-- ACTUALIZACION-002-FIN

-- ACTUALIZACION-003-INICIO
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

-- ACTUALIZACION-003-FIN

-- ACTUALIZACION-004-INICIO
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

-- ACTUALIZACION-004-FIN

-- ACTUALIZACION-005-INICIO
-- ============================================================================
-- ACTUALIZACIÓN 005 · Comunidad viva: reacciones, miembros recientes, Top Conectores y avisos sociales
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización (con la 004): ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
--
-- Qué añade:
--   · post_likes.reaction        → reacciones rápidas (👍 ❤️ 😂 😮 👏). Los «me gusta» anteriores quedan como 'like'.
--   · recent_members()           → últimas personas reales que se unieron (solo nombre de pila, ciudad y foto). Sin perfiles demo.
--   · top_connectors() y my_connector_status() → ranking de actividad de los últimos 30 días («Top Conector»). Sin perfiles demo.
--   · Avisos en tiempo real: comentar o reaccionar a una publicación avisa a su autor (por la tabla notifications).
--
-- Todas las cifras salen de actividad real. Nada se inventa ni se simula en el servidor.
-- ============================================================================

-- ── 1. Reacciones rápidas ───────────────────────────────────────────────────
alter table public.post_likes
  add column if not exists reaction text not null default 'like'
    check (reaction in ('like', 'love', 'haha', 'wow', 'clap'));

grant insert (reaction), update (reaction) on public.post_likes to authenticated;

drop policy if exists post_likes_update on public.post_likes;
create policy post_likes_update on public.post_likes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 2. Miembros recientes (prueba social real) ──────────────────────────────
-- Solo personas reales con el perfil completo. Se expone lo mínimo: nombre de pila, foto y ciudad.
create or replace function public.recent_members(p_limit int default 12)
returns table (member_id uuid, first_name text, avatar_url text, city text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, split_part(btrim(p.display_name), ' ', 1), p.avatar_url,
         nullif(btrim(split_part(p.location, ' · ', 1)), ''), p.created_at
    from public.profiles p
   where p.onboarding_completed and not p.is_demo
   order by p.created_at desc, p.id
   limit greatest(1, least(coalesce(p_limit, 12), 30));
$$;

-- ── 3. Actividad y «Top Conector» ───────────────────────────────────────────
-- Puntos de los últimos 30 días, con tope por categoría para que nadie domine solo repitiendo una acción:
--   publicar +3 (máx. 30) · reacciones recibidas +1 (máx. 50) · comentarios recibidos +2 (máx. 40) ·
--   comentar en publicaciones ajenas +1 (máx. 20) · invitados confirmados +10 (máx. 100) · matches +2 (máx. 20).
-- Las acciones sobre tu propia publicación no cuentan. Los perfiles demo no participan.
create or replace function public._connector_scores() returns table (user_id uuid, score int)
language sql stable security definer set search_path = public as $$
  with act as (
    select author_id as u, least(30, 3 * count(*))::int as pts
      from public.posts where created_at > now() - interval '30 days' group by author_id
    union all
    select p.author_id, least(50, count(*))::int
      from public.post_likes l join public.posts p on p.id = l.post_id
     where l.created_at > now() - interval '30 days' and l.user_id <> p.author_id group by p.author_id
    union all
    select p.author_id, least(40, 2 * count(*))::int
      from public.post_comments c join public.posts p on p.id = c.post_id
     where c.created_at > now() - interval '30 days' and c.author_id <> p.author_id group by p.author_id
    union all
    select c.author_id, least(20, count(*))::int
      from public.post_comments c join public.posts p on p.id = c.post_id
     where c.created_at > now() - interval '30 days' and c.author_id <> p.author_id group by c.author_id
    union all
    select referrer_id, least(100, 10 * count(*))::int
      from public.referrals where rewarded_at > now() - interval '30 days' group by referrer_id
    union all
    select m.u, least(20, 2 * count(*))::int
      from (select user_a as u from public.matches where created_at > now() - interval '30 days'
            union all
            select user_b from public.matches where created_at > now() - interval '30 days') m
     group by m.u
  )
  select a.u, sum(a.pts)::int
    from act a join public.profiles pr on pr.id = a.u
   where not pr.is_demo and pr.onboarding_completed
   group by a.u
  having sum(a.pts) > 0;
$$;

-- Ranking público de los perfiles más activos. Para figurar hacen falta al menos 10 puntos (no basta una acción suelta).
create or replace function public.top_connectors(p_limit int default 10)
returns table (person_id uuid, display_name text, avatar_url text, city text, score int, rank int)
language sql stable security definer set search_path = public as $$
  select s.user_id, p.display_name, p.avatar_url, nullif(btrim(split_part(p.location, ' · ', 1)), ''), s.score,
         (rank() over (order by s.score desc))::int
    from public._connector_scores() s join public.profiles p on p.id = s.user_id
   where s.score >= 10
   order by s.score desc, p.created_at, p.id
   limit greatest(1, least(coalesce(p_limit, 10), 25));
$$;

-- Tu posición: puntos, puesto y lo que te falta para entrar en el Top 10. `rank` es null si aún no sumas puntos.
create or replace function public.my_connector_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_score int;
  v_rank int;
  v_tenth int;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select coalesce(max(score), 0) into v_score from public._connector_scores() where user_id = me;
  select count(*)::int + 1 into v_rank from public._connector_scores() where score > v_score;
  -- Con menos de 10 personas en el ranking cualquiera con 10 puntos entra; solo si está lleno hay que superar al décimo.
  select case when count(*) >= 10 then min(score) else 0 end into v_tenth
    from (select score from public._connector_scores() where score >= 10 order by score desc limit 10) t;
  return jsonb_build_object(
    'score', v_score,
    'rank', case when v_score > 0 then v_rank end,
    'is_top', v_score >= 10 and v_rank <= 10,
    'threshold', greatest(10, v_tenth)   -- puntos que hay que alcanzar para figurar en el Top 10
  );
end $$;

-- ── 4. Avisos sociales en tiempo real ───────────────────────────────────────
-- El autor recibe un aviso cuando alguien comenta o reacciona a su publicación (la tabla notifications ya emite en tiempo real).
-- Un aviso por persona y publicación para reacciones: cambiar de reacción no duplica el aviso.
create or replace function public._notify_post_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_autor uuid;
  v_nombre text;
begin
  select author_id into v_autor from public.posts where id = new.post_id;
  if v_autor is null or v_autor = new.author_id then return new; end if;
  select split_part(btrim(display_name), ' ', 1) into v_nombre from public.profiles where id = new.author_id;
  perform public.notify(v_autor, 'sistema', '💬 ' || coalesce(v_nombre, 'Alguien') || ' comentó tu publicación',
    left(new.body, 80), '/comunidad', jsonb_build_object('post', new.post_id, 'actor', new.author_id, 'kind', 'comment'));
  return new;
end $$;

create or replace function public._notify_post_reaction() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_autor uuid;
  v_nombre text;
begin
  select author_id into v_autor from public.posts where id = new.post_id;
  if v_autor is null or v_autor = new.user_id then return new; end if;
  if exists (select 1 from public.notifications n
              where n.user_id = v_autor and n.data ->> 'kind' = 'reaction'
                and n.data ->> 'post' = new.post_id::text and n.data ->> 'actor' = new.user_id::text) then
    return new;
  end if;
  select split_part(btrim(display_name), ' ', 1) into v_nombre from public.profiles where id = new.user_id;
  perform public.notify(v_autor, 'sistema',
    case new.reaction when 'love' then '❤️ ' when 'haha' then '😂 ' when 'wow' then '😮 ' when 'clap' then '👏 ' else '👍 ' end
      || coalesce(v_nombre, 'Alguien') || ' reaccionó a tu publicación',
    '', '/comunidad', jsonb_build_object('post', new.post_id, 'actor', new.user_id, 'kind', 'reaction'));
  return new;
end $$;

drop trigger if exists trg_notify_post_comment on public.post_comments;
create trigger trg_notify_post_comment after insert on public.post_comments
  for each row execute function public._notify_post_comment();

drop trigger if exists trg_notify_post_reaction on public.post_likes;
create trigger trg_notify_post_reaction after insert on public.post_likes
  for each row execute function public._notify_post_reaction();

-- ── 5. Privilegios de ejecución ─────────────────────────────────────────────
grant execute on function public.recent_members(int), public.top_connectors(int) to anon, authenticated;
grant execute on function public.my_connector_status() to authenticated;
revoke execute on function
  public._connector_scores(), public._notify_post_comment(), public._notify_post_reaction()
  from public, anon, authenticated;

-- ACTUALIZACION-005-FIN

-- ACTUALIZACION-006-INICIO
-- ============================================================================
-- ACTUALIZACIÓN 006 · Directorios colaborativos: Movilidad, Delivery, Salud, Eventos, Mascotas y Hogar
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización (con la 005): ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
--
-- Diseño (ver docs/arquitectura-directorios.md):
--   Un NÚCLEO COMÚN parametrizado por «vertical» en vez de seis sistemas paralelos:
--     providers            perfil comercial o profesional (taxista, restaurante, farmacia, organizador, veterinaria, plomero…)
--     provider_contacts    teléfono/WhatsApp/dirección: solo visibles con sesión (anti-scraping y embudo de registro)
--     provider_items       menú, productos, servicios y tarifas
--     provider_duty_shifts turnos (farmacias de turno, guardias 24 h)
--     orders / order_lines pedidos (delivery, farmacias, tiendas de mascotas): los precios los fija el SERVIDOR
--     service_requests / service_offers  «Busco» de servicios: viaje, encomienda, reparación… con ofertas de profesionales
--     events / event_ticket_types / event_reservations  cartelera y reserva de entradas con aforo atómico
--     provider_reviews     reseñas (solo con interacción real; «compra verificada» si hubo transacción)
--     content_reports      denuncias con ocultación automática y moderación
--   Autoservicio: cualquier persona con sesión publica sin aprobación previa; la confianza se gana con verificación (KYC),
--   reseñas reales y denuncias de la comunidad, no con un cuello de botella de moderación.
--
-- Seguridad: precios, totales, aforo, estados, valoración y verificación los calcula SIEMPRE el servidor (funciones
-- SECURITY DEFINER); el cliente solo tiene privilegios por columna sobre lo que de verdad le pertenece.
-- ============================================================================

-- ── 1. Catálogo de secciones y categorías ───────────────────────────────────
-- Mantener en sync con src/data/directorio.ts (hay un test de paridad).
create or replace function public._directory_catalog() returns table (vertical text, subtype text)
language sql immutable as $$
  select * from (values
    ('movilidad', 'taxi'), ('movilidad', 'viaje_particular'), ('movilidad', 'encomienda'), ('movilidad', 'moto_mensajero'),
    ('delivery', 'restaurante'), ('delivery', 'cafeteria'), ('delivery', 'panaderia'), ('delivery', 'mercado'), ('delivery', 'comida_rapida'),
    ('salud', 'farmacia'), ('salud', 'clinica'), ('salud', 'consultorio'), ('salud', 'laboratorio'), ('salud', 'odontologia'),
    ('eventos', 'organizador'), ('eventos', 'teatro'), ('eventos', 'sala_de_conciertos'), ('eventos', 'centro_cultural'),
    ('mascotas', 'veterinaria'), ('mascotas', 'paseador'), ('mascotas', 'tienda_de_mascotas'), ('mascotas', 'peluqueria_canina'), ('mascotas', 'guarderia'),
    ('hogar', 'plomero'), ('hogar', 'electricista'), ('hogar', 'cerrajero'), ('hogar', 'limpieza'), ('hogar', 'carpintero'), ('hogar', 'pintor'), ('hogar', 'tecnico_electrodomesticos')
  ) as c (vertical, subtype);
$$;

create or replace function public._slugify(t text) returns text
language sql immutable as $$
  select coalesce(nullif(btrim(regexp_replace(public._norm(t), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'perfil');
$$;

-- Horario semanal: {"lun": [["08:00","13:00"],["15:00","19:00"]], …}. Tramos dentro de un mismo día (para cruzar la medianoche, parte en dos días).
create or replace function public._valid_hours(h jsonb) returns boolean
language plpgsql immutable as $$
declare
  k text;
  s jsonb;
  i int;
  ini text;
  fin text;
begin
  if h is null or jsonb_typeof(h) <> 'object' then return false; end if;
  for k, s in select * from jsonb_each(h) loop
    if k not in ('lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom') or jsonb_typeof(s) <> 'array' or jsonb_array_length(s) > 4 then return false; end if;
    for i in 0 .. jsonb_array_length(s) - 1 loop
      if jsonb_typeof(s -> i) <> 'array' or jsonb_array_length(s -> i) <> 2 then return false; end if;
      ini := (s -> i) ->> 0;
      fin := (s -> i) ->> 1;
      if ini !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or fin !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' or ini >= fin then return false; end if;
    end loop;
  end loop;
  return true;
end $$;

-- ¿Está abierto en ese instante? La hora se interpreta en Ecuador continental (America/Guayaquil, UTC-5, sin horario de verano).
create or replace function public._is_open(h jsonb, p_24h boolean, p_at timestamptz default now()) returns boolean
language plpgsql stable as $$
declare
  v_local timestamp;
  v_dia text;
  v_hora text;
  s jsonb;
  i int;
begin
  if p_24h then return true; end if;
  v_local := p_at at time zone 'America/Guayaquil';
  v_dia := (array['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'])[extract(isodow from v_local)::int];
  v_hora := to_char(v_local, 'HH24:MI');
  s := coalesce(h -> v_dia, '[]'::jsonb);
  for i in 0 .. jsonb_array_length(s) - 1 loop
    if v_hora >= (s -> i) ->> 0 and v_hora < (s -> i) ->> 1 then return true; end if;
  end loop;
  return false;
end $$;

-- Distancia en km (haversine). NULL si falta alguna coordenada.
create or replace function public._km(a_lat numeric, a_lng numeric, b_lat numeric, b_lng numeric) returns numeric
language sql immutable as $$
  select case when a_lat is null or a_lng is null or b_lat is null or b_lng is null then null
    else round((6371 * 2 * asin(sqrt(
      power(sin(radians((b_lat - a_lat)::float8) / 2), 2) +
      cos(radians(a_lat::float8)) * cos(radians(b_lat::float8)) * power(sin(radians((b_lng - a_lng)::float8) / 2), 2)
    )))::numeric, 2) end;
$$;

-- ── 2. Perfiles comerciales y profesionales ─────────────────────────────────
create table if not exists public.providers (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  vertical       text not null check (vertical in ('movilidad', 'delivery', 'salud', 'eventos', 'mascotas', 'hogar')),
  subtype        text not null,
  name           text not null check (char_length(btrim(name)) between 3 and 80),
  slug           text not null unique,                                  -- /directorio/<vertical>/<slug> (lo genera el servidor)
  description    text not null default '' check (char_length(description) <= 1000),
  city           text not null default 'Cuenca' check (char_length(city) between 2 and 60),
  zone           text not null default '' check (char_length(zone) <= 80),
  lat            numeric(9,6) check (lat between -90 and 90),
  lng            numeric(9,6) check (lng between -180 and 180),
  logo_url       text,
  cover_url      text,
  images         text[] not null default '{}' check (cardinality(images) <= 8),
  -- Cómo atiende: local · entrega (a domicilio) · retiro (en el local) · visita (va donde el cliente) · en_linea
  channels       text[] not null default '{local}' check (cardinality(channels) >= 1 and channels <@ array['local', 'entrega', 'retiro', 'visita', 'en_linea']),
  open_24h       boolean not null default false,
  hours          jsonb not null default '{}' check (jsonb_typeof(hours) = 'object'),
  delivery_fee   numeric(8,2) not null default 0 check (delivery_fee >= 0),
  min_order      numeric(8,2) not null default 0 check (min_order >= 0),
  delivery_zones text[] not null default '{}' check (cardinality(delivery_zones) <= 12),
  attrs          jsonb not null default '{}' check (jsonb_typeof(attrs) = 'object'),   -- vehículo, especies, especialidades…
  listing_id     uuid references public.listings (id) on delete set null,              -- vínculo opcional con su anuncio de «Negocios»
  job_id         uuid references public.jobs (id) on delete set null,                  -- vínculo opcional con su servicio en «Empleos»
  -- Solo los modifican funciones del servidor:
  status         text not null default 'active' check (status in ('active', 'paused', 'review', 'suspended')),
  verified_at    timestamptz,
  rating         numeric(2,1) not null default 0 check (rating between 0 and 5),
  reviews_count  int not null default 0 check (reviews_count >= 0),
  orders_count   int not null default 0 check (orders_count >= 0),
  boosted_until  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
drop trigger if exists providers_updated_at on public.providers;
create trigger providers_updated_at before update on public.providers for each row execute function public.set_updated_at();
create index if not exists providers_search_idx on public.providers (vertical, subtype, zone) where status = 'active';
create index if not exists providers_owner_idx on public.providers (owner_id);
create index if not exists providers_name_trgm_idx on public.providers using gin (name extensions.gin_trgm_ops);
create index if not exists providers_created_idx on public.providers (created_at desc);

create or replace function public._providers_prepare() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public._directory_catalog() c where c.vertical = new.vertical and c.subtype = new.subtype) then
      raise exception 'Esa categoría no existe en esta sección' using errcode = '22023';
    end if;
    if (select count(*) from public.providers where owner_id = new.owner_id) >= 5 then
      raise exception 'Has alcanzado el máximo de 5 perfiles' using errcode = 'P0001';
    end if;
    new.name := btrim(new.name);
    new.slug := left(public._slugify(new.name), 50) || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  if not public._valid_hours(new.hours) then
    raise exception 'El horario no es válido (usa tramos HH:MM dentro de un mismo día)' using errcode = '22023';
  end if;
  if new.listing_id is not null and not exists (select 1 from public.listings where id = new.listing_id and owner_id = new.owner_id) then
    raise exception 'Solo puedes vincular tus propios anuncios' using errcode = '42501';
  end if;
  if new.job_id is not null and not exists (select 1 from public.jobs where id = new.job_id and owner_id = new.owner_id) then
    raise exception 'Solo puedes vincular tus propios servicios' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists providers_prepare on public.providers;
create trigger providers_prepare before insert or update on public.providers for each row execute function public._providers_prepare();

-- Incentivo de autoservicio: la primera vez que publicas un perfil ganas monedas (una sola vez por persona).
create or replace function public._providers_reward() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.wallet_ledger where user_id = new.owner_id and reason = 'directory_first_provider') then
    perform public._earn(new.owner_id, 30, 'directory_first_provider');
  end if;
  return new;
end $$;
drop trigger if exists providers_reward on public.providers;
create trigger providers_reward after insert on public.providers for each row execute function public._providers_reward();

-- Contacto: solo con sesión (evita que se rastreen teléfonos y empuja al registro). El chat de la app es el canal por defecto.
create table if not exists public.provider_contacts (
  provider_id uuid primary key references public.providers (id) on delete cascade,
  phone       text check (phone is null or phone ~ '^\+?[0-9][0-9 ()-]{6,19}$'),
  whatsapp    text check (whatsapp is null or whatsapp ~ '^\+?[0-9][0-9 ()-]{6,19}$'),
  address     text check (char_length(address) <= 160),
  updated_at  timestamptz not null default now()
);
drop trigger if exists provider_contacts_updated_at on public.provider_contacts;
create trigger provider_contacts_updated_at before update on public.provider_contacts for each row execute function public.set_updated_at();

-- Menú, productos, servicios y tarifas
create table if not exists public.provider_items (
  id                    uuid primary key default gen_random_uuid(),
  provider_id           uuid not null references public.providers (id) on delete cascade,
  kind                  text not null check (kind in ('menu_item', 'product', 'service', 'rate')),
  section               text not null default '' check (char_length(section) <= 60),          -- «Platos fuertes», «Analgésicos»…
  name                  text not null check (char_length(btrim(name)) between 2 and 100),
  description           text not null default '' check (char_length(description) <= 400),
  price                 numeric(10,2) check (price >= 0),                                      -- NULL = a convenir
  price_to              numeric(10,2) check (price_to >= 0),                                   -- rango «desde – hasta»
  unit                  text not null default 'unidad' check (unit in ('unidad', 'hora', 'km', 'servicio', 'persona')),
  image_url             text,
  available             boolean not null default true,
  requires_prescription boolean not null default false,                                        -- medicamento con receta: nunca se vende por la app
  sort_order            int not null default 0,
  attrs                 jsonb not null default '{}' check (jsonb_typeof(attrs) = 'object'),
  created_at            timestamptz not null default now(),
  check (price_to is null or (price is not null and price_to >= price))
);
create index if not exists provider_items_provider_idx on public.provider_items (provider_id, sort_order);

create or replace function public._items_prepare() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_vertical text;
begin
  select vertical into v_vertical from public.providers where id = new.provider_id;
  if v_vertical is null then raise exception 'Perfil inexistente' using errcode = 'P0002'; end if;
  if new.kind = 'menu_item' and v_vertical <> 'delivery' then raise exception 'Los platos del menú son solo para Delivery' using errcode = '22023'; end if;
  if new.kind = 'product' and v_vertical not in ('delivery', 'salud', 'mascotas') then raise exception 'Este perfil no vende productos' using errcode = '22023'; end if;
  if new.kind = 'rate' and v_vertical <> 'movilidad' then raise exception 'Las tarifas son solo para Movilidad' using errcode = '22023'; end if;
  if new.requires_prescription and v_vertical <> 'salud' then raise exception 'La receta médica solo aplica a Salud' using errcode = '22023'; end if;
  if tg_op = 'INSERT' and (select count(*) from public.provider_items where provider_id = new.provider_id) >= 200 then
    raise exception 'Un perfil admite como máximo 200 elementos' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists provider_items_prepare on public.provider_items;
create trigger provider_items_prepare before insert or update on public.provider_items for each row execute function public._items_prepare();

-- Turnos: farmacias de turno, guardias 24 h de plomeros/cerrajeros… (solo Salud y Hogar)
create table if not exists public.provider_duty_shifts (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  note        text not null default '' check (char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '48 hours')
);
create index if not exists duty_shifts_idx on public.provider_duty_shifts (provider_id, ends_at desc);

create or replace function public._duty_prepare() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.providers where id = new.provider_id and vertical in ('salud', 'hogar')) then
    raise exception 'Los turnos solo aplican a Salud y Hogar' using errcode = '22023';
  end if;
  if (select count(*) from public.provider_duty_shifts where provider_id = new.provider_id and ends_at > now()) >= 60 then
    raise exception 'Demasiados turnos futuros' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists duty_shifts_prepare on public.provider_duty_shifts;
create trigger duty_shifts_prepare before insert on public.provider_duty_shifts for each row execute function public._duty_prepare();

-- ── 3. Pedidos (delivery, farmacias, tiendas de mascotas) ───────────────────
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  provider_id       uuid references public.providers (id) on delete set null,
  provider_owner_id uuid not null references public.profiles (id) on delete cascade,
  provider_name     text not null,
  customer_id       uuid not null references public.profiles (id) on delete cascade,
  kind              text not null check (kind in ('delivery', 'pickup')),
  status            text not null default 'placed' check (status in ('placed', 'accepted', 'preparing', 'on_the_way', 'delivered', 'rejected', 'cancelled')),
  subtotal          numeric(10,2) not null check (subtotal >= 0),
  delivery_fee      numeric(8,2) not null default 0 check (delivery_fee >= 0),
  total             numeric(10,2) not null check (total >= 0),
  payment_method    text not null check (payment_method in ('cash', 'transfer')),          -- sin pasarela de pago en esta fase
  address           text not null default '' check (char_length(address) <= 200),
  zone              text not null default '' check (char_length(zone) <= 80),
  notes             text not null default '' check (char_length(notes) <= 300),
  chat_id           uuid references public.chats (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (provider_owner_id <> customer_id)
);
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);
create index if not exists orders_owner_idx on public.orders (provider_owner_id, status, created_at desc);
create index if not exists orders_provider_idx on public.orders (provider_id);

create table if not exists public.order_lines (
  order_id   uuid not null references public.orders (id) on delete cascade,
  line_no    int not null,
  item_id    uuid references public.provider_items (id) on delete set null,
  name       text not null,                                    -- copia del nombre y del precio en el momento del pedido
  unit_price numeric(10,2) not null check (unit_price >= 0),
  qty        int not null check (qty between 1 and 20),
  primary key (order_id, line_no)
);

-- El cliente NUNCA envía precios: solo qué producto y cuántas unidades; el servidor calcula todo.
create or replace function public.place_order(
  p_provider uuid, p_kind text, p_lines jsonb, p_address text default '', p_zone text default '', p_notes text default '', p_payment text default 'cash'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  pr public.providers;
  it public.provider_items;
  ln jsonb;
  v_id uuid := gen_random_uuid();
  v_lines jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}';
  v_item uuid;
  v_qty int;
  v_sub numeric(10,2) := 0;
  v_fee numeric(8,2) := 0;
  v_chat uuid;
  v_cliente text;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into pr from public.providers where id = p_provider and status = 'active';
  if not found then raise exception 'Este perfil no está disponible' using errcode = 'P0002'; end if;
  if pr.owner_id = me then raise exception 'No puedes hacerte un pedido a ti mismo' using errcode = 'P0001'; end if;
  if pr.vertical not in ('delivery', 'salud', 'mascotas') then raise exception 'Este perfil no recibe pedidos' using errcode = '22023'; end if;
  if p_kind not in ('delivery', 'pickup') then raise exception 'Tipo de pedido no válido' using errcode = '22023'; end if;
  if p_payment not in ('cash', 'transfer') then raise exception 'Forma de pago no válida' using errcode = '22023'; end if;
  if p_kind = 'delivery' and not ('entrega' = any (pr.channels)) then raise exception 'Este perfil no entrega a domicilio' using errcode = 'P0001'; end if;
  if p_kind = 'delivery' and char_length(btrim(coalesce(p_address, ''))) < 5 then raise exception 'Indica la dirección de entrega' using errcode = '22023'; end if;
  if p_kind = 'pickup' and not (pr.channels && array['retiro', 'local']) then raise exception 'Este perfil no ofrece retiro en el local' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 30 then
    raise exception 'El pedido debe tener entre 1 y 30 productos' using errcode = '22023';
  end if;
  if (select count(*) from public.orders where customer_id = me and status = 'placed') >= 5 then
    raise exception 'Tienes demasiados pedidos sin responder' using errcode = 'P0001';
  end if;

  for ln in select * from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(ln) <> 'object' or coalesce(ln ->> 'item_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(ln ->> 'qty', '') !~ '^[0-9]{1,2}$' then
      raise exception 'Línea de pedido no válida' using errcode = '22023';
    end if;
    v_item := (ln ->> 'item_id')::uuid;
    v_qty := (ln ->> 'qty')::int;
    if v_qty not between 1 and 20 then raise exception 'La cantidad debe estar entre 1 y 20' using errcode = '22023'; end if;
    if v_item = any (v_seen) then raise exception 'Un producto aparece repetido en el pedido' using errcode = '22023'; end if;
    v_seen := v_seen || v_item;
    select * into it from public.provider_items where id = v_item and provider_id = pr.id and available;
    if not found then raise exception 'Un producto ya no está disponible' using errcode = 'P0002'; end if;
    if it.requires_prescription then
      raise exception '«%» requiere receta médica y no se vende por la app', it.name using errcode = 'P0001';
    end if;
    if it.price is null then raise exception '«%» no tiene precio fijo: consúltalo por el chat', it.name using errcode = 'P0001'; end if;
    v_sub := v_sub + it.price * v_qty;
    v_lines := v_lines || jsonb_build_object('item', it.id, 'name', it.name, 'price', it.price, 'qty', v_qty);
  end loop;

  if v_sub < pr.min_order then
    raise exception 'El pedido mínimo es de % USD', trim_scale(pr.min_order) using errcode = 'P0001';
  end if;
  if p_kind = 'delivery' then v_fee := pr.delivery_fee; end if;

  insert into public.orders (id, provider_id, provider_owner_id, provider_name, customer_id, kind, subtotal, delivery_fee, total,
                             payment_method, address, zone, notes)
  values (v_id, pr.id, pr.owner_id, pr.name, me, p_kind, v_sub, v_fee, v_sub + v_fee, p_payment,
          left(btrim(coalesce(p_address, '')), 200), left(btrim(coalesce(p_zone, '')), 80), left(btrim(coalesce(p_notes, '')), 300));
  insert into public.order_lines (order_id, line_no, item_id, name, unit_price, qty)
  select v_id, t.n, (t.l ->> 'item')::uuid, t.l ->> 'name', (t.l ->> 'price')::numeric, (t.l ->> 'qty')::int
    from jsonb_array_elements(v_lines) with ordinality as t (l, n);

  select split_part(btrim(display_name), ' ', 1) into v_cliente from public.profiles where id = me;
  v_chat := public._ensure_chat('direct', 'order:' || v_id, null, null, null, me, pr.owner_id,
    'Pedido a ' || pr.name || ' por ' || trim_scale(v_sub + v_fee) || ' USD. Coordinen aquí la entrega y el pago.');
  update public.orders set chat_id = v_chat where id = v_id;
  perform public.notify(pr.owner_id, 'sistema', '🛍️ Nuevo pedido de ' || coalesce(v_cliente, 'un cliente'),
    jsonb_array_length(v_lines) || ' producto(s) · ' || trim_scale(v_sub + v_fee) || ' USD', '/mensajes/' || v_chat,
    jsonb_build_object('order', v_id, 'kind', 'order'));
  return v_id;
end $$;

-- Máquina de estados: el negocio avanza el pedido; la persona solo puede cancelarlo mientras nadie lo ha aceptado.
create or replace function public.set_order_status(p_order uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  o public.orders;
  v_ok boolean;
  v_dest uuid;
  v_texto text;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found or me not in (o.customer_id, o.provider_owner_id) then raise exception 'Pedido inexistente' using errcode = 'P0002'; end if;

  if me = o.provider_owner_id then
    v_ok := (o.status = 'placed' and p_status in ('accepted', 'rejected'))
         or (o.status = 'accepted' and p_status in ('preparing', 'on_the_way', 'rejected'))
         or (o.status = 'preparing' and p_status in ('on_the_way', 'delivered'))
         or (o.status = 'on_the_way' and p_status = 'delivered');
    v_dest := o.customer_id;
  else
    v_ok := (o.status = 'placed' and p_status = 'cancelled');
    v_dest := o.provider_owner_id;
  end if;
  if not v_ok then raise exception 'No se puede pasar el pedido de % a %', o.status, p_status using errcode = 'P0001'; end if;

  update public.orders set status = p_status where id = o.id;
  if p_status = 'delivered' and o.provider_id is not null then
    update public.providers set orders_count = orders_count + 1 where id = o.provider_id;
  end if;
  v_texto := case p_status
    when 'accepted' then '✅ Pedido aceptado' when 'preparing' then '👨‍🍳 Tu pedido se está preparando' when 'on_the_way' then '🛵 Tu pedido va en camino'
    when 'delivered' then '🎉 Pedido entregado' when 'rejected' then '❌ El negocio no pudo aceptar tu pedido' else '🚫 El cliente canceló el pedido' end;
  if o.chat_id is not null then insert into public.messages (chat_id, sender_id, kind, body) values (o.chat_id, null, 'system', v_texto); end if;
  perform public.notify(v_dest, 'sistema', v_texto, o.provider_name, case when o.chat_id is not null then '/mensajes/' || o.chat_id end,
    jsonb_build_object('order', o.id, 'kind', 'order_status'));
end $$;

-- ── 4. «Busco» de servicios: viaje, encomienda, reparaciones… con ofertas ───
create table if not exists public.service_requests (
  id                uuid primary key default gen_random_uuid(),
  requester_id      uuid not null references public.profiles (id) on delete cascade,
  vertical          text not null check (vertical in ('movilidad', 'hogar', 'mascotas')),
  subtype           text not null,
  title             text not null check (char_length(btrim(title)) between 5 and 100),
  description       text not null default '' check (char_length(description) <= 600),
  zone              text not null default '' check (char_length(zone) <= 80),         -- origen / zona del servicio (la dirección exacta va por chat)
  dest_zone         text not null default '' check (char_length(dest_zone) <= 80),    -- destino (viajes y encomiendas)
  when_kind         text not null check (when_kind in ('now', 'today', 'scheduled')),
  scheduled_at      timestamptz,
  budget_max        numeric(10,2) check (budget_max > 0),
  details           jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),   -- pasajeros, peso, urgencia…
  status            text not null default 'open' check (status in ('open', 'accepted', 'closed')),
  accepted_offer_id uuid,
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now(),
  check (when_kind <> 'scheduled' or scheduled_at is not null)
);
create index if not exists service_requests_open_idx on public.service_requests (vertical, subtype, expires_at desc) where status = 'open';
create index if not exists service_requests_owner_idx on public.service_requests (requester_id, created_at desc);

create table if not exists public.service_offers (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.service_requests (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  price       numeric(10,2) not null check (price > 0),
  eta_minutes int not null check (eta_minutes between 1 and 10080),
  message     text not null default '' check (char_length(message) <= 300),
  status      text not null default 'sent' check (status in ('sent', 'accepted', 'rejected', 'withdrawn')),
  chat_id     uuid references public.chats (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (request_id, provider_id)
);
create index if not exists service_offers_provider_idx on public.service_offers (provider_id, created_at desc);

create or replace function public.create_service_request(
  p_vertical text, p_subtype text, p_title text, p_description text default '', p_zone text default '', p_dest_zone text default '',
  p_when text default 'today', p_scheduled_at timestamptz default null, p_budget numeric default null, p_details jsonb default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_exp timestamptz;
  v_cliente text;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if p_vertical not in ('movilidad', 'hogar', 'mascotas') then raise exception 'Esta sección no admite solicitudes' using errcode = '22023'; end if;
  if not exists (select 1 from public._directory_catalog() c where c.vertical = p_vertical and c.subtype = p_subtype) then
    raise exception 'Esa categoría no existe en esta sección' using errcode = '22023';
  end if;
  if p_when not in ('now', 'today', 'scheduled') then raise exception 'Momento no válido' using errcode = '22023'; end if;
  if p_when = 'scheduled' and (p_scheduled_at is null or p_scheduled_at <= now() or p_scheduled_at > now() + interval '90 days') then
    raise exception 'La fecha programada debe estar en los próximos 90 días' using errcode = '22023';
  end if;
  if (select count(*) from public.service_requests where requester_id = me and status = 'open' and expires_at > now()) >= 5 then
    raise exception 'Ya tienes 5 solicitudes abiertas' using errcode = 'P0001';
  end if;
  v_exp := case p_when when 'now' then now() + interval '1 hour' when 'today' then now() + interval '12 hours' else p_scheduled_at + interval '2 hours' end;

  insert into public.service_requests (id, requester_id, vertical, subtype, title, description, zone, dest_zone, when_kind, scheduled_at, budget_max, details, expires_at)
  values (v_id, me, p_vertical, p_subtype, btrim(p_title), left(btrim(coalesce(p_description, '')), 600), left(btrim(coalesce(p_zone, '')), 80),
          left(btrim(coalesce(p_dest_zone, '')), 80), p_when, case when p_when = 'scheduled' then p_scheduled_at end, p_budget, coalesce(p_details, '{}'), v_exp);

  -- Avisa (máx. 20 personas, las de la misma zona primero) a quienes ofrecen ese servicio. En Movilidad solo a conductores con identidad verificada.
  select split_part(btrim(display_name), ' ', 1) into v_cliente from public.profiles where id = me;
  insert into public.notifications (user_id, type, title, body, href, data)
  select t.owner_id, 'sistema', '🔔 Nueva solicitud: ' || left(btrim(p_title), 60), coalesce(nullif(p_zone, ''), 'Cuenca') || ' · ' || coalesce(v_cliente, 'Alguien'),
         '/directorio/solicitudes', jsonb_build_object('request', v_id, 'kind', 'request')
    from (
      select distinct on (p.owner_id) p.owner_id, (p.zone = coalesce(p_zone, '')) as misma_zona, p.rating
        from public.providers p join public.profiles pr on pr.id = p.owner_id
       where p.status = 'active' and p.vertical = p_vertical and p.subtype = p_subtype and p.owner_id <> me
         and (p_vertical <> 'movilidad' or pr.identity_verified)
       order by p.owner_id, (p.zone = coalesce(p_zone, '')) desc, p.rating desc
    ) t
   order by t.misma_zona desc, t.rating desc
   limit 20;
  return v_id;
end $$;

create or replace function public.send_offer(p_request uuid, p_provider uuid, p_price numeric, p_eta int, p_message text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r public.service_requests;
  pr public.providers;
  o public.service_offers;
  v_chat uuid;
  v_id uuid;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into pr from public.providers where id = p_provider and owner_id = me and status = 'active';
  if not found then raise exception 'Ese perfil no es tuyo o no está activo' using errcode = '42501'; end if;
  select * into r from public.service_requests where id = p_request and status = 'open' and expires_at > now();
  if not found then raise exception 'La solicitud ya no está abierta' using errcode = 'P0002'; end if;
  if r.requester_id = me then raise exception 'No puedes ofertar en tu propia solicitud' using errcode = 'P0001'; end if;
  if pr.vertical <> r.vertical or pr.subtype <> r.subtype then raise exception 'Tu perfil no ofrece este tipo de servicio' using errcode = '42501'; end if;
  if r.vertical = 'movilidad' and not exists (select 1 from public.profiles where id = me and identity_verified) then
    raise exception 'Para ofertar viajes y encomiendas debes verificar tu identidad' using errcode = '42501';
  end if;
  if p_price is null or p_price <= 0 then raise exception 'Indica un precio válido' using errcode = '22023'; end if;
  if p_eta is null or p_eta not between 1 and 10080 then raise exception 'Indica un tiempo estimado válido (en minutos)' using errcode = '22023'; end if;

  select * into o from public.service_offers where request_id = r.id and provider_id = pr.id;
  if found and o.status in ('accepted', 'rejected') then raise exception 'Esa oferta ya fue resuelta' using errcode = 'P0001'; end if;
  v_chat := public._ensure_chat('direct', 'request:' || r.id || ':' || me, null, null, null, me, r.requester_id,
    pr.name || ' respondió a tu solicitud «' || left(r.title, 60) || '».');
  insert into public.service_offers (request_id, provider_id, price, eta_minutes, message, chat_id)
  values (r.id, pr.id, p_price, p_eta, left(btrim(coalesce(p_message, '')), 300), v_chat)
  on conflict (request_id, provider_id) do update
    set price = excluded.price, eta_minutes = excluded.eta_minutes, message = excluded.message, status = 'sent'
  returning id into v_id;
  perform public.notify(r.requester_id, 'sistema', '💬 ' || pr.name || ' te ofrece ' || trim_scale(p_price) || ' USD',
    'Llega en ~' || p_eta || ' min · ' || left(r.title, 50), '/mensajes/' || v_chat, jsonb_build_object('request', r.id, 'offer', v_id, 'kind', 'offer'));
  return v_id;
end $$;

create or replace function public.accept_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  o public.service_offers;
  r public.service_requests;
  v_owner uuid;
  v_name text;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into o from public.service_offers where id = p_offer;
  if not found then raise exception 'Oferta inexistente' using errcode = 'P0002'; end if;
  select * into r from public.service_requests where id = o.request_id for update;
  if r.requester_id <> me then raise exception 'Solo quien publicó la solicitud puede aceptar' using errcode = '42501'; end if;
  if r.status <> 'open' or r.expires_at <= now() then raise exception 'La solicitud ya no está abierta' using errcode = 'P0001'; end if;
  if o.status <> 'sent' then raise exception 'Esa oferta ya no está vigente' using errcode = 'P0001'; end if;
  select owner_id, name into v_owner, v_name from public.providers where id = o.provider_id;
  update public.service_offers set status = 'accepted' where id = o.id;
  update public.service_offers set status = 'rejected' where request_id = r.id and id <> o.id and status = 'sent';
  update public.service_requests set status = 'accepted', accepted_offer_id = o.id where id = r.id;
  if o.chat_id is not null then insert into public.messages (chat_id, sender_id, kind, body) values (o.chat_id, null, 'system', '✅ Oferta aceptada: ' || trim_scale(o.price) || ' USD. Coordinen los detalles aquí.'); end if;
  perform public.notify(v_owner, 'sistema', '✅ Aceptaron tu oferta de ' || trim_scale(o.price) || ' USD', left(r.title, 60),
    case when o.chat_id is not null then '/mensajes/' || o.chat_id end, jsonb_build_object('request', r.id, 'offer', o.id, 'kind', 'offer_accepted'));
end $$;

create or replace function public.withdraw_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.service_offers o set status = 'withdrawn'
   where o.id = p_offer and o.status = 'sent' and exists (select 1 from public.providers p where p.id = o.provider_id and p.owner_id = auth.uid());
  if not found then raise exception 'No se puede retirar esa oferta' using errcode = 'P0001'; end if;
end $$;

create or replace function public.close_service_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.service_requests set status = 'closed' where id = p_request and requester_id = auth.uid() and status = 'open';
  if not found then raise exception 'No se puede cerrar esa solicitud' using errcode = 'P0001'; end if;
  update public.service_offers set status = 'rejected' where request_id = p_request and status = 'sent';
end $$;

-- ── 5. Eventos y entradas ───────────────────────────────────────────────────
create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  provider_id         uuid not null references public.providers (id) on delete cascade,   -- el organizador (vertical «eventos»)
  title               text not null check (char_length(btrim(title)) between 5 and 120),
  description         text not null default '' check (char_length(description) <= 2000),
  category            text not null check (category in ('concierto', 'teatro', 'taller', 'feria', 'deporte', 'gastronomia', 'infantil', 'cultural', 'otro')),
  venue_name          text not null default '' check (char_length(venue_name) <= 100),
  address             text not null default '' check (char_length(address) <= 160),
  zone                text not null default '' check (char_length(zone) <= 80),
  starts_at           timestamptz not null,
  ends_at             timestamptz,
  cover_url           text,
  images              text[] not null default '{}' check (cardinality(images) <= 6),
  is_free             boolean not null default false,
  external_ticket_url text check (external_ticket_url is null or external_ticket_url ~* '^https://[^ ]+$'),
  status              text not null default 'published' check (status in ('published', 'cancelled', 'review')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();
create index if not exists events_upcoming_idx on public.events (starts_at) where status = 'published';
create index if not exists events_provider_idx on public.events (provider_id);

create or replace function public._events_prepare() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.providers where id = new.provider_id and vertical = 'eventos') then
    raise exception 'Solo un perfil de la sección Eventos puede publicar eventos' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    if new.starts_at <= now() then raise exception 'La fecha del evento debe ser futura' using errcode = '22023'; end if;
    if (select count(*) from public.events where provider_id = new.provider_id and status = 'published' and starts_at > now()) >= 30 then
      raise exception 'Un organizador puede tener como máximo 30 eventos futuros' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists events_prepare on public.events;
create trigger events_prepare before insert or update of provider_id, starts_at on public.events for each row execute function public._events_prepare();

create table if not exists public.event_ticket_types (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 2 and 60),
  price         numeric(8,2) not null default 0 check (price >= 0),
  quantity      int not null check (quantity between 1 and 100000),
  sold          int not null default 0,
  max_per_order int not null default 6 check (max_per_order between 1 and 20),
  sales_end     timestamptz,
  created_at    timestamptz not null default now(),
  check (sold between 0 and quantity)
);
create index if not exists ticket_types_event_idx on public.event_ticket_types (event_id);

create table if not exists public.event_reservations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  ticket_type_id uuid not null references public.event_ticket_types (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  qty            int not null check (qty between 1 and 20),
  total          numeric(10,2) not null check (total >= 0),
  code           text not null unique,                                                -- se muestra como QR en la entrada
  status         text not null default 'reserved' check (status in ('reserved', 'cancelled', 'checked_in')),
  created_at     timestamptz not null default now()
);
-- Una reserva vigente por persona y tipo de entrada (evita acaparar aforo).
create unique index if not exists event_reservations_one_active on public.event_reservations (user_id, ticket_type_id) where status in ('reserved', 'checked_in');
create index if not exists event_reservations_event_idx on public.event_reservations (event_id, status);

create table if not exists public.event_interest (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Reserva atómica: el aforo se descuenta en una sola sentencia condicionada, así que nunca se vende de más aunque lleguen peticiones a la vez.
create or replace function public.reserve_tickets(p_type uuid, p_qty int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_event uuid;
  v_price numeric(8,2);
  v_name text;
  v_total numeric(10,2);
  v_code text;
  v_id uuid;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if p_qty is null or p_qty not between 1 and 20 then raise exception 'La cantidad debe estar entre 1 y 20' using errcode = '22023'; end if;
  if exists (select 1 from public.event_ticket_types t join public.events e on e.id = t.event_id join public.providers p on p.id = e.provider_id
              where t.id = p_type and p.owner_id = me) then
    raise exception 'No puedes reservar entradas de tu propio evento' using errcode = 'P0001';
  end if;
  update public.event_ticket_types t set sold = t.sold + p_qty
    from public.events e
   where t.id = p_type and e.id = t.event_id and e.status = 'published' and e.starts_at > now()
     and (t.sales_end is null or t.sales_end > now()) and p_qty <= t.max_per_order and t.sold + p_qty <= t.quantity
  returning t.event_id, t.price, t.name into v_event, v_price, v_name;
  if not found then raise exception 'Entradas agotadas, venta cerrada o cantidad no permitida' using errcode = 'P0001'; end if;
  v_total := v_price * p_qty;
  v_code := upper(substr(md5(gen_random_uuid()::text), 1, 10));
  begin
    insert into public.event_reservations (event_id, ticket_type_id, user_id, qty, total, code)
    values (v_event, p_type, me, p_qty, v_total, v_code) returning id into v_id;
  exception when unique_violation then
    raise exception 'Ya tienes una reserva para esta entrada' using errcode = 'P0001';
  end;
  return jsonb_build_object('id', v_id, 'code', v_code, 'total', v_total, 'type', v_name, 'qty', p_qty, 'payment', case when v_total = 0 then 'free' else 'pay_at_door' end);
end $$;

create or replace function public.cancel_reservation(p_reservation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.event_reservations;
begin
  select * into r from public.event_reservations where id = p_reservation and user_id = auth.uid() and status = 'reserved' for update;
  if not found then raise exception 'No se puede cancelar esa reserva' using errcode = 'P0001'; end if;
  update public.event_reservations set status = 'cancelled' where id = r.id;
  update public.event_ticket_types set sold = sold - r.qty where id = r.ticket_type_id;
end $$;

-- Control de acceso en la puerta: solo el organizador y una sola vez por entrada.
create or replace function public.check_in(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.event_reservations;
  v_name text;
  v_who text;
begin
  select r2.* into r from public.event_reservations r2
    join public.events e on e.id = r2.event_id join public.providers p on p.id = e.provider_id
   where r2.code = upper(btrim(p_code)) and p.owner_id = auth.uid() for update of r2;
  if not found then raise exception 'Código no válido para tus eventos' using errcode = 'P0002'; end if;
  if r.status = 'checked_in' then raise exception 'Esta entrada ya fue usada' using errcode = 'P0001'; end if;
  if r.status <> 'reserved' then raise exception 'Esta reserva fue cancelada' using errcode = 'P0001'; end if;
  update public.event_reservations set status = 'checked_in' where id = r.id;
  select name into v_name from public.event_ticket_types where id = r.ticket_type_id;
  select split_part(btrim(display_name), ' ', 1) into v_who from public.profiles where id = r.user_id;
  return jsonb_build_object('qty', r.qty, 'type', v_name, 'name', v_who);
end $$;

create or replace function public.toggle_event_interest(p_event uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if not exists (select 1 from public.events where id = p_event and status = 'published') then raise exception 'Evento inexistente' using errcode = 'P0002'; end if;
  delete from public.event_interest where event_id = p_event and user_id = me;
  if found then return false; end if;
  insert into public.event_interest (event_id, user_id) values (p_event, me);
  return true;
end $$;

-- ── 6. Reseñas de perfiles ──────────────────────────────────────────────────
create table if not exists public.provider_reviews (
  id                uuid primary key default gen_random_uuid(),
  provider_id       uuid not null references public.providers (id) on delete cascade,
  author_id         uuid not null references public.profiles (id) on delete cascade,
  rating            int not null check (rating between 1 and 5),
  comment           text not null default '' check (char_length(comment) <= 500),
  verified_purchase boolean not null default false,       -- hubo pedido entregado, oferta aceptada o entrada usada
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (provider_id, author_id)
);
create index if not exists provider_reviews_provider_idx on public.provider_reviews (provider_id, created_at desc);

-- 0 = sin relación · 1 = hubo conversación · 2 = hubo una transacción real
create or replace function public._interaction_level(p_author uuid, p_provider uuid) returns int
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.orders o where o.provider_id = p_provider and o.customer_id = p_author and o.status = 'delivered')
      or exists (select 1 from public.service_offers so join public.service_requests sr on sr.id = so.request_id
                  where so.provider_id = p_provider and sr.requester_id = p_author and so.status = 'accepted')
      or exists (select 1 from public.event_reservations r join public.events e on e.id = r.event_id
                  where e.provider_id = p_provider and r.user_id = p_author and r.status = 'checked_in') then 2
    when exists (select 1 from public.providers pr
                  join public.chat_members a on a.user_id = p_author
                  join public.chat_members b on b.chat_id = a.chat_id and b.user_id = pr.owner_id
                  join public.messages m on m.chat_id = a.chat_id and m.sender_id = p_author
                 where pr.id = p_provider) then 1
    else 0 end;
$$;

create or replace function public.review_provider(p_provider uuid, p_rating int, p_comment text default '') returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_nivel int;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if not exists (select 1 from public.providers where id = p_provider and status = 'active') then raise exception 'Perfil no disponible' using errcode = 'P0002'; end if;
  if exists (select 1 from public.providers where id = p_provider and owner_id = me) then raise exception 'No puedes valorar tu propio perfil' using errcode = 'P0001'; end if;
  v_nivel := public._interaction_level(me, p_provider);
  if v_nivel = 0 then raise exception 'Solo puedes valorar a quien hayas contactado o contratado' using errcode = 'P0001'; end if;
  insert into public.provider_reviews (provider_id, author_id, rating, comment, verified_purchase)
  values (p_provider, me, p_rating, left(btrim(coalesce(p_comment, '')), 500), v_nivel = 2)
  on conflict (provider_id, author_id) do update
    set rating = excluded.rating, comment = excluded.comment, verified_purchase = excluded.verified_purchase, updated_at = now();
end $$;

create or replace function public._reviews_recalc() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := case when tg_op = 'DELETE' then old.provider_id else new.provider_id end;
begin
  update public.providers p
     set rating = coalesce((select round(avg(rating), 1) from public.provider_reviews where provider_id = v_id), 0),
         reviews_count = (select count(*) from public.provider_reviews where provider_id = v_id)
   where p.id = v_id;
  return null;
end $$;
drop trigger if exists provider_reviews_recalc on public.provider_reviews;
create trigger provider_reviews_recalc after insert or update or delete on public.provider_reviews for each row execute function public._reviews_recalc();

-- ── 7. Denuncias y moderación ───────────────────────────────────────────────
create table if not exists public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('provider', 'event', 'request', 'item')),
  target_id   uuid not null,
  reason      text not null check (reason in ('fraude', 'contenido_inapropiado', 'informacion_falsa', 'duplicado', 'peligroso', 'otro')),
  note        text not null default '' check (char_length(note) <= 300),
  status      text not null default 'open' check (status in ('open', 'reviewed')),
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index if not exists content_reports_target_idx on public.content_reports (target_type, target_id);

-- Con 3 denuncias de personas distintas el contenido deja de mostrarse hasta que una persona moderadora lo revise.
create or replace function public.report_content(p_type text, p_id uuid, p_reason text, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_owner uuid;
  v_n int;
  v_changed int := 0;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  v_owner := case p_type
    when 'provider' then (select owner_id from public.providers where id = p_id)
    when 'event'    then (select p.owner_id from public.events e join public.providers p on p.id = e.provider_id where e.id = p_id)
    when 'request'  then (select requester_id from public.service_requests where id = p_id)
    when 'item'     then (select p.owner_id from public.provider_items i join public.providers p on p.id = i.provider_id where i.id = p_id) end;
  if v_owner is null then raise exception 'Contenido inexistente' using errcode = 'P0002'; end if;
  if v_owner = me then raise exception 'No puedes denunciar tu propio contenido' using errcode = 'P0001'; end if;
  insert into public.content_reports (reporter_id, target_type, target_id, reason, note)
  values (me, p_type, p_id, p_reason, left(btrim(coalesce(p_note, '')), 300))
  on conflict (reporter_id, target_type, target_id) do nothing;
  select count(*) into v_n from public.content_reports where target_type = p_type and target_id = p_id and status = 'open';
  if v_n >= 3 then
    if p_type = 'provider' then update public.providers set status = 'review' where id = p_id and status = 'active';
    elsif p_type = 'event' then update public.events set status = 'review' where id = p_id and status = 'published';
    elsif p_type = 'request' then update public.service_requests set status = 'closed' where id = p_id and status = 'open';
    else update public.provider_items set available = false where id = p_id and available;
    end if;
    get diagnostics v_changed = row_count;
    if v_changed > 0 then
      perform public.notify(v_owner, 'sistema', '⚠️ Tu contenido está en revisión', 'Varias personas lo denunciaron. Un moderador lo revisará pronto.', null, jsonb_build_object('kind', 'moderation'));
      insert into public.notifications (user_id, type, title, body, href, data)
      select a.user_id, 'sistema', '🛡️ Contenido en revisión (' || p_type || ')', 'Alcanzó ' || v_n || ' denuncias', '/admin/personas', jsonb_build_object('kind', 'moderation', 'target', p_id)
        from public.app_admins a;
    end if;
  end if;
end $$;

create or replace function public.moderate_content(p_type text, p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if p_type = 'provider' then
    if p_action = 'verify' then update public.providers set verified_at = now() where id = p_id;
    elsif p_action = 'unverify' then update public.providers set verified_at = null where id = p_id;
    elsif p_action = 'suspend' then update public.providers set status = 'suspended' where id = p_id;
    elsif p_action = 'restore' then update public.providers set status = 'active' where id = p_id;
    else raise exception 'Acción no válida' using errcode = '22023'; end if;
  elsif p_type = 'event' then
    if p_action = 'suspend' then update public.events set status = 'cancelled' where id = p_id;
    elsif p_action = 'restore' then update public.events set status = 'published' where id = p_id;
    else raise exception 'Acción no válida' using errcode = '22023'; end if;
  else
    raise exception 'Tipo no válido' using errcode = '22023';
  end if;
  if p_action in ('suspend', 'restore') then
    update public.content_reports set status = 'reviewed' where target_type = p_type and target_id = p_id;
  end if;
end $$;

-- El dueño solo puede alternar entre visible y pausado (el resto de estados los fija la moderación).
create or replace function public.set_provider_active(p_provider uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.providers set status = case when p_active then 'active' else 'paused' end
   where id = p_provider and owner_id = auth.uid() and status in ('active', 'paused');
  if not found then raise exception 'No se puede cambiar la visibilidad de ese perfil' using errcode = 'P0001'; end if;
end $$;

-- ── 8. Búsqueda del directorio ──────────────────────────────────────────────
-- Una sola función para todas las secciones. Orden: de turno verificado · impulsado · cercanía (si das coordenadas) · verificado · valoración.
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
       and (p_q is null or btrim(p_q) = '' or p.name ilike '%' || replace(replace(btrim(p_q), '%', ''), '_', '') || '%'
            or p.description ilike '%' || replace(replace(btrim(p_q), '%', ''), '_', '') || '%')
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

-- Cifras reales por sección (para las tarjetas de la portada).
create or replace function public.directory_counts() returns table (vertical text, providers int, verified int)
language sql stable security definer set search_path = public as $$
  select p.vertical, count(*)::int, count(p.verified_at)::int from public.providers p where p.status = 'active' group by p.vertical;
$$;

-- ── 9. Privilegios y RLS ────────────────────────────────────────────────────
alter table public.providers            enable row level security;
alter table public.provider_contacts    enable row level security;
alter table public.provider_items       enable row level security;
alter table public.provider_duty_shifts enable row level security;
alter table public.orders               enable row level security;
alter table public.order_lines          enable row level security;
alter table public.service_requests     enable row level security;
alter table public.service_offers       enable row level security;
alter table public.events               enable row level security;
alter table public.event_ticket_types   enable row level security;
alter table public.event_reservations   enable row level security;
alter table public.event_interest       enable row level security;
alter table public.provider_reviews     enable row level security;
alter table public.content_reports      enable row level security;

revoke all on public.providers, public.provider_contacts, public.provider_items, public.provider_duty_shifts, public.orders, public.order_lines,
              public.service_requests, public.service_offers, public.events, public.event_ticket_types, public.event_reservations,
              public.event_interest, public.provider_reviews, public.content_reports from anon, authenticated;

-- Públicas (catálogo): perfiles activos, menús, turnos, eventos, aforo y reseñas.
grant select on public.providers, public.provider_items, public.provider_duty_shifts, public.events, public.event_ticket_types,
                public.provider_reviews to anon, authenticated;
-- Con sesión:
grant select on public.provider_contacts, public.orders, public.order_lines, public.service_requests, public.service_offers,
                public.event_reservations, public.event_interest, public.content_reports to authenticated;

grant insert (owner_id, vertical, subtype, name, description, city, zone, lat, lng, logo_url, cover_url, images, channels, open_24h, hours,
              delivery_fee, min_order, delivery_zones, attrs, listing_id, job_id) on public.providers to authenticated;
grant update (name, description, city, zone, lat, lng, logo_url, cover_url, images, channels, open_24h, hours,
              delivery_fee, min_order, delivery_zones, attrs, listing_id, job_id) on public.providers to authenticated;
grant delete on public.providers to authenticated;

grant insert (provider_id, phone, whatsapp, address), update (phone, whatsapp, address), delete on public.provider_contacts to authenticated;
grant insert (provider_id, kind, section, name, description, price, price_to, unit, image_url, available, requires_prescription, sort_order, attrs),
      update (section, name, description, price, price_to, unit, image_url, available, requires_prescription, sort_order, attrs),
      delete on public.provider_items to authenticated;
grant insert (provider_id, starts_at, ends_at, note), delete on public.provider_duty_shifts to authenticated;
grant insert (provider_id, title, description, category, venue_name, address, zone, starts_at, ends_at, cover_url, images, is_free, external_ticket_url),
      update (title, description, category, venue_name, address, zone, starts_at, ends_at, cover_url, images, is_free, external_ticket_url),
      delete on public.events to authenticated;
grant insert (event_id, name, price, quantity, max_per_order, sales_end), update (name, price, quantity, sales_end, max_per_order), delete on public.event_ticket_types to authenticated;

drop policy if exists providers_select on public.providers;
create policy providers_select on public.providers for select using (status = 'active' or owner_id = auth.uid());
drop policy if exists providers_insert on public.providers;
create policy providers_insert on public.providers for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists providers_update on public.providers;
create policy providers_update on public.providers for update to authenticated
  using (owner_id = auth.uid() and status in ('active', 'paused')) with check (owner_id = auth.uid());
drop policy if exists providers_delete on public.providers;
create policy providers_delete on public.providers for delete to authenticated using (owner_id = auth.uid());

drop policy if exists provider_contacts_select on public.provider_contacts;
create policy provider_contacts_select on public.provider_contacts for select to authenticated using (
  exists (select 1 from public.providers p where p.id = provider_id and (p.status = 'active' or p.owner_id = auth.uid())));
drop policy if exists provider_contacts_write on public.provider_contacts;
create policy provider_contacts_write on public.provider_contacts for all to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()));

drop policy if exists provider_items_select on public.provider_items;
create policy provider_items_select on public.provider_items for select using (
  exists (select 1 from public.providers p where p.id = provider_id and (p.status = 'active' or p.owner_id = auth.uid())));
drop policy if exists provider_items_write on public.provider_items;
create policy provider_items_write on public.provider_items for all to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()));

drop policy if exists duty_shifts_select on public.provider_duty_shifts;
create policy duty_shifts_select on public.provider_duty_shifts for select using (
  exists (select 1 from public.providers p where p.id = provider_id and (p.status = 'active' or p.owner_id = auth.uid())));
drop policy if exists duty_shifts_write on public.provider_duty_shifts;
create policy duty_shifts_write on public.provider_duty_shifts for all to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()));

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated using (customer_id = auth.uid() or provider_owner_id = auth.uid());
drop policy if exists order_lines_select on public.order_lines;
create policy order_lines_select on public.order_lines for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or o.provider_owner_id = auth.uid())));

-- Las políticas de solicitudes y ofertas se consultan entre sí: sin este intermediario la base detecta recursión infinita.
-- La función solo responde «¿tengo una oferta en esa solicitud?» (nada de datos ajenos), por eso puede ejecutarla cualquiera con sesión.
create or replace function public._has_offer_on(p_request uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.service_offers o join public.providers p on p.id = o.provider_id
                  where o.request_id = p_request and p.owner_id = auth.uid());
$$;

drop policy if exists service_requests_select on public.service_requests;
create policy service_requests_select on public.service_requests for select to authenticated using (
  requester_id = auth.uid()
  or (status = 'open' and expires_at > now())
  or public._has_offer_on(id));
drop policy if exists service_offers_select on public.service_offers;
create policy service_offers_select on public.service_offers for select to authenticated using (
  exists (select 1 from public.service_requests r where r.id = request_id and r.requester_id = auth.uid())
  or exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()));

drop policy if exists events_select on public.events;
create policy events_select on public.events for select using (
  status = 'published' or exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()));
drop policy if exists events_write on public.events;
create policy events_write on public.events for all to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()));
drop policy if exists ticket_types_select on public.event_ticket_types;
create policy ticket_types_select on public.event_ticket_types for select using (
  exists (select 1 from public.events e where e.id = event_id and (e.status = 'published' or
          exists (select 1 from public.providers p where p.id = e.provider_id and p.owner_id = auth.uid()))));
drop policy if exists ticket_types_write on public.event_ticket_types;
create policy ticket_types_write on public.event_ticket_types for all to authenticated
  using (exists (select 1 from public.events e join public.providers p on p.id = e.provider_id where e.id = event_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e join public.providers p on p.id = e.provider_id where e.id = event_id and p.owner_id = auth.uid()));
drop policy if exists reservations_select on public.event_reservations;
create policy reservations_select on public.event_reservations for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.events e join public.providers p on p.id = e.provider_id where e.id = event_id and p.owner_id = auth.uid()));
drop policy if exists event_interest_select on public.event_interest;
create policy event_interest_select on public.event_interest for select to authenticated using (user_id = auth.uid());

drop policy if exists provider_reviews_select on public.provider_reviews;
create policy provider_reviews_select on public.provider_reviews for select using (true);
drop policy if exists content_reports_select on public.content_reports;
create policy content_reports_select on public.content_reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());

-- Tiempo real: pedidos, solicitudes y ofertas se ven al instante.
do $$
declare t text;
begin
  foreach t in array array['orders', 'service_requests', 'service_offers', 'events'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

grant execute on function public._has_offer_on(uuid) to authenticated;
grant execute on function
  public.place_order(uuid, text, jsonb, text, text, text, text), public.set_order_status(uuid, text),
  public.create_service_request(text, text, text, text, text, text, text, timestamptz, numeric, jsonb),
  public.send_offer(uuid, uuid, numeric, int, text), public.accept_offer(uuid), public.withdraw_offer(uuid), public.close_service_request(uuid),
  public.reserve_tickets(uuid, int), public.cancel_reservation(uuid), public.check_in(text), public.toggle_event_interest(uuid),
  public.review_provider(uuid, int, text), public.report_content(text, uuid, text, text), public.moderate_content(text, uuid, text),
  public.set_provider_active(uuid, boolean)
  to authenticated;
grant execute on function
  public.search_providers(text, text, text, text, boolean, boolean, boolean, boolean, numeric, numeric, int, int), public.directory_counts()
  to anon, authenticated;
revoke execute on function
  public._directory_catalog(), public._slugify(text), public._valid_hours(jsonb), public._is_open(jsonb, boolean, timestamptz),
  public._km(numeric, numeric, numeric, numeric), public._providers_prepare(), public._providers_reward(), public._items_prepare(),
  public._duty_prepare(), public._events_prepare(), public._interaction_level(uuid, uuid), public._reviews_recalc()
  from public, anon, authenticated;

-- ACTUALIZACION-006-FIN

-- ACTUALIZACION-007-INICIO
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

-- ACTUALIZACION-007-FIN
