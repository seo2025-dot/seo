# Economía de monedas y pagos (PayPhone y PayPal)

> **Estado.** Programado y probado (actualización `update_010_monedas.sql`): tarifas de uso con **3 usos gratis por acción**, tienda de monedas
> (**$0.50 · $1.50 · $3.50**), retos para ganar monedas sin pagar y todo el flujo de pago con PayPhone y PayPal. Lo único que falta para cobrar
> de verdad son **las credenciales de cada pasarela** (ver §6). Sin ellas la tienda muestra «Próximamente» en esa pasarela y nada se rompe.

> **Pagos por país.** PayPhone solo opera en Ecuador: la tienda lo ofrece a quien está en Ecuador (o no ha indicado país) y `/api/pagos/crear`
> lo rechaza a quien tiene otro país en su perfil. En el resto del mundo (España, Colombia, México, Europa…) se paga con **PayPal**, que acepta tarjetas
> internacionales (`pasarelasParaPais` en `src/lib/monedas.ts`). Los precios siguen en dólares.

## 1. La idea

Todas las personas y negocios tienen sus **primeros 3 usos gratis** de cada acción. Desde el cuarto se pagan con monedas, que se **compran**
(paquetes desde $0.50) o se **ganan con retos** (invitar amigos, calificar comercios, pedir, reservar…). Así el negocio ve que el sistema le
trae clientes antes de pagar, y las personas que no quieren gastar dinero pueden seguir usándolo a cambio de participar: economía circular.

| Acción | Quién paga | Gratis | Después | Se devuelve si… |
|---|---|---|---|---|
| Hacer un pedido | quien pide | 3 | 1 🪙 | el negocio lo rechaza o no responde en 3 h |
| Aceptar un pedido | el negocio | 3 (sus 3 primeros clientes) | 5 🪙 | — |
| Pedir ofertas | quien pide | 3 | 2 🪙 | — |
| Enviar una oferta | el profesional | 3 | 3 🪙 (reofertar no cobra) | — |
| Publicar un evento | el organizador | 3 | 10 🪙 | — |
| Reservar entradas | quien reserva | 3 | 1 🪙 por reserva | el organizador cancela el evento |
| Mensajes en citas | quien escribe | 3 por conversación | 1 🪙 cada 5 mensajes | — |
| Destacar mi negocio 24 h | el negocio | — | 30 🪙 | — |

**Por qué esos números.** Con el paquete más pequeño una moneda cuesta **1 centavo**: aceptar un pedido cuesta 5 centavos (≈0,6 % de un pedido de
$8, frente al 20–30 % de las apps de reparto), pedir o reservar cuesta como mucho 1 centavo, y escribir en una cita cuesta 1 centavo cada 5
mensajes. Es lo bastante barato para que nadie se lo piense y lo bastante frecuente para que un negocio con actividad recargue cada semana.

Todo se ajusta **sin tocar el código**: `coin_prices` (usos gratis, coste, activar/desactivar), `coin_packages` (precio y monedas de cada paquete),
`coin_settings` (bonificación de la primera compra: +25 %) y `coin_challenges` (retos y premios) son tablas que un administrador edita desde el panel `/admin/monedas` (§4) o, si prefiere, en el SQL Editor.

### Paquetes

| Paquete | Precio | Monedas | Por moneda | Primera compra (+25 %) |
|---|---|---|---|---|
| Recarga mini | $0.50 | 50 | 1,00 ¢ | 62 |
| Recarga plus (más popular) | $1.50 | 165 | 0,91 ¢ (−9 %) | 206 |
| Recarga pro (mejor precio) | $3.50 | 420 | 0,83 ¢ (−17 %) | 525 |

### Retos (ganar sin gastar)

Además de los retos diarios, el bono diario, la ruleta y las invitaciones que ya existían (+50 por amigo y hitos de 3, 5, 10 y 20 invitados,
hasta +2 000 con 20 amigos), hay **retos semanales y únicos** que miden lo que la persona ya hace: calificar 2 comercios (+25), recibir 2 pedidos
(+20), interactuar 10 veces en la comunidad (+20), sumar 3 amigos (+25), pedir o responder una solicitud (+15), reservar entradas (+10) y, para
negocios, **entregar 5 pedidos (+40)**; y de una sola vez: primera reseña, primer pedido y primera entrada. El progreso lo calcula la base de
datos contando filas reales (no hay nada que el navegador pueda falsear) y cada reto se cobra **una sola vez por periodo** (la semana empieza el
lunes a las 00:00 de Ecuador).

## 2. Cómo se cobra (base de datos)

Todo el cobro vive en **disparadores**: da igual desde dónde llegue la acción (la app, una función, un script), se cobra igual y en la misma
transacción que la acción. Si no hay saldo la acción **no ocurre** y el error es `insufficient_coins:<acción>:<coste>`; las pantallas lo traducen a
«🪙 Necesitas 5 monedas para aceptar este pedido» con los botones *Recargar* y *Ganar monedas gratis*.

- `_charge(usuario, acción)` cuenta los usos gratis en `coin_usage` y, agotados, descuenta monedas con `_spend` (que deja el apunte en `wallet_ledger`).
- Pedidos: `orders_charge_buyer` (al pedir) y `orders_status_coins` (al aceptar cobra al negocio; al rechazar o caducar devuelve al cliente).
- Solicitudes, ofertas, eventos y reservas: un disparador `BEFORE INSERT` en cada tabla. La reserva cancelada por el organizador se devuelve.
- Citas: `messages_charge` solo cuenta lo que una persona escribe desde su sesión en un chat de cita o match (los chats comerciales, los mensajes del
  sistema y las personas de demostración no se cobran).
- Las monedas **nunca las escribe el cliente** (`wallets` no admite `update` desde el navegador; hay una prueba).

## 3. Cómo se paga (pasarelas)

```
Navegador ── POST /api/pagos/crear {paquete, pasarela} ──▶ create_coin_payment()  (importe y monedas los fija la BASE)
          ◀── {url} ──                                       └─ crea el pago PENDIENTE
          ── redirige a PayPhone o PayPal ──▶ la persona paga ──▶ la pasarela devuelve al navegador a…
                 /api/pagos/payphone/retorno?id&clientTransactionId       (PayPhone)
                 /api/pagos/paypal/retorno?token&ref                      (PayPal)
          el SERVIDOR confirma con la pasarela ──▶ credit_coin_payment()  (solo service_role) ──▶ monedas + aviso
                                                     ▲
   PayPal además avisa a /api/pagos/paypal/webhook (por si la persona cierra el navegador antes de volver)
```

Reglas de seguridad (todas con pruebas):

- **El navegador nunca acredita monedas** ni elige el precio. `credit_coin_payment` y `fail_coin_payment` solo las puede ejecutar `service_role`
  (la clave `SUPABASE_SERVICE_ROLE_KEY` vive solo en el servidor, sin prefijo `NEXT_PUBLIC_`, en un módulo `server-only`).
- Se acredita **con lo que la pasarela responde** (importe y referencia de *su* respuesta), nunca con lo que venga en la URL. Si el importe no coincide
  con el fijado al crear el pago, el pago queda `failed` y no se acredita nada.
- **Idempotente:** retorno y webhook pueden llegar los dos (o repetidos): las monedas se acreditan una sola vez. Una misma operación de la pasarela
  tampoco puede pagar dos pagos (`unique (provider, provider_ref)`).
- El webhook de PayPal exige **firma válida** (se verifica con PayPal) y `PAYPAL_WEBHOOK_ID`; sin eso, no hace nada.
- El «pago de prueba» acredita al instante sin cobrar y **solo existe fuera de producción** (`NODE_ENV`); ninguna variable puede activarlo en producción.
- Máximo 8 pagos pendientes por persona y hora.

Rutas: `POST /api/pagos/crear` · `GET /api/pagos/pasarelas` · `GET /api/pagos/payphone/retorno` · `GET /api/pagos/paypal/retorno` ·
`POST /api/pagos/paypal/webhook` · `GET /api/pagos/cancelado` · `GET /api/pagos/prueba/retorno` (solo desarrollo).
Pantallas: `/monedas` (saldo, usos gratis, tienda, retos, movimientos) y `/monedas/resultado` (estado real del pago, con reintentos mientras sigue pendiente).

Código: `src/lib/pagos/{payphone,paypal,flujo,config,tipos}.ts` (sin Next ni Supabase: reciben `fetch` y sus dependencias, y se prueban con pasarelas
simuladas en `supabase/tests/pagos.test.mjs`), `src/lib/pagos/servidor.ts` y `src/lib/supabase/admin.ts` (cableado real) y `src/app/api/pagos/**` (rutas finas).

## 4. Panel de administración (`/admin/monedas`)

Solo para quienes están en `app_admins` (la pantalla lo comprueba y, además, **cada función `admin_*` de la base de datos vuelve a comprobar `is_admin()`**:
las tablas de tarifas, paquetes y ajustes no tienen ninguna escritura desde el navegador). Acceso: tu perfil > «Administrar monedas».

| Pestaña | Qué permite |
|---|---|
| Resumen | Ingresos, ticket medio, compradores y % que repite, ingreso por persona, monedas en circulación / emitidas / gastadas, **rotación** (gastadas ÷ emitidas: si es baja la gente acumula sin usar), ingresos por día, de dónde salen las monedas, en qué se gastan y ventas por pasarela y paquete (7, 30 o 90 días, en hora de Ecuador) |
| Ventas | Todos los pagos con filtro por estado, persona, importe, pasarela, referencias y el motivo si falló (importe distinto, cancelado…) para resolver reclamos |
| Tarifas y paquetes | Editar usos gratis y coste de cada acción (o apagarla), crear y editar paquetes (precio, monedas, etiqueta, activo), la bonificación de la primera compra y la meta y el premio de cada reto |
| Personas | Buscar por nombre, @usuario, correo o id; ver saldo, usos, pagos y movimientos; **sumar o restar monedas con un motivo obligatorio** (no deja el saldo en negativo) |
| Registro | Quién cambió qué y cuándo, con el antes y el después |

Notas: un cambio de precio de un paquete **no altera los pagos ya iniciados** (cada pago guarda su importe y sus monedas); los ajustes de saldo quedan en el
historial de la persona (`admin:…` / `admin_debit:…`) y en el registro; el correo solo lo ve el administrador.

## 5. Pruebas

`supabase/tests/monedas.test.mjs` (38, PostgreSQL real): tarifas, 3 gratis y cobro desde el cuarto en cada acción, devoluciones, mensajes de citas
(paridad TypeScript↔SQL), destacar, regalos de admin, retos (progreso, cobro único, semana siguiente), tienda (importe fijado por el servidor, solo
`service_role` acredita, idempotencia, importes falsos, referencias repetidas) el panel de administración (permisos, estadísticas que cuadran con los datos, paridad de las validaciones, auditoría) y las migraciones 010 y 011.
`supabase/tests/pagos.test.mjs` (40): forma exacta de cada llamada a PayPhone y PayPal, acreditación solo con lo confirmado, firma del webhook,
configuración y lógica de monedas de la interfaz.

## 6. Qué hace falta para cobrar de verdad

**PayPhone** (Botón de pagos, Ecuador): en [PayPhone Business](https://www.payphone.app/) crea una aplicación de tipo *Web* y copia
`PAYPHONE_TOKEN` (token de la aplicación) y `PAYPHONE_STORE_ID`; en «URL de respuesta» registra `https://TU-DOMINIO/api/pagos/payphone/retorno`.
Decide si el precio lleva **IVA desglosado** (`PAYPHONE_IVA_PCT`, 0 por defecto = el importe se envía sin desglosar).

**PayPal**: en [developer.paypal.com](https://developer.paypal.com/) crea una app REST y copia `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`
(`PAYPAL_ENV=sandbox` para probar, `live` en producción); crea un webhook a `https://TU-DOMINIO/api/pagos/paypal/webhook` con el evento
`PAYMENT.CAPTURE.COMPLETED` y copia su **Webhook ID** a `PAYPAL_WEBHOOK_ID`.

**Servidor**: `SUPABASE_SERVICE_ROLE_KEY` (Supabase > Project Settings > API > *service_role*; ¡nunca en el navegador ni en el repositorio!) y
`NEXT_PUBLIC_SITE_URL` con la dirección pública. Después: aplicar `update_010_monedas.sql` y probar primero en sandbox (PayPal) y con una tienda de
pruebas (PayPhone): las llamadas siguen la documentación de cada pasarela pero **no se han podido ejecutar contra sus servidores sin credenciales**.
