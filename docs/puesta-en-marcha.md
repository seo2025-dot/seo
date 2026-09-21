# Puesta en marcha: que todo funcione y te llegue el correo cuando alguien se registre

Son 4 pasos. Hazlos **en este orden** (primero la base de datos, después publicar la app: la app nueva usa columnas que la base de datos antigua no tiene).

## 1. Base de datos (Supabase) — 1 minuto

1. Entra en [supabase.com](https://supabase.com) → tu proyecto → **SQL Editor** → **New query**.
2. Abre el archivo `supabase/actualizar_todo.sql` de este proyecto, **copia todo su contenido**, pégalo y pulsa **Run**.
   - Aplica solo las actualizaciones que le falten a tu base de datos y se salta las que ya tiene; puedes ejecutarlo las veces que quieras.
   - En la pestaña *Messages* verás algo como `Actualización 014: aplicada` o `ya estaba aplicada, se omite`.
3. Hazte administrador (cambia el correo por el tuyo, el mismo con el que te registraste en la plataforma). Pégalo en otra consulta y pulsa Run:
   ```sql
   insert into public.app_admins (user_id)
   select id from auth.users where email = 'estudiosbarterrubio@hotmail.com'
   on conflict do nothing;
   ```
   Si no devuelve filas es que todavía no te has registrado con ese correo: regístrate en la plataforma y vuelve a ejecutarlo.

### Importante: direcciones de confirmación de correo (Supabase)

Si al confirmar el correo la persona acaba en `localhost` (o en `0.0.0.0`), Supabase tiene mal la dirección de la web. Corrígelo una vez:

1. Supabase → tu proyecto → **Authentication** → **URL Configuration**.
2. **Site URL**: `https://conectari.com` (sin barra final). Quita `http://localhost:3000`.
3. **Redirect URLs** → *Add URL*: añade `https://conectari.com/**` (y `https://www.conectari.com/**` si usas www). Puedes dejar
   `http://localhost:3000/**` solo para trabajar en tu computadora.
4. **Save changes**.

Sin esto Supabase ignora la dirección que envía la app y usa la «Site URL», que por defecto es `http://localhost:3000`. (La app, además, construye sus
redirecciones con `NEXT_PUBLIC_SITE_URL` y no con la dirección interna del servidor: ver `src/lib/origen.ts`.)

## 2. Claves del servidor (Hostinger) — 3 minutos

En [hPanel](https://hpanel.hostinger.com) abre tu sitio (la aplicación Node.js) → **Environment variables** (en el menú lateral). Las variables valen para la
compilación y para la app en marcha, y se conservan entre publicaciones ([documentación de Hostinger](https://docs.hostinger.com/node.js/environment-variables)).

**Lo más fácil:** en el proyecto hay un archivo **`.env.hostinger`** ya preparado (git lo ignora: nunca se sube). Rellena a mano las dos líneas que quedan
vacías y pulsa **Import .env** en Hostinger:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya vienen en el archivo |
| `RESEND_API_KEY`, `ADMIN_ALERT_EMAIL` | ya vienen en el archivo |
| `NEXT_PUBLIC_SITE_URL` | la dirección de tu web, p. ej. `https://conectari.com` (sin barra final) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** (secreta: solo aquí; nunca en el código ni en el chat) |

Después de cambiar variables hay que **volver a publicar** (paso 3): las que empiezan por `NEXT_PUBLIC_` se incorporan al compilar.

## 3. Publicar la versión nueva

1. En GitHub fusiona la rama `feat/directorio-pedidos` en `main` (*Pull requests* → *New pull request* → *Create* → *Merge*).
2. En hPanel comprueba que tu sitio publica la rama `main` (*Settings & Redeploy*) y pulsa **Redeploy** si no arrancó solo. Tarda unos minutos.
3. Si tras publicar ves la página anterior, en hPanel desactiva o vacía la caché/CDN del sitio (una vez): las respuestas antiguas guardadas pueden seguir
   apareciendo. Ver también `docs/renderizado-y-errores.md`.

## 4. Comprobarlo

1. Abre la web en una ventana privada y **regístrate con otro correo** (uno de prueba).
2. En menos de un minuto te llega a `estudiosbarterrubio@hotmail.com` un correo **«Nuevo registro: …»** (mira también en spam la primera vez).
3. Entra con tu cuenta: arriba verás el botón violeta **Admin**. Ahí está el panel `/admin` y la cola de verificación de identidad.
4. Registra un negocio de prueba desde el directorio → te llega **«Nuevo negocio: …»**. Sube una cédula y selfie desde `/verificacion` → te llega
   **«Verificación de identidad pendiente»**.

Si el correo no llega: abre `/admin`; si hay avisos por enviar te dirá cuántos y el motivo probable (variables sin configurar). Los avisos **no se
pierden**: salen en cuanto se corrija la configuración.
