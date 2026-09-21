# Avisos por correo y panel de administración

> Actualización `update_014_admin_alertas.sql` + `src/lib/avisos/**` + `src/app/admin/**`.

## 1. Qué avisos te llegan

Recibes un correo en la dirección que configures (`ADMIN_ALERT_EMAIL`) cuando:

| Momento | Asunto | Qué incluye |
|---|---|---|
| Alguien **se registra** (correo o Google) | `Nuevo registro: correo@…` | correo, nombre, usuario, fecha de registro (hora de Ecuador), rol inicial (`usuario`) y si confirmó el correo |
| Alguien **registra un negocio** | `Nuevo negocio: <nombre>` | negocio, sección, ubicación, dueña o dueño y su correo, fecha |
| Alguien **envía su cédula y selfie** | `Verificación de identidad pendiente: <nombre>` | nombre, correo y enlace directo a `/admin/kyc` (el correo nunca lleva la cédula) |

Las cuentas de demostración (`is_demo`) no generan correo.

## 2. Cómo funciona (y por qué no se pierden avisos)

1. Un **disparador** en la base de datos escribe una fila en `admin_alerts` en cuanto ocurre el hecho. Si escribir el aviso fallara, el registro o
   el negocio se completan igual: avisar nunca bloquea a nadie.
2. Justo después, la app llama a `POST /api/avisos/procesar` (al registrarse, al terminar el alta del negocio, al enviar la verificación, al
   confirmar el correo o entrar con Google, y cada vez que abres `/admin`). El servidor **reserva** los avisos pendientes
   (`claim_admin_alerts`), envía un correo por cada uno con [Resend](https://resend.com) y los marca como enviados (`finish_admin_alert`).
3. Si el envío falla, el aviso vuelve a la cola y se reintenta (hasta 5 veces; una reserva colgada caduca a los 2 minutos). Sin configuración
   (falta `RESEND_API_KEY`, `ADMIN_ALERT_EMAIL` o `SUPABASE_SERVICE_ROLE_KEY`) el servidor **no toca la cola**: los avisos esperan y salen en cuanto
   lo configures.
4. Seguridad: el correo solo va al `ADMIN_ALERT_EMAIL` del servidor; la ruta no recibe datos; los enlaces usan `NEXT_PUBLIC_SITE_URL` (nunca la
   dirección de la petición, que se podría falsificar); lo que escriben las personas se escapa en el HTML; solo el servidor (`service_role`) puede
   usar la cola y solo los administradores la leen.

> Un cron externo (p. ej. cada 15 minutos a `https://tu-dominio/api/avisos/procesar`) sirve de red de seguridad si nadie abre la app, pero no es
> imprescindible: los avisos también salen al abrir `/admin`.

## 3. Configurarlo (10 minutos)

1. Crea una cuenta gratis en [resend.com](https://resend.com) **con el correo donde quieres recibir los avisos**.
2. En Resend: *API Keys → Create API Key* y copia la clave (empieza por `re_`).
3. En el servidor (Vercel u otro), o en `.env.local` para probar en tu computadora, añade:
   ```
   RESEND_API_KEY=re_...
   ADMIN_ALERT_EMAIL=el-correo-donde-quieres-recibirlos
   SUPABASE_SERVICE_ROLE_KEY=...     (Supabase > Project Settings > API > service_role; solo en el servidor)
   NEXT_PUBLIC_SITE_URL=https://conectari.com
   ```
4. Ejecuta `supabase/update_014_admin_alertas.sql` en el SQL Editor de Supabase (idempotente).
5. Prueba: registra una cuenta de prueba y mira tu bandeja (y la carpeta de spam la primera vez).

Sobre el remitente: por defecto es `Conectari <onboarding@resend.dev>`, un remitente de pruebas de Resend que **solo entrega al correo con el que creaste tu
cuenta de Resend**; por eso el paso 1. Cuando tengas dominio propio, verifícalo en Resend (*Domains*) y define `ALERT_FROM=Avisos <avisos@tu-dominio.com>`.

## 4. El panel de administración

- **Acceso fácil**: si eres administrador ves un botón violeta **«Admin»** en la barra superior, en todas las páginas, con el número de
  verificaciones pendientes. También está en tu perfil («Panel de administración»). La dirección directa es `/admin`.
- **`/admin` (Resumen)**: una tarjeta grande te dice cuántas personas esperan verificación y te lleva a revisarlas; cifras de registros (hoy, 7 días,
  total) y de negocios; los últimos 10 registros y los últimos 10 negocios con su correo; y un aviso si hay correos sin poder enviarse.
- **`/admin/kyc` (Identidad)**: por cada solicitud ves nombre, correo, edad y ubicación, y **tres fotos lado a lado: cédula, selfie y foto de perfil**
  (toca una para verla en grande; los enlaces caducan a los 10 minutos). Botones **Aprobar** y **Rechazar** con motivos frecuentes de un toque; hay
  pestañas *Pendientes / Aprobadas / Rechazadas* para el historial. Al decidir, la persona recibe una notificación en la app.
- Además: `/admin/monedas` (economía) y `/admin/personas` (personas demo). Todas comparten las mismas pestañas de navegación.

Cómo te haces administrador: en el SQL Editor de Supabase, `insert into public.app_admins (user_id) select id from auth.users where email = 'tu-correo';`
