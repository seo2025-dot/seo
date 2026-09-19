-- ============================================================================
-- Datos de demostración (GENERADO por supabase/seed/generate.ts — no editar a mano).
-- Ejecutar DESPUÉS de schema.sql, en el SQL Editor de Supabase. Los usuarios demo no pueden iniciar sesión.
-- ============================================================================

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'demo+u1@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lucía Ferrer"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'demo+u2@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Martín Sosa"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'demo+u3@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Carolina Vidal"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'demo+u4@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Andrés Molina"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'demo+u5@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Valeria Núñez"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'demo+u6@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Diego Paredes"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'demo+u7@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sofía Aguirre"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'demo+u8@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ricardo Beltrán"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'demo+u9@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Camila Rojas"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'demo+u10@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Javier Ortega"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'demo+u11@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Paula Herrera"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'demo+u12@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Tomás Iglesias"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'demo+u13@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nadia Campos"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'demo+u14@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Bruno Salvatierra"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000015', 'authenticated', 'authenticated', 'demo+u15@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Elena Quiroga"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000016', 'authenticated', 'authenticated', 'demo+u16@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marcos Duarte"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000017', 'authenticated', 'authenticated', 'demo+u17@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nicolás Ferro"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000018', 'authenticated', 'authenticated', 'demo+u18@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Renata Silva"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000019', 'authenticated', 'authenticated', 'demo+u19@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mariana Ortiz"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000020', 'authenticated', 'authenticated', 'demo+u20@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Gabriel Lima"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'demo+u21@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sebastián Vera"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'demo+u22@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Antonella Ríos"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000023', 'authenticated', 'authenticated', 'demo+u23@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mateo Blanco"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;

update public.profiles set display_name = 'Lucía Ferrer', handle = '@lucia.ferrer', bio = 'Anfitriona desde 2021. Me encanta que la gente encuentre un hogar donde sentirse bien.', location = 'Zona Norte',
  interests = array['anfitrion', 'inversor']::text[], zones = array['Zona Norte', 'Las Lomas']::text[], relations = array[]::text[], lifestyle = array[]::text[], budget = null,
  age = 38, sign = 'leo', professional = null, badges = array['superhost', 'respuesta-rapida', 'fundador']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.9, reviews_count = 48, response_rate = 98,
  avatar_url = 'https://i.pravatar.cc/400?img=45', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2021, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set display_name = 'Martín Sosa', handle = '@martin.sosa', bio = 'Alquileres céntricos, trato directo y sin sorpresas.', location = 'Centro',
  interests = array['anfitrion']::text[], zones = array['Centro']::text[], relations = array[]::text[], lifestyle = array[]::text[], budget = null,
  age = 41, sign = 'virgo', professional = null, badges = array['respuesta-rapida']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.7, reviews_count = 31, response_rate = 94,
  avatar_url = 'https://i.pravatar.cc/400?img=13', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2022, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000002';
update public.profiles set display_name = 'Carolina Vidal', handle = '@caro.vidal', bio = 'Terrenos y proyectos. Si buscas dónde construir, hablemos.', location = 'Zona Sur',
  interests = array['anfitrion', 'inversor']::text[], zones = array['Zona Sur', 'Valle Alto']::text[], relations = array[]::text[], lifestyle = array[]::text[], budget = null,
  age = 36, sign = 'capricornio', professional = null, badges = array['inversor-pro']::text[],
  identity_verified = true, phone_verified = true, email_verified = false,
  kyc_status = 'verified', rating = 4.6, reviews_count = 12, response_rate = 88,
  avatar_url = 'https://i.pravatar.cc/400?img=32', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2023, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000003';
update public.profiles set display_name = 'Andrés Molina', handle = '@andres.molina', bio = 'Propiedades premium, autos de colección y oportunidades de inversión.', location = 'Las Lomas',
  interests = array['anfitrion', 'inversor']::text[], zones = array['Las Lomas', 'Country Los Pinos']::text[], relations = array[]::text[], lifestyle = array[]::text[], budget = null,
  age = 44, sign = 'escorpio', professional = null, badges = array['superhost', 'inversor-pro']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.8, reviews_count = 57, response_rate = 96,
  avatar_url = 'https://i.pravatar.cc/400?img=8', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2020, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000004';
update public.profiles set display_name = 'Valeria Núñez', handle = '@vale.nunez', bio = 'Lofts y espacios con carácter en el casco histórico.', location = 'Barrio Histórico',
  interests = array['anfitrion']::text[], zones = array['Barrio Histórico', 'Centro']::text[], relations = array[]::text[], lifestyle = array[]::text[], budget = null,
  age = 33, sign = 'piscis', professional = null, badges = array['respuesta-rapida', 'vecino-activo']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.9, reviews_count = 22, response_rate = 99,
  avatar_url = 'https://i.pravatar.cc/400?img=36', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2023, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000005';
update public.profiles set display_name = 'Diego Paredes', handle = '@diego.paredes', bio = 'Departamentos con vista, motos y buena rentabilidad.', location = 'Puerto Nuevo',
  interests = array['anfitrion', 'inversor']::text[], zones = array['Puerto Nuevo']::text[], relations = array[]::text[], lifestyle = array[]::text[], budget = null,
  age = 39, sign = 'tauro', professional = null, badges = array['inversor-pro']::text[],
  identity_verified = true, phone_verified = false, email_verified = true,
  kyc_status = 'verified', rating = 4.5, reviews_count = 17, response_rate = 85,
  avatar_url = 'https://i.pravatar.cc/400?img=12', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2022, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000006';
update public.profiles set display_name = 'Sofía Aguirre', handle = '@sofi.aguirre', bio = 'Casas familiares en barrios cerrados. Mudanzas sin estrés.', location = 'Country Los Pinos',
  interests = array['anfitrion']::text[], zones = array['Country Los Pinos']::text[], relations = array[]::text[], lifestyle = array[]::text[], budget = null,
  age = 35, sign = 'cancer', professional = null, badges = array['superhost']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.8, reviews_count = 39, response_rate = 97,
  avatar_url = 'https://i.pravatar.cc/400?img=5', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2021, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000007';
update public.profiles set display_name = 'Ricardo Beltrán', handle = '@ricardo.beltran', bio = 'Residencias señoriales, transporte y patrimonio familiar.', location = 'Valle Alto',
  interests = array['anfitrion', 'inversor']::text[], zones = array['Valle Alto', 'Las Lomas']::text[], relations = array[]::text[], lifestyle = array[]::text[], budget = null,
  age = 52, sign = 'sagitario', professional = null, badges = array['inversor-pro', 'fundador']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.7, reviews_count = 26, response_rate = 90,
  avatar_url = 'https://i.pravatar.cc/400?img=18', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2020, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000008';
update public.profiles set display_name = 'Camila Rojas', handle = '@cami.rojas', bio = 'Diseñadora gráfica. Busco roomie tranquila, con buena onda y plantas 🌿.', location = 'Centro',
  interests = array['roomie', 'inquilino', 'amigos']::text[], zones = array['Centro', 'Barrio Histórico']::text[], relations = array['amistad', 'roomie']::text[], lifestyle = array['Creativa', 'Amante de las plantas', 'Foodie']::text[], budget = 'USD 400–600 / mes',
  age = 29, sign = 'geminis', professional = null, badges = array['roomie-ideal', 'vecino-activo']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.9, reviews_count = 8, response_rate = 95,
  avatar_url = 'https://i.pravatar.cc/400?img=26', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2024, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000009';
update public.profiles set display_name = 'Javier Ortega', handle = '@javi.ortega', bio = 'Primera vivienda en camino. Comparto lo que voy aprendiendo del proceso.', location = 'Zona Norte',
  interests = array['comprador', 'inversor']::text[], zones = array['Zona Norte', 'Puerto Nuevo']::text[], relations = array['pareja', 'socios']::text[], lifestyle = array['Deportista', 'Emprendedor', 'Viajero']::text[], budget = 'USD 150–250 mil',
  age = 32, sign = 'aries', professional = null, badges = array['explorador']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.6, reviews_count = 4, response_rate = 90,
  avatar_url = 'https://i.pravatar.cc/400?img=52', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2025, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000010';
update public.profiles set display_name = 'Paula Herrera', handle = '@pau.herrera', bio = 'Nueva en la ciudad. Busco gente para compartir depto y salir a descubrir barrios.', location = 'Puerto Nuevo',
  interests = array['amigos', 'roomie']::text[], zones = array['Centro', 'Puerto Nuevo']::text[], relations = array['amistad', 'pareja', 'roomie']::text[], lifestyle = array['Nocturna', 'Viajera', 'Mascotas']::text[], budget = 'USD 350–500 / mes',
  age = 27, sign = 'libra', professional = null, badges = array['explorador', 'respuesta-rapida']::text[],
  identity_verified = false, phone_verified = true, email_verified = true,
  kyc_status = 'none', rating = 4.8, reviews_count = 5, response_rate = 97,
  avatar_url = 'https://i.pravatar.cc/400?img=27', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2025, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000011';
update public.profiles set display_name = 'Tomás Iglesias', handle = '@tomas.iglesias', bio = 'Inversor en propiedades para renta. Busco socios para proyectos pequeños.', location = 'Zona Sur',
  interests = array['inversor']::text[], zones = array['Zona Sur', 'Valle Alto']::text[], relations = array['socios']::text[], lifestyle = array['Emprendedor', 'Lector', 'Casero']::text[], budget = 'USD 80–300 mil',
  age = 40, sign = 'tauro', professional = null, badges = array['inversor-pro']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.7, reviews_count = 14, response_rate = 86,
  avatar_url = 'https://i.pravatar.cc/400?img=60', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2022, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000012';
update public.profiles set display_name = 'Nadia Campos', handle = '@nadia.campos', bio = 'Familia de cuatro buscando casa con jardín. Fan de los barrios cerrados.', location = 'Las Lomas',
  interests = array['comprador', 'amigos']::text[], zones = array['Las Lomas', 'Country Los Pinos']::text[], relations = array['amistad']::text[], lifestyle = array['Familiar', 'Mascotas', 'Casera']::text[], budget = 'USD 300–450 mil',
  age = 37, sign = 'acuario', professional = null, badges = array['vecino-activo']::text[],
  identity_verified = true, phone_verified = true, email_verified = false,
  kyc_status = 'verified', rating = 4.5, reviews_count = 3, response_rate = 92,
  avatar_url = 'https://i.pravatar.cc/400?img=16', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2024, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000013';
update public.profiles set display_name = 'Bruno Salvatierra', handle = '@bruno.salva', bio = 'Desarrollador remoto. Roomie ordenado, cocino los domingos.', location = 'Centro',
  interests = array['roomie', 'inquilino']::text[], zones = array['Centro', 'Zona Norte']::text[], relations = array['roomie', 'amistad']::text[], lifestyle = array['Casero', 'Foodie', 'Gamer']::text[], budget = 'USD 450–700 / mes',
  age = 31, sign = 'virgo', professional = null, badges = array['roomie-ideal']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.9, reviews_count = 11, response_rate = 93,
  avatar_url = 'https://i.pravatar.cc/400?img=11', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2023, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000014';
update public.profiles set display_name = 'Elena Quiroga', handle = '@elena.foto', bio = 'Fotógrafa inmobiliaria: haz que tu propiedad se venda sola.', location = 'Centro',
  interests = array['amigos']::text[], zones = array['Centro', 'Zona Norte']::text[], relations = array['amistad', 'pareja']::text[], lifestyle = array['Creativa', 'Viajera', 'Deportista']::text[], budget = null,
  age = 34, sign = 'leo', professional = '{"headline":"Fotógrafa y video inmobiliario","skills":["Fotografía HDR","Drone","Tour 360°","Edición"],"portfolio":["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=75&auto=format&fit=crop","https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=75&auto=format&fit=crop","https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=75&auto=format&fit=crop"]}'::jsonb, badges = array['freelancer-top', 'respuesta-rapida']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 5, reviews_count = 64, response_rate = 99,
  avatar_url = 'https://i.pravatar.cc/400?img=47', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2021, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000015';
update public.profiles set display_name = 'Marcos Duarte', handle = '@marcos.arq', bio = 'Arquitecto: remodelaciones, planos y dirección de obra.', location = 'Zona Sur',
  interests = array['inversor']::text[], zones = array['Zona Sur', 'Valle Alto']::text[], relations = array['socios']::text[], lifestyle = array['Emprendedor', 'Lector']::text[], budget = null,
  age = 45, sign = 'capricornio', professional = '{"headline":"Arquitecto y director de obra","skills":["Planos","Remodelación","Render 3D","Permisos"],"portfolio":["https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&q=75&auto=format&fit=crop","https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&q=75&auto=format&fit=crop"]}'::jsonb, badges = array['freelancer-top']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.8, reviews_count = 37, response_rate = 92,
  avatar_url = 'https://i.pravatar.cc/400?img=53', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2020, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000016';
update public.profiles set display_name = 'Nicolás Ferro', handle = '@nico.plomero', bio = 'Plomería y gasfitería 24 h. Presupuesto sin cargo.', location = 'Zona Norte',
  interests = array['amigos']::text[], zones = array['Zona Norte', 'Centro']::text[], relations = array['amistad']::text[], lifestyle = array['Deportista', 'Familiar']::text[], budget = null,
  age = 42, sign = 'aries', professional = '{"headline":"Plomero matriculado","skills":["Fugas","Instalaciones","Calefones","Urgencias"],"portfolio":["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&q=75&auto=format&fit=crop"]}'::jsonb, badges = array['respuesta-rapida']::text[],
  identity_verified = true, phone_verified = true, email_verified = false,
  kyc_status = 'verified', rating = 4.7, reviews_count = 88, response_rate = 96,
  avatar_url = 'https://i.pravatar.cc/400?img=54', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2022, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000017';
update public.profiles set display_name = 'Renata Silva', handle = '@renata.legal', bio = 'Abogada inmobiliaria: escrituras, contratos y sucesiones.', location = 'Centro',
  interests = array['inversor']::text[], zones = array['Centro']::text[], relations = array['socios', 'amistad']::text[], lifestyle = array['Lectora', 'Viajera']::text[], budget = null,
  age = 39, sign = 'libra', professional = '{"headline":"Abogada especialista en derecho inmobiliario","skills":["Contratos","Escrituras","Due diligence","Sucesiones"],"portfolio":["https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&q=75&auto=format&fit=crop"]}'::jsonb, badges = array['freelancer-top']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.9, reviews_count = 52, response_rate = 94,
  avatar_url = 'https://i.pravatar.cc/400?img=9', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2021, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000018';
update public.profiles set display_name = 'Mariana Ortiz', handle = '@luna.tarot', bio = 'Tarotista y astróloga. Lecturas con cariño y sin promesas mágicas ✨', location = 'Barrio Histórico',
  interests = array['amigos']::text[], zones = array['Barrio Histórico']::text[], relations = array['amistad', 'pareja']::text[], lifestyle = array['Espiritual', 'Nocturna', 'Mascotas']::text[], budget = null,
  age = 35, sign = 'piscis', professional = '{"headline":"Tarotista y astróloga","skills":["Tarot","Carta astral","Sinastría","Retorno solar"],"portfolio":["https://images.unsplash.com/photo-1601158935942-52255782d322?w=600&q=75&auto=format&fit=crop"]}'::jsonb, badges = array['guia-astral', 'respuesta-rapida']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.9, reviews_count = 120, response_rate = 97,
  avatar_url = 'https://i.pravatar.cc/400?img=24', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2022, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000019';
update public.profiles set display_name = 'Gabriel Lima', handle = '@gabo.diseno', bio = 'Diseñador gráfico y de marca para negocios inmobiliarios.', location = 'Centro',
  interests = array['amigos']::text[], zones = array['Centro']::text[], relations = array['amistad', 'pareja', 'socios']::text[], lifestyle = array['Creativo', 'Gamer', 'Foodie']::text[], budget = null,
  age = 30, sign = 'geminis', professional = '{"headline":"Diseñador de marca y contenido","skills":["Logos","Branding","Redes sociales","Presentaciones"],"portfolio":["https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=75&auto=format&fit=crop"]}'::jsonb, badges = array['freelancer-top']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.8, reviews_count = 41, response_rate = 91,
  avatar_url = 'https://i.pravatar.cc/400?img=14', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2023, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000020';
update public.profiles set display_name = 'Sebastián Vera', handle = '@sebas.vera', bio = 'Amante de los viajes y del buen café. Busco conexión real, sin prisa.', location = 'Puerto Nuevo',
  interests = array['amigos', 'comprador']::text[], zones = array['Puerto Nuevo', 'Centro']::text[], relations = array['pareja', 'amistad']::text[], lifestyle = array['Viajero', 'Deportista', 'Foodie']::text[], budget = null,
  age = 33, sign = 'sagitario', professional = null, badges = array['explorador']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.7, reviews_count = 6, response_rate = 90,
  avatar_url = 'https://i.pravatar.cc/400?img=57', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2024, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000021';
update public.profiles set display_name = 'Antonella Ríos', handle = '@anto.rios', bio = 'Psicóloga, lectora y fan de las plantas. Busco algo bonito y honesto.', location = 'Barrio Histórico',
  interests = array['amigos', 'inquilino']::text[], zones = array['Barrio Histórico', 'Centro']::text[], relations = array['pareja']::text[], lifestyle = array['Lectora', 'Espiritual', 'Amante de las plantas']::text[], budget = null,
  age = 30, sign = 'escorpio', professional = null, badges = array['vecino-activo']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.9, reviews_count = 9, response_rate = 96,
  avatar_url = 'https://i.pravatar.cc/400?img=21', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2024, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000022';
update public.profiles set display_name = 'Mateo Blanco', handle = '@mateo.blanco', bio = 'Emprendedor serial. Busco socios y gente con ganas de construir cosas.', location = 'Zona Norte',
  interests = array['inversor', 'amigos']::text[], zones = array['Zona Norte', 'Las Lomas']::text[], relations = array['socios', 'amistad']::text[], lifestyle = array['Emprendedor', 'Viajero', 'Nocturno']::text[], budget = 'USD 50–200 mil',
  age = 34, sign = 'acuario', professional = null, badges = array['inversor-pro']::text[],
  identity_verified = true, phone_verified = true, email_verified = true,
  kyc_status = 'verified', rating = 4.6, reviews_count = 10, response_rate = 88,
  avatar_url = 'https://i.pravatar.cc/400?img=68', is_demo = true, onboarding_completed = true, created_at = make_timestamptz(2023, 3, 1, 0, 0, 0)
where id = '00000000-0000-4000-8000-000000000023';

insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, area, attrs, images, flash_discount, flash_until, created_at)
values ('a0000000-0000-4000-8000-00000000010a', '00000000-0000-4000-8000-000000000001', 'offer', 'property', 'sale', 'casa', 'Casa moderna con jardín', 'Amplia casa de dos plantas con jardín, garaje doble y acabados de primera calidad.', 320000, 'USD', 'Zona Norte', 220, '{"bedrooms":4,"bathrooms":3,"amenities":["Jardín","Garaje","Parrilla"]}'::jsonb, array['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '1 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, area, attrs, images, flash_discount, flash_until, created_at)
values ('a0000000-0000-4000-8000-00000000010b', '00000000-0000-4000-8000-000000000002', 'offer', 'property', 'rent', 'departamento', 'Departamento céntrico luminoso', 'Departamento de 2 ambientes con balcón, a pasos del transporte y comercios.', 850, 'USD', 'Centro', 68, '{"bedrooms":2,"bathrooms":1,"amenities":["Balcón","Wifi","Aire acondicionado"]}'::jsonb, array['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&q=80&auto=format&fit=crop']::text[], 10, date_trunc('day', now()) + interval '1 day', now() - interval '3 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, area, attrs, images, flash_discount, flash_until, created_at)
values ('a0000000-0000-4000-8000-00000000010c', '00000000-0000-4000-8000-000000000003', 'offer', 'property', 'sale', 'terreno', 'Terreno en zona residencial', 'Lote plano listo para construir, con todos los servicios y escritura al día.', 95000, 'USD', 'Zona Sur', 450, '{"bedrooms":0,"bathrooms":0,"amenities":["Servicios","Escritura al día"]}'::jsonb, array['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '12 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, area, attrs, images, flash_discount, flash_until, created_at)
values ('a0000000-0000-4000-8000-00000000010d', '00000000-0000-4000-8000-000000000004', 'offer', 'property', 'sale', 'villa', 'Villa contemporánea con piscina', 'Villa de diseño con piscina, amplios ventanales, cocina abierta y zona de barbacoa.', 540000, 'USD', 'Las Lomas', 380, '{"bedrooms":5,"bathrooms":4,"amenities":["Piscina","Parrilla","Garaje","Seguridad 24 h"]}'::jsonb, array['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '2 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, area, attrs, images, flash_discount, flash_until, created_at)
values ('a0000000-0000-4000-8000-00000000010e', '00000000-0000-4000-8000-000000000005', 'offer', 'property', 'rent', 'departamento', 'Loft de diseño con doble altura', 'Loft reformado con techos altos, mucha luz natural y cocina integrada. Ideal para una persona o pareja.', 1100, 'USD', 'Barrio Histórico', 75, '{"bedrooms":1,"bathrooms":1,"amenities":["Wifi","Amoblado","Pet friendly"]}'::jsonb, array['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '0 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, area, attrs, images, flash_discount, flash_until, created_at)
values ('a0000000-0000-4000-8000-00000000010f', '00000000-0000-4000-8000-000000000006', 'offer', 'property', 'sale', 'departamento', 'Departamento con vistas a la ciudad', 'Piso 14 con vistas despejadas, cochera y amenities: gimnasio, SUM y terraza.', 185000, 'USD', 'Puerto Nuevo', 92, '{"bedrooms":2,"bathrooms":2,"amenities":["Gimnasio","Terraza","Cochera"]}'::jsonb, array['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '6 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, area, attrs, images, flash_discount, flash_until, created_at)
values ('a0000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000000007', 'offer', 'property', 'rent', 'casa', 'Casa familiar en barrio cerrado', 'Casa de tres plantas en barrio cerrado con seguridad 24 h, parque y club house.', 2400, 'USD', 'Country Los Pinos', 260, '{"bedrooms":4,"bathrooms":3,"amenities":["Seguridad 24 h","Club house","Jardín","Pet friendly"]}'::jsonb, array['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '4 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, area, attrs, images, flash_discount, flash_until, created_at)
values ('a0000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000008', 'offer', 'property', 'sale', 'casa', 'Residencia clásica con gran parque', 'Residencia señorial rodeada de jardines, con galería, biblioteca y casa de huéspedes.', 890000, 'USD', 'Valle Alto', 620, '{"bedrooms":6,"bathrooms":5,"amenities":["Jardín","Casa de huéspedes","Biblioteca","Garaje"]}'::jsonb, array['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '9 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, attrs, images, flash_discount, flash_until, created_at)
values ('b0000000-0000-4000-8000-0000000028c2', '00000000-0000-4000-8000-000000000004', 'offer', 'vehicle', 'sale', 'auto', 'Coupé deportivo en excelente estado', 'Único dueño, servicios oficiales al día, interior cuero. Se acepta inspección mecánica.', 89000, 'USD', 'Las Lomas', '{"brand":"Porsche","model":"911","year":2018,"km":42000,"extras":["Cuero","Techo solar","Cámara trasera"]}'::jsonb, array['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&q=80&auto=format&fit=crop']::text[], 8, date_trunc('day', now()) + interval '1 day', now() - interval '2 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, attrs, images, flash_discount, flash_until, created_at)
values ('b0000000-0000-4000-8000-0000000028c3', '00000000-0000-4000-8000-000000000001', 'offer', 'vehicle', 'sale', 'auto', 'Sedán familiar económico', 'Muy bien cuidado, bajo consumo, papeles al día. Ideal primer auto o uso familiar.', 17500, 'USD', 'Zona Norte', '{"brand":"Toyota","model":"Corolla","year":2020,"km":58000,"extras":["Aire acondicionado","Bluetooth","Airbags"]}'::jsonb, array['https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '5 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, attrs, images, flash_discount, flash_until, created_at)
values ('b0000000-0000-4000-8000-0000000028c4', '00000000-0000-4000-8000-000000000002', 'offer', 'vehicle', 'rent', 'auto', 'Auto rojo para alquilar por día', 'Alquiler por día con seguro incluido. Depósito reembolsable. Entrega en el centro.', 45, 'USD', 'Centro', '{"brand":"Mazda","model":"3","year":2021,"km":30000,"extras":["Seguro incluido","Kilometraje libre"]}'::jsonb, array['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '1 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, attrs, images, flash_discount, flash_until, created_at)
values ('b0000000-0000-4000-8000-0000000028c5', '00000000-0000-4000-8000-000000000006', 'offer', 'vehicle', 'sale', 'moto', 'Moto de aventura lista para ruta', 'Muy poco uso, equipada con baúl y protectores. Permuta por auto pequeño.', 6200, 'USD', 'Puerto Nuevo', '{"brand":"Honda","model":"XR 300","year":2022,"km":12000,"extras":["Baúl","Protectores","Escape deportivo"]}'::jsonb, array['https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '3 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, attrs, images, flash_discount, flash_until, created_at)
values ('b0000000-0000-4000-8000-0000000028c6', '00000000-0000-4000-8000-000000000005', 'offer', 'vehicle', 'rent', 'moto', 'Scooter urbana en alquiler mensual', 'Perfecta para moverte por el centro. Incluye casco y seguro básico.', 160, 'USD', 'Barrio Histórico', '{"brand":"Vespa","model":"Primavera","year":2021,"km":9000,"extras":["Casco incluido","Seguro básico"]}'::jsonb, array['https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '0 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, attrs, images, flash_discount, flash_until, created_at)
values ('b0000000-0000-4000-8000-0000000028c7', '00000000-0000-4000-8000-000000000008', 'offer', 'vehicle', 'sale', 'transporte', 'Minibús turístico de 20 plazas', 'Habilitado para turismo, con aire y asientos reclinables. Ideal para emprendimiento de traslados.', 38000, 'USD', 'Valle Alto', '{"brand":"Mercedes-Benz","model":"Sprinter","year":2019,"km":120000,"extras":["Habilitación turística","Aire acondicionado","Baúl"]}'::jsonb, array['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=900&q=80&auto=format&fit=crop']::text[], null, null, now() - interval '7 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, attrs, images, created_at)
values ('c0000000-0000-4000-8000-0000000027ca', '00000000-0000-4000-8000-000000000002', 'offer', 'business', null, 'Gastronomía', 'Cafetería de especialidad en pleno centro', 'Local equipado con clientela fija y marca propia. Se vende por cambio de ciudad; incluye capacitación.', 45000, 'USD', 'Centro', '{"return":"18–24 meses"}'::jsonb, array['https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=900&q=80&auto=format&fit=crop']::text[], now() - interval '4 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, attrs, images, created_at)
values ('c0000000-0000-4000-8000-0000000027cb', '00000000-0000-4000-8000-000000000006', 'offer', 'business', null, 'Inmobiliario / Servicios', 'Coworking con 40 puestos, busca socio inversor', 'Espacio ya operativo con 70 % de ocupación. Buscamos socio para abrir una segunda sede.', 80000, 'USD', 'Puerto Nuevo', '{"return":"24–30 meses"}'::jsonb, array['https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&q=80&auto=format&fit=crop']::text[], now() - interval '8 days')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, attrs, images, created_at)
values ('c0000000-0000-4000-8000-0000000027cc', '00000000-0000-4000-8000-000000000001', 'offer', 'business', null, 'Servicios', 'Agencia de gestión de alquileres temporales', 'Cartera de 18 propiedades gestionadas. Se traspasa con procesos, marca y plataforma de reservas.', 25000, 'USD', 'Zona Norte', '{"return":"12–18 meses"}'::jsonb, array['https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=80&auto=format&fit=crop']::text[], now() - interval '6 days')
on conflict (id) do nothing;

insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, budget_max, currency, zone, min_area, created_at)
values ('d0000000-0000-4000-8000-000000002694', '00000000-0000-4000-8000-000000000014', 'demand', 'property', 'rent', 'departamento', 'Busco departamento en Centro', 'Busco depto de 2 ambientes en el centro, con wifi y cerca del transporte.', 900, 'USD', 'Centro', null, now() - interval '4 hours')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, budget_max, currency, zone, min_area, created_at)
values ('d0000000-0000-4000-8000-000000002695', '00000000-0000-4000-8000-000000000010', 'demand', 'property', 'sale', 'casa', 'Busco casa en Zona Norte', 'Primera casa, con jardín y cochera. Puedo cerrar en 30 días.', 350000, 'USD', 'Zona Norte', null, now() - interval '8 hours')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, budget_max, currency, zone, min_area, created_at)
values ('d0000000-0000-4000-8000-000000002696', '00000000-0000-4000-8000-000000000013', 'demand', 'property', 'rent', 'casa', 'Busco casa en Country', 'Familia de cuatro, buscamos barrio cerrado con seguridad.', 2500, 'USD', 'Country', null, now() - interval '12 hours')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, budget_max, currency, zone, min_area, created_at)
values ('d0000000-0000-4000-8000-000000002697', '00000000-0000-4000-8000-000000000012', 'demand', 'property', 'sale', 'terreno', 'Busco terreno en Zona Sur', 'Busco terreno de 400 m² o más para desarrollo.', 100000, 'USD', 'Zona Sur', 400, now() - interval '16 hours')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, budget_max, currency, zone, min_area, created_at)
values ('d0000000-0000-4000-8000-000000002698', '00000000-0000-4000-8000-000000000009', 'demand', 'property', 'rent', 'departamento', 'Busco departamento en Barrio Histórico', 'Busco loft o depto con carácter, pet friendly.', 1200, 'USD', 'Barrio Histórico', null, now() - interval '20 hours')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, budget_max, currency, zone, min_area, created_at)
values ('d0000000-0000-4000-8000-000000002699', '00000000-0000-4000-8000-000000000021', 'demand', 'vehicle', 'sale', 'auto', 'Busco auto', 'Sedán confiable y económico, hasta 70.000 km.', 20000, 'USD', '', null, now() - interval '24 hours')
on conflict (id) do nothing;
insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, budget_max, currency, zone, min_area, created_at)
values ('d0000000-0000-4000-8000-00000000269a', '00000000-0000-4000-8000-000000000011', 'demand', 'vehicle', 'rent', 'moto', 'Busco moto', 'Scooter para moverme por la ciudad un par de meses.', 200, 'USD', '', null, now() - interval '28 hours')
on conflict (id) do nothing;

insert into public.jobs (id, owner_id, kind, title, description, category, price_from, currency, delivery_days, image_url, sales_count)
values ('e0000000-0000-4000-8000-0000000026f1', '00000000-0000-4000-8000-000000000015', 'gig', 'Fotos profesionales HDR + tour 360° de tu propiedad', 'Sesión de hasta 25 fotos editadas y tour virtual. Entrega en 48 h.', 'fotografia', 120, 'USD', 2, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900&q=80&auto=format&fit=crop', 214)
on conflict (id) do nothing;
insert into public.jobs (id, owner_id, kind, title, description, category, price_from, currency, delivery_days, image_url, sales_count)
values ('e0000000-0000-4000-8000-0000000026f2', '00000000-0000-4000-8000-000000000016', 'gig', 'Planos y proyecto de remodelación', 'Relevamiento, planos y render 3D para tu remodelación o ampliación.', 'arquitectura', 350, 'USD', 10, 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=900&q=80&auto=format&fit=crop', 67)
on conflict (id) do nothing;
insert into public.jobs (id, owner_id, kind, title, description, category, price_from, currency, delivery_days, image_url, sales_count)
values ('e0000000-0000-4000-8000-0000000026f3', '00000000-0000-4000-8000-000000000017', 'gig', 'Reparación de fugas y revisión de instalaciones', 'Visita con diagnóstico y presupuesto sin cargo. Urgencias 24 h.', 'plomeria', 40, 'USD', 1, 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=900&q=80&auto=format&fit=crop', 530)
on conflict (id) do nothing;
insert into public.jobs (id, owner_id, kind, title, description, category, price_from, currency, delivery_days, image_url, sales_count)
values ('e0000000-0000-4000-8000-0000000026f4', '00000000-0000-4000-8000-000000000018', 'gig', 'Revisión legal de contrato de compraventa o alquiler', 'Análisis del contrato, riesgos y recomendaciones por escrito.', 'legal', 90, 'USD', 3, 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=900&q=80&auto=format&fit=crop', 143)
on conflict (id) do nothing;
insert into public.jobs (id, owner_id, kind, title, description, category, price_from, currency, delivery_days, image_url, sales_count)
values ('e0000000-0000-4000-8000-0000000026f5', '00000000-0000-4000-8000-000000000019', 'gig', 'Lectura de tarot y carta astral completa', 'Sesión de 45 min por videollamada o audio. Solo entretenimiento y orientación personal.', 'tarot', 30, 'USD', 1, 'https://images.unsplash.com/photo-1601158935942-52255782d322?w=900&q=80&auto=format&fit=crop', 380)
on conflict (id) do nothing;
insert into public.jobs (id, owner_id, kind, title, description, category, price_from, currency, delivery_days, image_url, sales_count)
values ('e0000000-0000-4000-8000-0000000026f6', '00000000-0000-4000-8000-000000000020', 'gig', 'Logo y kit de marca para tu inmobiliaria', 'Logo, paleta, tipografías y plantillas para redes en 5 días.', 'diseno', 180, 'USD', 5, 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=900&q=80&auto=format&fit=crop', 96)
on conflict (id) do nothing;
insert into public.jobs (id, owner_id, kind, title, description, job_type, modality, location, budget_text, skills, created_at)
values ('f0000000-0000-4000-8000-0000000026b3', '00000000-0000-4000-8000-000000000001', 'vacancy', 'Asesor/a inmobiliario/a remoto/a', 'Buscamos alguien con ganas de acompañar compradores y propietarios de principio a fin.', 'tiempo-completo', 'remoto', 'Zona Norte', 'USD 900–1.400 / mes + comisiones', array['Ventas', 'CRM', 'Atención al cliente']::text[], now() - interval '20 hours')
on conflict (id) do nothing;
insert into public.jobs (id, owner_id, kind, title, description, job_type, modality, location, budget_text, skills, created_at)
values ('f0000000-0000-4000-8000-0000000026b4', '00000000-0000-4000-8000-000000000004', 'vacancy', 'Fotógrafo/a de autos para catálogo', 'Sesión de 12 vehículos de colección. Se valora experiencia en fotografía automotriz.', 'proyecto', 'presencial', 'Las Lomas', 'USD 600 por proyecto', array['Fotografía', 'Edición', 'Vehículos']::text[], now() - interval '48 hours')
on conflict (id) do nothing;
insert into public.jobs (id, owner_id, kind, title, description, job_type, modality, location, budget_text, skills, created_at)
values ('f0000000-0000-4000-8000-0000000026b5', '00000000-0000-4000-8000-000000000006', 'vacancy', 'Community manager para coworking', 'Dinamizar la comunidad del coworking, organizar eventos y gestionar redes.', 'contrato', 'hibrido', 'Puerto Nuevo', 'USD 700 / mes (6 meses)', array['Redes sociales', 'Eventos', 'Diseño']::text[], now() - interval '72 hours')
on conflict (id) do nothing;
insert into public.jobs (id, owner_id, kind, title, description, job_type, modality, location, budget_text, skills, created_at)
values ('f0000000-0000-4000-8000-0000000026b6', '00000000-0000-4000-8000-000000000007', 'vacancy', 'Servicio de mudanzas y montaje de muebles', 'Buscamos equipo confiable para mudanzas de inquilinos en barrios cerrados.', 'contrato', 'presencial', 'Country Los Pinos', 'Por servicio (USD 80–200)', array['Logística', 'Montaje', 'Carga']::text[], now() - interval '120 hours')
on conflict (id) do nothing;
insert into public.jobs (id, owner_id, kind, title, description, job_type, modality, location, budget_text, skills, created_at)
values ('f0000000-0000-4000-8000-0000000026b7', '00000000-0000-4000-8000-000000000012', 'vacancy', 'Analista financiero/a para proyectos de inversión', 'Informes de rentabilidad y riesgo para pequeños desarrollos de 2 a 6 unidades.', 'proyecto', 'remoto', 'Zona Sur', 'USD 400 por informe', array['Excel', 'Flujo de caja', 'Mercado inmobiliario']::text[], now() - interval '144 hours')
on conflict (id) do nothing;

insert into public.posts (id, author_id, kind, body, zone, image_url, created_at)
values ('10000000-0000-4000-8000-0000125067ea', '00000000-0000-4000-8000-000000000004', 'propiedad', 'Nuestra villa en Las Lomas recién terminada: ventanales de piso a techo y piscina climatizada. Abierta a visitas este fin de semana 🏊', 'Las Lomas', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80&auto=format&fit=crop', now() - interval '35 minutes')
on conflict (id) do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ea', '00000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ea', '00000000-0000-4000-8000-000000000009') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ea', '00000000-0000-4000-8000-000000000013') on conflict do nothing;
insert into public.post_comments (id, post_id, author_id, body, created_at) values ('20000000-0000-4000-8000-000000002675', '10000000-0000-4000-8000-0000125067ea', '00000000-0000-4000-8000-000000000013', '¡Qué belleza! ¿Aceptan visitas con niños?', now() - interval '20 minutes') on conflict (id) do nothing;
insert into public.posts (id, author_id, kind, body, zone, image_url, created_at)
values ('10000000-0000-4000-8000-0000125067eb', '00000000-0000-4000-8000-000000000009', 'consulta', '¿Alguien vive en Barrio Histórico o Centro? Estoy evaluando mudarme y quiero saber cómo es el ruido de noche y el transporte 🚌', 'Barrio Histórico', null, now() - interval '120 minutes')
on conflict (id) do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067eb', '00000000-0000-4000-8000-000000000005') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067eb', '00000000-0000-4000-8000-000000000014') on conflict do nothing;
insert into public.post_comments (id, post_id, author_id, body, created_at) values ('20000000-0000-4000-8000-000000002676', '10000000-0000-4000-8000-0000125067eb', '00000000-0000-4000-8000-000000000005', 'Vivo en el casco histórico: de noche es tranquilo salvo viernes y sábado. El transporte es excelente.', now() - interval '90 minutes') on conflict (id) do nothing;
insert into public.post_comments (id, post_id, author_id, body, created_at) values ('20000000-0000-4000-8000-000000002677', '10000000-0000-4000-8000-0000125067eb', '00000000-0000-4000-8000-000000000014', 'En el Centro hay más movimiento, pero todo a mano. Si quieres te cuento más.', now() - interval '70 minutes') on conflict (id) do nothing;
insert into public.posts (id, author_id, kind, body, zone, image_url, created_at)
values ('10000000-0000-4000-8000-0000125067ec', '00000000-0000-4000-8000-000000000010', 'historia', 'Después de 8 meses buscando, ¡hoy firmé la reserva de mi primera casa! Consejo: visiten en distintos horarios, cambia todo 🏡', 'Zona Norte', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&q=80&auto=format&fit=crop', now() - interval '300 minutes')
on conflict (id) do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ec', '00000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ec', '00000000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ec', '00000000-0000-4000-8000-000000000009') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ec', '00000000-0000-4000-8000-000000000011') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ec', '00000000-0000-4000-8000-000000000013') on conflict do nothing;
insert into public.post_comments (id, post_id, author_id, body, created_at) values ('20000000-0000-4000-8000-000000002678', '10000000-0000-4000-8000-0000125067ec', '00000000-0000-4000-8000-000000000001', '¡Felicidades, Javi! Bienvenido al barrio 🎉', now() - interval '280 minutes') on conflict (id) do nothing;
insert into public.posts (id, author_id, kind, body, zone, image_url, created_at)
values ('10000000-0000-4000-8000-0000125067ed', '00000000-0000-4000-8000-000000000007', 'experiencia', 'Balance de 3 años como anfitriona: lo que más valoran los inquilinos es la comunicación rápida, más que cualquier amenity. Respondan en menos de 1 hora y verán la diferencia.', 'Country Los Pinos', null, now() - interval '540 minutes')
on conflict (id) do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ed', '00000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ed', '00000000-0000-4000-8000-000000000004') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ed', '00000000-0000-4000-8000-000000000005') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ed', '00000000-0000-4000-8000-000000000008') on conflict do nothing;
insert into public.posts (id, author_id, kind, body, zone, image_url, created_at)
values ('10000000-0000-4000-8000-0000125067ee', '00000000-0000-4000-8000-000000000012', 'consulta', 'Inversores: ¿cómo están viendo la rentabilidad en Zona Sur? Analizo comprar dos lotes para desarrollar y quiero contrastar números.', 'Zona Sur', null, now() - interval '1320 minutes')
on conflict (id) do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ee', '00000000-0000-4000-8000-000000000003') on conflict do nothing;
insert into public.post_comments (id, post_id, author_id, body, created_at) values ('20000000-0000-4000-8000-000000002679', '10000000-0000-4000-8000-0000125067ee', '00000000-0000-4000-8000-000000000003', 'Tengo un lote en venta ahí, te paso info por mensaje. La demanda de alquiler crece.', now() - interval '1200 minutes') on conflict (id) do nothing;
insert into public.posts (id, author_id, kind, body, zone, image_url, created_at)
values ('10000000-0000-4000-8000-0000125067ef', '00000000-0000-4000-8000-000000000005', 'propiedad', 'El loft del Barrio Histórico tiene nuevas fotos ✨ Luz natural todo el día y pet friendly.', 'Barrio Histórico', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80&auto=format&fit=crop', now() - interval '1800 minutes')
on conflict (id) do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ef', '00000000-0000-4000-8000-000000000009') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ef', '00000000-0000-4000-8000-000000000011') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067ef', '00000000-0000-4000-8000-000000000014') on conflict do nothing;
insert into public.posts (id, author_id, kind, body, zone, image_url, created_at)
values ('10000000-0000-4000-8000-0000125067f0', '00000000-0000-4000-8000-000000000011', 'historia', 'Llevo 2 semanas en Puerto Nuevo y ya conocí a tres vecinos gracias a la comunidad. ¡Qué bueno no empezar de cero! Si alguien quiere un café por la zona, avisen ☕', 'Puerto Nuevo', null, now() - interval '2880 minutes')
on conflict (id) do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067f0', '00000000-0000-4000-8000-000000000006') on conflict do nothing;
insert into public.post_likes (post_id, user_id) values ('10000000-0000-4000-8000-0000125067f0', '00000000-0000-4000-8000-000000000009') on conflict do nothing;

delete from public.notifications where user_id in (select id from public.profiles where is_demo);
