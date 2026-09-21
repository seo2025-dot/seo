-- ============================================================================
-- ACTUALIZACIÓN 010 · Economía de monedas: 3 usos gratis, tarifas de uso, tienda de monedas y retos de comunidad
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización (con la 009): ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez (las tarifas ya editadas por un administrador no se pisan).
--
-- Modelo:
--   · Cada persona o negocio tiene sus PRIMEROS 3 USOS GRATIS de cada acción (pedir, aceptar un pedido, pedir ofertas, ofertar,
--     publicar un evento, reservar entradas). A partir del cuarto se descuentan monedas (tabla coin_prices, editable por un admin).
--   · En las citas, cada persona escribe 3 mensajes gratis por conversación; luego 1 moneda cada 5 mensajes.
--   · Las monedas se ganan con retos (diarios, semanales y únicos), invitando amigos, la ruleta y el bono diario, o se compran
--     en paquetes de $0.50, $1.50 y $3.50 (coin_packages). Pagar con PayPhone o PayPal lo confirma SIEMPRE el servidor
--     (credit_coin_payment solo la puede ejecutar service_role): el navegador nunca acredita monedas.
--   · Todo el cobro vive en disparadores: da igual por qué camino llegue la acción, se cobra igual y de forma atómica con ella.
-- ============================================================================

-- ── 1. Tarifas de uso ───────────────────────────────────────────────────────
create table if not exists public.coin_prices (
  action     text primary key check (action ~ '^[a-z_]+$'),
  label      text not null,
  free_uses  int not null default 3 check (free_uses >= 0),     -- usos gratis por persona (en chat_message: mensajes gratis por conversación)
  cost       int not null check (cost >= 0),                    -- monedas por uso (en chat_message: cada 5 mensajes)
  active     boolean not null default true,
  sort       int not null default 0
);
insert into public.coin_prices (action, label, free_uses, cost, sort) values
  ('order_place',    'Hacer un pedido',                       3, 1, 10),
  ('order_accept',   'Aceptar un pedido (negocio)',           3, 5, 20),
  ('request_create', 'Pedir ofertas',                         3, 2, 30),
  ('offer_send',     'Enviar una oferta (profesional)',       3, 3, 40),
  ('event_publish',  'Publicar un evento',                    3, 10, 50),
  ('event_reserve',  'Reservar entradas',                     3, 1, 60),
  ('chat_message',   'Mensajes en citas (cada 5)',            3, 1, 70),
  ('provider_boost', 'Destacar mi negocio 24 h',              0, 30, 80)
on conflict (action) do nothing;

-- Cuántos usos gratis y de pago lleva cada persona por acción.
create table if not exists public.coin_usage (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  action    text not null,
  free_used int not null default 0 check (free_used >= 0),
  paid_used int not null default 0 check (paid_used >= 0),
  spent     int not null default 0 check (spent >= 0),
  primary key (user_id, action)
);

alter table public.coin_prices enable row level security;
alter table public.coin_usage  enable row level security;
revoke all on public.coin_prices, public.coin_usage from anon, authenticated;
grant select on public.coin_prices to anon, authenticated;
grant select on public.coin_usage to authenticated;
drop policy if exists coin_prices_select on public.coin_prices;
create policy coin_prices_select on public.coin_prices for select using (true);
drop policy if exists coin_usage_select on public.coin_usage;
create policy coin_usage_select on public.coin_usage for select to authenticated using (user_id = auth.uid());

-- Cobra un uso: gratis mientras queden usos gratuitos; después descuenta monedas (o falla con «insufficient_coins:acción:coste»).
-- Devuelve las monedas cobradas (0 si fue gratis o la acción no tiene tarifa activa).
create or replace function public._charge(p_user uuid, p_action text, p_ref text default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  pr public.coin_prices;
  u public.coin_usage;
begin
  select * into pr from public.coin_prices where action = p_action and active;
  if not found then return 0; end if;
  insert into public.coin_usage (user_id, action) values (p_user, p_action) on conflict do nothing;
  select * into u from public.coin_usage where user_id = p_user and action = p_action for update;
  if u.free_used < pr.free_uses then
    update public.coin_usage set free_used = free_used + 1 where user_id = p_user and action = p_action;
    return 0;
  end if;
  if pr.cost = 0 then
    update public.coin_usage set paid_used = paid_used + 1 where user_id = p_user and action = p_action;
    return 0;
  end if;
  if not exists (select 1 from public.wallets where user_id = p_user and coins >= pr.cost) then
    raise exception 'insufficient_coins:%:%', p_action, pr.cost using errcode = 'P0001';
  end if;
  perform public._spend(p_user, pr.cost, 'use:' || p_action || coalesce(':' || p_ref, ''));
  update public.coin_usage set paid_used = paid_used + 1, spent = spent + pr.cost where user_id = p_user and action = p_action;
  return pr.cost;
end $$;

-- Devuelve monedas de un uso que no llegó a prestarse (pedido rechazado o sin respuesta, evento cancelado).
create or replace function public._refund(p_user uuid, p_action text, p_amount int, p_ref text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then return; end if;
  perform public._earn(p_user, p_amount, 'refund:' || p_action || coalesce(':' || p_ref, ''));
  update public.coin_usage set paid_used = greatest(paid_used - 1, 0), spent = greatest(spent - p_amount, 0) where user_id = p_user and action = p_action;
end $$;

-- ── 2. Pedidos: cobra al comprador al pedir y al negocio al aceptar; devuelve si no hubo servicio ─────────────────
alter table public.orders
  add column if not exists coins_paid     int not null default 0 check (coins_paid >= 0),       -- lo que pagó quien pide
  add column if not exists coins_business int not null default 0 check (coins_business >= 0),   -- lo que pagó el negocio al aceptar
  add column if not exists coins_refunded int not null default 0 check (coins_refunded >= 0);

create or replace function public._orders_charge_buyer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.coins_paid := public._charge(new.customer_id, 'order_place', new.id::text);
  return new;
end $$;
drop trigger if exists orders_charge_buyer on public.orders;
create trigger orders_charge_buyer before insert on public.orders for each row execute function public._orders_charge_buyer();

create or replace function public._orders_status_coins() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cost int;
begin
  if old.status <> 'placed' then return new; end if;
  if new.status = 'accepted' then
    v_cost := public._charge(new.provider_owner_id, 'order_accept', new.id::text);
    if v_cost > 0 then update public.orders set coins_business = v_cost where id = new.id; end if;
  elsif old.coins_paid > 0 and (new.status = 'rejected' or (new.status = 'cancelled' and now() - old.created_at >= interval '3 hours')) then
    -- El negocio lo rechazó o no respondió a tiempo: no hubo servicio, se devuelve lo pagado. Si cancela la propia persona, no.
    perform public._refund(new.customer_id, 'order_place', old.coins_paid, new.id::text);
    update public.orders set coins_refunded = old.coins_paid where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists orders_status_coins on public.orders;
create trigger orders_status_coins after update of status on public.orders for each row execute function public._orders_status_coins();

-- ── 3. Solicitudes, ofertas y eventos ───────────────────────────────────────
create or replace function public._requests_charge() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._charge(new.requester_id, 'request_create', new.id::text);
  return new;
end $$;
drop trigger if exists service_requests_charge on public.service_requests;
create trigger service_requests_charge before insert on public.service_requests for each row execute function public._requests_charge();

-- Reofertar (mismo perfil, misma solicitud) actualiza la oferta y no vuelve a cobrar.
create or replace function public._offers_charge() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  if exists (select 1 from public.service_offers where request_id = new.request_id and provider_id = new.provider_id) then return new; end if;
  select owner_id into v_owner from public.providers where id = new.provider_id;
  if v_owner is not null then perform public._charge(v_owner, 'offer_send', new.request_id::text); end if;
  return new;
end $$;
drop trigger if exists service_offers_charge on public.service_offers;
create trigger service_offers_charge before insert on public.service_offers for each row execute function public._offers_charge();

create or replace function public._events_charge() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.providers where id = new.provider_id;
  if v_owner is not null then perform public._charge(v_owner, 'event_publish', new.id::text); end if;
  return new;
end $$;
drop trigger if exists events_charge on public.events;
create trigger events_charge before insert on public.events for each row execute function public._events_charge();

alter table public.event_reservations add column if not exists coins_paid int not null default 0 check (coins_paid >= 0);
create or replace function public._reservations_charge() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.coins_paid := public._charge(new.user_id, 'event_reserve', new.event_id::text);
  return new;
end $$;
drop trigger if exists event_reservations_charge on public.event_reservations;
create trigger event_reservations_charge before insert on public.event_reservations for each row execute function public._reservations_charge();

-- Si el organizador cancela el evento, se devuelve lo que costó reservar.
create or replace function public._reservations_refund() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'reserved' and new.status = 'cancelled' and old.coins_paid > 0
     and exists (select 1 from public.events where id = new.event_id and status = 'cancelled') then
    perform public._refund(new.user_id, 'event_reserve', old.coins_paid, new.event_id::text);
  end if;
  return new;
end $$;
drop trigger if exists event_reservations_refund on public.event_reservations;
create trigger event_reservations_refund after update of status on public.event_reservations for each row execute function public._reservations_refund();

-- ── 4. Citas: 3 mensajes gratis por conversación y después 1 moneda cada 5 ──────────────────────────────────
-- Solo cuenta lo que escribe una persona desde su sesión en un chat de cita o match (los chats comerciales y los mensajes del
-- sistema o de las personas de demostración quedan fuera).
create or replace function public._messages_charge() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pr public.coin_prices;
  v_n int;
begin
  if new.kind <> 'text' or new.sender_id is null or new.sender_id is distinct from auth.uid() then return new; end if;
  if not exists (select 1 from public.chats where id = new.chat_id and origin in ('cita', 'match')) then return new; end if;
  select * into pr from public.coin_prices where action = 'chat_message' and active;
  if not found then return new; end if;
  select count(*)::int into v_n from public.messages where chat_id = new.chat_id and sender_id = new.sender_id and kind = 'text';
  -- v_n = mensajes ya enviados: el n.º v_n+1 es gratis hasta free_uses; después se paga el primero de cada bloque de 5.
  if v_n < pr.free_uses or pr.cost = 0 or (v_n - pr.free_uses) % 5 <> 0 then return new; end if;
  if not exists (select 1 from public.wallets where user_id = new.sender_id and coins >= pr.cost) then
    raise exception 'insufficient_coins:chat_message:%', pr.cost using errcode = 'P0001';
  end if;
  perform public._spend(new.sender_id, pr.cost, 'use:chat_message:' || new.chat_id);
  return new;
end $$;
drop trigger if exists messages_charge on public.messages;
create trigger messages_charge before insert on public.messages for each row execute function public._messages_charge();

-- ── 5. Destacar un negocio (24 h más arriba en los listados) ────────────────
create or replace function public.boost_provider(p_provider uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_until timestamptz;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if not exists (select 1 from public.providers where id = p_provider and owner_id = me and status = 'active') then
    raise exception 'Solo puedes destacar tus propios perfiles activos' using errcode = '42501';
  end if;
  perform public._charge(me, 'provider_boost', p_provider::text);
  update public.providers set boosted_until = greatest(now(), coalesce(boosted_until, now())) + interval '24 hours'
   where id = p_provider returning boosted_until into v_until;
  return v_until;
end $$;

-- ── 6. Retos de comunidad (semanales y únicos): dan monedas sin gastar dinero ───────────────────────────────
create table if not exists public.coin_challenges (
  id          text primary key check (id ~ '^[a-z_]+$'),
  period      text not null check (period in ('weekly', 'once')),
  metric      text not null check (metric in ('reviews', 'orders_delivered', 'orders_served', 'community', 'requests', 'reservations', 'friends')),
  target      int not null check (target >= 1),
  prize       int not null check (prize >= 1),
  emoji       text not null default '🎯',
  title       text not null,
  description text not null default '',
  href        text,
  active      boolean not null default true,
  sort        int not null default 0
);
insert into public.coin_challenges (id, period, metric, target, prize, emoji, title, description, href, sort) values
  ('resenas_semana',    'weekly', 'reviews',          2,  25, '⭐', 'Califica 2 comercios',               'Reseña a negocios donde pediste o con los que hablaste.',        '/directorio',            10),
  ('pedidos_semana',    'weekly', 'orders_delivered', 2,  20, '🛵', 'Recibe 2 pedidos esta semana',       'Pide comida o farmacia y recíbelo.',                             '/directorio/delivery',   20),
  ('comunidad_semana',  'weekly', 'community',        10, 20, '💬', 'Interactúa 10 veces en la comunidad', 'Reacciona o comenta en publicaciones.',                          '/comunidad',             30),
  ('amigos_semana',     'weekly', 'friends',          3,  25, '🤝', 'Suma 3 amigos nuevos',               'Acepta o envía solicitudes de amistad.',                         '/comunidad',             40),
  ('solicitud_semana',  'weekly', 'requests',         1,  15, '🙋', 'Pide ofertas o responde una',        'Publica una solicitud o envía una oferta.',                      '/directorio/solicitudes', 50),
  ('evento_semana',     'weekly', 'reservations',     1,  10, '🎟️', 'Reserva entradas de un evento',      'Reserva un lugar en un evento de tu ciudad.',                    '/directorio/eventos',    60),
  ('servir_semana',     'weekly', 'orders_served',    5,  40, '🏪', 'Entrega 5 pedidos (negocios)',       'Atiende pedidos hasta marcarlos como entregados.',               '/directorio/mi-negocio/pedidos', 70),
  ('primera_resena',    'once',   'reviews',          1,  20, '🌟', 'Tu primera reseña',                  'Cuéntale a la comunidad cómo te fue con un negocio.',            '/directorio',            110),
  ('primer_pedido',     'once',   'orders_delivered', 1,  20, '🍔', 'Tu primer pedido entregado',         'Haz tu primer pedido por conectari.com.',                        '/directorio/delivery',   120),
  ('primera_reserva',   'once',   'reservations',     1,  10, '🎫', 'Tu primera entrada',                 'Reserva entradas para un evento.',                               '/directorio/eventos',    130)
on conflict (id) do nothing;

create table if not exists public.coin_challenge_claims (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  challenge_id text not null references public.coin_challenges (id) on delete cascade,
  period_key   text not null,
  claimed_at   timestamptz not null default now(),
  primary key (user_id, challenge_id, period_key)          -- la clave impide cobrar dos veces el mismo reto en el mismo periodo
);

alter table public.coin_challenges enable row level security;
alter table public.coin_challenge_claims enable row level security;
revoke all on public.coin_challenges, public.coin_challenge_claims from anon, authenticated;
grant select on public.coin_challenges to authenticated;
grant select on public.coin_challenge_claims to authenticated;
drop policy if exists coin_challenges_select on public.coin_challenges;
create policy coin_challenges_select on public.coin_challenges for select to authenticated using (true);
drop policy if exists coin_challenge_claims_select on public.coin_challenge_claims;
create policy coin_challenge_claims_select on public.coin_challenge_claims for select to authenticated using (user_id = auth.uid());

-- Ventana de cada periodo. La semana empieza el lunes a las 00:00 de Ecuador (UTC-5 fijo) y se calcula sin depender de la zona de la sesión.
create or replace function public._challenge_window(p_period text) returns table (period_key text, since timestamptz, until_at timestamptz)
language sql stable as $$
  select case p_period when 'weekly' then to_char(s.local_week, 'IYYY"-W"IW') else 'once' end,
         case p_period when 'weekly' then (s.local_week + interval '5 hours') at time zone 'UTC' else '-infinity'::timestamptz end,
         case p_period when 'weekly' then (s.local_week + interval '7 days 5 hours') at time zone 'UTC' else null end
    from (select date_trunc('week', (now() at time zone 'UTC') - interval '5 hours') as local_week) s
$$;

create or replace function public._challenge_progress(p_user uuid, p_metric text, p_since timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select case p_metric
    when 'reviews'          then (select count(*) from public.provider_reviews where author_id = p_user and created_at >= p_since)
    when 'orders_delivered' then (select count(*) from public.orders where customer_id = p_user and status = 'delivered' and updated_at >= p_since)
    when 'orders_served'    then (select count(*) from public.orders where provider_owner_id = p_user and status = 'delivered' and updated_at >= p_since)
    when 'community'        then (select count(*) from public.post_likes where user_id = p_user and created_at >= p_since)
                               + (select count(*) from public.post_comments where author_id = p_user and created_at >= p_since)
    when 'requests'         then (select count(*) from public.service_requests where requester_id = p_user and created_at >= p_since)
                               + (select count(*) from public.service_offers o join public.providers p on p.id = o.provider_id where p.owner_id = p_user and o.created_at >= p_since)
    when 'reservations'     then (select count(*) from public.event_reservations where user_id = p_user and status in ('reserved', 'checked_in') and created_at >= p_since)
    when 'friends'          then (select count(*) from public.friendships where status = 'accepted' and p_user in (requester_id, addressee_id) and responded_at >= p_since)
    else 0
  end::int
$$;

create or replace function public.community_challenges_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'period', c.period, 'metric', c.metric, 'target', c.target, 'prize', c.prize, 'emoji', c.emoji, 'title', c.title,
             'description', c.description, 'href', c.href,
             'progress', least(public._challenge_progress(me, c.metric, w.since), c.target),
             'claimed', exists (select 1 from public.coin_challenge_claims k where k.user_id = me and k.challenge_id = c.id and k.period_key = w.period_key),
             'ends_at', w.until_at) order by c.period desc, c.sort)
      from public.coin_challenges c cross join lateral public._challenge_window(c.period) w
     where c.active), '[]'::jsonb);
end $$;

create or replace function public.claim_community_challenge(p_id text) returns int
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c public.coin_challenges;
  w record;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into c from public.coin_challenges where id = p_id and active;
  if not found then raise exception 'Reto inexistente' using errcode = '22023'; end if;
  select * into w from public._challenge_window(c.period);
  if public._challenge_progress(me, c.metric, w.since) < c.target then raise exception 'El reto aún no está cumplido' using errcode = 'P0001'; end if;
  begin
    insert into public.coin_challenge_claims (user_id, challenge_id, period_key) values (me, c.id, w.period_key);
  exception when unique_violation then
    raise exception 'Ya cobraste este reto' using errcode = 'P0001';
  end;
  perform public._earn(me, c.prize, 'challenge:' || c.id || ':' || w.period_key);
  return c.prize;
end $$;

-- ── 7. Tienda de monedas ────────────────────────────────────────────────────
create table if not exists public.coin_packages (
  id          text primary key check (id ~ '^[a-z_]+$'),
  label       text not null,
  price_cents int not null check (price_cents > 0),
  coins       int not null check (coins > 0),
  badge       text,
  active      boolean not null default true,
  sort        int not null default 0
);
-- $0.50 → 50 monedas (1 ¢ cada una) · $1.50 → 165 (+10 %) · $3.50 → 420 (+20 %)
insert into public.coin_packages (id, label, price_cents, coins, badge, sort) values
  ('mini', 'Recarga mini',   50,  50, null,           10),
  ('plus', 'Recarga plus',   150, 165, 'Más popular', 20),
  ('pro',  'Recarga pro',    350, 420, 'Mejor precio', 30)
on conflict (id) do nothing;

create table if not exists public.coin_settings (
  key   text primary key,
  value int not null
);
insert into public.coin_settings (key, value) values ('first_purchase_bonus_pct', 25) on conflict (key) do nothing;   -- +25 % de monedas en la primera compra

create table if not exists public.coin_payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  package_id   text not null references public.coin_packages (id),
  provider     text not null check (provider in ('payphone', 'paypal', 'prueba')),
  client_ref   text not null unique,                       -- identificador nuestro (clientTransactionId en PayPhone, custom_id en PayPal)
  provider_ref text,                                        -- identificador de la pasarela cuando se confirma
  amount_cents int not null check (amount_cents > 0),
  coins        int not null check (coins > 0),              -- monedas que se acreditan (incluye la bonificación)
  bonus_coins  int not null default 0 check (bonus_coins >= 0),
  currency     text not null default 'USD' check (currency = 'USD'),
  status       text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  raw          jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  paid_at      timestamptz
);
create unique index if not exists coin_payments_provider_ref_idx on public.coin_payments (provider, provider_ref) where provider_ref is not null;
create index if not exists coin_payments_user_idx on public.coin_payments (user_id, created_at desc);

alter table public.coin_packages enable row level security;
alter table public.coin_settings enable row level security;
alter table public.coin_payments enable row level security;
revoke all on public.coin_packages, public.coin_settings, public.coin_payments from anon, authenticated;
grant select on public.coin_packages to anon, authenticated;
grant select (id, user_id, package_id, provider, client_ref, amount_cents, coins, bonus_coins, currency, status, created_at, paid_at) on public.coin_payments to authenticated;
drop policy if exists coin_packages_select on public.coin_packages;
create policy coin_packages_select on public.coin_packages for select using (true);
drop policy if exists coin_payments_select on public.coin_payments;
create policy coin_payments_select on public.coin_payments for select to authenticated using (user_id = auth.uid());

-- Inicia una compra: deja un pago PENDIENTE con el importe y las monedas fijados por el servidor (el navegador no elige el precio).
create or replace function public.create_coin_payment(p_package text, p_provider text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  pk public.coin_packages;
  v_bonus int := 0;
  v_pct int;
  v_ref text := replace(gen_random_uuid()::text, '-', '');
  v_id uuid;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if p_provider not in ('payphone', 'paypal', 'prueba') then raise exception 'Pasarela no válida' using errcode = '22023'; end if;
  select * into pk from public.coin_packages where id = p_package and active;
  if not found then raise exception 'Paquete no disponible' using errcode = '22023'; end if;
  if (select count(*) from public.coin_payments where user_id = me and status = 'pending' and created_at > now() - interval '1 hour') >= 8 then
    raise exception 'Demasiados pagos pendientes: espera unos minutos' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.coin_payments where user_id = me and status = 'paid') then
    select value into v_pct from public.coin_settings where key = 'first_purchase_bonus_pct';
    v_bonus := floor(pk.coins * coalesce(v_pct, 0) / 100.0)::int;
  end if;
  insert into public.coin_payments (user_id, package_id, provider, client_ref, amount_cents, coins, bonus_coins)
  values (me, pk.id, p_provider, v_ref, pk.price_cents, pk.coins + v_bonus, v_bonus) returning id into v_id;
  return jsonb_build_object('id', v_id, 'client_ref', v_ref, 'package', pk.id, 'label', pk.label, 'amount_cents', pk.price_cents,
                            'coins', pk.coins + v_bonus, 'bonus_coins', v_bonus, 'provider', p_provider);
end $$;

-- Acredita un pago CONFIRMADO por la pasarela. Solo la ejecuta el servidor (service_role) tras verificar el pago con la pasarela.
-- Es idempotente (la pasarela puede avisar dos veces: retorno del navegador y webhook) y compara el importe con el fijado al crear el pago.
create or replace function public.credit_coin_payment(p_client_ref text, p_provider text, p_provider_ref text, p_amount_cents int, p_raw jsonb default '{}')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pay public.coin_payments;
begin
  select * into pay from public.coin_payments where client_ref = p_client_ref for update;
  if not found then raise exception 'Pago inexistente' using errcode = 'P0002'; end if;
  if pay.provider <> p_provider then raise exception 'La pasarela no coincide con la del pago' using errcode = '22023'; end if;
  if pay.status = 'paid' then
    return jsonb_build_object('ok', true, 'already', true, 'coins', pay.coins, 'user', pay.user_id);
  end if;
  if pay.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', 'status_' || pay.status); end if;
  if p_amount_cents is distinct from pay.amount_cents then
    update public.coin_payments set status = 'failed', raw = coalesce(p_raw, '{}') || jsonb_build_object('motivo', 'importe_distinto', 'recibido', p_amount_cents) where id = pay.id;
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  end if;
  begin
    update public.coin_payments set status = 'paid', provider_ref = p_provider_ref, paid_at = now(), raw = coalesce(p_raw, '{}') where id = pay.id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'provider_ref_reused');
  end;
  perform public._earn(pay.user_id, pay.coins, 'purchase:' || pay.package_id);
  perform public.notify(pay.user_id, 'recompensa', '🪙 +' || pay.coins || ' monedas',
    'Tu recarga de $' || to_char(pay.amount_cents / 100.0, 'FM990.00') || ' ya está en tu cuenta. ¡Gracias!', '/monedas',
    jsonb_build_object('payment', pay.id, 'kind', 'coin_purchase'));
  return jsonb_build_object('ok', true, 'already', false, 'coins', pay.coins, 'user', pay.user_id);
end $$;

-- Cierra un pago pendiente que no se completó (cancelado en la pasarela, rechazado o error al iniciar). Solo servidor.
create or replace function public.fail_coin_payment(p_client_ref text, p_status text, p_raw jsonb default '{}') returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('failed', 'cancelled') then raise exception 'Estado no válido' using errcode = '22023'; end if;
  update public.coin_payments set status = p_status, raw = coalesce(p_raw, '{}') where client_ref = p_client_ref and status = 'pending';
  return found;
end $$;

-- Regalo o compensación de monedas por un administrador (soporte, promociones, pruebas de la beta).
create or replace function public.admin_grant_coins(p_user uuid, p_amount int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if p_amount is null or p_amount not between 1 and 10000 then raise exception 'La cantidad debe estar entre 1 y 10000' using errcode = '22023'; end if;
  perform public._earn(p_user, p_amount, 'admin:' || left(coalesce(nullif(btrim(p_reason), ''), 'regalo'), 60));
end $$;

-- ── 8. Permisos ─────────────────────────────────────────────────────────────
grant execute on function
  public.boost_provider(uuid), public.community_challenges_status(), public.claim_community_challenge(text),
  public.create_coin_payment(text, text), public.admin_grant_coins(uuid, int, text)
  to authenticated;
grant execute on function public.credit_coin_payment(text, text, text, int, jsonb), public.fail_coin_payment(text, text, jsonb) to service_role;
revoke execute on function public.credit_coin_payment(text, text, text, int, jsonb), public.fail_coin_payment(text, text, jsonb) from public, anon, authenticated;
revoke execute on function
  public._charge(uuid, text, text), public._refund(uuid, text, int, text), public._orders_charge_buyer(), public._orders_status_coins(),
  public._requests_charge(), public._offers_charge(), public._events_charge(), public._reservations_charge(), public._reservations_refund(),
  public._messages_charge(), public._challenge_window(text), public._challenge_progress(uuid, text, timestamptz)
  from public, anon, authenticated;
