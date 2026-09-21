# conectari.com — Todo lo que necesitas en tu ciudad, en una sola app

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · **Supabase** (PostgreSQL + Auth + Storage + Realtime).

## Identidad visual
- **Logotipos** (`public/brand/`, derivados de los originales de `E:\Conectari`): `conectari-header.png` (wordmark sin eslogan, fondo transparente, cabecera), `conectari-header-claro.png` (versión para fondos oscuros), `conectari-logo.png` (wordmark + eslogan), `conectari-icono.png` (icono «C», footer) y los favicons `src/app/icon.png` / `apple-icon.png`. Los originales no tenían transparencia (el wordmark) o tenían la «C» como hueco (el icono); se procesaron para que se vean igual sobre cualquier fondo.
- **Paleta** (tokens en `src/app/globals.css`): tinta `#02070e`, naranja `#ff6908` (escala `brand-50…900`), llama `#ff2701`, mango `#ff8a00`, ámbar `#ffad02`, sol `#ffc504`, papel `#fdfcfa`. Único color ajeno al logo: turquesa `#00b8ad` para «Comunidad». Los colores de cada categoría están en `src/lib/marca.ts`.
- **Tipografía**: Nunito (titulares, redondeada como el wordmark) + Inter (texto). **Movimiento**: manchas animadas, cinta de secciones, tarjetas que se elevan y botones con brillo; se desactiva con `prefers-reduced-motion`.
- **Institucional**: bloque «¿Qué es conectari.com?» al final de la portada y página completa en `/que-es`.

Inmuebles, vehículos y negocios · Citas y networking · Astrología y tarot · Empleos y servicios freelance ·
Mensajería en tiempo real · Recompensas · Verificación de identidad (KYC) y reputación P2P.

## Puesta en marcha

Requiere [Node.js](https://nodejs.org) 18.18+ y un proyecto de [Supabase](https://supabase.com).

### 1. Variables de entorno
Copia `.env.example` a `.env.local` y rellénalo (Supabase → *Project Settings → API*). La clave `sb_publishable_…` (o `anon`) es pública por diseño: la seguridad la imponen las políticas RLS.

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# Opcional — dónde se guardan las fotos de perfil (ver "Fotos de perfil")
# NEXT_PUBLIC_MEDIA_DRIVER=local     # desarrollo: carpeta .media, servida en /api/media
# MEDIA_LOCAL_DIR=.media
```

### 2. Crear la base de datos (una sola vez)
1. Supabase → **SQL Editor → New query**.
2. Pega **todo** `supabase/schema.sql` y pulsa **Run** (tablas, funciones, RLS, buckets de Storage y Realtime).
   > **¿Ya aplicaste una versión anterior de `schema.sql`?** No lo repitas entero: ejecuta solo `supabase/update_002_fotos_onboarding.sql` (fotos de perfil, onboarding y simulador; es idempotente y marca como «onboarding completo» a los perfiles que ya existían).
3. *(Opcional, recomendado para probar)* pega y ejecuta `supabase/seed.sql`: crea 23 perfiles demo, ofertas, búsquedas, servicios, vacantes y publicaciones. Los perfiles demo **no pueden iniciar sesión** y aceptan algunos likes en Citas para poder probar con una sola cuenta.
   > **¿Tu base ya tenía la 002?** Ejecuta además `supabase/update_003_conexion_viral.sql` (perfil académico, recomendaciones, referidos y retos diarios; idempotente).
   >
   > **¿Y la 003?** Ejecuta `supabase/update_004_pareja_ideal.sql` (valores, pareja ideal estructurada y afinidad con desglose por categoría; idempotente). Aplícala **antes** de desplegar la app: el perfil y las recomendaciones leen sus columnas nuevas.
   >
   > **¿Y la 004?** Ejecuta `supabase/update_005_comunidad_viva.sql` (reacciones, miembros recientes, Top Conectores y avisos sociales; idempotente). También **antes** de desplegar: la portada llama a sus funciones.
   >
   > **¿Y la 005?** Ejecuta `supabase/update_006_directorios.sql` (directorios de Movilidad, Delivery, Salud, Eventos, Mascotas y Hogar; idempotente). Sus pantallas (`/directorio`) llegan con la Fase 1 (ver abajo).
   >
   > **¿Y la 006?** Ejecuta `supabase/update_007_buscador_universal.sql` (buscador universal del directorio: negocios y lo que venden, sin distinguir acentos). Aplica **006 y 007 antes de desplegar** la app: el directorio, la portada y el alta llaman a sus funciones y a las tablas nuevas.
   > **¿Y la 007?** Ejecuta `supabase/update_008_pedidos.sql` (carrito y pedidos de Delivery y Farmacias: teléfono del cliente, caducidad de pedidos sin respuesta y `place_order` con retiro en local). Aplícala antes de desplegar el carrito: cambia la firma de `place_order`.
4. *(Opcional)* ejecuta `supabase/seed_personas.sql`: **5 personas de demostración de Ecuador** (Cuenca, Quito y Guayaquil) con retrato y escenas de su ciudad; requiere haber aplicado también `update_003_conexion_viral.sql` y `update_004_pareja_ideal.sql` (ver [Persona Engine](#persona-engine-simulación-de-personas)).
5. Hazte administrador (para revisar KYC y usar el Persona Engine), sustituyendo tu correo tras registrarte:
   ```sql
   insert into public.app_admins (user_id) select id from auth.users where email = 'tu@correo.com';
   ```

### 3. Autenticación
Supabase → **Authentication**:
- *URL Configuration*: añade `http://localhost:3000/auth/callback` (y la URL de producción) a **Redirect URLs**.
- *Providers*: email/contraseña viene activo. Para **Google** o **GitHub** actívalos allí; los botones aparecen solos cuando el proveedor está activado.
- Por defecto se exige confirmar el correo (se puede desactivar en *Sign In / Providers → Email* mientras desarrollas).

### 4. Arrancar
```bash
npm install
npm run dev      # http://localhost:3000
```

## Arquitectura

Tres capas con responsabilidades separadas: **cliente** (pantallas y `features/`), **servicios/API** (route handlers + `lib/media` + Supabase) y **medios** (archivos y su almacenamiento).

```
supabase/                              ── BASE DE DATOS
├── schema.sql                         Esquema completo (incluye la actualización 002)
├── update_002_fotos_onboarding.sql    Solo lo nuevo: fotos, onboarding, simulador (para bases ya creadas)
├── update_003_conexion_viral.sql      Perfil académico, recomendaciones, referidos, retos diarios, métricas
├── update_004_pareja_ideal.sql        Valores, pareja ideal estructurada y afinidad por categoría
├── update_005_comunidad_viva.sql      Reacciones, miembros recientes, Top Conectores y avisos sociales
├── update_006_directorios.sql         Directorios: perfiles, menús, pedidos, solicitudes/ofertas, eventos y entradas, reseñas, moderación
├── update_007_buscador_universal.sql  Buscador universal del directorio (negocios y productos) y búsqueda sin acentos
├── update_008_pedidos.sql             Pedidos: teléfono del cliente, caducidad a las 3 h sin respuesta y place_order con retiro
├── seed.sql / seed_personas.sql       Datos de demostración (generados)
├── seed/                              Datos en TypeScript + generadores (generate.ts, personas.ts = Persona Engine)
└── tests/                             Pruebas: db.test.mjs, media.test.mjs, ui-logica.test.mjs
src/
├── middleware.ts                      Refresca la sesión y redirige rutas privadas a /login
├── context/SocialContext.tsx          Capa de datos: consultas, mutaciones/RPC y suscripciones Realtime
├── lib/
│   ├── supabaseClient.ts              Cliente del navegador
│   ├── supabase/                      server.ts (SSR), middleware, mapeo, subida a Storage
│   └── media/                         ── SERVICIO DE MEDIOS (solo servidor, salvo config/urls)
│       ├── config.ts                  Límites (10 fotos, 5 MB, JPG/PNG/WebP) y mensajes de error
│       ├── procesar.ts                Validación por firma real + EXIF + versión completa y miniatura (sharp)
│       ├── almacenamiento.ts          Interfaz Almacenamiento + drivers local y Supabase Storage
│       ├── manejadores.ts             Lógica de /api/photos con dependencias inyectadas (testeable)
│       └── servidor.ts / urls.ts      Cableado con Supabase / ruta guardada → URL pública
├── app/
│   ├── api/photos/…                   POST (subir), PATCH (reordenar), DELETE /[id]
│   ├── api/media/[...ruta]/           Sirve .media (solo con el driver local)
│   ├── onboarding/                    Alta guiada
│   └── admin/{kyc,personas}/          Revisión de identidad · Persona Engine
├── features/
│   ├── fotos/                         GaleriaFotos (elegir, previsualizar, reordenar, eliminar), Visor, SeccionFotos
│   └── onboarding/                    Asistente por pasos + validación
└── .media/ (git-ignorado)             Fotos del driver local
```

### Fotos de perfil (hasta 10)
- **Tabla `profile_photos`** (perfil 1 → N): `sort_order` 0–9 con `unique(user_id, sort_order)` ⇒ **máximo 10 garantizado por la base de datos**, también con subidas concurrentes. La foto 0 es la principal y se copia a `profiles.avatar_url` (miniatura). Nadie inserta/actualiza/borra directamente: solo las RPC `add_profile_photo`, `delete_profile_photo` (compacta el orden) y `reorder_profile_photos`.
- **Endpoints**: `POST /api/photos` (multipart, campo `file`), `PATCH /api/photos` (`{ ids: [...] }` en el orden deseado) y `DELETE /api/photos/:id`. Códigos: 401 sin sesión · 400 petición inválida · 413 >5 MB · 415 formato no permitido · 422 imagen corrupta, <300 px o >50 MP · 409 ya tienes 10 fotos · 502 fallo de almacenamiento.
- **Procesado** (servidor, `sharp`): el formato se decide por los primeros bytes (no por extensión ni `Content-Type`), se corrige la orientación, se **eliminan los metadatos EXIF/GPS**, y se guardan dos WebP: completa (≤1600×2000) y **miniatura 320×400** recortada. Protección frente a bombas de descompresión (≤50 megapíxeles).
- **Almacenamiento intercambiable** (`NEXT_PUBLIC_MEDIA_DRIVER`): `supabase` (por defecto) usa el bucket público `media` de Supabase Storage, que es almacenamiento compatible con S3 y con CDN; `local` guarda en `.media/` para desarrollo sin depender del bucket. Para un S3 propio basta implementar la interfaz `Almacenamiento` (3 métodos) en `almacenamiento.ts`.
- **Interfaz**: seleccionar (varias a la vez o arrastrando), previsualizar, **reordenar arrastrando o con los botones ← →**, eliminar y elegir principal *antes de confirmar*; los cambios se aplican al pulsar «Guardar» (borra → sube una a una con progreso → reordena).

### Onboarding
Tras registrarse, `GuardaOnboarding` lleva a `/onboarding` (solo si `profiles.onboarding_completed` es `false`): **Sobre ti (con universidad y colegio) → Intereses → Tu pareja ideal → Fotos → Confirmar**. Cada paso se valida en el cliente y `complete_onboarding()` lo **vuelve a validar en el servidor** (nombre, usuario, fecha de nacimiento ≥ 18 años, universidad, colegio, descripción de la pareja ideal y al menos 1 foto). El indicador no es escribible directamente por el cliente.

### Conexión: perfil académico, recomendaciones, referidos y retos (actualización 003)
Todo vive en `supabase/update_003_conexion_viral.sql` (idempotente; ya incluido al final de `schema.sql`).

- **Perfil ampliado**: `profiles.university`, `school`, `height_cm` (públicos) y `user_private.ideal_partner` (descripción libre de la pareja ideal, **privada**: solo su dueño la lee; el motor la usa dentro de funciones `SECURITY DEFINER` y jamás la devuelve). El onboarding tiene un paso nuevo, **«Tu pareja ideal»**, y `complete_onboarding()` exige universidad, colegio y ≥ 20 caracteres de pareja ideal (los perfiles anteriores no se bloquean; pueden completarlo en su perfil).
- **Motor de recomendación** (`recommend_people()` → `/explorar`): puntúa 0–100 y explica los motivos. El texto de la pareja ideal se compara con cómo se describe cada perfil (lexemas del diccionario español de PostgreSQL, sin acentos ni palabras vacías), con reciprocidad, junto a valores, estilo de vida, tipo de relación, formación, intereses, zona y afinidad astral (reparto exacto y desglose por categoría en la [actualización 004](#pareja-ideal-estructurada-afinidad-y-completado-del-perfil-actualización-004)). Filtra por **rango de edad y de estatura**, oculta a quien descartaste y pagina. *Siguiente paso natural*: embeddings con `pgvector` para captar sinónimos y matices.
- **Galería** `/explorar`: tarjetas grandes con anillo de compatibilidad, motivos, formación y botón «Conectar» (reutiliza `swipe_person`, con match automático si es mutuo).
- **Bienvenida y saludo**: al terminar el registro, un modal con el nombre de la persona y sus tres primeros pasos (una sola vez); al volver a iniciar sesión, un saludo cálido con su nombre (una vez por sesión). Ver `src/lib/mensajes.ts`.
- **«Hoy depende de ti»** (portada): panel con lo que de verdad está pendiente (likes sin responder, mensajes, personas nuevas, racha, monedas por cobrar y cuenta atrás real hasta el reinicio de los retos, medianoche UTC). Tono motivador y estoico; **todas las cifras son reales** (`opportunity_snapshot()`, `community_stats()`) y no se muestra nada si no hay nada pendiente o la cifra es demasiado pequeña.
- **Referidos** (`/invitar`): enlace personal `/registro?ref=CÓDIGO`. Cada invitado que **completa su perfil** suma +50 monedas al invitador y +25 al invitado (una sola vez, anti-abuso); bonos de hito a los 3 (+50), 5 (+100), 10 (+250) y 20 (+600) y rangos de estatus **Semilla → Puente → Conector → Embajador → Mentor → Faro** con meta de un círculo de 20. Incluye ranking. El código se captura desde cualquier página de entrada (`CapturaReferido`) y se aplica con `apply_referral()` (sirve también con OAuth). Las monedas son virtuales y sin valor monetario.
- **Retos diarios** (`/retos`): bono diario, conectar con 3 personas, publicar, iniciar conversación, reflexión del día, traer a alguien y bono «día completo». El servidor comprueba el cumplimiento con actividad real y paga una sola vez por reto y día (`claim_daily_challenge()`). Los premios están duplicados en `src/lib/retos.ts` y hay un test de paridad.
- **Reflexiones** (`src/lib/reflexiones.ts`): mensajes de autoconocimiento y progreso inspirados en la filosofía espiritista de Allan Kardec. Solo se marcan como cita las frases conocidas de su obra; el resto se presenta como «inspirada en», sin atribuirle palabras.

### Pareja ideal estructurada, afinidad y completado del perfil (actualización 004)
Todo vive en `supabase/update_004_pareja_ideal.sql` (idempotente; ya incluido al final de `schema.sql`).

- **Qué se define**: además de la descripción libre, cada persona marca **qué busca exactamente**: *tipo de relación* (`profiles.relations`, público, como siempre), *valores* (`user_private.ideal_values`, privado) y *estilo de vida* (`user_private.ideal_lifestyle`, privado); y **sus propios valores** (`profiles.core_values`, públicos, se ven en el perfil). Catálogo y tope (5 por lista; el servidor admite 8) en `src/data/catalogos.ts`. Se pide (opcional) en el onboarding y se edita en «Editar información».
- **Afinidad por categoría**: `recommend_people()` devuelve, además del puntaje 0–100, `pct_values`, `pct_lifestyle` y `pct_relation`. Cada uno pesa **70 % lo que tú buscas frente a lo que la otra persona tiene** y **30 % reciprocidad** (lo que ella/él busca frente a lo que tú tienes). Quien no indicó qué busca se compara con lo que ya es; sin datos de alguno de los dos lados el resultado es `NULL` y la tarjeta muestra «—», nunca un 0 % engañoso. Etiquetas comparables sin acentos ni género (*Casero* = *Casera*).
- **Reparto de los 100 puntos**: 25 texto de pareja ideal ↔ perfil · 10 reciprocidad del texto · 15 valores · 12 estilo de vida · 10 tipo de relación · 9 universidad (6) y colegio (3) · 6 intereses · 6 zona · 7 afinidad astral. Un 100 % exige encaje total. Las respuestas solo llevan porcentajes y motivos genéricos, nunca lo que la otra persona marcó.
- **Tarjetas**: `/explorar` (`TarjetaAfinidad`) y `/citas` (`ContenidoPersona`, con el orden del mazo por afinidad real) muestran el porcentaje total y las tres barras por categoría (`BarrasAfinidad`).
- **Completado del perfil** (`src/lib/completitud.ts`): fotos 20 (3 = completo) · biografía 15 (60 caracteres) · zona 15 · intereses y estilo de vida 15 · descripción de pareja ideal 15 (20 caracteres, como el servidor) · «qué buscas exactamente» 20. La barra («X % completado») aparece en el perfil, en el botón «Editar información», en la cabecera fija del formulario (se actualiza mientras escribes) y como aviso en `/explorar`.

### Portada y comunidad viva (actualización 005)
Todo lo de servidor vive en `supabase/update_005_comunidad_viva.sql` (idempotente; ya incluido al final de `schema.sql`). **Todas las cifras y personas que se muestran son reales**: no hay contadores ni perfiles inventados (los perfiles demo quedan fuera de miembros recientes y del ranking).

- **Orden de la portada** (`src/app/page.tsx`): 1) *Explora tu ciudad a un toque* (categorías, buscador y prueba social) → 2) *Miembros recientes* → 3) muro de la comunidad con columna lateral en escritorio → *Qué es*.
- **Miembros recientes** (`MiembrosRecientes`, RPC `recent_members()`): las últimas personas que se unieron (solo nombre de pila, ciudad y foto), con rotación suave cada 4 s. Se pausa al pasar el ratón o enfocar y no se anima con «reducir movimiento».
- **Muro con carga infinita** (`MuroHome`): publicaciones con **reacciones rápidas** (👍 ❤️ 😂 😮 👏, columna `post_likes.reaction`), comentarios y enlaces clicables (solo http/https). Se revelan de 8 en 8 al acercarte al final; cuando se agotan las descargadas, `cargarMasPosts()` pide lotes de 20 más antiguas al servidor. Tras 6 cargas automáticas seguidas aparece «Ver más publicaciones» para que el pie de página siga alcanzable.
- **Bloques intercalados** (`src/lib/comunidad.ts` → `POSICION_BLOQUE`): *Personas que quizá conozcas* (carrusel con la afinidad real de `recommend_people` y «Agregar a amigos») tras la 3.ª publicación, invitación con monedas tras la 6.ª, *Top Conectores* tras la 8.ª y ofertas tras la 10.ª. En escritorio, invitación y ranking van en la columna lateral (junto a *Hoy depende de ti* y las tendencias).
- **Invitar por monedas** (`InvitarCTA`): enlace único `/registro?ref=…`, WhatsApp, contadores reales (invitadas, con perfil completo, monedas ganadas), próximo bono de hito y cuenta atrás del reto diario «Trae a alguien» (+30 🪙, reinicio real a medianoche UTC). Sin cifras inventadas.
- **Fama: «Top Conector»** (`top_connectors()`, `my_connector_status()`, `ConectoresDestacados`, `TopConectorBadge`): ranking de los últimos 30 días con topes por categoría (publicar +3 máx. 30 · reacciones recibidas +1 máx. 50 · comentarios recibidos +2 máx. 40 · comentar en publicaciones ajenas +1 máx. 20 · amistades invitadas +10 máx. 100 · matches +2 máx. 20; lo propio no cuenta; mínimo 10 puntos para figurar). La insignia se ve en las publicaciones y en las sugerencias, y cada persona ve cuánto le falta. Las reglas están duplicadas en `PUNTOS_ACTIVIDAD` y un test comprueba la paridad con SQL.
- **Notificaciones en tiempo real**: comentar o reaccionar a una publicación avisa a su autor (un aviso por persona y publicación) por `notifications` (Realtime); `AvisoVivo` muestra un aviso emergente al llegar uno nuevo y la campana del menú suma el contador.

### Directorios colaborativos (actualización 006)
Seis secciones nuevas de uso diario donde **la comunidad publica el contenido**: *Movilidad* (taxis y mandados), *Delivery*, *Farmacias y salud*, *Eventos y entradas*, *Mascotas* y *Servicios del hogar*. Un solo núcleo (`providers`, catálogo, pedidos, solicitudes con ofertas, eventos, reseñas y moderación) parametrizado por sección; el catálogo que configura la interfaz está en `src/data/directorio.ts`.

**Fase 1 hecha para Delivery y Farmacias** (las otras secciones se activan con `activa: true` en el catálogo):
- **Hub** `/directorio`: buscador universal, secciones con cifras reales, farmacias de turno y negocios abiertos ahora.
- **Listados** `/directorio/delivery` y `/directorio/salud` (alias `/delivery`, `/farmacias`): filtros en la URL (categoría, zona, abierto ahora, a domicilio, verificados, de turno), paginación y estados vacíos.
- **Fichas** `/directorio/<sección>/<slug>`: carta o productos, horario, turnos, reseñas, datos estructurados para Google; el contacto solo se ve con sesión.
- **Buscador universal**: en la portada (pestañas Inmuebles · Comida · Farmacias · Todo) y en `/directorio/buscar`; «paracetamol» encuentra las farmacias que lo tienen y su precio.
- **Alta guiada** `/directorio/mi-negocio/nuevo` (6 pasos, con borrador y vista previa) y **panel** `/directorio/mi-negocio`: editar datos, fotos, horario, catálogo y turnos, pausar o eliminar. Publicar el primer negocio da +30 🪙.

Probado: 58 pruebas de base de datos (`supabase/tests/directorios.test.mjs`, incluido el flujo real de alta y edición) y 29 de lógica de interfaz (`supabase/tests/directorio-ui.test.mjs`). Los pedidos con carrito y las solicitudes con ofertas son la Fase 2. Diseño completo (modelo, flujos, rutas y componentes, pautas de autoservicio, riesgos y fases): **[docs/arquitectura-directorios.md](docs/arquitectura-directorios.md)**.

### Persona Engine (simulación de personas)
- `supabase/seed_personas.sql` crea **5 personas completas de Ecuador**: Emilia Vintimilla (Cuenca, restauradora y ceramista), Mariana Larrea (Quito, fundadora de café de especialidad), Génesis Villamar (Guayaquil · Puerto Santa Ana, coach de liderazgo), Sebastián Astudillo (Cuenca · Turi, violinista) y Andrés Terán (Quito · Cumbayá, ingeniero civil). Cada una trae biografía, universidad, colegio, estatura, profesión, **pareja ideal** (privada) y una galería de 5–6 fotos: el retrato (foto 0 = avatar, de pravatar.cc) y escenas reales de su ciudad (Wikimedia Commons, licencias libres; los créditos están en la cabecera del SQL y en `supabase/seed/escenas_ecuador.ts`). Todas las URLs son públicas y se verificaron con HTTP 200. Comparten universidad o colegio entre sí a propósito (Emilia y Sebastián; Mariana y Andrés) para que el motor de recomendación tenga con qué trabajar.
- El script es **idempotente y atómico** (una transacción): reemplaza la galería completa de cada persona (por eso re-ejecutarlo sustituye las fotos del seed anterior) y no pisa el `@usuario` si una persona real ya lo tiene. Son perfiles demo (`is_demo`): no pueden iniciar sesión y la galería `/explorar` los marca como «Perfil demo».
- Generar más (carga/rendimiento): `npx tsx supabase/seed/personas.ts --count 200 --out supabase/seed_personas_200.sql` (las personas 6 en adelante son relleno para pruebas de carga con 10 fotos de picsum.photos cada una).
- **`/admin/personas`** (solo administradores): lista las personas con su galería y estadísticas, y permite que **interactúen contigo** (like, superlike, descartar, solicitud de amistad, mensaje) mediante la RPC `admin_simulate`, que la base de datos restringe a administradores y a perfiles demo. Sirve para probar matches, notificaciones y chat con una sola cuenta real.

### Modelo de datos
| Tabla | Contenido |
|---|---|
| `profiles` | Perfil público, KYC (`kyc_status`, `identity_verified`) y **`trust_score`** (0–100, calculado en el servidor) |
| `user_private` | Fecha de nacimiento y teléfono (solo el propio usuario) |
| `listings` | Ofertas **y** demandas de inmuebles, vehículos y negocios |
| `listing_matches` | Pares oferta↔demanda que coinciden (los mantiene un trigger) |
| `matches`, `person_swipes`, `friendships` | Citas, compatibilidad astral y contactos |
| `jobs`, `job_applications` | Servicios (gigs) y vacantes |
| `chats`, `chat_members`, `messages` | Mensajería (texto, ofertas, cotizaciones, sistema) |
| `notifications`, `posts`, `post_likes`, `post_comments`, `reviews` | Avisos, comunidad y reputación |
| `wallets`, `wallet_ledger`, `missions_claimed`, `tarot_draws` | Monedas y tarot (solo mutables vía RPC) |
| `referrals`, `daily_challenge_claims` | Red de invitaciones y cobros de retos diarios (solo lectura propia; se escriben vía RPC) |
| `kyc_submissions`, `app_admins` | Verificación de identidad |

### Seguridad
- **RLS activado en todas las tablas** y privilegios mínimos (todo cerrado por defecto).
- **Privilegios por columna**: el cliente no puede escribir `identity_verified`, `kyc_status`, `rating`, `trust_score`, `badges`, `boosted_until`, monedas… Solo funciones `SECURITY DEFINER`.
- Chats visibles solo para sus miembros; las ofertas/cotizaciones solo cambian de estado vía `respond_offer()`.
- Storage: bucket público `media` (escritura solo en `<tu_uid>/…`) y bucket **privado** `kyc` (solo tú y administradores; sin edición ni borrado por el usuario).
- El middleware valida el token con `auth.getUser()` y el callback OAuth solo acepta redirecciones internas.

### Motor de coincidencias (oferta ↔ demanda)
Al insertar o modificar un anuncio, un trigger ejecuta `refresh_listing_matches()`: cruza el inventario con las búsquedas activas (categoría, operación, tipo, zona, moneda, presupuesto —con oferta relámpago aplicada— y superficie mínima), guarda los pares en `listing_matches` y crea notificaciones **solo para pares nuevos**. Las notificaciones llegan al instante por Realtime. Índices: `listings_match_idx`, `listings_offer_price_idx`, `listings_demand_budget_idx` y `listings_zone_trgm_idx` (pg_trgm).

### Tiempo real
Mensajes, notificaciones, monedero, amistades y matches por `postgres_changes`; presencia ("en línea" y "N personas viendo esto") y "escribiendo…" por Presence/Broadcast.

## Despliegue automatizado
1. **App (Vercel)**: importa el repositorio en [vercel.com/new](https://vercel.com/new) (Next.js se detecta solo) y define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Cada push a `main` despliega producción y cada pull request genera una vista previa. Añade la URL de producción a *Authentication → URL Configuration → Redirect URLs* de Supabase.
2. **Integración continua** (`.github/workflows/ci.yml`): en cada push/PR ejecuta tipos, lint, `next build` y las pruebas (lógica de cliente, medios y base de datos con PostgreSQL real). Conviene exigir que pase antes de fusionar (*Settings → Branches → Require status checks*).
3. **Base de datos**: aplica una vez `supabase/update_003_conexion_viral.sql` en el *SQL Editor* de Supabase, o automatízalo con el flujo manual **Aplicar actualización de base de datos** (`.github/workflows/db-migrate.yml`), que usa el secreto `SUPABASE_DB_URL` (entorno `production` para poder exigir aprobación). Aplica la base **antes** de desplegar la app: la app nueva llama a funciones y columnas que la 003 y la 004 crean.

## Pruebas de la base de datos
No tocan tu proyecto: levantan un PostgreSQL embebido, imitan `auth`/`storage` y aplican `schema.sql` + `seed.sql`.
```bash
npm i --no-save embedded-postgres pg tsx
npx tsx supabase/tests/db.test.mjs        # base de datos + API de fotos con Postgres real
npx tsx supabase/tests/media.test.mjs     # procesado de imágenes (formatos, EXIF, límites, rendimiento)
npx tsx supabase/tests/ui-logica.test.mjs # sincronización de fotos y validación del onboarding
```
Cubren RLS y privilegios por columna, el motor de coincidencias (incluido rendimiento con 20 000 anuncios), RPC de chat/ofertas/KYC/monedas, Storage, paridad SQL↔TypeScript de la compatibilidad astral y del puntaje de confianza, y que **todas las tablas, columnas y funciones que usa `src/` existan** en el esquema.

## Limitaciones conocidas
- **Sin bots**: al ser datos reales, nadie responde en los chats salvo otras cuentas reales (los perfiles demo no escriben). Prueba con dos cuentas.
- **KYC manual**: la revisión la hace un administrador desde `/admin/kyc`; no hay proveedor automático (Stripe Identity, Onfido…).
- **Teléfono**: no hay verificación por SMS (`phone_verified` queda en falso).
- **Pagos**: aceptar una oferta o cotización solo registra el acuerdo; no se procesa ningún pago.
- **Escala**: la app carga hasta 500 anuncios, 300 servicios y 100 publicaciones al arrancar; para más volumen hay que paginar en servidor.
- **Oferta relámpago del seed** dura hasta el fin del día del seeding.
- **Fotos**: no hay moderación de contenido (NSFW) ni límite de frecuencia de subidas; añádelos (p. ej. un servicio de moderación y rate limiting en `/api/photos`) antes de abrir el registro al público. Las personas del seed usan imágenes externas (pravatar.cc, Wikimedia Commons y, en el relleno, picsum.photos) y no pasan por el pipeline de subida; los retratos son fotos de muestra de otras personas, por eso los perfiles se marcan como demo. No los ejecutes en producción con usuarios reales sin dejarlo claro, y sustitúyelos por fotos propias o con licencia antes de un lanzamiento público.
- **S3 propio**: el bucket de Supabase Storage ya es compatible con S3; un bucket S3/R2 directo requiere un driver nuevo (interfaz `Almacenamiento`).
- **API**: se usa la API REST/RPC de Supabase (PostgREST); no hay GraphQL (puede activarse con `pg_graphql`).
- Astrología y tarot son entretenimiento.
