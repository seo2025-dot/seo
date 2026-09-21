-- ============================================================================
-- ACTUALIZACIÓN 009 · Eventos operables (cancelar con aviso, cambios de fecha) y topes en las solicitudes
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización (con la 008): ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
--
-- Qué cambia respecto a la 006:
--   · cancel_event(): el organizador cancela un evento (antes no podía: `status` no es editable por columna). Las reservas vigentes
--     pasan a «canceladas» y cada asistente recibe un aviso que lleva a «Mis entradas».
--   · Trigger de reprogramación: si el organizador cambia la fecha de inicio, quienes tienen una reserva vigente reciben un aviso.
--   · Un evento cancelado sigue siendo visible para quienes tenían una reserva (antes desaparecía por completo de «Mis entradas»).
--   · create_service_request(): los detalles de una solicitud no pueden superar 500 caracteres y el presupuesto cabe en numeric(10,2)
--     (antes fallaba con un error técnico o admitía un texto enorme).
-- ============================================================================

-- ── 1. Cancelar un evento ───────────────────────────────────────────────────
create or replace function public.cancel_event(p_event uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e public.events;
  r record;
  v_n int := 0;
begin
  if me is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  select ev.* into e from public.events ev join public.providers p on p.id = ev.provider_id
   where ev.id = p_event and p.owner_id = me and ev.status = 'published' for update of ev;
  if not found then raise exception 'No se puede cancelar ese evento' using errcode = 'P0001'; end if;
  update public.events set status = 'cancelled' where id = e.id;
  for r in
    update public.event_reservations set status = 'cancelled' where event_id = e.id and status = 'reserved' returning user_id, qty
  loop
    v_n := v_n + 1;
    perform public.notify(r.user_id, 'sistema', '⚠️ Se canceló «' || left(e.title, 60) || '»',
      'Tu reserva de ' || r.qty || case when r.qty = 1 then ' entrada' else ' entradas' end || ' quedó sin efecto.', '/directorio/entradas',
      jsonb_build_object('event', e.id, 'kind', 'event_cancelled'));
  end loop;
  return v_n;
end $$;

-- ── 2. Aviso al cambiar la fecha ────────────────────────────────────────────
create or replace function public._events_reschedule_notice() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and new.starts_at is distinct from old.starts_at then
    insert into public.notifications (user_id, type, title, body, href, data)
    select r.user_id, 'sistema', '📅 Cambió la fecha de «' || left(new.title, 60) || '»',
           'Revisa la nueva fecha y cancela tu reserva si ya no puedes asistir.', '/directorio/entradas',
           jsonb_build_object('event', new.id, 'kind', 'event_rescheduled')
      from (select distinct user_id from public.event_reservations where event_id = new.id and status = 'reserved') r;
  end if;
  return new;
end $$;
drop trigger if exists events_reschedule_notice on public.events;
create trigger events_reschedule_notice after update of starts_at on public.events for each row execute function public._events_reschedule_notice();

-- ── 3. Quien reservó sigue viendo el evento aunque se cancele ──────────────
-- events_select solo mostraba los publicados: al cancelarse, las personas con reserva perdían hasta el título. Como reservations_select
-- consulta events (para el organizador), esta política no puede consultar event_reservations directamente (recursión infinita de RLS):
-- se usa una función definidora que solo responde «¿tengo una reserva en este evento?».
create or replace function public._has_reservation_on(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_reservations where event_id = p_event and user_id = auth.uid());
$$;
grant execute on function public._has_reservation_on(uuid) to anon, authenticated;
drop policy if exists events_select on public.events;
create policy events_select on public.events for select using (
  status = 'published'
  or exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid())
  or (status = 'cancelled' and public._has_reservation_on(id)));

-- ── 4. Topes en las solicitudes ─────────────────────────────────────────────
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
  if octet_length(coalesce(p_details, '{}'::jsonb)::text) > 500 then raise exception 'Los detalles de la solicitud son demasiado largos' using errcode = '22023'; end if;
  if p_budget is not null and p_budget >= 100000000 then raise exception 'El presupuesto es demasiado alto' using errcode = '22023'; end if;
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

-- ── 5. Permisos ─────────────────────────────────────────────────────────────
grant execute on function public.cancel_event(uuid) to authenticated;
revoke execute on function public._events_reschedule_notice() from public, anon, authenticated;
