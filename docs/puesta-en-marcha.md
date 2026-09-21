# Puesta en marcha: que todo funcione y te llegue el correo cuando alguien se registre

Son 4 pasos. Hazlos **en este orden** (primero la base de datos, después publicar la app: la app nueva usa columnas que la base de datos
antigua no tiene).

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

## 2. Claves del servidor — 3 minutos

En el hosting donde está publicada la app (normalmente **Vercel** → tu proyecto → *Settings* → *Environment Variables*) añade estas cuatro variables
(marca *Production*):

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | la clave de Resend (empieza por `re_`) |
| `ADMIN_ALERT_EMAIL` | `estudiosbarterrubio@hotmail.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** (secreta: solo aquí, nunca en el código ni en el chat) |
| `NEXT_PUBLIC_SITE_URL` | la dirección de tu web, p. ej. `https://conectari.com` |

Las dos que ya usa la app (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) deben seguir ahí.

## 3. Publicar la versión nueva

Fusiona la rama `feat/directorio-pedidos` en `main` (en GitHub: *Pull requests* → *New pull request* → *Create* → *Merge*). Vercel publica solo en
un par de minutos. Si añadiste o cambiaste variables en el paso 2, hace falta esa publicación para que las tomen.

## 4. Comprobarlo

1. Abre la web en una ventana privada y **regístrate con otro correo** (uno de prueba).
2. En menos de un minuto te llega a `estudiosbarterrubio@hotmail.com` un correo **«Nuevo registro: …»** (mira también en spam la primera vez).
3. Entra con tu cuenta: arriba verás el botón violeta **Admin**. Ahí está el panel `/admin` y la cola de verificación de identidad.
4. Registra un negocio de prueba desde el directorio → te llega **«Nuevo negocio: …»**. Sube una cédula y selfie desde `/verificacion` → te llega
   **«Verificación de identidad pendiente»**.

Si el correo no llega: abre `/admin`; si hay avisos por enviar te dirá cuántos y el motivo probable (variables sin configurar). Los avisos **no se
pierden**: salen en cuanto se corrija la configuración.
