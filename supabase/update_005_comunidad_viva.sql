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
