-- ============================================================================
-- PERSONAS SIMULADAS (5) — GENERADO por supabase/seed/personas.ts; no lo edites a mano.
-- Personas 1–5: Cuenca, Quito y Guayaquil, con retrato y escenas de su ciudad. Personas 6+: relleno de pruebas de carga.
-- Requiere schema.sql con las actualizaciones 002 (fotos) y 003 (universidad, colegio, estatura, pareja ideal).
-- Es idempotente y atómico (una sola transacción): si algo falla no queda nada a medias.
-- Son perfiles DEMO: no pueden iniciar sesión. Un administrador puede simularlas en /admin/personas.
--
-- Créditos de las imágenes: retratos de pravatar.cc; escenas de Wikimedia Commons con licencia libre:
--   cuenca-catedral: Bernard Gagnon (CC BY-SA 3.0) https://commons.wikimedia.org/wiki/File:Catedral_de_la_Inmaculada_Concepci%C3%B3n,_Cuenca.jpg
--   cuenca-tomebamba: Martín Vasco (CC BY-SA 4.0) https://commons.wikimedia.org/wiki/File:R%C3%ADo_Tomebamba_desde_el_Paseo_3_de_Noviembre,_Cuenca.jpg
--   cuenca-turi-cafe: Arabsalam (CC BY 4.0) https://commons.wikimedia.org/wiki/File:Mirador_de_Turi_Ecuador_1739.jpg
--   cuenca-arcos: Bernard Gagnon (CC BY-SA 3.0) https://commons.wikimedia.org/wiki/File:Catedral_de_la_Inmaculada_Concepci%C3%B3n,_Cuenca_04.jpg
--   cuenca-turi-mirador: Arabsalam (CC BY 4.0) https://commons.wikimedia.org/wiki/File:Mirador_de_Turi_Ecuador_1736.jpg
--   cuenca-turi-valle: Arabsalam (CC BY 4.0) https://commons.wikimedia.org/wiki/File:Mirador_de_Turi_Ecuador_1742.jpg
--   cuenca-rio-piedras: Martin.vascovinueza (CC BY-SA 4.0) https://commons.wikimedia.org/wiki/File:Rio_Tomebamba_con_un_caudal_bajo_durante_el_estiaje_de_2024.jpg
--   cuenca-turi-panoramica: PAULOGARCIA2005 (CC BY 3.0) https://commons.wikimedia.org/wiki/File:Panor%C3%A1mica_desde_Turi_de_Cuenca_(Ecuador)_2.jpg
--   quito-floresta: Theodore.shouse (CC BY 4.0) https://commons.wikimedia.org/wiki/File:Motorcycle_in_La_Floresta,_Quito.jpg
--   quito-garcia-moreno: Cayambe (CC BY-SA 3.0) https://commons.wikimedia.org/wiki/File:Quito_calle_Garc%C3%ADa_Moreno.jpg
--   quito-santo-domingo: Diego Delso (CC BY-SA 4.0) https://commons.wikimedia.org/wiki/File:Iglesia_de_Santo_Domingo,_Quito,_Ecuador,_2015-07-22,_DD_202-204_HDR.JPG
--   quito-atardecer: Cristian Paliz (CC BY-SA 3.0) https://commons.wikimedia.org/wiki/File:Llovizna_al_atardecer_-_panoramio.jpg
--   quito-teleferico-vista: David Berkowitz (CC BY 2.0) https://commons.wikimedia.org/wiki/File:Telef%C3%A9riQo_views_of_mountains_and_Quito_-_Ecuador_-_South_America.jpg
--   quito-gondolas: AndrewDressel (CC BY-SA 4.0) https://commons.wikimedia.org/wiki/File:Gondolas_of_the_TeleferiQo_in_Quito,_Ecuador.jpg
--   quito-biblioteca: Diego Delso (CC BY-SA 4.0) https://commons.wikimedia.org/wiki/File:Museo_de_la_Catedral_de_Quito,_Quito,_Ecuador,_2015-07-22,_DD_94-96_HDR.JPG
--   quito-estacion: AndrewDressel (CC BY-SA 4.0) https://commons.wikimedia.org/wiki/File:Top_station_of_the_TeleferiQo_in_Quito,_Ecuador.jpg
--   gye-puerto-santa-ana: Unknown authorUnknown author (CC0) https://commons.wikimedia.org/wiki/File:Puerto_Santa_Ana._Guayaquil,_Guayas,_Ecuador.jpg
--   gye-callejones: Sageo (CC BY-SA 3.0) https://commons.wikimedia.org/wiki/File:SageoEG_-_Puerto_Santa_Ana_-_Callejones_06.jpg
--   gye-malecon: Freddy eduardo (CC BY-SA 4.0) https://commons.wikimedia.org/wiki/File:Vista_del_Malec%C3%B3n_2000.jpg
--   gye-las-penas: Epiovesan (CC BY 3.0) https://commons.wikimedia.org/wiki/File:Abril_2005_029.jpg
--   gye-capilla: Edjoerv (CC BY-SA 4.0) https://commons.wikimedia.org/wiki/File:Capilla_Santa_Ana_desde_el_Faro.JPG
-- ============================================================================

begin;

-- Persona 1: Emilia Vintimilla
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'demo+persona1@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Emilia Vintimilla"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
update public.user_private set birth_date = '1994-10-08', ideal_partner = 'Una persona de mirada serena y palabra honesta, que sepa escuchar sin apuro y quiera crecer conmigo, no competir. Sensible al arte, a la música y a la naturaleza; con estudios y curiosidad por seguir aprendiendo. Que cuide a su familia, cocine un domingo largo, camine junto al río y tenga la humildad de reconocer sus errores. Alguien que quiera construir un hogar estable, con compromiso y ternura.' where user_id = '00000000-0000-4000-8000-000000000101';
update public.profiles set display_name = 'Emilia Vintimilla',
  handle = case when exists (select 1 from public.profiles o where o.handle = '@emilia.vintimilla' and o.id <> '00000000-0000-4000-8000-000000000101') then handle else '@emilia.vintimilla' end,
  bio = 'Restauro pintura colonial y modelo cerámica en un taller junto al Tomebamba. Creo en las sobremesas largas, en el silencio compartido y en el amor que se cultiva con paciencia. No busco impresionar a nadie: busco con quién construir un hogar y una vida honesta.', location = 'Cuenca · Centro Histórico y Turi',
  interests = array['amigos']::text[], zones = array['Barrio Histórico', 'Las Lomas']::text[], relations = array['pareja', 'amistad']::text[], lifestyle = array['Creativo', 'Lector', 'Espiritual']::text[],
  university = 'Universidad de Cuenca', school = 'Colegio Benigno Malo', height_cm = 165,
  professional = '{"headline":"Restauradora de arte y ceramista","skills":["Restauración","Cerámica","Historia del arte"],"portfolio":[]}'::jsonb,
  age = 32, sign = 'libra', avatar_url = 'https://i.pravatar.cc/300?img=23',
  email_verified = true, identity_verified = true, kyc_status = 'verified', is_demo = true, onboarding_completed = true
where id = '00000000-0000-4000-8000-000000000101';
delete from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000101';
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime) values
  ('00000000-0000-4000-8000-000000000101', 0, 'https://i.pravatar.cc/900?img=23', 'https://i.pravatar.cc/300?img=23', 900, 900, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000101', 1, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Catedral_de_la_Inmaculada_Concepci%C3%B3n%2C_Cuenca.jpg/960px-Catedral_de_la_Inmaculada_Concepci%C3%B3n%2C_Cuenca.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Catedral_de_la_Inmaculada_Concepci%C3%B3n%2C_Cuenca.jpg/330px-Catedral_de_la_Inmaculada_Concepci%C3%B3n%2C_Cuenca.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000101', 2, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Mirador_de_Turi_Ecuador_1739.jpg/960px-Mirador_de_Turi_Ecuador_1739.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Mirador_de_Turi_Ecuador_1739.jpg/330px-Mirador_de_Turi_Ecuador_1739.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000101', 3, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/R%C3%ADo_Tomebamba_desde_el_Paseo_3_de_Noviembre%2C_Cuenca.jpg/960px-R%C3%ADo_Tomebamba_desde_el_Paseo_3_de_Noviembre%2C_Cuenca.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/R%C3%ADo_Tomebamba_desde_el_Paseo_3_de_Noviembre%2C_Cuenca.jpg/330px-R%C3%ADo_Tomebamba_desde_el_Paseo_3_de_Noviembre%2C_Cuenca.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000101', 4, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Catedral_de_la_Inmaculada_Concepci%C3%B3n%2C_Cuenca_04.jpg/960px-Catedral_de_la_Inmaculada_Concepci%C3%B3n%2C_Cuenca_04.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Catedral_de_la_Inmaculada_Concepci%C3%B3n%2C_Cuenca_04.jpg/330px-Catedral_de_la_Inmaculada_Concepci%C3%B3n%2C_Cuenca_04.jpg', 960, null, 'image/jpeg');

-- Persona 2: Mariana Larrea
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'demo+persona2@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mariana Larrea"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
update public.user_private set birth_date = '1991-05-19', ideal_partner = 'Alguien de carácter tranquilo y ambición sana, que trabaje con propósito y no necesite aparentar. Emprendedor o con espíritu de construir, con estudios universitarios, lector, que disfrute del deporte, del buen café y de las caminatas por Cumbayá los fines de semana. Que hable con claridad, respete mis tiempos y quiera formar una familia y una comunidad en la que ambos crezcamos.' where user_id = '00000000-0000-4000-8000-000000000102';
update public.profiles set display_name = 'Mariana Larrea',
  handle = case when exists (select 1 from public.profiles o where o.handle = '@mariana.larrea' and o.id <> '00000000-0000-4000-8000-000000000102') then handle else '@mariana.larrea' end,
  bio = 'Fundé una marca de café de especialidad junto a familias productoras de Loja e Intag. Madrugo, leo a los estoicos y practico algo simple: hacer bien lo que depende de mí. Quiero una pareja con quien crecer sin competir y una comunidad que se cuide entre sí.', location = 'Quito · La Floresta y Cumbayá',
  interests = array['amigos', 'inversor']::text[], zones = array['Zona Norte', 'Valle Alto']::text[], relations = array['pareja', 'socios']::text[], lifestyle = array['Emprendedor', 'Foodie', 'Lector']::text[],
  university = 'Universidad San Francisco de Quito', school = 'Colegio Alemán de Quito', height_cm = 168,
  professional = '{"headline":"Fundadora · café de especialidad ecuatoriano","skills":["Emprendimiento","Comercio justo","Liderazgo"],"portfolio":[]}'::jsonb,
  age = 35, sign = 'tauro', avatar_url = 'https://i.pravatar.cc/300?img=28',
  email_verified = true, identity_verified = true, kyc_status = 'verified', is_demo = true, onboarding_completed = true
where id = '00000000-0000-4000-8000-000000000102';
delete from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000102';
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime) values
  ('00000000-0000-4000-8000-000000000102', 0, 'https://i.pravatar.cc/900?img=28', 'https://i.pravatar.cc/300?img=28', 900, 900, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000102', 1, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Motorcycle_in_La_Floresta%2C_Quito.jpg/960px-Motorcycle_in_La_Floresta%2C_Quito.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Motorcycle_in_La_Floresta%2C_Quito.jpg/330px-Motorcycle_in_La_Floresta%2C_Quito.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000102', 2, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Quito_calle_Garc%C3%ADa_Moreno.jpg/960px-Quito_calle_Garc%C3%ADa_Moreno.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Quito_calle_Garc%C3%ADa_Moreno.jpg/330px-Quito_calle_Garc%C3%ADa_Moreno.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000102', 3, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Iglesia_de_Santo_Domingo%2C_Quito%2C_Ecuador%2C_2015-07-22%2C_DD_202-204_HDR.JPG/960px-Iglesia_de_Santo_Domingo%2C_Quito%2C_Ecuador%2C_2015-07-22%2C_DD_202-204_HDR.JPG', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Iglesia_de_Santo_Domingo%2C_Quito%2C_Ecuador%2C_2015-07-22%2C_DD_202-204_HDR.JPG/330px-Iglesia_de_Santo_Domingo%2C_Quito%2C_Ecuador%2C_2015-07-22%2C_DD_202-204_HDR.JPG', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000102', 4, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Llovizna_al_atardecer_-_panoramio.jpg/960px-Llovizna_al_atardecer_-_panoramio.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Llovizna_al_atardecer_-_panoramio.jpg/330px-Llovizna_al_atardecer_-_panoramio.jpg', 960, null, 'image/jpeg');

-- Persona 3: Génesis Villamar
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'demo+persona3@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Génesis Villamar"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
update public.user_private set birth_date = '1997-02-11', ideal_partner = 'Una persona sociable, alegre y de corazón generoso, con metas claras y ganas de evolucionar. Que le guste el deporte, viajar, bailar y reunir a la gente en casa; que sepa pedir perdón y celebrar los logros del otro. Con formación, trabajo digno y valores firmes. Quiero un compañero de vida que construya conmigo un hogar, una familia y un aporte real para nuestra ciudad.' where user_id = '00000000-0000-4000-8000-000000000103';
update public.profiles set display_name = 'Génesis Villamar',
  handle = case when exists (select 1 from public.profiles o where o.handle = '@genesis.villamar' and o.id <> '00000000-0000-4000-8000-000000000103') then handle else '@genesis.villamar' end,
  bio = 'Guayaquileña de pura cepa: coach de liderazgo y voluntaria en un banco de alimentos. Risa fuerte, abrazo largo y disciplina de madrugada. Crecer es un deporte de equipo: busco una pareja que se atreva a mejorar conmigo, sin poses ni juegos, y amigos para hacer comunidad.', location = 'Guayaquil · Puerto Santa Ana',
  interests = array['amigos', 'anfitrion']::text[], zones = array['Puerto Nuevo', 'Centro']::text[], relations = array['pareja', 'amistad']::text[], lifestyle = array['Deportista', 'Viajero', 'Familiar']::text[],
  university = 'Universidad Casa Grande', school = 'Colegio Americano de Guayaquil', height_cm = 163,
  professional = '{"headline":"Coach de liderazgo y voluntaria social","skills":["Liderazgo","Coaching","Voluntariado"],"portfolio":[]}'::jsonb,
  age = 29, sign = 'acuario', avatar_url = 'https://i.pravatar.cc/300?img=49',
  email_verified = true, identity_verified = true, kyc_status = 'verified', is_demo = true, onboarding_completed = true
where id = '00000000-0000-4000-8000-000000000103';
delete from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000103';
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime) values
  ('00000000-0000-4000-8000-000000000103', 0, 'https://i.pravatar.cc/900?img=49', 'https://i.pravatar.cc/300?img=49', 900, 900, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000103', 1, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Puerto_Santa_Ana._Guayaquil%2C_Guayas%2C_Ecuador.jpg/960px-Puerto_Santa_Ana._Guayaquil%2C_Guayas%2C_Ecuador.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Puerto_Santa_Ana._Guayaquil%2C_Guayas%2C_Ecuador.jpg/330px-Puerto_Santa_Ana._Guayaquil%2C_Guayas%2C_Ecuador.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000103', 2, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/SageoEG_-_Puerto_Santa_Ana_-_Callejones_06.jpg/960px-SageoEG_-_Puerto_Santa_Ana_-_Callejones_06.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/SageoEG_-_Puerto_Santa_Ana_-_Callejones_06.jpg/330px-SageoEG_-_Puerto_Santa_Ana_-_Callejones_06.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000103', 3, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Vista_del_Malec%C3%B3n_2000.jpg/960px-Vista_del_Malec%C3%B3n_2000.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Vista_del_Malec%C3%B3n_2000.jpg/330px-Vista_del_Malec%C3%B3n_2000.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000103', 4, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Abril_2005_029.jpg/960px-Abril_2005_029.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Abril_2005_029.jpg/330px-Abril_2005_029.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000103', 5, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/93/Capilla_Santa_Ana_desde_el_Faro.JPG/960px-Capilla_Santa_Ana_desde_el_Faro.JPG', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/93/Capilla_Santa_Ana_desde_el_Faro.JPG/330px-Capilla_Santa_Ana_desde_el_Faro.JPG', 960, null, 'image/jpeg');

-- Persona 4: Sebastián Astudillo
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000104', 'authenticated', 'authenticated', 'demo+persona4@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sebastián Astudillo"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
update public.user_private set birth_date = '1989-12-03', ideal_partner = 'Una persona auténtica y de espíritu libre, que valore el arte y la conversación profunda por encima de las apariencias. Con vida y sueños propios, y ganas de compartirlos; que disfrute de un concierto, de una caminata por Turi y de cocinar en casa. Que crea en la constancia, el respeto y la fidelidad, y quiera construir una familia y una comunidad con calma y verdad.' where user_id = '00000000-0000-4000-8000-000000000104';
update public.profiles set display_name = 'Sebastián Astudillo',
  handle = case when exists (select 1 from public.profiles o where o.handle = '@sebastian.astudillo' and o.id <> '00000000-0000-4000-8000-000000000104') then handle else '@sebastian.astudillo' end,
  bio = 'Toco el violín en la Orquesta Sinfónica y enseño música a niños de un barrio de Cuenca. Aprendí que la disciplina es una forma de ternura. Busco una compañera de vida con quien envejecer entre música, montañas y una mesa siempre abierta.', location = 'Cuenca · Turi',
  interests = array['amigos']::text[], zones = array['Las Lomas', 'Centro']::text[], relations = array['pareja', 'amistad']::text[], lifestyle = array['Creativo', 'Espiritual', 'Lector']::text[],
  university = 'Universidad de Cuenca', school = 'Colegio Benigno Malo', height_cm = 178,
  professional = '{"headline":"Violinista y docente de música","skills":["Violín","Composición","Pedagogía musical"],"portfolio":[]}'::jsonb,
  age = 37, sign = 'sagitario', avatar_url = 'https://i.pravatar.cc/300?img=55',
  email_verified = true, identity_verified = true, kyc_status = 'verified', is_demo = true, onboarding_completed = true
where id = '00000000-0000-4000-8000-000000000104';
delete from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000104';
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime) values
  ('00000000-0000-4000-8000-000000000104', 0, 'https://i.pravatar.cc/900?img=55', 'https://i.pravatar.cc/300?img=55', 900, 900, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000104', 1, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Mirador_de_Turi_Ecuador_1736.jpg/960px-Mirador_de_Turi_Ecuador_1736.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Mirador_de_Turi_Ecuador_1736.jpg/330px-Mirador_de_Turi_Ecuador_1736.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000104', 2, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/Mirador_de_Turi_Ecuador_1742.jpg/960px-Mirador_de_Turi_Ecuador_1742.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/Mirador_de_Turi_Ecuador_1742.jpg/330px-Mirador_de_Turi_Ecuador_1742.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000104', 3, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Rio_Tomebamba_con_un_caudal_bajo_durante_el_estiaje_de_2024.jpg/960px-Rio_Tomebamba_con_un_caudal_bajo_durante_el_estiaje_de_2024.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Rio_Tomebamba_con_un_caudal_bajo_durante_el_estiaje_de_2024.jpg/330px-Rio_Tomebamba_con_un_caudal_bajo_durante_el_estiaje_de_2024.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000104', 4, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Panor%C3%A1mica_desde_Turi_de_Cuenca_%28Ecuador%29_2.jpg/960px-Panor%C3%A1mica_desde_Turi_de_Cuenca_%28Ecuador%29_2.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Panor%C3%A1mica_desde_Turi_de_Cuenca_%28Ecuador%29_2.jpg/330px-Panor%C3%A1mica_desde_Turi_de_Cuenca_%28Ecuador%29_2.jpg', 960, null, 'image/jpeg');

-- Persona 5: Andrés Terán
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000105', 'authenticated', 'authenticated', 'demo+persona5@inmobiliaria.social.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Andrés Terán"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
update public.user_private set birth_date = '1987-07-24', ideal_partner = 'Una persona madura emocionalmente, sincera y con propósito, que sepa lo que quiere y lo diga sin rodeos. Independiente, con estudios y sentido del humor; que disfrute del deporte, de viajar y de una buena comida en casa. Que valore la familia y el compromiso, y quiera construir un hogar y una comunidad juntos, apoyándonos en los días difíciles y celebrando los buenos.' where user_id = '00000000-0000-4000-8000-000000000105';
update public.profiles set display_name = 'Andrés Terán',
  handle = case when exists (select 1 from public.profiles o where o.handle = '@andres.teran' and o.id <> '00000000-0000-4000-8000-000000000105') then handle else '@andres.teran' end,
  bio = 'Ingeniero civil: construyo vivienda accesible porque un hogar digno es la base de cualquier proyecto de vida. Corro al amanecer en el Metropolitano y cocino los sábados. Cero juegos: busco una relación adulta, con conversación real y un futuro que se levanta entre dos.', location = 'Quito · Cumbayá',
  interests = array['comprador', 'inversor']::text[], zones = array['Valle Alto', 'Zona Norte']::text[], relations = array['pareja', 'socios']::text[], lifestyle = array['Deportista', 'Emprendedor', 'Casero']::text[],
  university = 'Pontificia Universidad Católica del Ecuador', school = 'Colegio Alemán de Quito', height_cm = 176,
  professional = '{"headline":"Ingeniero civil · vivienda accesible","skills":["Construcción","Gestión de proyectos","Vivienda social"],"portfolio":[]}'::jsonb,
  age = 39, sign = 'leo', avatar_url = 'https://i.pravatar.cc/300?img=59',
  email_verified = true, identity_verified = true, kyc_status = 'verified', is_demo = true, onboarding_completed = true
where id = '00000000-0000-4000-8000-000000000105';
delete from public.profile_photos where user_id = '00000000-0000-4000-8000-000000000105';
insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime) values
  ('00000000-0000-4000-8000-000000000105', 0, 'https://i.pravatar.cc/900?img=59', 'https://i.pravatar.cc/300?img=59', 900, 900, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000105', 1, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/Telef%C3%A9riQo_views_of_mountains_and_Quito_-_Ecuador_-_South_America.jpg/960px-Telef%C3%A9riQo_views_of_mountains_and_Quito_-_Ecuador_-_South_America.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/Telef%C3%A9riQo_views_of_mountains_and_Quito_-_Ecuador_-_South_America.jpg/330px-Telef%C3%A9riQo_views_of_mountains_and_Quito_-_Ecuador_-_South_America.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000105', 2, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Gondolas_of_the_TeleferiQo_in_Quito%2C_Ecuador.jpg/960px-Gondolas_of_the_TeleferiQo_in_Quito%2C_Ecuador.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Gondolas_of_the_TeleferiQo_in_Quito%2C_Ecuador.jpg/330px-Gondolas_of_the_TeleferiQo_in_Quito%2C_Ecuador.jpg', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000105', 3, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Museo_de_la_Catedral_de_Quito%2C_Quito%2C_Ecuador%2C_2015-07-22%2C_DD_94-96_HDR.JPG/960px-Museo_de_la_Catedral_de_Quito%2C_Quito%2C_Ecuador%2C_2015-07-22%2C_DD_94-96_HDR.JPG', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Museo_de_la_Catedral_de_Quito%2C_Quito%2C_Ecuador%2C_2015-07-22%2C_DD_94-96_HDR.JPG/330px-Museo_de_la_Catedral_de_Quito%2C_Quito%2C_Ecuador%2C_2015-07-22%2C_DD_94-96_HDR.JPG', 960, null, 'image/jpeg'),
  ('00000000-0000-4000-8000-000000000105', 4, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Top_station_of_the_TeleferiQo_in_Quito%2C_Ecuador.jpg/960px-Top_station_of_the_TeleferiQo_in_Quito%2C_Ecuador.jpg', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Top_station_of_the_TeleferiQo_in_Quito%2C_Ecuador.jpg/330px-Top_station_of_the_TeleferiQo_in_Quito%2C_Ecuador.jpg', 960, null, 'image/jpeg');

commit;
