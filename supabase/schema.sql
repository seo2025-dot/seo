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
