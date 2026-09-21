/**
 * Pruebas de la economía de monedas (supabase/update_010_monedas.sql) contra un PostgreSQL real embebido.
 *
 *   npm i --no-save embedded-postgres pg tsx
 *   npx tsx supabase/tests/monedas.test.mjs
 *
 * Verifica: 3 usos gratis por acción y cobro a partir del cuarto (pedidos, aceptar, solicitudes, ofertas, eventos, reservas),
 * devoluciones, 3 mensajes gratis por cita y 1 moneda cada 5, destacar negocio, retos de comunidad (progreso, cobro único por periodo),
 * la tienda (importe fijado por el servidor, acreditación solo por service_role, idempotencia, importes falsos) y la migración 010.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { PAQUETES_DEFECTO, PRECIOS_DEFECTO, bonoPrimeraCompra, costeMensaje } from "@/lib/monedas";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const esquema = path.join(aqui, "..", "schema.sql");
const puerto = 55446;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "monedas-test-"));

const server = new EmbeddedPostgres({
  databaseDir: dir, user: "postgres", password: "pw", port: puerto, persistent: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C", "--no-sync"],
  onLog: () => {}, onError: () => {},
});
await server.initialise();
await server.start();
await server.createDatabase("test");

const conn = { host: "localhost", port: puerto, user: "postgres", password: "pw", database: "test" };
const su = new pg.Client(conn);
await su.connect();
su.on("notice", () => {});

let ok = 0;
let fallos = 0;
const test = async (nombre, fn) => {
  try {
    await fn();
    ok++;
    console.log("  ✓", nombre);
  } catch (e) {
    fallos++;
    console.log("  ✗", nombre, "\n     ", String(e.message).split("\n")[0]);
  }
};
const q = async (sql, params) => (await su.query(sql, params)).rows;

/** Ejecuta SQL como un rol de la base: una persona autenticada, anónimo (uid null) o el servidor (`"service"`). */
async function como(uid, sql, params) {
  const c = new pg.Client(conn);
  await c.connect();
  try {
    await c.query("begin");
    const rol = uid === "service" ? "service_role" : uid ? "authenticated" : "anon";
    await c.query(`set local role ${rol}`);
    const claims = uid === "service" ? { role: "service_role" } : uid ? { sub: uid, role: "authenticated" } : { role: "anon" };
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const res = await c.query(sql, params);
    await c.query("commit");
    return res.rows;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}
const falla = async (promesa, patron) => {
  try {
    await promesa;
  } catch (e) {
    if (patron && !patron.test(e.message)) throw new Error(`Error inesperado: ${e.message}`);
    return e;
  }
  throw new Error("Se esperaba un error y no ocurrió");
};

await su.query(fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8"));
try {
  await su.query(fs.readFileSync(esquema, "utf8"));
  console.log("  schema.sql aplicado");
} catch (e) {
  console.log("  ✗ schema.sql →", e.message, e.position ? `(posición ${e.position})` : "");
  process.exit(1);
}

// ── Utilidades ──────────────────────────────────────────────────────────────
let contador = 0;
/** Persona nueva con el saldo de bienvenida de la app (20 monedas) salvo que se indique otro. */
const saldoInicial = new Map();
const persona = async (nombre, { monedas } = {}) => {
  const id = randomUUID();
  await q("insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3, now())", [id, `${nombre.toLowerCase()}${++contador}@test.dev`, JSON.stringify({ full_name: nombre })]);
  if (monedas !== undefined) await q("update public.wallets set coins = $2 where user_id = $1", [id, monedas]);
  saldoInicial.set(id, monedas ?? 20);
  return id;
};
const saldo = async (uid) => (await q("select coins from public.wallets where user_id = $1", [uid]))[0].coins;
const uso = async (uid, accion) => (await q("select free_used, paid_used, spent from public.coin_usage where user_id = $1 and action = $2", [uid, accion]))[0];
const perfil = async (uid, { vertical = "delivery", subtype = "restaurante", name = "Sabor Cuencano", ...extra } = {}) => {
  const cols = { owner_id: uid, vertical, subtype, name, ...extra };
  const claves = Object.keys(cols);
  const fila = (await como(uid, `insert into public.providers (${claves.join(", ")}) values (${claves.map((_, i) => `$${i + 1}`).join(", ")}) returning id, slug`, Object.values(cols)))[0];
  // El primer perfil regala +30 monedas (recompensa de autoservicio): se anula para medir solo las tarifas.
  await q("update public.wallets set coins = $2 where user_id = $1", [uid, saldoInicial.get(uid) ?? 20]);
  return fila;
};
const articulo = async (prov, nombre, precio) => (await q("insert into public.provider_items (provider_id, kind, name, price) values ($1, 'menu_item', $2, $3) returning id", [prov, nombre, precio]))[0].id;
const pedir = (uid, prov, item, { tel = "0991234567" } = {}) =>
  como(uid, "select public.place_order($1, 'delivery', $2::jsonb, 'Av. Solano 1-23', 'Centro', '', 'cash', $3) id", [prov, JSON.stringify([{ item_id: item, qty: 1 }]), tel]).then((r) => r[0].id);
const estado = (uid, pedido, s) => como(uid, "select public.set_order_status($1, $2)", [pedido, s]);
const solicitar = (uid, titulo = "Necesito un plomero") =>
  como(uid, "select public.create_service_request('hogar', 'plomero', $1, '', 'Centro', '', 'today', null, null, '{}'::jsonb) id", [titulo]).then((r) => r[0].id);

// ── 1. Tarifas ──────────────────────────────────────────────────────────────
console.log("\nTarifas y paquetes");
await test("PARIDAD: las tarifas y los paquetes de fábrica de TypeScript son los que siembra la base", async () => {
  const filas = await q("select action, label, free_uses, cost from public.coin_prices order by sort");
  assert.deepEqual(filas.map((f) => [f.action, f.label, f.free_uses, f.cost]), PRECIOS_DEFECTO.map((p) => [p.accion, p.etiqueta, p.gratis, p.coste]));
  const paq = await q("select id, label, price_cents, coins, badge from public.coin_packages order by sort");
  assert.deepEqual(paq.map((p) => [p.id, p.label, p.price_cents, p.coins, p.badge ?? undefined]), PAQUETES_DEFECTO.map((p) => [p.id, p.etiqueta, p.centavos, p.monedas, p.insignia]));
  assert.deepEqual(paq.map((p) => p.price_cents), [50, 150, 350], "los tres paquetes definitivos: $0.50, $1.50 y $3.50");
  const [b] = await q("select value from public.coin_settings where key = 'first_purchase_bonus_pct'");
  assert.equal(b.value, 25);
});
await test("las tarifas y los paquetes son públicos de lectura y no se editan desde el cliente", async () => {
  assert.equal((await como(null, "select action from public.coin_prices")).length, PRECIOS_DEFECTO.length);
  assert.equal((await como(null, "select id from public.coin_packages")).length, 3);
  const u = await persona("Curiosa");
  await falla(como(u, "update public.coin_prices set cost = 0 where action = 'order_accept'"), /permission denied/);
  await falla(como(u, "update public.coin_packages set price_cents = 1 where id = 'pro'"), /permission denied/);
  await falla(como(u, "select * from public.coin_settings"), /permission denied/);
  await falla(como(u, "select public._charge($1, 'order_place')", [u]), /permission denied/);
  await falla(como(u, "update public.wallets set coins = 99999 where user_id = $1", [u]), /permission denied/);
});

// ── 2. Pedidos ──────────────────────────────────────────────────────────────
console.log("\nPedidos: 3 gratis y después monedas");
const duenoA = await persona("DuenoRestaurante", { monedas: 20 });
const sabor = await perfil(duenoA, { name: "Sabor Cuencano", channels: ["local", "entrega"] });
const ceviche = await articulo(sabor.id, "Ceviche mixto", 6.5);
await test("quien pide: los 3 primeros pedidos son gratis y el cuarto cuesta 1 moneda", async () => {
  const cli = await persona("ClienteUno");
  for (let i = 0; i < 3; i++) await pedir(cli, sabor.id, ceviche);
  assert.equal(await saldo(cli), 20, "tres pedidos gratis: el saldo no cambia");
  assert.deepEqual([(await uso(cli, "order_place")).free_used, (await uso(cli, "order_place")).paid_used], [3, 0]);
  const cuarto = await pedir(cli, sabor.id, ceviche);
  assert.equal(await saldo(cli), 19);
  assert.equal((await q("select coins_paid from public.orders where id = $1", [cuarto]))[0].coins_paid, 1);
  assert.deepEqual((await q("select delta, reason from public.wallet_ledger where user_id = $1 and reason like 'use:%'", [cli])).map((l) => [l.delta, l.reason.split(":").slice(0, 2).join(":")]), [[-1, "use:order_place"]]);
});
await test("sin monedas el pedido no se hace, no deja rastro y avisa cuánto cuesta", async () => {
  const pobre = await persona("ClienteSinSaldo", { monedas: 0 });
  for (let i = 0; i < 3; i++) await pedir(pobre, sabor.id, ceviche);
  const e = await falla(pedir(pobre, sabor.id, ceviche), /insufficient_coins:order_place:1/);
  assert.equal(e.code, "P0001");
  assert.equal((await q("select count(*)::int n from public.orders where customer_id = $1", [pobre]))[0].n, 3, "el cuarto pedido no se creó");
  assert.equal((await uso(pobre, "order_place")).paid_used, 0);
  await q("update public.wallets set coins = 1 where user_id = $1", [pobre]);
  await pedir(pobre, sabor.id, ceviche);
  assert.equal(await saldo(pobre), 0);
});
await test("el negocio: los 3 primeros clientes son gratis y desde el cuarto cuesta 5 monedas por aceptar", async () => {
  const cli = await persona("ClienteVarios", { monedas: 100 });
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(await pedir(cli, sabor.id, ceviche));
  for (let i = 0; i < 3; i++) await estado(duenoA, ids[i], "accepted");
  assert.equal(await saldo(duenoA), 20, "tres clientes gratis");
  await estado(duenoA, ids[3], "accepted");
  assert.equal(await saldo(duenoA), 15);
  assert.equal((await q("select coins_business from public.orders where id = $1", [ids[3]]))[0].coins_business, 5);
  assert.deepEqual([(await uso(duenoA, "order_accept")).free_used, (await uso(duenoA, "order_accept")).paid_used, (await uso(duenoA, "order_accept")).spent], [3, 1, 5]);
  await estado(duenoA, ids[3], "preparing");
  await estado(duenoA, ids[3], "on_the_way");
  assert.equal(await saldo(duenoA), 15, "avanzar el pedido no vuelve a cobrar");
});
await test("un negocio sin saldo no puede aceptar el cuarto pedido, pero sí rechazarlo (gratis)", async () => {
  const duenoB = await persona("DuenoSinSaldo", { monedas: 4 });
  const prov = await perfil(duenoB, { name: "Cafetería Sin Saldo", subtype: "cafeteria", channels: ["local", "entrega"] });
  const item = await articulo(prov.id, "Café", 2);
  const cli = await persona("ClienteCafe", { monedas: 100 });
  const pedidos = [];
  for (let i = 0; i < 5; i++) pedidos.push(await pedir(cli, prov.id, item));
  for (let i = 0; i < 3; i++) await estado(duenoB, pedidos[i], "accepted");
  const e = await falla(estado(duenoB, pedidos[3], "accepted"), /insufficient_coins:order_accept:5/);
  assert.equal(e.code, "P0001");
  assert.equal((await q("select status from public.orders where id = $1", [pedidos[3]]))[0].status, "placed", "el pedido sigue sin aceptar");
  await estado(duenoB, pedidos[3], "rejected");
  await q("update public.wallets set coins = 5 where user_id = $1", [duenoB]);
  await estado(duenoB, pedidos[4], "accepted");
  assert.equal(await saldo(duenoB), 0);
});
await test("devolución: si el negocio rechaza o no responde, quien pidió recupera sus monedas; si cancela él mismo, no", async () => {
  const cli = await persona("ClienteDevol", { monedas: 10 });
  for (let i = 0; i < 3; i++) await estado(duenoA, await pedir(cli, sabor.id, ceviche), "rejected"); // gratis (no devuelven nada)
  assert.equal(await saldo(cli), 10);
  const rechazado = await pedir(cli, sabor.id, ceviche);
  const caducado = await pedir(cli, sabor.id, ceviche);
  const cancelado = await pedir(cli, sabor.id, ceviche);
  assert.equal(await saldo(cli), 7);
  await estado(duenoA, rechazado, "rejected");
  assert.equal(await saldo(cli), 8, "rechazado: devuelve 1");
  assert.equal((await q("select coins_refunded from public.orders where id = $1", [rechazado]))[0].coins_refunded, 1);
  await q("update public.orders set created_at = now() - interval '4 hours' where id = $1", [caducado]);
  await como(cli, "select public.expire_stale_orders()");
  assert.equal((await q("select status from public.orders where id = $1", [caducado]))[0].status, "cancelled");
  assert.equal(await saldo(cli), 9, "sin respuesta en 3 h: devuelve 1");
  await estado(cli, cancelado, "cancelled");
  assert.equal(await saldo(cli), 9, "cancelarlo uno mismo no devuelve nada");
  assert.equal((await uso(cli, "order_place")).paid_used, 1, "los devueltos ya no cuentan como usos de pago");
  assert.deepEqual((await q("select reason from public.wallet_ledger where user_id = $1 and reason like 'refund:%'", [cli])).length, 2);
});

// ── 3. Solicitudes, ofertas, eventos y entradas ─────────────────────────────
console.log("\nSolicitudes, ofertas, eventos y entradas");
await test("solicitudes: 3 gratis y desde la cuarta 2 monedas", async () => {
  const p = await persona("Solicitante", { monedas: 5 });
  for (let i = 1; i <= 3; i++) await solicitar(p, `Necesito un plomero ${i}`);
  assert.equal(await saldo(p), 5);
  // el tope de 5 abiertas evita probar más de 5 seguidas: se cierran las anteriores
  await q("update public.service_requests set status = 'closed' where requester_id = $1", [p]);
  await solicitar(p, "Necesito un plomero 4");
  assert.equal(await saldo(p), 3);
  await solicitar(p, "Necesito un plomero 5");
  assert.equal(await saldo(p), 1);
  const e = await falla(solicitar(p, "Necesito un plomero 6"), /insufficient_coins:request_create:2/);
  assert.equal(e.code, "P0001");
});
await test("ofertas: 3 gratis por profesional, cuarta a 3 monedas; reofertar la misma solicitud no cobra otra vez", async () => {
  const pro = await persona("Plomero", { monedas: 3 });
  const perfilPro = await perfil(pro, { vertical: "hogar", subtype: "plomero", name: "Plomería Rápida" });
  const clientes = [];
  for (let i = 0; i < 5; i++) clientes.push(await persona(`Pide${i}`));
  const sols = [];
  for (const c of clientes) sols.push(await solicitar(c, "Arreglar una fuga"));
  for (let i = 0; i < 3; i++) await como(pro, "select public.send_offer($1, $2, 20, 30)", [sols[i], perfilPro.id]);
  assert.equal(await saldo(pro), 3, "tres ofertas gratis");
  await como(pro, "select public.send_offer($1, $2, 25, 20, 'Mejor precio')", [sols[0], perfilPro.id]); // actualizar la primera
  assert.equal(await saldo(pro), 3, "actualizar una oferta no cobra");
  assert.deepEqual([(await uso(pro, "offer_send")).free_used, (await uso(pro, "offer_send")).paid_used], [3, 0]);
  await como(pro, "select public.send_offer($1, $2, 20, 30)", [sols[3], perfilPro.id]);
  assert.equal(await saldo(pro), 0, "la cuarta cuesta 3");
  await falla(como(pro, "select public.send_offer($1, $2, 20, 30)", [sols[4], perfilPro.id]), /insufficient_coins:offer_send:3/);
  assert.equal((await q("select count(*)::int n from public.service_offers where request_id = $1", [sols[4]]))[0].n, 0);
});
await test("eventos: 3 publicaciones gratis por organizador y después 10 monedas", async () => {
  const org = await persona("Organizador", { monedas: 10 });
  const po = await perfil(org, { vertical: "eventos", subtype: "organizador", name: "Cultura Viva" });
  const evento = (titulo) => como(org, "insert into public.events (provider_id, title, category, starts_at, venue_name, zone) values ($1, $2, 'concierto', now() + interval '10 days', 'Sala', 'Centro') returning id", [po.id, titulo]).then((r) => r[0].id);
  for (let i = 1; i <= 3; i++) await evento(`Concierto número ${i}`);
  assert.equal(await saldo(org), 10);
  await evento("Concierto número 4");
  assert.equal(await saldo(org), 0);
  await falla(evento("Concierto número 5"), /insufficient_coins:event_publish:10/);
  assert.equal((await q("select count(*)::int n from public.events where provider_id = $1", [po.id]))[0].n, 4);
});
await test("entradas: 3 reservas gratis, la cuarta cuesta 1; si el organizador cancela el evento se devuelve", async () => {
  const org = await persona("OrganizadorReservas", { monedas: 100 });
  const po = await perfil(org, { vertical: "eventos", subtype: "teatro", name: "Teatro Sucre" });
  const asistente = await persona("Asistente", { monedas: 5 });
  const tipos = [];
  for (let i = 0; i < 4; i++) {
    const ev = (await como(org, "insert into public.events (provider_id, title, category, starts_at) values ($1, $2, 'teatro', now() + interval '9 days') returning id", [po.id, `Función ${i}`]))[0].id;
    tipos.push({ ev, tipo: (await como(org, "insert into public.event_ticket_types (event_id, name, price, quantity) values ($1, 'General', 5, 50) returning id", [ev]))[0].id });
  }
  for (let i = 0; i < 3; i++) await como(asistente, "select public.reserve_tickets($1, 1)", [tipos[i].tipo]);
  assert.equal(await saldo(asistente), 5);
  const r4 = (await como(asistente, "select public.reserve_tickets($1, 2) r", [tipos[3].tipo]))[0].r;
  assert.equal(await saldo(asistente), 4, "una moneda por reserva, sin importar cuántas entradas");
  assert.equal((await q("select coins_paid from public.event_reservations where id = $1", [r4.id]))[0].coins_paid, 1);
  await como(org, "select public.cancel_event($1)", [tipos[3].ev]);
  assert.equal(await saldo(asistente), 5, "evento cancelado: devuelve la moneda");
  await como(org, "select public.cancel_event($1)", [tipos[0].ev]);
  assert.equal(await saldo(asistente), 5, "una reserva gratis no devuelve nada");
});

// ── 4. Citas ────────────────────────────────────────────────────────────────
console.log("\nCitas: mensajes");
const chatDe = async (a, b, origin) => {
  const id = (await q("insert into public.chats (kind, origin, context_key, created_by) values ('direct', $1, $2, $3) returning id", [origin, `direct:${randomUUID()}`, a]))[0].id;
  await q("insert into public.chat_members (chat_id, user_id) values ($1, $2), ($1, $3)", [id, a, b]);
  return id;
};
const escribir = (uid, chat, cuerpo = "hola") => como(uid, "insert into public.messages (chat_id, sender_id, kind, body) values ($1, $2, 'text', $3) returning id", [chat, uid, cuerpo]);
await test("PARIDAD: costeMensaje() de TypeScript == lo que cobra la base (3 gratis y 1 moneda cada 5)", async () => {
  const ella = await persona("Ella", { monedas: 2 });
  const el = await persona("El", { monedas: 100 });
  const chat = await chatDe(ella, el, "cita");
  const precio = PRECIOS_DEFECTO.find((p) => p.accion === "chat_message");
  let esperado = 2;
  const cobros = [];
  for (let n = 0; n < 14; n++) {
    const antes = await saldo(ella);
    const coste = costeMensaje(precio, n);
    if (antes < coste) {
      await falla(escribir(ella, chat), /insufficient_coins:chat_message:1/);
      break;
    }
    await escribir(ella, chat, `mensaje ${n + 1}`);
    esperado -= coste;
    assert.equal(await saldo(ella), esperado, `tras el mensaje ${n + 1}`);
    if (coste) cobros.push(n + 1);
  }
  assert.deepEqual(cobros, [4, 9], "se cobra el 4.º y el 9.º; el 14.º ya no se puede pagar");
  assert.equal(esperado, 0);
  assert.equal((await q("select count(*)::int n from public.messages where chat_id = $1 and sender_id = $2", [chat, ella]))[0].n, 13, "el mensaje 14 no se envió por falta de saldo");
  assert.equal((await q("select count(*)::int n from public.messages where chat_id = $1 and sender_id = $2 and body = 'mensaje 14'", [chat, ella]))[0].n, 0);
});
await test("el cupo de mensajes es por conversación y por persona; quien responde tiene sus propios 3 gratis", async () => {
  const a = await persona("Ana", { monedas: 5 });
  const b = await persona("Beto", { monedas: 5 });
  const c = await persona("Carla", { monedas: 5 });
  const chatAB = await chatDe(a, b, "match");
  const chatAC = await chatDe(a, c, "cita");
  for (let i = 0; i < 3; i++) await escribir(a, chatAB);
  for (let i = 0; i < 3; i++) await escribir(b, chatAB);
  for (let i = 0; i < 3; i++) await escribir(a, chatAC);
  assert.deepEqual([await saldo(a), await saldo(b)], [5, 5], "3 + 3 + 3 gratis, cada uno en su conversación");
  await escribir(a, chatAB);
  assert.equal(await saldo(a), 4);
  assert.equal(await saldo(b), 5);
});
await test("no se cobra en chats comerciales, mensajes del sistema, ofertas ni personas de demostración", async () => {
  const a = await persona("Vende", { monedas: 1 });
  const b = await persona("Compra", { monedas: 1 });
  const comercial = await chatDe(a, b, null);
  for (let i = 0; i < 8; i++) await escribir(a, comercial);
  assert.equal(await saldo(a), 1, "chat comercial: gratis");
  const cita = await chatDe(a, b, "cita");
  for (let i = 0; i < 3; i++) await escribir(a, cita);
  await q("insert into public.messages (chat_id, sender_id, kind, body) values ($1, null, 'system', 'aviso')", [cita]);
  for (let i = 0; i < 3; i++) await q("insert into public.messages (chat_id, sender_id, kind, body) values ($1, $2, 'text', 'como servidor')", [cita, a]); // sin sesión: no es la persona escribiendo
  assert.equal(await saldo(a), 1);
  assert.equal((await q("select count(*)::int n from public.messages where chat_id = $1", [cita]))[0].n, 7);
});

// ── 5. Destacar negocio y regalos ───────────────────────────────────────────
console.log("\nDestacar y regalar monedas");
await test("destacar un negocio cuesta 30 monedas y suma 24 h; solo el dueño y con perfil activo", async () => {
  const d = await persona("DuenoBoost", { monedas: 70 });
  const p = await perfil(d, { name: "Pizzería Boost", subtype: "restaurante" });
  const ajeno = await persona("Ajeno", { monedas: 100 });
  await falla(como(ajeno, "select public.boost_provider($1)", [p.id]), /Solo puedes destacar/);
  const hasta1 = (await como(d, "select public.boost_provider($1) t", [p.id]))[0].t;
  assert.equal(await saldo(d), 40);
  const hasta2 = (await como(d, "select public.boost_provider($1) t", [p.id]))[0].t;
  assert.equal(new Date(hasta2).getTime() - new Date(hasta1).getTime(), 24 * 3_600_000, "destacar de nuevo suma otras 24 h");
  await falla(como(d, "select public.boost_provider($1)", [p.id]), /insufficient_coins:provider_boost:30/);
  assert.equal((await q("select boosted_until > now() as b from public.providers where id = $1", [p.id]))[0].b, true);
});
await test("admin_grant_coins: solo administradores, con límites y motivo en el historial", async () => {
  const admin = await persona("Admin", { monedas: 0 });
  await q("insert into public.app_admins (user_id) values ($1)", [admin]);
  const u = await persona("Beneficiada", { monedas: 0 });
  await falla(como(u, "select public.admin_grant_coins($1, 50, 'x')", [u]), /Solo administradores/);
  await falla(como(admin, "select public.admin_grant_coins($1, 0, 'x')", [u]), /entre 1 y 10000/);
  await falla(como(admin, "select public.admin_grant_coins($1, 10001, 'x')", [u]), /entre 1 y 10000/);
  await como(admin, "select public.admin_grant_coins($1, 50, 'beta tester')", [u]);
  assert.equal(await saldo(u), 50);
  assert.equal((await q("select reason from public.wallet_ledger where user_id = $1 and reason like 'admin:%'", [u]))[0].reason, "admin:beta tester");
});
await test("las tarifas se pueden ajustar en la base sin tocar el código (gratis, coste y desactivar)", async () => {
  const p = await persona("ClienteTarifa", { monedas: 10 });
  await q("update public.coin_prices set free_uses = 0, cost = 4 where action = 'order_place'");
  await pedir(p, sabor.id, ceviche);
  assert.equal(await saldo(p), 6, "ya no hay usos gratis y cuesta 4");
  await q("update public.coin_prices set active = false where action = 'order_place'");
  await pedir(p, sabor.id, ceviche);
  assert.equal(await saldo(p), 6, "desactivada: gratis");
  await q("update public.coin_prices set free_uses = 3, cost = 1, active = true where action = 'order_place'");
});

// ── 6. Retos de comunidad ───────────────────────────────────────────────────
console.log("\nRetos de comunidad");
const retos = async (uid) => (await como(uid, "select public.community_challenges_status() r"))[0].r;
const reto = (lista, id) => lista.find((r) => r.id === id);
await test("el catálogo trae retos semanales y únicos con progreso y sin cobrar", async () => {
  const u = await persona("Jugadora");
  const lista = await retos(u);
  assert.ok(lista.length >= 10);
  assert.equal(new Set(lista.map((r) => r.period)).size, 2);
  for (const r of lista) assert.ok(r.title && r.emoji && r.prize > 0 && r.target >= 1 && r.progress === 0 && r.claimed === false, r.id);
  assert.ok(reto(lista, "resenas_semana").ends_at, "los semanales indican cuándo terminan");
  assert.equal(reto(lista, "primera_resena").ends_at, null, "los únicos no caducan");
  await falla(como(null, "select public.community_challenges_status()"), /permission denied|No autenticado/);
});
await test("un reto no se cobra hasta cumplirlo, se cobra una sola vez por periodo y paga el premio", async () => {
  const u = await persona("Reseñadora", { monedas: 0 });
  await falla(como(u, "select public.claim_community_challenge('primera_reserva')"), /aún no está cumplido/);
  const org = await persona("OrgReto", { monedas: 100 });
  const po = await perfil(org, { vertical: "eventos", subtype: "organizador", name: "Org Reto" });
  const ev = (await como(org, "insert into public.events (provider_id, title, category, starts_at) values ($1, 'Feria del libro', 'feria', now() + interval '8 days') returning id", [po.id]))[0].id;
  const tipo = (await como(org, "insert into public.event_ticket_types (event_id, name, price, quantity) values ($1, 'Libre', 0, 20) returning id", [ev]))[0].id;
  await como(u, "select public.reserve_tickets($1, 1)", [tipo]);
  let lista = await retos(u);
  assert.equal(reto(lista, "evento_semana").progress, 1);
  assert.equal(reto(lista, "primera_reserva").progress, 1);
  assert.equal((await como(u, "select public.claim_community_challenge('evento_semana') p"))[0].p, 10);
  assert.equal((await como(u, "select public.claim_community_challenge('primera_reserva') p"))[0].p, 10);
  assert.equal(await saldo(u), 20);
  await falla(como(u, "select public.claim_community_challenge('evento_semana')"), /Ya cobraste este reto/);
  lista = await retos(u);
  assert.deepEqual([reto(lista, "evento_semana").claimed, reto(lista, "primera_reserva").claimed], [true, true]);
  assert.equal(await saldo(u), 20, "el segundo intento no pagó");
  assert.ok((await q("select reason from public.wallet_ledger where user_id = $1 and reason like 'challenge:%'", [u])).every((r) => /^challenge:[a-z_]+:(\d{4}-W\d{2}|once)$/.test(r.reason)));
  await falla(como(u, "select public.claim_community_challenge('inventado')"), /Reto inexistente/);
});
await test("un reto semanal se vuelve a poder cobrar la semana siguiente; uno único, nunca", async () => {
  const u = await persona("Constante", { monedas: 0 });
  const org = await persona("OrgSemanas", { monedas: 100 });
  const po = await perfil(org, { vertical: "eventos", subtype: "organizador", name: "Org Semanas" });
  const ev = (await como(org, "insert into public.events (provider_id, title, category, starts_at) values ($1, 'Taller de cerámica', 'taller', now() + interval '8 days') returning id", [po.id]))[0].id;
  const tipo = (await como(org, "insert into public.event_ticket_types (event_id, name, price, quantity) values ($1, 'Libre', 0, 20) returning id", [ev]))[0].id;
  await como(u, "select public.reserve_tickets($1, 1)", [tipo]);
  await como(u, "select public.claim_community_challenge('evento_semana')");
  // simula que pasó una semana: la reserva y el cobro quedan en la semana anterior
  await q("update public.event_reservations set created_at = now() - interval '8 days' where user_id = $1", [u]);
  await q("update public.coin_challenge_claims set period_key = '2020-W01' where user_id = $1 and challenge_id = 'evento_semana'", [u]);
  let lista = await retos(u);
  assert.deepEqual([reto(lista, "evento_semana").progress, reto(lista, "evento_semana").claimed], [0, false], "semana nueva: vuelve a empezar");
  assert.equal(reto(lista, "primera_reserva").progress, 1, "los únicos cuentan toda la historia");
  const ev2 = (await como(org, "insert into public.events (provider_id, title, category, starts_at) values ($1, 'Feria gastronómica', 'gastronomia', now() + interval '9 days') returning id", [po.id]))[0].id;
  const tipo2 = (await como(org, "insert into public.event_ticket_types (event_id, name, price, quantity) values ($1, 'Libre', 0, 20) returning id", [ev2]))[0].id;
  await como(u, "select public.reserve_tickets($1, 1)", [tipo2]);
  assert.equal((await como(u, "select public.claim_community_challenge('evento_semana') p"))[0].p, 10, "esta semana sí se puede cobrar de nuevo");
});
await test("los retos miden lo que dicen: reseñas, pedidos entregados, negocios que sirven y comunidad", async () => {
  const cli = await persona("ClienteReto", { monedas: 100 });
  const dueno = await persona("DuenoReto", { monedas: 100 });
  const prov = await perfil(dueno, { name: "Resto Reto", channels: ["local", "entrega"] });
  const item = await articulo(prov.id, "Sopa", 3);
  const p1 = await pedir(cli, prov.id, item);
  for (const s of ["accepted", "preparing", "on_the_way", "delivered"]) await estado(dueno, p1, s);
  let l = await retos(cli);
  assert.deepEqual([reto(l, "pedidos_semana").progress, reto(l, "primer_pedido").progress], [1, 1]);
  assert.equal(reto(await retos(dueno), "servir_semana").progress, 1, "el negocio cuenta lo que entrega");
  await como(cli, "select public.review_provider($1, 5, 'Muy rico')", [prov.id]);
  l = await retos(cli);
  assert.deepEqual([reto(l, "resenas_semana").progress, reto(l, "primera_resena").progress], [1, 1]);
  const [post] = await q("insert into public.posts (author_id, kind, body) values ($1, 'historia', 'Hola comunidad') returning id", [dueno]);
  await como(cli, "insert into public.post_likes (post_id, user_id) values ($1, $2)", [post.id, cli]);
  await como(cli, "insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'Genial')", [post.id, cli]);
  assert.equal(reto(await retos(cli), "comunidad_semana").progress, 2);
  await como(cli, "insert into public.friendships (requester_id, addressee_id, status, responded_at) values ($1, $2, 'accepted', now())", [cli, dueno]).catch(() => q("insert into public.friendships (requester_id, addressee_id, status, responded_at) values ($1, $2, 'accepted', now())", [cli, dueno]));
  assert.equal(reto(await retos(cli), "amigos_semana").progress, 1);
  const sol = await solicitar(cli, "Reparar una puerta");
  assert.ok(sol);
  assert.equal(reto(await retos(cli), "solicitud_semana").progress, 1);
});

// ── 7. Tienda de monedas ────────────────────────────────────────────────────
console.log("\nTienda de monedas y pagos");
const crear = (uid, paquete, pasarela = "payphone") => como(uid, "select public.create_coin_payment($1, $2) p", [paquete, pasarela]).then((r) => r[0].p);
const acreditar = (ref, pasarela, provRef, centavos, raw = {}) => como("service", "select public.credit_coin_payment($1, $2, $3, $4, $5::jsonb) r", [ref, pasarela, provRef, centavos, JSON.stringify(raw)]).then((r) => r[0].r);
await test("crear un pago: el precio y las monedas los fija el servidor; la primera compra suma +25 %", async () => {
  const u = await persona("Compradora", { monedas: 0 });
  const p = await crear(u, "plus");
  assert.deepEqual([p.amount_cents, p.coins, p.bonus_coins, p.provider, p.package], [150, 165 + bonoPrimeraCompra(165), bonoPrimeraCompra(165), "payphone", "plus"]);
  assert.equal(bonoPrimeraCompra(165), 41);
  assert.match(p.client_ref, /^[0-9a-f]{32}$/);
  const [fila] = await q("select status, amount_cents, coins from public.coin_payments where client_ref = $1", [p.client_ref]);
  assert.deepEqual([fila.status, fila.amount_cents, fila.coins], ["pending", 150, 206]);
  await falla(crear(u, "gratis"), /Paquete no disponible/);
  await falla(crear(u, "mini", "bitcoin"), /Pasarela no válida/);
  await falla(como(null, "select public.create_coin_payment('mini', 'paypal')"), /permission denied|No autenticado/);
  await falla(como(u, "insert into public.coin_payments (user_id, package_id, provider, client_ref, amount_cents, coins) values ($1, 'pro', 'paypal', 'x', 1, 9999)", [u]), /permission denied/);
  await falla(como(u, "update public.coin_payments set status = 'paid' where client_ref = $1", [p.client_ref]), /permission denied/);
  await falla(como(u, "select raw from public.coin_payments"), /permission denied/);
  assert.equal(await saldo(u), 0, "crear un pago no da monedas");
});
await test("credit_coin_payment: solo el servidor; acredita una vez (retorno + webhook) y avisa", async () => {
  const u = await persona("Pagadora", { monedas: 0 });
  const p = await crear(u, "mini", "paypal");
  await falla(como(u, "select public.credit_coin_payment($1, 'paypal', 'X1', 50, '{}'::jsonb)", [p.client_ref]), /permission denied/);
  await falla(como(null, "select public.credit_coin_payment($1, 'paypal', 'X1', 50, '{}'::jsonb)", [p.client_ref]), /permission denied/);
  const r1 = await acreditar(p.client_ref, "paypal", "CAP-1", 50, { estado: "COMPLETED" });
  assert.deepEqual([r1.ok, r1.already, r1.coins], [true, false, 62]);
  assert.equal(await saldo(u), 62, "50 + 12 de la primera compra (25 % redondeado hacia abajo)");
  const r2 = await acreditar(p.client_ref, "paypal", "CAP-1", 50);
  assert.deepEqual([r2.ok, r2.already], [true, true]);
  assert.equal(await saldo(u), 62, "el segundo aviso de la pasarela no vuelve a acreditar");
  const [fila] = await q("select status, provider_ref, paid_at is not null pagado from public.coin_payments where client_ref = $1", [p.client_ref]);
  assert.deepEqual([fila.status, fila.provider_ref, fila.pagado], ["paid", "CAP-1", true]);
  assert.equal((await q("select reason from public.wallet_ledger where user_id = $1 and reason like 'purchase:%'", [u])).length, 1);
  const av = await q("select title, href from public.notifications where user_id = $1 and data ->> 'kind' = 'coin_purchase'", [u]);
  assert.deepEqual([av.length, av[0].title, av[0].href], [1, "🪙 +62 monedas", "/monedas"]);
  const p2 = await crear(u, "mini", "paypal");
  assert.equal(p2.bonus_coins, 0, "solo la primera compra tiene bonificación");
});
await test("un importe distinto al esperado no acredita y deja el pago como fallido; otra pasarela o una referencia repetida tampoco", async () => {
  const u = await persona("Tramposa", { monedas: 0 });
  const p = await crear(u, "pro", "payphone");
  const malo = await acreditar(p.client_ref, "payphone", "PP-1", 50);
  assert.deepEqual([malo.ok, malo.reason], [false, "amount_mismatch"]);
  assert.equal(await saldo(u), 0);
  assert.equal((await q("select status, raw ->> 'motivo' m from public.coin_payments where client_ref = $1", [p.client_ref]))[0].m, "importe_distinto");
  const otra = await acreditar(p.client_ref, "payphone", "PP-1", 350);
  assert.deepEqual([otra.ok, otra.reason], [false, "status_failed"], "un pago fallido no se reabre");
  const p2 = await crear(u, "pro", "payphone");
  await falla(acreditar(p2.client_ref, "paypal", "X", 350), /no coincide/);
  await falla(acreditar("inexistente", "payphone", "X", 350), /Pago inexistente/);
  await acreditar(p2.client_ref, "payphone", "PP-2", 350);
  const p3 = await crear(u, "pro", "payphone");
  const repetida = await acreditar(p3.client_ref, "payphone", "PP-2", 350);
  assert.deepEqual([repetida.ok, repetida.reason], [false, "provider_ref_reused"], "la misma operación de la pasarela no paga dos pagos");
  assert.equal(await saldo(u), 420 + bonoPrimeraCompra(420));
});
await test("fail_coin_payment cierra solo pagos pendientes y solo lo ejecuta el servidor", async () => {
  const u = await persona("Cancela", { monedas: 0 });
  const p = await crear(u, "mini", "payphone");
  await falla(como(u, "select public.fail_coin_payment($1, 'cancelled')", [p.client_ref]), /permission denied/);
  assert.equal((await como("service", "select public.fail_coin_payment($1, 'cancelled', '{\"motivo\":\"usuario\"}'::jsonb) r", [p.client_ref]))[0].r, true);
  assert.equal((await como("service", "select public.fail_coin_payment($1, 'failed') r", [p.client_ref]))[0].r, false, "ya no está pendiente");
  await falla(como("service", "select public.fail_coin_payment($1, 'paid')", [p.client_ref]), /Estado no válido/);
  assert.deepEqual((await acreditar(p.client_ref, "payphone", "Z", 50)).reason, "status_cancelled");
  assert.equal(await saldo(u), 0);
});
await test("no se pueden acumular pagos pendientes sin límite", async () => {
  const u = await persona("Insistente", { monedas: 0 });
  for (let i = 0; i < 8; i++) await crear(u, "mini", "paypal");
  await falla(crear(u, "mini", "paypal"), /Demasiados pagos pendientes/);
});
await test("un pago acreditado permite seguir operando: del bloqueo por saldo a pedir otra vez", async () => {
  const u = await persona("Recarga", { monedas: 0 });
  for (let i = 0; i < 3; i++) await pedir(u, sabor.id, ceviche);
  await falla(pedir(u, sabor.id, ceviche), /insufficient_coins:order_place:1/);
  const p = await crear(u, "mini", "payphone");
  await acreditar(p.client_ref, "payphone", "PP-RECARGA", 50);
  await pedir(u, sabor.id, ceviche);
  assert.equal(await saldo(u), 62 - 1);
});

// ── 8. Migración ────────────────────────────────────────────────────────────
console.log("\nMigración");
await test("MIGRACIÓN: update_010 sobre una base con 009 (dos veces) conserva pedidos y saldos, y empieza a cobrar", async () => {
  const completo = fs.readFileSync(esquema, "utf8").replace(/\r\n/g, "\n");
  const ini = completo.indexOf("-- ACTUALIZACION-010-INICIO");
  const fin = completo.indexOf("-- ACTUALIZACION-010-FIN");
  assert.ok(ini > 0 && fin > ini, "faltan los marcadores de la actualización 010 en schema.sql");
  const actualizacion = fs.readFileSync(path.join(aqui, "..", "update_010_monedas.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(completo.slice(completo.indexOf("\n", ini) + 1, fin).trim(), actualizacion.trim(), "schema.sql y update_010 difieren");
  await server.createDatabase("migracion10");
  const m = new pg.Client({ ...conn, database: "migracion10" });
  await m.connect();
  m.on("notice", () => {});
  const como10 = async (uid, sql, params = []) => {
    await m.query("begin");
    await m.query("set local role authenticated");
    await m.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    try {
      const r = await m.query(sql, params);
      await m.query("commit");
      return r.rows;
    } catch (e) {
      await m.query("rollback");
      throw e;
    }
  };
  try {
    await m.query(fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8").replace(/^create role .*$/gm, ""));
    await m.query(completo.slice(0, ini)); // esquema base + 002 … + 009
    await m.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'due10@test.dev', '{\"full_name\":\"Dueno Diez\"}'), (gen_random_uuid(), 'cli10@test.dev', '{\"full_name\":\"Cliente Diez\"}')");
    const [dueno, cliente] = (await m.query("select id from auth.users order by email")).rows.map((r) => r.id);
    const prov = (await m.query("insert into public.providers (owner_id, vertical, subtype, name, channels) values ($1, 'delivery', 'restaurante', 'Resto Diez', '{local,entrega}') returning id", [dueno])).rows[0].id;
    const item = (await m.query("insert into public.provider_items (provider_id, kind, name, price) values ($1, 'menu_item', 'Sopa', 4) returning id", [prov])).rows[0].id;
    // Antes de la 010 se pide sin coste: 5 pedidos de la misma persona sin tocar su saldo.
    for (let i = 0; i < 5; i++) await como10(cliente, "select public.place_order($1, 'delivery', $2::jsonb, 'Calle 1 y 2', 'Centro', '', 'cash', '099 111 2222')", [prov, JSON.stringify([{ item_id: item, qty: 1 }])]);
    const saldoAntes = (await m.query("select coins from public.wallets where user_id = $1", [cliente])).rows[0].coins;
    assert.equal(saldoAntes, 20, "pedir antes de la 010 no costaba nada");
    await m.query(actualizacion);
    await m.query(actualizacion); // idempotente
    assert.equal((await m.query("select count(*)::int n from public.coin_prices")).rows[0].n, 8, "las tarifas no se duplican");
    assert.equal((await m.query("select count(*)::int n from public.coin_packages")).rows[0].n, 3);
    assert.equal((await m.query("select count(*)::int n from public.coin_challenges")).rows[0].n, 10);
    assert.equal((await m.query("select count(*)::int n from public.orders where coins_paid = 0")).rows[0].n, 5, "los pedidos anteriores conservan coste 0");
    await m.query("update public.coin_prices set cost = 7 where action = 'order_accept'");
    await m.query(actualizacion);
    assert.equal((await m.query("select cost from public.coin_prices where action = 'order_accept'")).rows[0].cost, 7, "volver a ejecutar no pisa las tarifas ajustadas");
    // A partir de la 010 cuenta: la persona ya hizo 5 pedidos antes, pero los usos gratis se cuentan desde ahora.
    await m.query("update public.orders set status = 'rejected' where customer_id = $1", [cliente]); // libera el cupo de pedidos sin responder
    for (let i = 0; i < 4; i++) await como10(cliente, "select public.place_order($1, 'delivery', $2::jsonb, 'Calle 1 y 2', 'Centro', '', 'cash', '099 111 2222')", [prov, JSON.stringify([{ item_id: item, qty: 1 }])]);
    const u10 = (await m.query("select free_used, paid_used from public.coin_usage where user_id = $1 and action = 'order_place'", [cliente])).rows[0];
    assert.deepEqual([u10.free_used, u10.paid_used], [3, 1], "los 3 usos gratis se cuentan desde la 010");
    assert.equal((await m.query("select coins from public.wallets where user_id = $1", [cliente])).rows[0].coins, saldoAntes - 1);
  } finally {
    await m.end();
  }
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
await su.end();
await server.stop();
fs.rmSync(dir, { recursive: true, force: true });
process.exit(fallos ? 1 : 0);
