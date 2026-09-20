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
