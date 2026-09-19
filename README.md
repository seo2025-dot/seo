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
4. *(Opcional)* ejecuta `supabase/seed_personas.sql`: **3 personas simuladas completas con 10 fotos cada una** (ver [Persona Engine](#persona-engine-simulación-de-personas)).
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
Tras registrarse, `GuardaOnboarding` lleva a `/onboarding` (solo si `profiles.onboarding_completed` es `false`): **Sobre ti → Intereses → Fotos → Confirmar**. Cada paso se valida en el cliente y `complete_onboarding()` lo **vuelve a validar en el servidor** (nombre, usuario, fecha de nacimiento ≥ 18 años, al menos 1 foto). El indicador no es escribible directamente por el cliente.

### Persona Engine (simulación de personas)
- `supabase/seed_personas.sql` crea **3 personas completas** (Valentina Cruz, Mateo Salinas, Lucía Andrade): usuario, perfil con onboarding completo, fecha de nacimiento y **10 fotos cada una** (URLs deterministas de picsum.photos). Son perfiles demo (`is_demo`): no pueden iniciar sesión.
- Generar más (carga/rendimiento): `npx tsx supabase/seed/personas.ts --count 200 --out supabase/seed_personas_200.sql` (200 personas = 2 000 fotos).
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
- **Fotos**: no hay moderación de contenido (NSFW) ni límite de frecuencia de subidas; añádelos (p. ej. un servicio de moderación y rate limiting en `/api/photos`) antes de abrir el registro al público. Las 3 personas del seed usan imágenes externas (picsum.photos), no pasan por el pipeline de subida.
- **S3 propio**: el bucket de Supabase Storage ya es compatible con S3; un bucket S3/R2 directo requiere un driver nuevo (interfaz `Almacenamiento`).
- **API**: se usa la API REST/RPC de Supabase (PostgREST); no hay GraphQL (puede activarse con `pg_graphql`).
- Astrología y tarot son entretenimiento.
