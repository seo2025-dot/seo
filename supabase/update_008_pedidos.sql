-- ============================================================================
-- ACTUALIZACIÓN 008 · Pedidos operables: teléfono para la entrega, caducidad y avisos que llevan al pedido
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización (con la 007): ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
--
-- Qué cambia respecto a la 006 (place_order y set_order_status; el resto del sistema de pedidos no se toca):
--   · orders.customer_phone → los pedidos a domicilio exigen un teléfono para que el repartidor pueda llamar. Solo lo ven la persona
--     que pide y el negocio (mismas reglas de acceso que el resto del pedido).
--   · Caducidad: un pedido que nadie responde en 3 horas se cancela solo (con mensaje en el chat) y deja de ocupar uno de los
--     5 cupos de «pedidos sin responder». Se aplica al pedir y con expire_stale_orders() al abrir las bandejas.
--   · Los avisos apuntan a la pantalla del pedido (/directorio/pedidos/<id>) en vez de al chat.
--   · En pedidos para retirar, los avisos dicen «listo para retirar» y «retirado» en vez de «va en camino» y «entregado».
-- ============================================================================

-- ── 1. Teléfono del cliente ─────────────────────────────────────────────────
alter table public.orders
  add column if not exists customer_phone text
    check (customer_phone is null or customer_phone ~ '^\+?[0-9][0-9 ()-]{6,19}$');

-- ── 2. Caducidad de pedidos sin respuesta ───────────────────────────────────
-- Cancela los pedidos «enviados» hace más de 3 horas en los que participa esa persona (como cliente o como negocio).
create or replace function public._expire_stale_orders(p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int := 0;
  r record;
begin
  for r in
    update public.orders set status = 'cancelled'
     where status = 'placed' and created_at < now() - interval '3 hours' and (customer_id = p_user or provider_owner_id = p_user)
    returning id, chat_id
  loop
    v_n := v_n + 1;
    if r.chat_id is not null then
      insert into public.messages (chat_id, sender_id, kind, body)
      values (r.chat_id, null, 'system', '⌛ El negocio no respondió a tiempo: el pedido se canceló.');
    end if;
  end loop;
  return v_n;
end $$;

create or replace function public.expire_stale_orders() returns int
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  return public._expire_stale_orders(auth.uid());
end $$;

-- ── 3. place_order con teléfono ─────────────────────────────────────────────
-- Cambia la lista de parámetros (se añade p_phone): hay que eliminar la versión anterior.
drop function if exists public.place_order(uuid, text, jsonb, text, text, text, text);

-- El cliente NUNCA envía precios: solo qué producto y cuántas unidades; el servidor calcula todo.
create or replace function public.place_order(
  p_provider uuid, p_kind text, p_lines jsonb, p_address text default '', p_zone text default '', p_notes text default '', p_payment text default 'cash',
  p_phone text default null
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
  v_tel text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select * into pr from public.providers where id = p_provider and status = 'active';
  if not found then raise exception 'Este perfil no está disponible' using errcode = 'P0002'; end if;
  if pr.owner_id = me then raise exception 'No puedes hacerte un pedido a ti mismo' using errcode = 'P0001'; end if;
  if pr.vertical not in ('delivery', 'salud', 'mascotas') then raise exception 'Este perfil no recibe pedidos' using errcode = '22023'; end if;
  if p_kind not in ('delivery', 'pickup') then raise exception 'Tipo de pedido no válido' using errcode = '22023'; end if;
  if p_payment not in ('cash', 'transfer') then raise exception 'Forma de pago no válida' using errcode = '22023'; end if;
  if v_tel is not null and v_tel !~ '^\+?[0-9][0-9 ()-]{6,19}$' then raise exception 'Escribe un teléfono válido' using errcode = '22023'; end if;
  if p_kind = 'delivery' and v_tel is null then raise exception 'Indica un teléfono para que puedan llamarte al entregar' using errcode = '22023'; end if;
  if p_kind = 'delivery' and not ('entrega' = any (pr.channels)) then raise exception 'Este perfil no entrega a domicilio' using errcode = 'P0001'; end if;
  if p_kind = 'delivery' and char_length(btrim(coalesce(p_address, ''))) < 5 then raise exception 'Indica la dirección de entrega' using errcode = '22023'; end if;
  if p_kind = 'pickup' and not (pr.channels && array['retiro', 'local']) then raise exception 'Este perfil no ofrece retiro en el local' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 30 then
    raise exception 'El pedido debe tener entre 1 y 30 productos' using errcode = '22023';
  end if;
  perform public._expire_stale_orders(me);   -- los pedidos sin respuesta durante 3 horas se cancelan solos y no ocupan cupo
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
                             payment_method, address, zone, notes, customer_phone)
  values (v_id, pr.id, pr.owner_id, pr.name, me, p_kind, v_sub, v_fee, v_sub + v_fee, p_payment,
          left(btrim(coalesce(p_address, '')), 200), left(btrim(coalesce(p_zone, '')), 80), left(btrim(coalesce(p_notes, '')), 300), v_tel);
  insert into public.order_lines (order_id, line_no, item_id, name, unit_price, qty)
  select v_id, t.n, (t.l ->> 'item')::uuid, t.l ->> 'name', (t.l ->> 'price')::numeric, (t.l ->> 'qty')::int
    from jsonb_array_elements(v_lines) with ordinality as t (l, n);

  select split_part(btrim(display_name), ' ', 1) into v_cliente from public.profiles where id = me;
  v_chat := public._ensure_chat('direct', 'order:' || v_id, null, null, null, me, pr.owner_id,
    'Pedido a ' || pr.name || ' por ' || trim_scale(v_sub + v_fee) || ' USD. Coordinen aquí la entrega y el pago.');
  update public.orders set chat_id = v_chat where id = v_id;
  perform public.notify(pr.owner_id, 'sistema', '🛍️ Nuevo pedido de ' || coalesce(v_cliente, 'un cliente'),
    jsonb_array_length(v_lines) || ' producto(s) · ' || trim_scale(v_sub + v_fee) || ' USD', '/directorio/pedidos/' || v_id,
    jsonb_build_object('order', v_id, 'kind', 'order'));
  return v_id;
end $$;

-- ── 4. set_order_status: textos de retiro y avisos hacia el pedido ────────────
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
    when 'accepted' then '✅ Pedido aceptado' when 'preparing' then '👨‍🍳 Tu pedido se está preparando'
    when 'on_the_way' then case when o.kind = 'pickup' then '📦 Tu pedido está listo para retirar' else '🛵 Tu pedido va en camino' end
    when 'delivered' then case when o.kind = 'pickup' then '🎉 Pedido retirado' else '🎉 Pedido entregado' end
    when 'rejected' then '❌ El negocio no pudo aceptar tu pedido' else '🚫 El cliente canceló el pedido' end;
  if o.chat_id is not null then insert into public.messages (chat_id, sender_id, kind, body) values (o.chat_id, null, 'system', v_texto); end if;
  perform public.notify(v_dest, 'sistema', v_texto, o.provider_name, '/directorio/pedidos/' || o.id,
    jsonb_build_object('order', o.id, 'kind', 'order_status'));
end $$;

-- ── 5. Privilegios de ejecución ─────────────────────────────────────────────
grant execute on function public.place_order(uuid, text, jsonb, text, text, text, text, text), public.expire_stale_orders() to authenticated;
revoke execute on function public._expire_stale_orders(uuid) from public, anon, authenticated;
