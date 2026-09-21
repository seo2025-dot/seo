-- ============================================================================
-- ACTUALIZACIÓN 014 · Avisos por correo al administrador y panel de administración fácil de usar
--
-- · Si ya aplicaste schema.sql ANTES de esta actualización (con la 013): ejecuta SOLO este archivo (SQL Editor > Run).
-- · Si vas a instalar desde cero: schema.sql ya incluye este contenido al final; no hace falta ejecutarlo aparte.
-- Es idempotente: se puede ejecutar más de una vez.
--
-- Qué añade:
--   · admin_alerts: cola («bandeja de salida») de avisos para el administrador. Un disparador escribe un aviso cuando alguien se REGISTRA,
--     cuando alguien REGISTRA UN NEGOCIO y cuando alguien ENVÍA su verificación de identidad (cédula y selfie). Un fallo al avisar nunca
--     impide el registro. El envío del correo lo hace el servidor de la app (ruta /api/avisos/procesar) leyendo esta cola.
--   · claim_admin_alerts() / finish_admin_alert(): solo las usa el servidor (service_role) para reservar avisos, enviarlos y marcarlos;
--     una reserva caduca a los 2 minutos y cada aviso se intenta como máximo 5 veces. Los perfiles demo no generan correo.
--   · admin_overview(): resumen para el panel /admin (registros, negocios, verificaciones pendientes y últimos movimientos).
--   · admin_kyc_queue(): cola de verificación de identidad con nombre, correo, edad y foto de perfil de cada persona.
-- ============================================================================

-- ── 1. Bandeja de avisos ────────────────────────────────────────────────────
create table if not exists public.admin_alerts (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('new_user', 'new_business', 'new_kyc')),
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  attempts   int not null default 0,
  claimed_at timestamptz,
  sent_at    timestamptz,
  last_error text
);
create index if not exists admin_alerts_pending_idx on public.admin_alerts (created_at) where sent_at is null;
alter table public.admin_alerts enable row level security;
-- Solo los administradores leen la bandeja (para ver si hay avisos sin enviar); nadie la escribe desde el navegador.
grant select on public.admin_alerts to authenticated;
drop policy if exists admin_alerts_select on public.admin_alerts;
create policy admin_alerts_select on public.admin_alerts for select to authenticated using (public.is_admin());

-- ── 2. Disparadores: registro, negocio y verificación ───────────────────────
create or replace function public._alert_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_alerts (kind, payload)
  values ('new_user', jsonb_build_object(
    'user_id', new.id,
    'name', new.display_name,
    'handle', new.handle,
    'email', (select u.email from auth.users u where u.id = new.id),
    'email_confirmed', new.email_verified,
    'role', 'usuario',
    'registered_at', new.created_at));
  return new;
exception when others then
  return new;   -- avisar nunca debe impedir el registro
end $$;
drop trigger if exists profiles_admin_alert on public.profiles;
create trigger profiles_admin_alert after insert on public.profiles for each row execute function public._alert_new_user();

create or replace function public._alert_new_business() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_alerts (kind, payload)
  values ('new_business', jsonb_build_object(
    'provider_id', new.id,
    'name', new.name,
    'slug', new.slug,
    'vertical', new.vertical,
    'subtype', new.subtype,
    'city', new.city,
    'country', new.country,
    'owner_id', new.owner_id,
    'owner_name', (select p.display_name from public.profiles p where p.id = new.owner_id),
    'owner_email', (select u.email from auth.users u where u.id = new.owner_id),
    'created_at', new.created_at));
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists providers_admin_alert on public.providers;
create trigger providers_admin_alert after insert on public.providers for each row execute function public._alert_new_business();

create or replace function public._alert_new_kyc() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_alerts (kind, payload)
  values ('new_kyc', jsonb_build_object(
    'submission_id', new.id,
    'user_id', new.user_id,
    'name', (select p.display_name from public.profiles p where p.id = new.user_id),
    'email', (select u.email from auth.users u where u.id = new.user_id),
    'created_at', new.created_at));
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists kyc_admin_alert on public.kyc_submissions;
create trigger kyc_admin_alert after insert on public.kyc_submissions for each row execute function public._alert_new_kyc();

-- ── 3. Cola de envío (solo el servidor, con la clave de servicio) ───────────
create or replace function public.claim_admin_alerts(p_limit int default 10) returns setof public.admin_alerts
language plpgsql security definer set search_path = public as $$
begin
  -- Las cuentas de demostración no generan correo.
  update public.admin_alerts a set sent_at = now(), last_error = 'demo'
   where a.sent_at is null and a.kind = 'new_user'
     and exists (select 1 from public.profiles p where p.id = (a.payload ->> 'user_id')::uuid and p.is_demo);
  return query
  with c as (
    select a.id from public.admin_alerts a
     where a.sent_at is null and a.attempts < 5
       and (a.claimed_at is null or a.claimed_at < now() - interval '2 minutes')
     order by a.created_at
     limit greatest(1, least(coalesce(p_limit, 10), 25))
     for update skip locked)
  update public.admin_alerts a set attempts = a.attempts + 1, claimed_at = now()
    from c where a.id = c.id
  returning a.*;
end $$;

create or replace function public.finish_admin_alert(p_id uuid, p_ok boolean, p_error text default null) returns void
language sql security definer set search_path = public as $$
  update public.admin_alerts
     set sent_at = case when p_ok then now() else null end,
         last_error = case when p_ok then null else left(coalesce(p_error, 'error'), 300) end,
         claimed_at = case when p_ok then claimed_at else null end
   where id = p_id;
$$;
revoke execute on function public.claim_admin_alerts(int), public.finish_admin_alert(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_admin_alerts(int), public.finish_admin_alert(uuid, boolean, text) to service_role;
revoke execute on function public._alert_new_user(), public._alert_new_business(), public._alert_new_kyc() from public, anon, authenticated;

-- ── 4. Panel de administración ──────────────────────────────────────────────
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users_total',      (select count(*)::int from public.profiles where not is_demo),
    'users_24h',        (select count(*)::int from public.profiles where not is_demo and created_at > now() - interval '24 hours'),
    'users_7d',         (select count(*)::int from public.profiles where not is_demo and created_at > now() - interval '7 days'),
    'businesses_total', (select count(*)::int from public.providers),
    'businesses_24h',   (select count(*)::int from public.providers where created_at > now() - interval '24 hours'),
    'businesses_7d',    (select count(*)::int from public.providers where created_at > now() - interval '7 days'),
    'kyc_pending',      (select count(*)::int from public.kyc_submissions where status = 'pending'),
    'alerts_unsent',    (select count(*)::int from public.admin_alerts where sent_at is null and attempts < 5),
    'alerts_failed',    (select count(*)::int from public.admin_alerts where sent_at is null and attempts >= 5),
    'recent_users', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select p.id, p.display_name as name, p.handle, u.email, p.created_at, p.kyc_status, p.onboarding_completed, p.country
          from public.profiles p left join auth.users u on u.id = p.id
         where not p.is_demo order by p.created_at desc limit 10) x), '[]'::jsonb),
    'recent_businesses', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select b.id, b.name, b.slug, b.vertical, b.subtype, b.city, b.country, b.status, b.created_at,
               o.display_name as owner_name, u.email as owner_email
          from public.providers b
          left join public.profiles o on o.id = b.owner_id
          left join auth.users u on u.id = b.owner_id
         order by b.created_at desc limit 10) x), '[]'::jsonb));
end $$;

create or replace function public.admin_kyc_queue(p_status text default 'pending', p_limit int default 50)
returns table (id uuid, user_id uuid, status text, reason text, created_at timestamptz, reviewed_at timestamptz, doc_path text, selfie_path text,
               display_name text, handle text, email text, age int, avatar_url text, location text, identity_verified boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('pending', 'approved', 'rejected', 'all') then raise exception 'Estado no válido' using errcode = '22023'; end if;
  return query
  select k.id, k.user_id, k.status, k.reason, k.created_at, k.reviewed_at, k.doc_path, k.selfie_path,
         p.display_name, p.handle, u.email::text, p.age, p.avatar_url, p.location, p.identity_verified
    from public.kyc_submissions k
    join public.profiles p on p.id = k.user_id
    left join auth.users u on u.id = k.user_id
   where p_status = 'all' or k.status = p_status
   order by (k.status = 'pending') desc,
            case when k.status = 'pending' then k.created_at end asc,
            k.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 100));
end $$;

revoke execute on function public.admin_overview(), public.admin_kyc_queue(text, int) from public, anon;
grant execute on function public.admin_overview(), public.admin_kyc_queue(text, int) to authenticated;
