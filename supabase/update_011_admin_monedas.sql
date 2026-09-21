-- ============================================================================
-- ACTUALIZACIÓN 011 · Panel de administración de monedas
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización (con la 010): ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
--
-- Qué añade (todo solo para administradores: cada función comprueba `is_admin()` y, si no lo eres, falla con «Solo administradores»):
--   · admin_coin_stats(): ventas, compradores, monedas en circulación, de dónde salen y en qué se gastan, y la serie diaria.
--   · admin_coin_payments(): listado de pagos con filtro por estado y paginación.
--   · admin_update_price / admin_update_package / admin_set_setting / admin_update_challenge: ajustar tarifas, paquetes, la bonificación de
--     la primera compra y los retos SIN tocar SQL. Los cambios de precio solo afectan a compras nuevas (cada pago guarda su importe).
--   · admin_find_user / admin_user_coins / admin_adjust_coins: buscar a una persona, ver su saldo, usos, pagos y movimientos, y sumar o
--     restar monedas con un motivo.
--   · coin_admin_log: registro de auditoría de TODO lo anterior (quién, qué y el antes y el después).
-- ============================================================================

-- ── 1. Registro de auditoría ────────────────────────────────────────────────
create table if not exists public.coin_admin_log (
  id         bigint generated always as identity primary key,
  admin_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists coin_admin_log_created_idx on public.coin_admin_log (created_at desc);
alter table public.coin_admin_log enable row level security;
revoke all on public.coin_admin_log from anon, authenticated;   -- solo se lee con admin_coin_log()

create or replace function public._admin_log(p_action text, p_detail jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.coin_admin_log (admin_id, action, detail) values (auth.uid(), p_action, coalesce(p_detail, '{}'));
$$;

-- ── 2. Estadísticas ─────────────────────────────────────────────────────────
-- Los días se cuentan en hora de Ecuador (UTC-5 fijo). `p_days` se limita a 1–365.
create or replace function public.admin_coin_stats(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_dias int := greatest(1, least(coalesce(p_days, 30), 365));
  v_hoy date := ((now() at time zone 'UTC') - interval '5 hours')::date;
  v_desde date := v_hoy - (greatest(1, least(coalesce(p_days, 30), 365)) - 1);
  v_since timestamptz := (v_desde::timestamp + interval '5 hours') at time zone 'UTC';
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return jsonb_build_object(
    'dias', v_dias,
    'ventas', (select jsonb_build_object(
        'pagos', count(*) filter (where status = 'paid'),
        'centavos', coalesce(sum(amount_cents) filter (where status = 'paid'), 0),
        'monedas', coalesce(sum(coins) filter (where status = 'paid'), 0),
        'bonificadas', coalesce(sum(bonus_coins) filter (where status = 'paid'), 0),
        'pendientes', count(*) filter (where status = 'pending'),
        'fallidos', count(*) filter (where status = 'failed'),
        'cancelados', count(*) filter (where status = 'cancelled'))
      from public.coin_payments where created_at >= v_since),
    'por_pasarela', coalesce((select jsonb_agg(jsonb_build_object('pasarela', provider, 'pagos', n, 'centavos', c) order by c desc)
      from (select provider, count(*) n, sum(amount_cents) c from public.coin_payments where status = 'paid' and created_at >= v_since group by provider) t), '[]'),
    'por_paquete', coalesce((select jsonb_agg(jsonb_build_object('paquete', package_id, 'pagos', n, 'centavos', c) order by c desc)
      from (select package_id, count(*) n, sum(amount_cents) c from public.coin_payments where status = 'paid' and created_at >= v_since group by package_id) t), '[]'),
    'compradores', jsonb_build_object(
      'periodo', (select count(distinct user_id) from public.coin_payments where status = 'paid' and created_at >= v_since),
      'total', (select count(distinct user_id) from public.coin_payments where status = 'paid'),
      'repetidores', (select count(*) from (select user_id from public.coin_payments where status = 'paid' group by user_id having count(*) >= 2) r)),
    'ajustes', (select coalesce(jsonb_object_agg(key, value), '{}') from public.coin_settings),
    'usuarios', (select count(*) from public.profiles where not is_demo),
    'circulacion', (select coalesce(sum(w.coins), 0) from public.wallets w join public.profiles p on p.id = w.user_id where not p.is_demo),
    'emitidas', coalesce((select jsonb_object_agg(cat, total) from (
        select cat, sum(delta) total from (
          select case when reason like 'purchase:%' then 'compras'
                      when reason like 'challenge:%' or reason like 'daily:%' or reason like 'mission:%' then 'retos'
                      when reason in ('daily_checkin', 'wheel') then 'bonos'
                      when reason like 'referral%' or reason = 'referred_welcome' then 'invitaciones'
                      when reason like 'refund:%' then 'devoluciones'
                      when reason like 'admin:%' then 'admin'
                      else 'otros' end cat, delta
            from public.wallet_ledger where delta > 0 and created_at >= v_since) x
        group by cat) y), '{}'),
    'gastadas', coalesce((select jsonb_agg(jsonb_build_object('accion', accion, 'monedas', m, 'usos', n) order by m desc) from (
        select split_part(reason, ':', 2) accion, sum(-delta) m, count(*) n from public.wallet_ledger
         where reason like 'use:%' and delta < 0 and created_at >= v_since group by 1) g), '[]'),
    'diario', (select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'centavos', coalesce(v.c, 0), 'pagos', coalesce(v.n, 0)) order by d), '[]')
      from generate_series(v_desde, v_hoy, interval '1 day') g(d)
      left join (select ((paid_at at time zone 'UTC') - interval '5 hours')::date dia, sum(amount_cents) c, count(*) n
                   from public.coin_payments where status = 'paid' and paid_at >= v_since group by 1) v on v.dia = g.d::date));
end $$;

-- ── 3. Listado de pagos ─────────────────────────────────────────────────────
create or replace function public.admin_coin_payments(p_status text default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 100));
  v_offset int := greatest(0, coalesce(p_offset, 0));
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('pending', 'paid', 'failed', 'cancelled') then raise exception 'Estado no válido' using errcode = '22023'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.coin_payments where p_status is null or status = p_status),
    'items', coalesce((select jsonb_agg(t) from (
      select p.id, p.user_id, pr.display_name as persona, pr.handle, p.package_id as paquete, p.provider as pasarela, p.amount_cents as centavos, p.coins,
             p.bonus_coins as bonificadas, p.status as estado, p.provider_ref as ref_pasarela, p.client_ref, p.created_at, p.paid_at, p.raw ->> 'motivo' as motivo
        from public.coin_payments p join public.profiles pr on pr.id = p.user_id
       where p_status is null or p.status = p_status
       order by p.created_at desc limit v_limit offset v_offset) t), '[]'));
end $$;

-- ── 4. Ajustes de tarifas, paquetes, bonificación y retos ───────────────────
create or replace function public.admin_update_price(p_action text, p_free int, p_cost int, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  antes public.coin_prices;
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  select * into antes from public.coin_prices where action = p_action;
  if not found then raise exception 'Esa tarifa no existe' using errcode = 'P0002'; end if;
  if p_free is null or p_free not between 0 and 1000 then raise exception 'Los usos gratis deben estar entre 0 y 1000' using errcode = '22023'; end if;
  if p_cost is null or p_cost not between 0 and 100000 then raise exception 'El coste debe estar entre 0 y 100000 monedas' using errcode = '22023'; end if;
  update public.coin_prices set free_uses = p_free, cost = p_cost, active = coalesce(p_active, active) where action = p_action;
  perform public._admin_log('price', jsonb_build_object('action', p_action,
    'antes', jsonb_build_object('free', antes.free_uses, 'cost', antes.cost, 'active', antes.active),
    'despues', jsonb_build_object('free', p_free, 'cost', p_cost, 'active', coalesce(p_active, antes.active))));
end $$;

create or replace function public.admin_update_package(p_id text, p_label text, p_price_cents int, p_coins int, p_badge text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  antes public.coin_packages;
  v_label text := btrim(coalesce(p_label, ''));
  v_badge text := nullif(btrim(coalesce(p_badge, '')), '');
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if p_id is null or p_id !~ '^[a-z_]{2,20}$' then raise exception 'El identificador solo admite letras minúsculas y guion bajo (2–20)' using errcode = '22023'; end if;
  if char_length(v_label) not between 2 and 40 then raise exception 'El nombre debe tener entre 2 y 40 caracteres' using errcode = '22023'; end if;
  if v_badge is not null and char_length(v_badge) > 30 then raise exception 'La etiqueta admite como máximo 30 caracteres' using errcode = '22023'; end if;
  if p_price_cents is null or p_price_cents not between 10 and 100000 then raise exception 'El precio debe estar entre $0.10 y $1000.00' using errcode = '22023'; end if;
  if p_coins is null or p_coins not between 1 and 1000000 then raise exception 'Las monedas deben estar entre 1 y 1000000' using errcode = '22023'; end if;
  select * into antes from public.coin_packages where id = p_id;
  insert into public.coin_packages (id, label, price_cents, coins, badge, active, sort)
  values (p_id, v_label, p_price_cents, p_coins, v_badge, coalesce(p_active, true), coalesce((select max(sort) from public.coin_packages), 0) + 10)
  on conflict (id) do update set label = excluded.label, price_cents = excluded.price_cents, coins = excluded.coins, badge = excluded.badge, active = coalesce(p_active, public.coin_packages.active);
  perform public._admin_log(case when antes.id is null then 'package_new' else 'package' end, jsonb_build_object('id', p_id,
    'antes', case when antes.id is null then null else jsonb_build_object('label', antes.label, 'price_cents', antes.price_cents, 'coins', antes.coins, 'badge', antes.badge, 'active', antes.active) end,
    'despues', jsonb_build_object('label', v_label, 'price_cents', p_price_cents, 'coins', p_coins, 'badge', v_badge, 'active', coalesce(p_active, antes.active, true))));
end $$;

create or replace function public.admin_set_setting(p_key text, p_value int) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_antes int;
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if p_key not in ('first_purchase_bonus_pct') then raise exception 'Ese ajuste no existe' using errcode = 'P0002'; end if;
  if p_value is null or p_value not between 0 and 200 then raise exception 'La bonificación debe estar entre 0 y 200 %%' using errcode = '22023'; end if;
  select value into v_antes from public.coin_settings where key = p_key;
  insert into public.coin_settings (key, value) values (p_key, p_value) on conflict (key) do update set value = excluded.value;
  perform public._admin_log('setting', jsonb_build_object('key', p_key, 'antes', v_antes, 'despues', p_value));
end $$;

create or replace function public.admin_update_challenge(p_id text, p_target int, p_prize int, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  antes public.coin_challenges;
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  select * into antes from public.coin_challenges where id = p_id;
  if not found then raise exception 'Ese reto no existe' using errcode = 'P0002'; end if;
  if p_target is null or p_target not between 1 and 1000 then raise exception 'La meta debe estar entre 1 y 1000' using errcode = '22023'; end if;
  if p_prize is null or p_prize not between 1 and 10000 then raise exception 'El premio debe estar entre 1 y 10000 monedas' using errcode = '22023'; end if;
  update public.coin_challenges set target = p_target, prize = p_prize, active = coalesce(p_active, active) where id = p_id;
  perform public._admin_log('challenge', jsonb_build_object('id', p_id,
    'antes', jsonb_build_object('target', antes.target, 'prize', antes.prize, 'active', antes.active),
    'despues', jsonb_build_object('target', p_target, 'prize', p_prize, 'active', coalesce(p_active, antes.active))));
end $$;

-- ── 5. Personas: buscar, ver y ajustar saldo ────────────────────────────────
create or replace function public.admin_find_user(p_q text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := btrim(coalesce(p_q, ''));
  v_pat text;
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if char_length(v_q) < 2 then raise exception 'Escribe al menos 2 caracteres' using errcode = '22023'; end if;
  v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((select jsonb_agg(t) from (
    select p.id, p.display_name as nombre, p.handle, u.email, coalesce(w.coins, 0) as monedas
      from public.profiles p join auth.users u on u.id = p.id left join public.wallets w on w.user_id = p.id
     where p.display_name ilike v_pat or p.handle ilike v_pat or u.email ilike v_pat or p.id::text = v_q
     order by p.display_name limit 8) t), '[]');
end $$;

create or replace function public.admin_user_coins(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Persona inexistente' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'persona', (select jsonb_build_object('id', p.id, 'nombre', p.display_name, 'handle', p.handle, 'email', u.email, 'verificada', p.identity_verified, 'demo', p.is_demo)
                  from public.profiles p join auth.users u on u.id = p.id where p.id = p_user),
    'monedas', coalesce((select coins from public.wallets where user_id = p_user), 0),
    'usos', coalesce((select jsonb_agg(jsonb_build_object('accion', action, 'gratis', free_used, 'pagados', paid_used, 'gastadas', spent) order by action)
                        from public.coin_usage where user_id = p_user), '[]'),
    'pagos', coalesce((select jsonb_agg(t) from (
                select id, package_id as paquete, provider as pasarela, amount_cents as centavos, coins, status as estado, created_at
                  from public.coin_payments where user_id = p_user order by created_at desc limit 10) t), '[]'),
    'movimientos', coalesce((select jsonb_agg(t) from (
                select delta, reason as motivo, created_at from public.wallet_ledger where user_id = p_user order by created_at desc, id desc limit 30) t), '[]'));
end $$;

-- Suma (o resta, con signo negativo) monedas con un motivo obligatorio. Queda en el historial de la persona y en el registro de auditoría.
create or replace function public.admin_adjust_coins(p_user uuid, p_delta int, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_saldo int;
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10000 then raise exception 'El ajuste debe ser distinto de 0 y de 10000 monedas como máximo' using errcode = '22023'; end if;
  if char_length(v_reason) < 3 then raise exception 'Indica el motivo del ajuste' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Persona inexistente' using errcode = 'P0002'; end if;
  select coins into v_saldo from public.wallets where user_id = p_user for update;
  if p_delta > 0 then
    perform public._earn(p_user, p_delta, 'admin:' || left(v_reason, 60));
  else
    if coalesce(v_saldo, 0) < -p_delta then raise exception 'La persona solo tiene % monedas', coalesce(v_saldo, 0) using errcode = 'P0001'; end if;
    perform public._spend(p_user, -p_delta, 'admin_debit:' || left(v_reason, 60));
  end if;
  perform public._admin_log('adjust', jsonb_build_object('user', p_user, 'delta', p_delta, 'motivo', left(v_reason, 120), 'saldo_antes', v_saldo));
  return coalesce(v_saldo, 0) + p_delta;
end $$;

-- El regalo de la 010 también queda auditado (misma firma: la sustituye).
create or replace function public.admin_grant_coins(p_user uuid, p_amount int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if p_amount is null or p_amount not between 1 and 10000 then raise exception 'La cantidad debe estar entre 1 y 10000' using errcode = '22023'; end if;
  perform public._earn(p_user, p_amount, 'admin:' || left(coalesce(nullif(btrim(p_reason), ''), 'regalo'), 60));
  perform public._admin_log('grant', jsonb_build_object('user', p_user, 'delta', p_amount, 'motivo', left(coalesce(p_reason, ''), 120)));
end $$;

-- ── 6. Registro de auditoría (lectura) ──────────────────────────────────────
create or replace function public.admin_coin_log(p_limit int default 40) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(t) from (
    select l.id, l.action as accion, l.detail as detalle, l.created_at, pr.display_name as admin
      from public.coin_admin_log l left join public.profiles pr on pr.id = l.admin_id
     order by l.created_at desc, l.id desc limit greatest(1, least(coalesce(p_limit, 40), 200))) t), '[]');
end $$;

-- ── 7. Permisos ─────────────────────────────────────────────────────────────
grant execute on function
  public.admin_coin_stats(int), public.admin_coin_payments(text, int, int), public.admin_update_price(text, int, int, boolean),
  public.admin_update_package(text, text, int, int, text, boolean), public.admin_set_setting(text, int), public.admin_update_challenge(text, int, int, boolean),
  public.admin_find_user(text), public.admin_user_coins(uuid), public.admin_adjust_coins(uuid, int, text), public.admin_grant_coins(uuid, int, text),
  public.admin_coin_log(int)
  to authenticated;
revoke execute on function public._admin_log(text, jsonb) from public, anon, authenticated;
