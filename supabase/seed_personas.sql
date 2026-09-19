-- ============================================================================
-- PERSONAS SIMULADAS (3) con 10 fotos cada una — GENERADO por supabase/seed/personas.ts
-- Requiere haber aplicado schema.sql (incluye la actualización 002: profile_photos). Es idempotente.
-- Son perfiles DEMO: no pueden iniciar sesión. Un administrador puede simularlas en /admin/personas.
-- ============================================================================

-- Persona 1: Valentina Cruz
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'demo+persona1@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Valentina Cruz"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
update public.user_private set birth_date = '1998-04-02' where user_id = '00000000-0000-4000-8000-000000000101';
update public.profiles set display_name = 'Valentina Cruz', handle = '@vale.cruz', bio = 'Diseñadora de interiores. Busco roomie ordenada y con buena onda; me encantan los mercados y cocinar los domingos.', location = 'Centro',
  interests = array['roomie', 'amigos']::text[], zones = array['Centro', 'Barrio Histórico']::text[], relations = array['amistad', 'roomie']::text[], lifestyle = array['Viajero', 'Foodie', 'Creativo']::text[],
  age = 28, sign = 'aries', avatar_url = 'https://picsum.photos/seed/valentina-cruz-1-0/240/300',
  email_verified = true, identity_verified = true, kyc_status = 'verified', is_demo = true, onboarding_completed = true
where id = '00000000-0000-4000-8000-000000000101';
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000101', 0, 'https://picsum.photos/seed/valentina-cruz-1-0/900/1200', 'https://picsum.photos/seed/valentina-cruz-1-0/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000101' and sort_order = 0);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000101', 1, 'https://picsum.photos/seed/valentina-cruz-1-1/900/1200', 'https://picsum.photos/seed/valentina-cruz-1-1/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000101' and sort_order = 1);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000101', 2, 'https://picsum.photos/seed/valentina-cruz-1-2/900/1200', 'https://picsum.photos/seed/valentina-cruz-1-2/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000101' and sort_order = 2);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000101', 3, 'https://picsum.photos/seed/valentina-cruz-1-3/900/1200', 'https://picsum.photos/seed/valentina-cruz-1-3/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000101' and sort_order = 3);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000101', 4, 'https://picsum.photos/seed/valentina-cruz-1-4/900/1200', 'https://picsum.photos/seed/valentina-cruz-1-4/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000101' and sort_order = 4);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000101', 5, 'https://picsum.photos/seed/valentina-cruz-1-5/900/1200', 'https://picsum.photos/seed/valentina-cruz-1-5/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000101' and sort_order = 5);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000101', 6, 'https://picsum.photos/seed/valentina-cruz-1-6/900/1200', 'https://picsum.photos/seed/valentina-cruz-1-6/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000101' and sort_order = 6);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000101', 7, 'https://picsum.photos/seed/valentina-cruz-1-7/900/1200', 'https://picsum.photos/seed/valentina-cruz-1-7/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000101' and sort_order = 7);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000101', 8, 'https://picsum.photos/seed/valentina-cruz-1-8/900/1200', 'https://picsum.photos/seed/valentina-cruz-1-8/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000101' and sort_order = 8);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000101', 9, 'https://picsum.photos/seed/valentina-cruz-1-9/900/1200', 'https://picsum.photos/seed/valentina-cruz-1-9/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000101' and sort_order = 9);

-- Persona 2: Mateo Salinas
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'demo+persona2@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mateo Salinas"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
update public.user_private set birth_date = '1991-11-18' where user_id = '00000000-0000-4000-8000-000000000102';
update public.profiles set display_name = 'Mateo Salinas', handle = '@mateo.salinas', bio = 'Ingeniero y futuro propietario. Comparto lo que voy aprendiendo sobre hipotecas y busco socios para pequeñas inversiones.', location = 'Zona Norte',
  interests = array['comprador', 'inversor']::text[], zones = array['Zona Norte', 'Las Lomas']::text[], relations = array['pareja', 'socios']::text[], lifestyle = array['Deportista', 'Emprendedor']::text[],
  age = 35, sign = 'escorpio', avatar_url = 'https://picsum.photos/seed/mateo-salinas-2-0/240/300',
  email_verified = true, identity_verified = true, kyc_status = 'verified', is_demo = true, onboarding_completed = true
where id = '00000000-0000-4000-8000-000000000102';
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000102', 0, 'https://picsum.photos/seed/mateo-salinas-2-0/900/1200', 'https://picsum.photos/seed/mateo-salinas-2-0/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000102' and sort_order = 0);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000102', 1, 'https://picsum.photos/seed/mateo-salinas-2-1/900/1200', 'https://picsum.photos/seed/mateo-salinas-2-1/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000102' and sort_order = 1);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000102', 2, 'https://picsum.photos/seed/mateo-salinas-2-2/900/1200', 'https://picsum.photos/seed/mateo-salinas-2-2/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000102' and sort_order = 2);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000102', 3, 'https://picsum.photos/seed/mateo-salinas-2-3/900/1200', 'https://picsum.photos/seed/mateo-salinas-2-3/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000102' and sort_order = 3);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000102', 4, 'https://picsum.photos/seed/mateo-salinas-2-4/900/1200', 'https://picsum.photos/seed/mateo-salinas-2-4/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000102' and sort_order = 4);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000102', 5, 'https://picsum.photos/seed/mateo-salinas-2-5/900/1200', 'https://picsum.photos/seed/mateo-salinas-2-5/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000102' and sort_order = 5);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000102', 6, 'https://picsum.photos/seed/mateo-salinas-2-6/900/1200', 'https://picsum.photos/seed/mateo-salinas-2-6/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000102' and sort_order = 6);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000102', 7, 'https://picsum.photos/seed/mateo-salinas-2-7/900/1200', 'https://picsum.photos/seed/mateo-salinas-2-7/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000102' and sort_order = 7);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000102', 8, 'https://picsum.photos/seed/mateo-salinas-2-8/900/1200', 'https://picsum.photos/seed/mateo-salinas-2-8/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000102' and sort_order = 8);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000102', 9, 'https://picsum.photos/seed/mateo-salinas-2-9/900/1200', 'https://picsum.photos/seed/mateo-salinas-2-9/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000102' and sort_order = 9);

-- Persona 3: Lucía Andrade
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'demo+persona3@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lucía Andrade"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
update public.user_private set birth_date = '1995-08-27' where user_id = '00000000-0000-4000-8000-000000000103';
update public.profiles set display_name = 'Lucía Andrade', handle = '@lucia.andrade', bio = 'Psicóloga y amante de los gatos. Alquilando cerca del puerto; busco planes tranquilos, buenos libros y gente sincera.', location = 'Puerto Nuevo',
  interests = array['inquilino', 'amigos']::text[], zones = array['Puerto Nuevo', 'Centro']::text[], relations = array['pareja', 'amistad']::text[], lifestyle = array['Lector', 'Mascotas', 'Espiritual']::text[],
  age = 31, sign = 'virgo', avatar_url = 'https://picsum.photos/seed/lucia-andrade-3-0/240/300',
  email_verified = true, identity_verified = true, kyc_status = 'verified', is_demo = true, onboarding_completed = true
where id = '00000000-0000-4000-8000-000000000103';
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000103', 0, 'https://picsum.photos/seed/lucia-andrade-3-0/900/1200', 'https://picsum.photos/seed/lucia-andrade-3-0/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000103' and sort_order = 0);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000103', 1, 'https://picsum.photos/seed/lucia-andrade-3-1/900/1200', 'https://picsum.photos/seed/lucia-andrade-3-1/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000103' and sort_order = 1);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000103', 2, 'https://picsum.photos/seed/lucia-andrade-3-2/900/1200', 'https://picsum.photos/seed/lucia-andrade-3-2/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000103' and sort_order = 2);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000103', 3, 'https://picsum.photos/seed/lucia-andrade-3-3/900/1200', 'https://picsum.photos/seed/lucia-andrade-3-3/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000103' and sort_order = 3);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000103', 4, 'https://picsum.photos/seed/lucia-andrade-3-4/900/1200', 'https://picsum.photos/seed/lucia-andrade-3-4/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000103' and sort_order = 4);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000103', 5, 'https://picsum.photos/seed/lucia-andrade-3-5/900/1200', 'https://picsum.photos/seed/lucia-andrade-3-5/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000103' and sort_order = 5);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000103', 6, 'https://picsum.photos/seed/lucia-andrade-3-6/900/1200', 'https://picsum.photos/seed/lucia-andrade-3-6/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000103' and sort_order = 6);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000103', 7, 'https://picsum.photos/seed/lucia-andrade-3-7/900/1200', 'https://picsum.photos/seed/lucia-andrade-3-7/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000103' and sort_order = 7);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000103', 8, 'https://picsum.photos/seed/lucia-andrade-3-8/900/1200', 'https://picsum.photos/seed/lucia-andrade-3-8/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000103' and sort_order = 8);
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)
select '00000000-0000-4000-8000-000000000103', 9, 'https://picsum.photos/seed/lucia-andrade-3-9/900/1200', 'https://picsum.photos/seed/lucia-andrade-3-9/240/300', 900, 1200, 'image/jpeg'
where not exists (select 1 from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000103' and sort_order = 9);
