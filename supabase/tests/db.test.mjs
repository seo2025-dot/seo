/**
 * Pruebas de supabase/schema.sql contra un PostgreSQL real (embebido; NO toca tu proyecto de Supabase).
 *
 *   npm i --no-save embedded-postgres pg tsx
 *   npx tsx supabase/tests/db.test.mjs
 *
 * Verifica: esquema, RLS, privilegios por columna, motor de coincidencias, RPCs, Storage y la paridad
 * de la compatibilidad astral entre SQL y TypeScript.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { sinastria } from "@/lib/astrologia";
import { puntajeConfianza } from "@/lib/confianza";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const esquema = path.join(aqui, "..", "schema.sql");
const puerto = 55444;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "supa-test-"));

const server = new EmbeddedPostgres({
  databaseDir: dir, user: "postgres", password: "pw", port: puerto, persistent: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C", "--no-sync"],   // como Supabase: UTF-8
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

/** Ejecuta SQL como superusuario. */
const q = async (sql, params) => (await su.query(sql, params)).rows;

/** Ejecuta SQL como un usuario autenticado (o anónimo si uid es null), en una transacción propia. */
async function como(uid, sql, params) {
  const c = new pg.Client(conn);
  await c.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(uid ? { sub: uid, role: "authenticated" } : { role: "anon" }),
    ]);
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
    return;
  }
  throw new Error("Se esperaba un error y no ocurrió");
};

// ── Preparación ─────────────────────────────────────────────────────────────
await su.query(fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8"));
try {
  await su.query(fs.readFileSync(esquema, "utf8"));
  console.log("  schema.sql aplicado");
} catch (e) {
  console.log("  ✗ schema.sql →", e.message, e.position ? `(posición ${e.position})` : "");
  process.exit(1);
}

const nuevoUsuario = async (nombre, extra = {}) => {
  const id = randomUUID();
  await q("insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3, now())", [
    id,
    `${nombre.toLowerCase()}@test.dev`,
    JSON.stringify({ full_name: nombre, ...extra }),
  ]);
  return id;
};

const ana = await nuevoUsuario("Ana");
const beto = await nuevoUsuario("Beto");
const carla = await nuevoUsuario("Carla");
const admin = await nuevoUsuario("Admin");
await q("insert into public.app_admins (user_id) values ($1)", [admin]);

// ── 1. Alta de usuarios ─────────────────────────────────────────────────────
console.log("\nAlta y privacidad de perfiles");
await test("el registro crea perfil, datos privados y monedero con 20 monedas", async () => {
  const [u] = await q("select display_name, handle, email_verified from public.profiles where id = $1", [ana]);
  assert.equal(u.display_name, "Ana");
  assert.match(u.handle, /^@ana_/);
  assert.equal(u.email_verified, true);
  const [w] = await q("select coins, super_likes from public.wallets where user_id = $1", [ana]);
  assert.equal(w.coins, 20);
  assert.equal(w.super_likes, 1);
  assert.equal((await q("select count(*)::int n from public.user_private where user_id = $1", [ana]))[0].n, 1);
});
await test("el usuario edita su perfil pero no puede tocar campos de confianza", async () => {
  await como(ana, "update public.profiles set bio = 'Hola', zones = array['Centro'] where id = $1", [ana]);
  for (const col of ["identity_verified = true", "kyc_status = 'verified'", "rating = 5", "badges = array['superhost']", "is_demo = true", "email_verified = false"]) {
    await falla(como(ana, `update public.profiles set ${col} where id = $1`, [ana]), /permission denied/);
  }
});
await test("no puede editar el perfil de otro (RLS: 0 filas)", async () => {
  const r = await como(ana, "update public.profiles set bio = 'hackeado' where id = $1 returning id", [beto]);
  assert.equal(r.length, 0);
});
await test("los perfiles son públicos (incluso anónimos) pero no exponen datos privados", async () => {
  assert.ok((await como(null, "select id from public.profiles")).length >= 4);
  await falla(como(null, "select * from public.user_private"), /permission denied/);
});
await test("los datos privados solo los ve su dueño", async () => {
  await como(ana, "update public.user_private set birth_date = '1990-03-25' where user_id = $1", [ana]);
  assert.equal((await como(ana, "select birth_date from public.user_private")).length, 1);
  assert.equal((await como(beto, "select * from public.user_private where user_id = $1", [ana])).length, 0);
});
await test("no se permite registrar a un menor de edad", async () => {
  const anio = new Date().getFullYear() - 10;
  await falla(como(ana, "update public.user_private set birth_date = $2 where user_id = $1", [ana, `${anio}-01-01`]), /mayor de 18/);
});
await test("el cliente no puede insertar perfiles ni modificar monederos", async () => {
  await falla(como(ana, "insert into public.profiles (id) values (gen_random_uuid())"), /permission denied/);
  await falla(como(ana, "update public.wallets set coins = 999999 where user_id = $1", [ana]), /permission denied/);
  await falla(como(ana, "insert into public.wallet_ledger (user_id, delta, reason) values ($1, 100, 'x')", [ana]), /permission denied/);
});

// ── 2. Anuncios y motor de coincidencias ────────────────────────────────────
console.log("\nOfertas, demandas y motor de coincidencias");
const oferta = (extra = {}) => ({
  kind: "offer", category: "property", operation: "rent", subtype: "departamento", title: "Depto luminoso centro",
  price: 850, currency: "USD", zone: "Centro", area: 68, ...extra,
});
async function publicar(uid, l) {
  const cols = Object.keys(l);
  const r = await como(uid, `insert into public.listings (owner_id, ${cols.join(", ")}) values ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")}) returning id`, [uid, ...Object.values(l)]);
  return r[0].id;
}
let deptoBeto, buscoAna;
await test("un usuario publica una oferta; otros no pueden publicar a su nombre", async () => {
  deptoBeto = await publicar(beto, oferta());
  await falla(como(ana, "insert into public.listings (owner_id, kind, category, operation, title, price) values ($1, 'offer', 'property', 'rent', 'Falso', 10)", [beto]), /row-level security/);
});
await test("no se puede fijar boosted_until desde el cliente", async () => {
  await falla(como(beto, "update public.listings set boosted_until = now() + interval '1 day' where id = $1", [deptoBeto]), /permission denied/);
  await falla(como(beto, "insert into public.listings (owner_id, kind, category, operation, title, price, boosted_until) values ($1,'offer','property','rent','Boost falso',10, now())", [beto]), /permission denied/);
});
await test("las restricciones de integridad rechazan datos inválidos", async () => {
  await falla(como(beto, "insert into public.listings (owner_id, kind, category, operation, title) values ($1,'offer','property','rent','Sin precio')", [beto]), /offer_has_price/);
  await falla(como(beto, "insert into public.listings (owner_id, kind, category, title, budget_max) values ($1,'demand','business','Negocio',10)", [beto]), /demand_no_business|operation_required/);
  await falla(como(beto, "insert into public.listings (owner_id, kind, category, operation, title, price, currency) values ($1,'offer','property','rent','Moneda mala',10,'BTC')", [beto]), /check/);
});
await test("publicar una BÚSQUEDA coincidente notifica a ambos en el acto y crea el par", async () => {
  buscoAna = await publicar(ana, { kind: "demand", category: "property", operation: "rent", subtype: "departamento", zone: "centro", budget_max: 900, currency: "USD", title: "Busco depto en el centro" });
  const pares = await q("select * from public.listing_matches where demand_id = $1", [buscoAna]);
  assert.equal(pares.length, 1);
  assert.equal(pares[0].offer_id, deptoBeto);
  const paraBeto = await como(beto, "select title from public.notifications where type = 'match-demanda'");
  const paraAna = await como(ana, "select title from public.notifications where type = 'match-demanda'");
  assert.ok(paraBeto.some((n) => /comprador/.test(n.title)), "Beto no recibió aviso");
  assert.ok(paraAna.some((n) => /oferta/.test(n.title)), "Ana no recibió aviso");
});
await test("no se duplican avisos al volver a evaluar el par", async () => {
  const antes = (await q("select count(*)::int n from public.notifications where type = 'match-demanda'"))[0].n;
  await como(ana, "update public.listings set description = 'x', zone = 'Centro' where id = $1", [buscoAna]);
  await q("select public.refresh_listing_matches($1)", [buscoAna]);
  assert.equal((await q("select count(*)::int n from public.notifications where type = 'match-demanda'"))[0].n, antes);
});
await test("publicar una OFERTA nueva que encaja con búsquedas activas avisa al vendedor y al comprador", async () => {
  const otro = await publicar(carla, oferta({ title: "Depto céntrico amoblado", price: 700 }));
  assert.equal((await q("select count(*)::int n from public.listing_matches where offer_id = $1", [otro]))[0].n, 1);
  assert.ok((await como(carla, "select 1 from public.notifications where type = 'match-demanda'")).length >= 1);
  assert.ok((await como(ana, "select 1 from public.notifications where type = 'match-demanda' and title like '%Una oferta coincide%'")).length >= 1);
});
await test("no coinciden: otra moneda, presupuesto insuficiente, otra zona, otro tipo o misma persona", async () => {
  const no = [
    oferta({ title: "En euros", currency: "EUR" }),
    oferta({ title: "Muy caro", price: 2000 }),
    oferta({ title: "Otra zona", zone: "Zona Sur" }),
    oferta({ title: "Es una casa", subtype: "casa" }),
    oferta({ title: "En venta", operation: "sale" }),
  ];
  for (const l of no) {
    const id = await publicar(carla, l);
    assert.equal((await q("select count(*)::int n from public.listing_matches where offer_id = $1", [id]))[0].n, 0, l.title);
  }
  const propia = await publicar(ana, oferta({ title: "Mi propio depto" }));
  assert.equal((await q("select count(*)::int n from public.listing_matches where offer_id = $1", [propia]))[0].n, 0);
});
await test("subir el precio por encima del presupuesto elimina el par; bajarlo lo restablece", async () => {
  await como(beto, "update public.listings set price = 1500 where id = $1", [deptoBeto]);
  assert.equal((await q("select count(*)::int n from public.listing_matches where offer_id = $1", [deptoBeto]))[0].n, 0);
  await como(beto, "update public.listings set price = 880 where id = $1", [deptoBeto]);
  assert.equal((await q("select count(*)::int n from public.listing_matches where offer_id = $1", [deptoBeto]))[0].n, 1);
});
await test("la oferta relámpago (descuento vigente) hace que coincida un anuncio que superaba el presupuesto", async () => {
  const caro = await publicar(carla, oferta({ title: "Depto con relámpago", price: 950 }));
  assert.equal((await q("select count(*)::int n from public.listing_matches where offer_id = $1", [caro]))[0].n, 0);
  await como(carla, "update public.listings set flash_discount = 10, flash_until = now() + interval '5 hours' where id = $1", [caro]);
  assert.equal((await q("select count(*)::int n from public.listing_matches where offer_id = $1", [caro]))[0].n, 1);   // 950 - 10 % = 855 ≤ 900
});
await test("pausar un anuncio elimina sus pares", async () => {
  await como(beto, "update public.listings set status = 'paused' where id = $1", [deptoBeto]);
  assert.equal((await q("select count(*)::int n from public.listing_matches where offer_id = $1", [deptoBeto]))[0].n, 0);
  await como(beto, "update public.listings set status = 'active' where id = $1", [deptoBeto]);
});
await test("find_offers_for_demand y find_demands_for_offer devuelven el inventario/búsquedas correctos", async () => {
  const ofertas = await como(ana, "select id from public.find_offers_for_demand($1)", [buscoAna]);
  assert.ok(ofertas.length >= 2);
  const demandas = await como(beto, "select id from public.find_demands_for_offer($1)", [deptoBeto]);
  assert.deepEqual(demandas.map((d) => d.id), [buscoAna]);
});
await test("demand_counts_for_offers agrega sin exponer datos personales", async () => {
  const filas = await como(null, "select * from public.demand_counts_for_offers()");
  const f = filas.find((x) => x.offer_id === deptoBeto);
  assert.equal(f.buyers, 1);
  assert.deepEqual(Object.keys(f).sort(), ["buyers", "offer_id"]);
});
await test("los pares solo son visibles para los dueños implicados", async () => {
  assert.ok((await como(ana, "select 1 from public.listing_matches")).length >= 1);
  assert.equal((await como(carla, "select 1 from public.listing_matches where demand_id = $1 and offer_id = $2", [buscoAna, deptoBeto])).length, 0);
  await falla(como(null, "select * from public.listing_matches"), /permission denied/);
});
await test("los anuncios pausados no son visibles para terceros, pero sí para su dueño", async () => {
  await como(beto, "update public.listings set status = 'paused' where id = $1", [deptoBeto]);
  assert.equal((await como(ana, "select 1 from public.listings where id = $1", [deptoBeto])).length, 0);
  assert.equal((await como(beto, "select 1 from public.listings where id = $1", [deptoBeto])).length, 1);
  await como(beto, "update public.listings set status = 'active' where id = $1", [deptoBeto]);
});
await test("los índices del motor son utilizables por el planificador", async () => {
  await q("set enable_seqscan = off");
  const plan1 = (await q("explain select * from public.listings where kind = 'offer' and category = 'property' and operation = 'rent' and subtype = 'departamento' and status = 'active'")).map((r) => r["QUERY PLAN"]).join("\n");
  assert.match(plan1, /listings_match_idx/);
  const plan2 = (await q("explain select * from public.listings where zone ilike '%centro%'")).map((r) => r["QUERY PLAN"]).join("\n");
  assert.match(plan2, /listings_zone_trgm_idx/);
  const plan3 = (await q("explain select * from public.listings where kind = 'offer' and status = 'active' and currency = 'USD' and price <= 900")).map((r) => r["QUERY PLAN"]).join("\n");
  assert.match(plan3, /listings_offer_price_idx|listings_match_idx/);   // ambos índices parciales cubren esta consulta
  await q("reset enable_seqscan");
});
await test("rendimiento: el motor evalúa 20 000 anuncios en tiempo aceptable", async () => {
  await q(`insert into public.listings (owner_id, kind, category, operation, subtype, title, price, zone, currency, area)
           select $1, 'offer', 'property', case when g % 2 = 0 then 'sale' else 'rent' end,
                  (array['casa','departamento','terreno','villa'])[1 + g % 4], 'Anuncio ' || g, 100 + (g % 900) * 10,
                  (array['Centro','Zona Norte','Zona Sur','Las Lomas'])[1 + g % 4], 'USD', 40 + g % 300
           from generate_series(1, 20000) g`, [carla]);
  await q("analyze public.listings");
  const t0 = Date.now();
  const r = await q("select count(*)::int n from public.find_offers_for_demand($1)", [buscoAna]);
  const ms = Date.now() - t0;
  console.log(`      (${r[0].n} coincidencias en ${ms} ms)`);
  assert.ok(ms < 1500, `tardó ${ms} ms`);
  await q("delete from public.listings where title like 'Anuncio %'");
});

// ── 3. Chats, mensajes y ofertas ────────────────────────────────────────────
console.log("\nMensajería (chats, mensajes, ofertas)");
let chat;
await test("open_chat es idempotente y crea 2 miembros + mensaje de sistema", async () => {
  chat = (await como(ana, "select public.open_chat('listing', $1) id", [deptoBeto]))[0].id;
  const de_nuevo = (await como(ana, "select public.open_chat('listing', $1) id", [deptoBeto]))[0].id;
  assert.equal(chat, de_nuevo);
  assert.equal((await q("select count(*)::int n from public.chat_members where chat_id = $1", [chat]))[0].n, 2);
  assert.equal((await q("select count(*)::int n from public.messages where chat_id = $1 and kind = 'system'", [chat]))[0].n, 1);
});
await test("no puedes abrir chat contigo mismo ni sobre un anuncio inexistente", async () => {
  await falla(como(beto, "select public.open_chat('listing', $1)", [deptoBeto]), /contigo mismo/);
  await falla(como(ana, "select public.open_chat('listing', $1)", [randomUUID()]), /no disponible/);
});
await test("un tercero no ve el chat, sus mensajes ni sus miembros, y no puede escribir", async () => {
  await como(ana, "insert into public.messages (chat_id, sender_id, body) values ($1, $2, 'hola Beto')", [chat, ana]);
  assert.equal((await como(carla, "select 1 from public.chats where id = $1", [chat])).length, 0);
  assert.equal((await como(carla, "select 1 from public.messages where chat_id = $1", [chat])).length, 0);
  assert.equal((await como(carla, "select 1 from public.chat_members where chat_id = $1", [chat])).length, 0);
  await falla(como(carla, "insert into public.messages (chat_id, sender_id, body) values ($1, $2, 'intruso')", [chat, carla]), /row-level security/);
});
await test("no se puede suplantar al remitente ni forjar mensajes de sistema", async () => {
  await falla(como(ana, "insert into public.messages (chat_id, sender_id, body) values ($1, $2, 'soy Beto')", [chat, beto]), /row-level security/);
  await falla(como(ana, "insert into public.messages (chat_id, sender_id, kind, body) values ($1, $2, 'system', 'Acuerdo cerrado')", [chat, ana]), /row-level security|check/);
});
await test("los mensajes son inmutables para los clientes", async () => {
  await falla(como(ana, "update public.messages set body = 'editado' where chat_id = $1", [chat]), /permission denied/);
  await falla(como(ana, "delete from public.messages where chat_id = $1", [chat]), /permission denied/);
});
let oferta1;
await test("un comprador envía una oferta; no puede fijar su estado como aceptada", async () => {
  oferta1 = (await como(ana, "insert into public.messages (chat_id, sender_id, kind, body, amount, currency, status) values ($1,$2,'offer','Mi oferta',800,'USD','pending') returning id", [chat, ana]))[0].id;
  await falla(como(ana, "insert into public.messages (chat_id, sender_id, kind, body, amount, currency, status) values ($1,$2,'offer','Ya aceptada',1,'USD','accepted')", [chat, ana]), /row-level security/);
  await falla(como(ana, "insert into public.messages (chat_id, sender_id, kind, body, amount, currency, status) values ($1,$2,'offer','Sin importe',null,'USD','pending')", [chat, ana]), /deal_fields/);
});
await test("el remitente no puede aceptar su propia oferta; el destinatario sí (una sola vez)", async () => {
  await falla(como(ana, "select public.respond_offer($1, true)", [oferta1]), /propia oferta/);
  await como(beto, "select public.respond_offer($1, true)", [oferta1]);
  const [m] = await q("select status from public.messages where id = $1", [oferta1]);
  assert.equal(m.status, "accepted");
  assert.ok((await q("select 1 from public.messages where chat_id = $1 and kind = 'system' and body like '%Acuerdo%'", [chat])).length >= 1);
  await falla(como(beto, "select public.respond_offer($1, false)", [oferta1]), /ya fue respondida/);
  assert.ok((await como(ana, "select 1 from public.notifications where type = 'oferta'")).length >= 1);
});
await test("un tercero no puede responder ofertas ajenas", async () => {
  const o2 = (await como(ana, "insert into public.messages (chat_id, sender_id, kind, body, amount, currency, status) values ($1,$2,'offer','Otra',700,'USD','pending') returning id", [chat, ana]))[0].id;
  await falla(como(carla, "select public.respond_offer($1, true)", [o2]), /Sin acceso/);
});
await test("las cotizaciones solo las envía el freelancer del servicio (no el cliente)", async () => {
  const gig = (await como(carla, "insert into public.jobs (owner_id, kind, title, category, price_from, delivery_days) values ($1,'gig','Fotos HDR de tu propiedad','fotografia',120,2) returning id", [carla]))[0].id;
  const chatGig = (await como(ana, "select public.open_chat('gig', $1) id", [gig]))[0].id;
  await falla(como(ana, "insert into public.messages (chat_id, sender_id, kind, body, amount, currency, days, status) values ($1,$2,'quote','Auto-cotización',1,'USD',1,'pending')", [chatGig, ana]), /row-level security/);
  const quote = (await como(carla, "insert into public.messages (chat_id, sender_id, kind, body, amount, currency, days, status) values ($1,$2,'quote','Mi cotización',150,'USD',3,'pending') returning id", [chatGig, carla]))[0].id;
  await falla(como(carla, "select public.respond_offer($1, true)", [quote]), /propia oferta/);
  await como(ana, "select public.respond_offer($1, true)", [quote]);
  assert.equal((await q("select sales_count from public.jobs where id = $1", [gig]))[0].sales_count, 1);
  // Las ofertas de compra no valen en chats de servicio.
  await falla(como(ana, "insert into public.messages (chat_id, sender_id, kind, body, amount, currency, status) values ($1,$2,'offer','x',1,'USD','pending')", [chatGig, ana]), /row-level security/);
});
await test("postularse a una vacante crea chat, mensaje y notificación (sin duplicar)", async () => {
  const vac = (await como(carla, "insert into public.jobs (owner_id, kind, title, job_type, modality) values ($1,'vacancy','Asesor inmobiliario remoto','contrato','remoto') returning id", [carla]))[0].id;
  const c1 = (await como(beto, "select public.apply_job($1) id", [vac]))[0].id;
  const c2 = (await como(beto, "select public.apply_job($1) id", [vac]))[0].id;
  assert.equal(c1, c2);
  assert.equal((await q("select count(*)::int n from public.messages where chat_id = $1 and kind = 'text'", [c1]))[0].n, 1);
  assert.equal((await q("select count(*)::int n from public.job_applications where job_id = $1", [vac]))[0].n, 1);
  await falla(como(carla, "select public.apply_job($1)", [vac]), /propia publicación/);
});
await test("get_my_chats devuelve no leídos y último mensaje; mark_chat_read los pone a cero", async () => {
  const antes = (await como(beto, "select public.get_my_chats() c"))[0].c.find((x) => x.id === chat);
  assert.ok(antes.unread >= 2, `unread=${antes.unread}`);
  assert.equal(antes.other_id, ana);
  assert.ok(antes.last_message);
  await como(beto, "select public.mark_chat_read($1)", [chat]);
  const despues = (await como(beto, "select public.get_my_chats() c"))[0].c.find((x) => x.id === chat);
  assert.equal(despues.unread, 0);
  assert.equal((await como(carla, "select public.get_my_chats() c"))[0].c.some((x) => x.id === chat), false);
});

// ── 4. Amistad y citas ──────────────────────────────────────────────────────
console.log("\nAmistad, citas y compatibilidad astral");
await test("no se puede abrir chat directo sin amistad", async () => {
  await falla(como(ana, "select public.open_chat('direct', $1)", [carla]), /solo puedes chatear con tus amigos/i);
});
await test("solicitud de amistad → notificación → aceptar → chat directo automático", async () => {
  await como(ana, "insert into public.friendships (requester_id, addressee_id) values ($1,$2)", [ana, carla]);
  assert.ok((await como(carla, "select 1 from public.notifications where type = 'solicitud'")).length >= 1);
  assert.equal((await como(ana, "update public.friendships set status = 'accepted' where requester_id = $1 returning id", [ana])).length, 0);   // el solicitante no puede aceptar (RLS: 0 filas)
  const r = await como(carla, "update public.friendships set status = 'accepted' where addressee_id = $1 returning id", [carla]);
  assert.equal(r.length, 1);
  const chatDirecto = (await como(ana, "select public.open_chat('direct', $1) id", [carla]))[0].id;
  assert.ok(chatDirecto);
  assert.ok((await como(ana, "select 1 from public.notifications where type = 'solicitud' and title like '%aceptó%'")).length >= 1);
});
await test("no se puede forzar una solicitud ya aceptada ni suplantar al solicitante", async () => {
  await falla(como(ana, "insert into public.friendships (requester_id, addressee_id, status) values ($1,$2,'accepted')", [ana, beto]), /row-level security/);
  await falla(como(ana, "insert into public.friendships (requester_id, addressee_id) values ($1,$2)", [beto, ana]), /row-level security/);
  await falla(como(ana, "insert into public.friendships (requester_id, addressee_id) values ($1,$2)", [ana, carla]), /duplicate|unique/);
});
await test("swipe: un like sin reciprocidad no crea match; el like mutuo crea match, chat, amistad y avisos", async () => {
  await como(ana, "update public.profiles set sign = 'aries' where id = $1", [ana]);
  await como(beto, "update public.profiles set sign = 'leo' where id = $1", [beto]);
  const r1 = (await como(ana, "select public.swipe_person($1, 'like', 'pareja') r", [beto]))[0].r;
  assert.equal(r1.result, "liked");
  assert.equal((await q("select count(*)::int n from public.matches")).at(0).n, 0);
  const r2 = (await como(beto, "select public.swipe_person($1, 'like', 'pareja') r", [ana]))[0].r;
  assert.equal(r2.result, "match");
  assert.ok(r2.chat_id);
  assert.equal(r2.astral_score, sinastria("aries", "leo", "pareja").puntaje);
  const [m] = await como(ana, "select user_a, user_b, astral_score from public.matches");
  assert.ok(m.user_a < m.user_b);
  assert.ok((await como(ana, "select 1 from public.notifications where type = 'match-persona'")).length >= 1);
  assert.equal((await q("select status from public.friendships where least(requester_id, addressee_id) = least($1::uuid,$2::uuid) and greatest(requester_id, addressee_id) = greatest($1::uuid,$2::uuid)", [ana, beto]))[0].status, "accepted");
  assert.ok((await como(beto, "select public.get_my_chats() c"))[0].c.some((x) => x.id === r2.chat_id && x.origin === "cita"));
});
await test("swipe: validaciones (uno mismo, acción inválida) y 'pass'", async () => {
  await falla(como(ana, "select public.swipe_person($1, 'like')", [ana]), /ti mismo/);
  await falla(como(ana, "select public.swipe_person($1, 'love')", [carla]), /inválida/);
  assert.equal((await como(beto, "select public.swipe_person($1, 'pass') r", [carla]))[0].r.result, "passed");
});
await test("Super Like consume un token, avisa al destinatario y falla si no quedan", async () => {
  const dana = await nuevoUsuario("Dana");
  const r = (await como(carla, "select public.swipe_person($1, 'super') r", [dana]))[0].r;
  assert.equal(r.result, "liked");   // no es match garantizado: hace falta reciprocidad
  assert.equal((await q("select super_likes from public.wallets where user_id = $1", [carla]))[0].super_likes, 0);
  assert.ok((await como(dana, "select 1 from public.notifications where title like '%Super Like%'")).length >= 1);
  const eva = await nuevoUsuario("Eva");
  await falla(como(carla, "select public.swipe_person($1, 'super')", [eva]), /no_super_likes/);
});
await test("los usuarios demo corresponden algunos likes para poder probar con una sola cuenta", async () => {
  let matches = 0;
  for (let i = 0; i < 6; i++) {
    const d = await nuevoUsuario(`Demo${i}`);
    await q("update public.profiles set is_demo = true where id = $1", [d]);
    const r = (await como(beto, "select public.swipe_person($1, 'like') r", [d]))[0].r;
    if (r.result === "match") matches++;
  }
  assert.ok(matches >= 1 && matches < 6, `matches=${matches}`);
});
await test("PARIDAD: astral_score en SQL == sinastria() en TypeScript (12×12×4 combinaciones)", async () => {
  const signos = ["aries", "tauro", "geminis", "cancer", "leo", "virgo", "libra", "escorpio", "sagitario", "capricornio", "acuario", "piscis"];
  let n = 0;
  for (const ctx of ["pareja", "amistad", "roomie", "socios"]) {
    const filas = await q("select a, b, public.astral_score(a, b, $1) s from unnest($2::text[]) a cross join unnest($2::text[]) b", [ctx, signos]);
    for (const { a, b, s } of filas) {
      const esperado = sinastria(a, b, ctx).puntaje;
      assert.equal(s, esperado, `${a}-${b}-${ctx}: SQL=${s} TS=${esperado}`);
      n++;
    }
  }
  assert.equal(n, 576);
});

await test("PARIDAD: trust_score en SQL == puntajeConfianza() en TypeScript", async () => {
  const anio = new Date().getFullYear();
  let n = 0;
  for (const identidad of [false, true]) for (const tel of [false, true]) for (const email of [false, true])
    for (const [rating, resenas] of [[0, 0], [4.9, 48], [4.5, 3], [3.7, 9], [5, 1]])
      for (const respuesta of [0, 25, 75, 88, 95, 100]) {
        const u = (await q("insert into auth.users (email) values ($1) returning id", [`paridad${n}@test.dev`]))[0].id;
        await q("update public.profiles set identity_verified=$2, phone_verified=$3, email_verified=$4, rating=$5, reviews_count=$6, response_rate=$7 where id=$1",
          [u, identidad, tel, email, rating, resenas, respuesta]);
        const [p] = await q("select trust_score from public.profiles where id = $1", [u]);
        const esperado = puntajeConfianza({ verificaciones: { identidad, telefono: tel, email }, rating, resenas, respuesta, miembroDesde: anio }, anio);
        assert.equal(p.trust_score, esperado, JSON.stringify({ identidad, tel, email, rating, resenas, respuesta }) + ` SQL=${p.trust_score} TS=${esperado}`);
        n++;
      }
  assert.equal(n, 8 * 5 * 6);
});
await test("el cliente no puede modificar trust_score", async () => {
  await falla(como(ana, "update public.profiles set trust_score = 100 where id = $1", [ana]), /permission denied/);
});
// ── 5. KYC y Storage ────────────────────────────────────────────────────────
console.log("\nKYC y Storage");
await test("solo se aceptan rutas de la propia carpeta y la solicitud queda pendiente", async () => {
  await falla(como(ana, "select public.submit_kyc($1, $2)", [`${beto}/doc.jpg`, `${ana}/selfie.jpg`]), /tu carpeta/);
  await como(ana, "select public.submit_kyc($1, $2)", [`${ana}/doc.jpg`, `${ana}/selfie.jpg`]);
  assert.equal((await q("select kyc_status, identity_verified from public.profiles where id = $1", [ana]))[0].kyc_status, "pending");
  await falla(como(ana, "select public.submit_kyc($1, $2)", [`${ana}/doc2.jpg`, `${ana}/selfie2.jpg`]), /unique|duplicate/);
});
await test("las solicitudes KYC solo las ven su dueño y los administradores", async () => {
  assert.equal((await como(ana, "select 1 from public.kyc_submissions")).length, 1);
  assert.equal((await como(beto, "select 1 from public.kyc_submissions")).length, 0);
  assert.equal((await como(admin, "select 1 from public.kyc_submissions")).length, 1);
});
await test("un usuario no puede aprobarse a sí mismo ni escribir en kyc_submissions", async () => {
  const [{ id }] = await q("select id from public.kyc_submissions where user_id = $1", [ana]);
  await falla(como(ana, "select public.review_kyc($1, true)", [id]), /administradores/);
  await falla(como(ana, "update public.kyc_submissions set status = 'approved' where id = $1", [id]), /permission denied/);
  await falla(como(ana, "insert into public.kyc_submissions (user_id, doc_path, selfie_path) values ($1,$2,$3)", [ana, `${ana}/a`, `${ana}/b`]), /permission denied/);
});
await test("el administrador aprueba → identidad verificada + aviso; no se puede revisar dos veces", async () => {
  const [{ id }] = await q("select id from public.kyc_submissions where user_id = $1", [ana]);
  await como(admin, "select public.review_kyc($1, true)", [id]);
  const [u] = await q("select identity_verified, kyc_status from public.profiles where id = $1", [ana]);
  assert.equal(u.identity_verified, true);
  assert.equal(u.kyc_status, "verified");
  assert.ok((await como(ana, "select 1 from public.notifications where type = 'kyc'")).length >= 1);
  await falla(como(admin, "select public.review_kyc($1, false)", [id]), /no pendiente/);
});
await test("rechazo con motivo y nuevo intento permitido", async () => {
  await como(beto, "select public.submit_kyc($1, $2)", [`${beto}/d.jpg`, `${beto}/s.jpg`]);
  const [{ id }] = await q("select id from public.kyc_submissions where user_id = $1", [beto]);
  await como(admin, "select public.review_kyc($1, false, 'Foto borrosa')", [id]);
  assert.equal((await q("select kyc_status from public.profiles where id = $1", [beto]))[0].kyc_status, "rejected");
  await como(beto, "select public.submit_kyc($1, $2)", [`${beto}/d2.jpg`, `${beto}/s2.jpg`]);
});
const objeto = async (uid, bucket, nombre) =>
  como(uid, "insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3) returning id", [bucket, nombre, uid]);
await test("Storage KYC: solo se sube a la propia carpeta; otros no lo ven; el admin sí", async () => {
  await objeto(ana, "kyc", `${ana}/doc.jpg`);
  await falla(objeto(ana, "kyc", `${beto}/doc.jpg`), /row-level security/);
  assert.equal((await como(ana, "select 1 from storage.objects where bucket_id = 'kyc'")).length, 1);
  assert.equal((await como(beto, "select 1 from storage.objects where bucket_id = 'kyc'")).length, 0);
  assert.equal((await como(null, "select 1 from storage.objects where bucket_id = 'kyc'")).length, 0);
  assert.equal((await como(admin, "select 1 from storage.objects where bucket_id = 'kyc'")).length, 1);
});
await test("Storage KYC: el usuario no puede modificar ni borrar sus documentos; el admin sí puede borrarlos", async () => {
  assert.equal((await como(ana, "update storage.objects set name = $1 where bucket_id = 'kyc' returning id", [`${ana}/otro.jpg`])).length, 0);
  assert.equal((await como(ana, "delete from storage.objects where bucket_id = 'kyc' returning id")).length, 0);
  assert.equal((await como(admin, "delete from storage.objects where bucket_id = 'kyc' returning id")).length, 1);
});
await test("Storage media: lectura pública, escritura solo en la propia carpeta", async () => {
  await objeto(ana, "media", `${ana}/casa.jpg`);
  await falla(objeto(ana, "media", `${beto}/casa.jpg`), /row-level security/);
  assert.equal((await como(null, "select 1 from storage.objects where bucket_id = 'media'")).length, 1);
  assert.equal((await como(beto, "delete from storage.objects where bucket_id = 'media' returning id")).length, 0);
});
await test("los buckets se crearon con las restricciones esperadas", async () => {
  const b = Object.fromEntries((await q("select id, public, file_size_limit, allowed_mime_types from storage.buckets")).map((x) => [x.id, x]));
  assert.equal(b.kyc.public, false);
  assert.equal(b.media.public, true);
  assert.ok(b.kyc.allowed_mime_types.every((m) => m.startsWith("image/")));
});

// ── 6. Recompensas ──────────────────────────────────────────────────────────
console.log("\nRecompensas (monedas server-side)");
const monedas = async (uid) => (await q("select coins from public.wallets where user_id = $1", [uid]))[0].coins;
await test("bono diario: una vez al día, con racha", async () => {
  const antes = await monedas(beto);
  const r = (await como(beto, "select public.daily_checkin() r"))[0].r;
  assert.equal(r.amount, 10);
  assert.equal(await monedas(beto), antes + 10);
  await falla(como(beto, "select public.daily_checkin()"), /already_claimed/);
  await q("update public.wallets set last_checkin = current_date - 1, streak = 2 where user_id = $1", [beto]);
  assert.equal((await como(beto, "select public.daily_checkin() r"))[0].r.streak, 3);
  await q("update public.wallets set last_checkin = current_date - 5, streak = 6 where user_id = $1", [beto]);
  assert.equal((await como(beto, "select public.daily_checkin() r"))[0].r.streak, 1);   // se rompió la racha
});
await test("ruleta: un giro al día, premio válido y acreditado", async () => {
  const antes = await monedas(ana);
  const r = (await como(ana, "select public.spin_wheel() r"))[0].r;
  assert.ok([5, 10, 20, 50, 100, 25].includes(r.amount));
  assert.equal(await monedas(ana), antes + r.amount);
  await falla(como(ana, "select public.spin_wheel()"), /already_spun/);
});
await test("ruleta: la distribución favorece premios bajos (2 000 simulaciones)", async () => {
  const cuenta = {};
  const u = await nuevoUsuario("Ruleta");
  for (let i = 0; i < 2000; i++) {
    await q("update public.wallets set last_spin = null where user_id = $1", [u]);
    const c = new pg.Client(conn);
    await c.connect();
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: u, role: "authenticated" })]);
    const r = (await c.query("select public.spin_wheel() r")).rows[0].r;
    await c.query("commit");
    await c.end();
    cuenta[r.amount] = (cuenta[r.amount] ?? 0) + 1;
  }
  assert.ok((cuenta[5] ?? 0) > (cuenta[100] ?? 0) * 4, JSON.stringify(cuenta));
  console.log("      distribución:", JSON.stringify(cuenta));
});
await test("canjes: sin saldo falla sin efectos; con saldo descuenta, suma y deja rastro en el libro", async () => {
  await q("update public.wallets set coins = 40 where user_id = $1", [carla]);
  await falla(como(carla, "select public.redeem_super_likes()"), /insufficient_coins/);
  assert.equal(await monedas(carla), 40);
  await q("update public.wallets set coins = 300, super_likes = 0 where user_id = $1", [carla]);
  assert.equal((await como(carla, "select public.redeem_super_likes() n"))[0].n, 3);
  assert.equal(await monedas(carla), 240);
  assert.equal((await como(carla, "select public.redeem_premium_reading() n"))[0].n, 1);
  assert.equal(await monedas(carla), 190);
  const [l] = await q("select sum(delta)::int s from public.wallet_ledger where user_id = $1 and reason in ('super_likes','premium_reading')", [carla]);
  assert.equal(l.s, -110);
});
await test("boost: solo sobre tus ofertas, cuesta 100 y acumula 24 h", async () => {
  await q("update public.wallets set coins = 250 where user_id = $1", [beto]);
  await falla(como(beto, "select public.redeem_boost($1)", [buscoAna]), /propias ofertas/);
  const hasta = (await como(beto, "select public.redeem_boost($1) t", [deptoBeto]))[0].t;
  assert.ok(new Date(hasta) > new Date(Date.now() + 23 * 3600e3));
  assert.equal(await monedas(beto), 150);
  const hasta2 = (await como(beto, "select public.redeem_boost($1) t", [deptoBeto]))[0].t;
  assert.ok(new Date(hasta2) > new Date(Date.now() + 47 * 3600e3));
});
await test("misiones: solo si se cumplen, una vez, y con el premio correcto", async () => {
  const w = await monedas(carla);
  await falla(como(carla, "select public.claim_mission('kyc')"), /aún no está cumplida/);
  await falla(como(carla, "select public.claim_mission('nope')"), /inexistente/);
  assert.equal((await como(carla, "select public.claim_mission('publicar') p"))[0].p, 50);
  assert.equal(await monedas(carla), w + 50);
  await falla(como(carla, "select public.claim_mission('publicar')"), /duplicate|unique/);
});
await test("tarot: 1 carta cada 24 h; la premium exige tirada y da 3 cartas distintas", async () => {
  const r = (await como(ana, "select public.draw_tarot(false) r"))[0].r;
  assert.equal(r.cards.length, 1);
  assert.ok(r.cards[0] >= 0 && r.cards[0] <= 21);
  await falla(como(ana, "select public.draw_tarot(false)"), /cooldown:\d+/);
  await falla(como(ana, "select public.draw_tarot(true)"), /no_premium_readings/);
  await q("update public.wallets set premium_readings = 1 where user_id = $1", [ana]);
  const p = (await como(ana, "select public.draw_tarot(true) r"))[0].r;
  assert.equal(new Set(p.cards).size, 3);
  assert.equal((await q("select premium_readings from public.wallets where user_id = $1", [ana]))[0].premium_readings, 0);
  assert.equal((await como(ana, "select 1 from public.tarot_draws")).length, 2);
  assert.equal((await como(beto, "select 1 from public.tarot_draws")).length, 0);
});
await test("el monedero, el libro y las misiones son privados", async () => {
  assert.equal((await como(ana, "select 1 from public.wallets")).length, 1);
  assert.equal((await como(ana, "select 1 from public.wallet_ledger where user_id <> $1", [ana])).length, 0);
  await falla(como(null, "select * from public.wallets"), /permission denied/);
});

// ── 7. Comunidad, reseñas y notificaciones ──────────────────────────────────
console.log("\nComunidad, reseñas y notificaciones");
await test("posts públicos; solo el autor publica y borra lo suyo; likes y comentarios propios", async () => {
  const post = (await como(ana, "insert into public.posts (author_id, kind, body) values ($1,'historia','Mi primera casa') returning id", [ana]))[0].id;
  assert.equal((await como(null, "select 1 from public.posts where id = $1", [post])).length, 1);
  await falla(como(beto, "insert into public.posts (author_id, kind, body) values ($1,'historia','suplantado')", [ana]), /row-level security/);
  assert.equal((await como(beto, "delete from public.posts where id = $1 returning id", [post])).length, 0);
  await como(beto, "insert into public.post_likes (post_id, user_id) values ($1,$2)", [post, beto]);
  await falla(como(beto, "insert into public.post_likes (post_id, user_id) values ($1,$2)", [post, ana]), /row-level security/);
  await como(beto, "insert into public.post_comments (post_id, author_id, body) values ($1,$2,'Felicidades')", [post, beto]);
  assert.equal((await como(ana, "delete from public.posts where id = $1 returning id", [post])).length, 1);
  assert.equal((await q("select count(*)::int n from public.post_comments where post_id = $1", [post]))[0].n, 0);   // cascada
});
await test("reseñas: solo entre quienes han conversado; recalculan la reputación", async () => {
  const fran = await nuevoUsuario("Fran");   // sin ningún chat con Ana
  await falla(como(fran, "insert into public.reviews (author_id, target_id, rating) values ($1,$2,5)", [fran, ana]), /row-level security/);
  const r = await como(ana, "insert into public.reviews (author_id, target_id, rating, comment) values ($1,$2,5,'Excelente trato') returning id", [ana, beto]);
  assert.equal(r.length, 1);
  await q("insert into public.reviews (author_id, target_id, rating) values ($1,$2,4)", [carla, beto]);
  const [u] = await q("select rating, reviews_count from public.profiles where id = $1", [beto]);
  assert.equal(Number(u.rating), 4.5);
  assert.equal(u.reviews_count, 2);
  await falla(como(ana, "insert into public.reviews (author_id, target_id, rating) values ($1,$2,5)", [ana, ana]), /./);
});
await test("las notificaciones son privadas; solo se puede marcar como leída lo propio", async () => {
  assert.equal((await como(beto, "select 1 from public.notifications where user_id <> $1", [beto])).length, 0);
  await falla(como(beto, "update public.notifications set title = 'x' where user_id = $1", [beto]), /permission denied/);
  await como(beto, "select public.mark_notifications_read()");
  assert.equal((await como(beto, "select 1 from public.notifications where read_at is null")).length, 0);
  assert.ok((await como(ana, "select 1 from public.notifications where read_at is null")).length >= 1);   // no afecta a otros
  await falla(como(null, "select * from public.notifications"), /permission denied/);
});
await test("los administradores no aparecen en tablas accesibles y app_admins es inaccesible", async () => {
  await falla(como(ana, "select * from public.app_admins"), /permission denied/);
  await falla(como(ana, "insert into public.app_admins (user_id) values ($1)", [ana]), /permission denied/);
});
await test("las funciones internas no son invocables por clientes", async () => {
  for (const fn of ["public._earn($1, 1000, 'x')", "public._spend($1, 1, 'x')", "public.notify($1, 'sistema', 'x')", "public._ensure_chat('direct','k',null,null,null,$1,$1)"]) {
    await falla(como(ana, `select ${fn}`, [ana]), /permission denied/);
  }
  await falla(como(null, "select public.daily_checkin()"), /permission denied/);
});
await test("Realtime: las tablas de tiempo real están en la publicación", async () => {
  const t = (await q("select tablename from pg_publication_tables where pubname = 'supabase_realtime'")).map((r) => r.tablename);
  for (const x of ["messages", "notifications", "listings", "wallets", "matches", "friendships"]) assert.ok(t.includes(x), x);
});
await test("borrar un usuario en auth elimina en cascada sus datos", async () => {
  const z = await nuevoUsuario("Zoe");
  await como(z, "insert into public.posts (author_id, kind, body) values ($1,'historia','hola')", [z]);
  await q("delete from auth.users where id = $1", [z]);
  assert.equal((await q("select count(*)::int n from public.profiles where id = $1", [z]))[0].n, 0);
  assert.equal((await q("select count(*)::int n from public.posts where author_id = $1", [z]))[0].n, 0);
  assert.equal((await q("select count(*)::int n from public.wallets where user_id = $1", [z]))[0].n, 0);
});

await test("seed.sql se aplica (y es idempotente): perfiles demo, ofertas, búsquedas, servicios y coincidencias", async () => {
  const seed = fs.readFileSync(path.join(aqui, "..", "seed.sql"), "utf8");
  await su.query(seed);
  await su.query(seed); // segunda ejecución: no debe fallar ni duplicar
  const c = async (sql) => (await q(sql))[0].n;
  const demo = "owner_id in (select id from public.profiles where id::text like '00000000-0000-4000-8000-%')";
  const esperado = async (nombre, sql, valor) => assert.equal(await c(sql), valor, `${nombre}: valor distinto del esperado (${valor})`);
  await esperado("perfiles demo", "select count(*)::int n from public.profiles where id::text like '00000000-0000-4000-8000-%'", 23);
  await esperado("ofertas demo", `select count(*)::int n from public.listings where kind = 'offer' and ${demo}`, 17);
  await esperado("búsquedas demo", `select count(*)::int n from public.listings where kind = 'demand' and ${demo}`, 7);
  await esperado("gigs demo", "select count(*)::int n from public.jobs where kind = 'gig' and owner_id in (select id from public.profiles where id::text like '00000000-0000-4000-8000-%')", 6);
  await esperado("vacantes demo", "select count(*)::int n from public.jobs where kind = 'vacancy' and owner_id in (select id from public.profiles where id::text like '00000000-0000-4000-8000-%')", 5);
  await esperado("posts demo", "select count(*)::int n from public.posts where author_id in (select id from public.profiles where id::text like '00000000-0000-4000-8000-%')", 7);
  const pares = await q("select l.title from public.listing_matches m join public.listings l on l.id = m.offer_id join public.listings d on d.id = m.demand_id where d.owner_id = (select id from public.profiles where handle = '@bruno.salva')");
  assert.ok(pares.some((p) => /Departamento céntrico/.test(p.title)), "la búsqueda de Bruno debería coincidir con el depto céntrico");
  assert.equal(await c("select count(*)::int n from public.notifications where user_id in (select id from public.profiles where id::text like '00000000-0000-4000-8000-%')"), 0);
  assert.ok((await c("select trust_score n from public.profiles where handle = '@lucia.ferrer'")) >= 90);
  // Ningún perfil demo se muestra con iniciales: todos traen avatar, distinto para cada uno.
  const avatares = await q("select avatar_url from public.profiles where id::text like '00000000-0000-4000-8000-%'");
  assert.ok(avatares.every((a) => a.avatar_url && /^https:\/\/i\.pravatar\.cc\/400\?img=\d+$/.test(a.avatar_url)), "hay perfiles demo sin avatar");
  assert.equal(new Set(avatares.map((a) => a.avatar_url)).size, avatares.length, "avatares repetidos");
  assert.equal(avatares.length, 23);
  await esperado("perfiles demo con onboarding completo (salen en /explorar)", "select count(*)::int n from public.profiles where id::text like '00000000-0000-4000-8000-%' and onboarding_completed", 23);
});

// ── 7b. Fotos de perfil (máx. 10), onboarding y simulación de personas ──────
console.log("\nFotos de perfil, onboarding y personas simuladas");
const foto = (uid, n) => [`${uid}/fotos/f${n}.webp`, `${uid}/fotos/f${n}_thumb.webp`, 1200, 1600, 90_000 + n, "image/webp"];
const addFoto = (uid, n) => como(uid, "select public.add_profile_photo($1,$2,$3,$4,$5,$6) id", foto(uid, n));
const fotosDe = async (uid) => q("select id, sort_order from public.profile_photos where user_id = $1 order by sort_order", [uid]);
const dora = await nuevoUsuario("Dora");
const edu = await nuevoUsuario("Edu");
let idsDora = [];
await test("las fotos solo se crean con add_profile_photo (sin INSERT/UPDATE/DELETE directos) y son públicas", async () => {
  await falla(como(dora, "insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path) values ($1, 0, 'a/b', 'a/c')", [dora]), /permission denied/);
  idsDora.push((await addFoto(dora, 0))[0].id);
  await falla(como(dora, "update public.profile_photos set sort_order = 5 where user_id = $1", [dora]), /permission denied/);
  await falla(como(dora, "delete from public.profile_photos where user_id = $1", [dora]), /permission denied/);
  assert.equal((await como(null, "select 1 from public.profile_photos where user_id = $1", [dora])).length, 1);
});
await test("hasta 10 fotos con orden 0..9 correlativo; la número 11 se rechaza", async () => {
  for (let n = 1; n < 10; n++) idsDora.push((await addFoto(dora, n))[0].id);
  assert.deepEqual((await fotosDe(dora)).map((f) => f.sort_order), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await falla(addFoto(dora, 10), /max_photos/);
  assert.equal((await fotosDe(dora)).length, 10);
});
await test("las fotos deben estar en la carpeta del propio usuario", async () => {
  await falla(como(edu, "select public.add_profile_photo($1,$2,1,1,1,'image/webp')", [`${dora}/x.webp`, `${edu}/x_thumb.webp`]), /tu carpeta/);
  await falla(como(edu, "select public.add_profile_photo($1,$2,1,1,1,'image/gif')", [`${edu}/x.gif`, `${edu}/x_t.gif`]), /check/);
});
await test("los límites son por perfil: otra persona puede tener sus propias 10 fotos", async () => {
  for (let n = 0; n < 10; n++) await addFoto(edu, n);
  assert.equal((await fotosDe(edu)).length, 10);
});
await test("reordenar: exige la lista completa, sin repetidos ni fotos ajenas; aplica el orden pedido", async () => {
  const invertido = [...idsDora].reverse();
  await como(dora, "select public.reorder_profile_photos($1::uuid[])", [invertido]);
  assert.deepEqual((await fotosDe(dora)).map((f) => f.id), invertido);
  await falla(como(dora, "select public.reorder_profile_photos($1::uuid[])", [invertido.slice(1)]), /exactamente/);
  await falla(como(dora, "select public.reorder_profile_photos($1::uuid[])", [[...invertido.slice(1), invertido[1]]]), /exactamente/);
  const ajena = (await fotosDe(edu))[0].id;
  await falla(como(dora, "select public.reorder_profile_photos($1::uuid[])", [[...invertido.slice(1), ajena]]), /exactamente/);
  idsDora = invertido;
});
await test("borrar compacta el orden y devuelve las rutas a eliminar; nadie borra fotos ajenas", async () => {
  const [medio] = await q("select id from public.profile_photos where user_id = $1 and sort_order = 4", [dora]);
  await falla(como(edu, "select * from public.delete_profile_photo($1)", [medio.id]), /no encontrada/);
  const rutas = await como(dora, "select * from public.delete_profile_photo($1)", [medio.id]);
  assert.match(rutas[0].storage_path, new RegExp(`^${dora}/fotos/`));
  assert.deepEqual((await fotosDe(dora)).map((f) => f.sort_order), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  await addFoto(dora, 99); // el hueco liberado se reutiliza: vuelve a haber 10
  assert.equal((await fotosDe(dora)).length, 10);
});
await test("subidas concurrentes: nunca se supera el máximo (12 peticiones en paralelo sobre 3 huecos)", async () => {
  const fran2 = await nuevoUsuario("Concurrente");
  for (let n = 0; n < 7; n++) await addFoto(fran2, n);
  const res = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => addFoto(fran2, 100 + i)));
  assert.equal(res.filter((r) => r.status === "fulfilled").length, 3);
  assert.deepEqual((await fotosDe(fran2)).map((f) => f.sort_order), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
await test("eliminar el perfil elimina sus fotos (cascada)", async () => {
  const tmp = await nuevoUsuario("Temporal");
  await addFoto(tmp, 0);
  await q("delete from auth.users where id = $1", [tmp]);
  assert.equal((await q("select count(*)::int n from public.profile_photos where user_id = $1", [tmp]))[0].n, 0);
});
await test("complete_onboarding valida en el servidor: nombre, usuario, fecha de nacimiento y al menos una foto", async () => {
  const gus = await nuevoUsuario("Gus");
  assert.equal((await q("select onboarding_completed from public.profiles where id = $1", [gus]))[0].onboarding_completed, false);
  await falla(como(gus, "select public.complete_onboarding()"), /fecha de nacimiento/);
  await como(gus, "update public.user_private set birth_date = '1990-05-05' where user_id = $1", [gus]);
  await falla(como(gus, "select public.complete_onboarding()"), /falta tu universidad/);
  await como(gus, "update public.profiles set university = 'Universidad Nacional' where id = $1", [gus]);
  await falla(como(gus, "select public.complete_onboarding()"), /falta tu colegio/);
  await como(gus, "update public.profiles set school = 'Colegio San José' where id = $1", [gus]);
  await falla(como(gus, "select public.complete_onboarding()"), /pareja ideal/);
  await como(gus, "update public.user_private set ideal_partner = 'corto' where user_id = $1", [gus]);
  await falla(como(gus, "select public.complete_onboarding()"), /pareja ideal/);
  await como(gus, "update public.user_private set ideal_partner = 'Alguien alegre, curioso y que ame viajar' where user_id = $1", [gus]);
  await falla(como(gus, "select public.complete_onboarding()"), /al menos una foto/);
  await addFoto(gus, 0);
  // A todas las personas se les pregunta si son hombre o mujer y a quién quieren conocer (update_013)
  await falla(como(gus, "select public.complete_onboarding()"), /hombre o mujer/);
  await falla(como(gus, "update public.user_private set gender = 'otro' where user_id = $1", [gus]), /violates check/);
  await como(gus, "update public.user_private set gender = 'no_dice' where user_id = $1", [gus]);
  await falla(como(gus, "select public.complete_onboarding()"), /a quién te gustaría conocer/);
  await como(gus, "update public.user_private set interested_in = 'todos' where user_id = $1", [gus]);
  await falla(como(gus, "update public.profiles set onboarding_completed = true where id = $1", [gus]), /permission denied/);
  await como(gus, "select public.complete_onboarding()");
  assert.equal((await q("select onboarding_completed from public.profiles where id = $1", [gus]))[0].onboarding_completed, true);
  await q("update public.profiles set display_name = 'Nuevo usuario' where id = $1", [gus]);
  await q("update public.profiles set onboarding_completed = false where id = $1", [gus]);
  await falla(como(gus, "select public.complete_onboarding()"), /falta tu nombre/);
});
await test("admin_simulate: solo administradores y solo como personas demo; like → match; mensaje requiere vínculo", async () => {
  const persona = await nuevoUsuario("PersonaSim");
  await q("update public.profiles set is_demo = true, sign = 'leo' where id = $1", [persona]);
  await falla(como(dora, "select public.admin_simulate($1,'like',$2)", [persona, dora]), /administradores/);
  await falla(como(admin, "select public.admin_simulate($1,'like',$2)", [dora, edu]), /persona simulada/);
  await falla(como(admin, "select public.admin_simulate($1,'like',$1)", [persona]), /inválido/);
  await falla(como(admin, "select public.admin_simulate($1,'message',$2,'hola')", [persona, dora]), /no_chat/);
  const r1 = (await como(admin, "select public.admin_simulate($1,'like',$2) r", [persona, dora]))[0].r;
  assert.equal(r1.result, "liked");
  assert.ok((await como(dora, "select 1 from public.person_swipes where 1=0")).length === 0);
  const r2 = (await como(dora, "select public.swipe_person($1,'like') r", [persona]))[0].r;
  assert.equal(r2.result, "match");
  const m = (await como(admin, "select public.admin_simulate($1,'message',$2,'¡Hola! Vi tus fotos') r", [persona, dora]))[0].r;
  assert.equal(m.chat_id, r2.chat_id);
  assert.ok((await como(dora, "select 1 from public.messages where chat_id = $1 and sender_id = $2 and body like '%fotos%'", [m.chat_id, persona])).length === 1);
  const otra = await nuevoUsuario("PersonaSim2");
  await q("update public.profiles set is_demo = true where id = $1", [otra]);
  assert.equal((await como(admin, "select public.admin_simulate($1,'friend_request',$2) r", [otra, dora]))[0].r.result, "sent");
  assert.ok((await como(dora, "select 1 from public.friendships where requester_id = $1 and status = 'pending'", [otra])).length === 1);
  await falla(como(admin, "select public.admin_simulate($1,'bomba',$2)", [otra, dora]), /inválida/);
});
await test("Persona Engine: seed_personas.sql crea 5 personas de Ecuador completas, con fotos de retrato, es idempotente y coincide con el generador", async () => {
  const { generarSql } = await import("../seed/personas.ts");
  const fichero = fs.readFileSync(path.join(aqui, "..", "seed_personas.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(fichero, generarSql(5), "seed_personas.sql está desactualizado: ejecuta npx tsx supabase/seed/personas.ts");
  const ids = [1, 2, 3, 4, 5].map((n) => `00000000-0000-4000-8000-${String(100 + n).padStart(12, "0")}`);
  // Simula una base con el seed ANTIGUO ya aplicado (fotos de picsum, incluidas posiciones 6–9): debe quedar reemplazado, no mezclado.
  await su.query(generarSql(3).replace(/https:\/\/i\.pravatar\.cc\/\d+\?img=\d+/g, "https://picsum.photos/seed/viejo/900/1200"));
  await q("insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path) select $1, g, 'https://picsum.photos/seed/viejo-' || g, 'https://picsum.photos/seed/viejo-' || g from generate_series(6, 9) g", [ids[0]]);
  await su.query(fichero);
  await su.query(fichero); // idempotente
  const escenasPropias = new Set();
  for (const [i, id] of ids.entries()) {
    const f = await q("select sort_order, storage_path, thumb_path, mime from public.profile_photos where user_id = $1 order by sort_order", [id]);
    assert.ok(f.length >= 5 && f.length <= 10, `persona ${i + 1}: ${f.length} fotos`);
    assert.deepEqual(f.map((x) => x.sort_order), f.map((_, k) => k), "las fotos deben ocupar posiciones consecutivas desde 0");
    assert.ok(f.every((x) => /^https:\/\/(i\.pravatar\.cc|thumb\.wikimedia\.org)\//.test(x.storage_path) && x.mime === "image/jpeg"), "solo retratos y escenas verificadas; nada de picsum");
    assert.match(f[0].storage_path, /pravatar\.cc\/900\?img=\d+$/, "la foto 0 es el retrato");
    assert.ok(f.slice(1).every((x) => /wikimedia/.test(x.storage_path)), "el resto son escenas de su ciudad");
    for (const x of f) {
      assert.ok(!escenasPropias.has(x.storage_path), "las galerías no repiten fotos entre personas");
      escenasPropias.add(x.storage_path);
    }
    const [p] = await q("select display_name, handle, bio, location, is_demo, onboarding_completed, avatar_url, sign, age, height_cm, university, school, professional, (select birth_date from public.user_private where user_id = id) nac, (select char_length(ideal_partner) from public.user_private where user_id = id) largo from public.profiles where id = $1", [id]);
    assert.ok(p.display_name && p.handle && p.is_demo && p.onboarding_completed && p.sign && p.nac && p.age >= 18, `perfil incompleto: ${JSON.stringify(p)}`);
    assert.ok(p.university && p.school && p.height_cm >= 150 && p.largo >= 200 && p.professional?.headline, "faltan formación, estatura, pareja ideal o profesión");
    assert.ok(p.bio.length >= 150 && p.bio.length <= 300 && /Cuenca|Quito|Guayaquil/.test(p.location), "biografía sustancial y ubicada en Ecuador");
    assert.equal(p.avatar_url, f[0].thumb_path, "el avatar debe ser la miniatura de la foto principal (nunca vacío: sin iniciales)");
  }
  assert.deepEqual((await q("select location from public.profiles where id = any($1) order by id", [ids])).map((x) => x.location.split(" ·")[0]), ["Cuenca", "Quito", "Guayaquil", "Cuenca", "Quito"]);
  assert.equal((await q("select count(*)::int n from public.profile_photos where user_id = any($1) and storage_path like '%picsum%'", [ids]))[0].n, 0, "el seed antiguo queda reemplazado");
  // No rompe nada existente: siguen funcionando el motor de recomendación y las funciones de swipe con estas personas.
  const invitada = await nuevoUsuario("VisitaEcuador");
  await q("update public.profiles set onboarding_completed = true, age = 30, university = 'Universidad de Cuenca', school = 'Colegio Benigno Malo', interests = '{amigos}', zones = '{Centro}' where id = $1", [invitada]);
  await q("update public.user_private set ideal_partner = 'Alguien sensible al arte, la música y la naturaleza, honesto y con ganas de construir un hogar' where user_id = $1", [invitada]);
  const rec = await como(invitada, "select * from public.recommend_people(p_limit => 60)");
  const emilia = rec.find((r) => r.person_id === ids[0]), seb = rec.find((r) => r.person_id === ids[3]);
  assert.ok(emilia && seb, "las personas de Ecuador aparecen en las recomendaciones");
  assert.ok(emilia.reasons.includes("Comparten universidad") && emilia.reasons.includes("Fueron al mismo colegio"), emilia.reasons.join("|"));
  assert.ok(emilia.score >= 30, `emilia=${emilia.score}`); // sin valores ni estilo marcados por la visitante, solo texto, formación y zona
  assert.ok(["liked", "match"].includes((await como(invitada, "select public.swipe_person($1, 'like') r", [ids[0]]))[0].r.result)); // las personas demo corresponden 2 de cada 3 likes
  // Sin colisión de usuario: si una persona real ya tiene ese @usuario, el seed no falla ni lo pisa.
  const real = await nuevoUsuario("UsuarioReal");
  await q("update public.profiles set handle = '@temporal.emilia' where id = $1", [ids[0]]);
  await q("update public.profiles set handle = '@emilia.vintimilla' where id = $1", [real]);
  await su.query(fichero);
  assert.equal((await q("select handle from public.profiles where id = $1", [real]))[0].handle, "@emilia.vintimilla");
  assert.equal((await q("select handle from public.profiles where id = $1", [ids[0]]))[0].handle, "@temporal.emilia");
  await q("update public.profiles set handle = '@real.' || substr(id::text, 1, 6) where id = $1", [real]);
  await su.query(fichero);
  assert.equal((await q("select handle from public.profiles where id = $1", [ids[0]]))[0].handle, "@emilia.vintimilla");
  // A escala: 200 personas (195 de relleno × 10 fotos) entran sin errores y respetan el máximo.
  const t0 = Date.now();
  await su.query(generarSql(200));
  assert.equal((await q("select count(*)::int n from public.profile_photos where user_id::text like '00000000-0000-4000-8000-%' and user_id = any(select id from public.profiles where handle like '@sim.%')"))[0].n, 195 * 10);
  assert.ok(Date.now() - t0 < 30_000, "200 personas deberían cargarse en menos de 30 s");
});
await test("la función interna _swipe_person no es invocable por clientes", async () => {
  await falla(como(dora, "select public._swipe_person($1,$2,'like','pareja',true)", [dora, edu]), /permission denied/);
});
await test("MIGRACIÓN: esquema base + update_002 (dos veces) deja el mismo resultado y marca los perfiles previos como completos", async () => {
  const completo = fs.readFileSync(esquema, "utf8").replace(/\r\n/g, "\n"); // Windows con autocrlf: schema.sql llega con CRLF
  const ini = completo.indexOf("-- ACTUALIZACION-002-INICIO");
  const fin = completo.indexOf("-- ACTUALIZACION-002-FIN");
  assert.ok(ini > 0 && fin > ini, "faltan los marcadores de la actualización en schema.sql");
  const base = completo.slice(0, ini);
  const actualizacion = fs.readFileSync(path.join(aqui, "..", "update_002_fotos_onboarding.sql"), "utf8").replace(/\r\n/g, "\n");
  // El contenido incrustado en schema.sql debe ser idéntico al del archivo de actualización.
  assert.equal(completo.slice(completo.indexOf("\n", ini) + 1, fin).trim(), actualizacion.trim(), "schema.sql y update_002 difieren");
  await server.createDatabase("migracion");
  const m = new pg.Client({ ...conn, database: "migracion" });
  await m.connect();
  m.on("notice", () => {});
  try {
    // Los roles son globales del clúster: ya existen (los creó el bootstrap de la base principal).
    await m.query(fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8").replace(/^create role .*$/gm, ""));
    await m.query(base);
    await m.query("insert into auth.users (id, email) values (gen_random_uuid(), 'antiguo@test.dev')");
    await m.query(actualizacion);
    await m.query(actualizacion); // idempotente
    await m.query("insert into auth.users (id, email) values (gen_random_uuid(), 'nuevo@test.dev')");
    await m.query(actualizacion); // una tercera ejecución no debe volver a marcar al usuario nuevo como completo
    const filas = (await m.query("select email, onboarding_completed from public.profiles p join auth.users u on u.id = p.id order by email")).rows;
    assert.deepEqual(filas.map((f) => [f.email, f.onboarding_completed]), [["antiguo@test.dev", true], ["nuevo@test.dev", false]]);
    const fns = (await m.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('add_profile_photo','delete_profile_photo','reorder_profile_photos','complete_onboarding','admin_simulate','_swipe_person')")).rows[0].n;
    assert.equal(fns, 6);
  } finally {
    await m.end();
  }
});

// ── 7b. Perfil académico, recomendación, referidos, retos diarios ───────────
console.log("\nConexión: recomendación, referidos y retos diarios");
const perfilListo = (uid, campos) =>
  q(`update public.profiles set onboarding_completed = true, age = $2, height_cm = $3, bio = $4, university = $5, school = $6, interests = $7, zones = $8 where id = $1`,
    [uid, campos.edad, campos.altura, campos.bio ?? "", campos.uni ?? null, campos.colegio ?? null, campos.intereses ?? [], campos.zonas ?? []]);
const completarPerfil = async (uid, n = 0) => {
  await q("update public.user_private set birth_date = '1992-02-02', ideal_partner = 'Alguien alegre, sincero y con ganas de crecer juntos', gender = 'no_dice', interested_in = 'todos' where user_id = $1", [uid]);
  await q("update public.profiles set university = 'Universidad Central', school = 'Colegio Norte' where id = $1", [uid]);
  await addFoto(uid, n);
  await como(uid, "select public.complete_onboarding()");
};

const yo3 = await nuevoUsuario("Yo3");
const afin = await nuevoUsuario("Afin");
const lejano = await nuevoUsuario("Lejano");
await perfilListo(yo3, { edad: 30, altura: 170, bio: "Soy ingeniera", uni: "Universidad Central", colegio: "Colegio Norte", intereses: ["amigos"], zonas: ["Centro"] });
await perfilListo(afin, { edad: 31, altura: 182, bio: "Me encanta viajar, cocinar y el deporte", uni: "universidad  CENTRAL", colegio: "Colegio Sur", intereses: ["amigos"], zonas: ["Centro"] });
await perfilListo(lejano, { edad: 45, altura: 158, bio: "Coleccionista de sellos antiguos", uni: "Otra", colegio: "Otro", zonas: ["Norte"] });
await q("update public.user_private set ideal_partner = 'Alguien que ame viajar, cocinar y practicar deporte' where user_id = $1", [yo3]);
await q("update public.user_private set ideal_partner = 'Alguien tranquila que sepa de ingeniería' where user_id = $1", [afin]);
await test("recommend_people: ordena por compatibilidad (pareja ideal + universidad + intereses) y explica los motivos", async () => {
  const r = await como(yo3, "select * from public.recommend_people(p_limit => 60)");
  const a = r.find((x) => x.person_id === afin);
  assert.ok(a, "falta el candidato afín");
  assert.equal(r[0].person_id, afin, "el más afín va primero");
  assert.ok(a.score >= 30 && a.score <= 100, `afín=${a.score}`);
  assert.ok(a.score >= r[1].score + 10, `se distingue claramente del resto: afín=${a.score}, siguiente=${r[1].score}`);
  assert.ok(a.reasons.some((m) => /pareja ideal/.test(m)) && a.reasons.includes("Comparten universidad") && a.reasons.includes("Intereses en común"), a.reasons.join("|"));
  assert.ok(!r.some((x) => x.person_id === yo3), "no debe recomendarse a sí mismo");
  const [l] = (await como(yo3, "select * from public.recommend_people(p_min_age => 44, p_max_age => 46, p_min_height => 155, p_max_height => 160)")).filter((x) => x.person_id === lejano);
  assert.ok(l && l.score <= 10 && l.reasons.length === 0, "quien no encaja puntúa casi nada y sin motivos");
});
await test("recommend_people: filtros de edad y estatura", async () => {
  const ids = async (args) => (await como(yo3, `select person_id from public.recommend_people(${args}, p_limit => 60)`)).map((x) => x.person_id);
  const porEdad = await ids("p_min_age => 44, p_max_age => 46, p_min_height => 150");
  assert.ok(porEdad.includes(lejano) && !porEdad.includes(afin));
  const combinado = await ids("p_min_age => 31, p_max_age => 31, p_min_height => 180");
  assert.ok(combinado.includes(afin) && !combinado.includes(lejano));
  assert.deepEqual(await ids("p_min_height => 200"), []);
  const bajos = await ids("p_min_age => 40, p_max_height => 160");
  assert.ok(bajos.includes(lejano) && !bajos.includes(afin));
  assert.ok(!(await ids("p_max_age => 30")).includes(afin), "31 años queda fuera de un máximo de 30");
  const rango = await como(yo3, "select p.age, p.height_cm from public.recommend_people(p_min_age => 25, p_max_age => 35, p_min_height => 165, p_max_height => 190, p_limit => 60) r join public.profiles p on p.id = r.person_id");
  assert.ok(rango.length >= 1 && rango.every((x) => x.age >= 25 && x.age <= 35 && x.height_cm >= 165 && x.height_cm <= 190));
  assert.equal((await como(yo3, "select * from public.recommend_people(p_limit => 1)")).length, 1);
});
await test("recommend_people: oculta a quien descartaste y exige sesión", async () => {
  await como(yo3, "select public.swipe_person($1, 'pass')", [lejano]);
  assert.equal((await como(yo3, "select person_id from public.recommend_people()")).some((x) => x.person_id === lejano), false);
  await falla(como(null, "select * from public.recommend_people()"), /permission denied|No autenticado/);
});
await test("la descripción de la pareja ideal es privada (solo su dueña o dueño la lee) y no sale en ninguna función", async () => {
  assert.equal((await como(afin, "select ideal_partner from public.user_private where user_id = $1", [yo3])).length, 0);
  assert.match((await como(yo3, "select ideal_partner from public.user_private where user_id = $1", [yo3]))[0].ideal_partner, /viajar/);
  const cols = (await como(yo3, "select * from public.recommend_people(p_limit => 1)"))[0];
  assert.deepEqual(Object.keys(cols).sort(), ["pct_lifestyle", "pct_relation", "pct_values", "person_id", "reasons", "score"]);
  await falla(como(yo3, "select public._lex('x')"), /permission denied/);
});
// ── Pareja ideal estructurada (update_004): valores, estilo de vida y tipo de relación ──
// Con 200 personas de relleno ya cargadas hay más de 60 candidatos: se aisla a estos perfiles por su estatura (170 cm; el relleno no tiene estatura).
const buscadora = await nuevoUsuario("Buscadora");
const gemela = await nuevoUsuario("Gemela");
const opuesta = await nuevoUsuario("Opuesta");
const sinDatos = await nuevoUsuario("SinDatos");
for (const [uid, edad] of [[buscadora, 33], [gemela, 34], [opuesta, 35], [sinDatos, 36]]) await perfilListo(uid, { edad, altura: 170, bio: "Perfil de prueba estructurada", uni: "U Aparte " + edad, colegio: "C Aparte " + edad });
await q("update public.profiles set core_values = '{Honestidad,Familia}', lifestyle = '{Deportista,Viajero}', relations = '{pareja}' where id = $1", [buscadora]);
await q("update public.user_private set ideal_values = '{Familia,Lealtad}', ideal_lifestyle = '{Casera,Viajero}' where user_id = $1", [buscadora]);
// Gemela: tiene lo que busca la buscadora (con otro género gramatical: «Casero» ≙ «Casera») y busca lo que la buscadora es.
await q("update public.profiles set core_values = '{Familia,Lealtad}', lifestyle = '{Casero,Viajero}', relations = '{pareja,amistad}' where id = $1", [gemela]);
await q("update public.user_private set ideal_values = '{Honestidad,Familia}', ideal_lifestyle = '{Deportista,Viajero}' where user_id = $1", [gemela]);
await q("update public.profiles set core_values = '{Ambición,Aventura}', lifestyle = '{Gamer}', relations = '{socios}' where id = $1", [opuesta]);
await test("pareja ideal estructurada: el motor devuelve el % por valores, estilo de vida y tipo de relación", async () => {
  const r = await como(buscadora, "select * from public.recommend_people(p_min_height => 170, p_max_height => 170, p_limit => 60)");
  const g = r.find((x) => x.person_id === gemela), o = r.find((x) => x.person_id === opuesta);
  // Valores y estilo: la gemela tiene todo lo que busca la buscadora y viceversa (100). Relación: la buscadora quiere «pareja» y la gemela la ofrece, pero la gemela
  // también busca «amistad», que la buscadora no marca: 0,7 × 1 + 0,3 × 0,5 = 85.
  assert.deepEqual([g.pct_values, g.pct_lifestyle, g.pct_relation], [100, 100, 85], JSON.stringify(g));
  assert.deepEqual([o.pct_values, o.pct_lifestyle, o.pct_relation], [0, 0, 0], JSON.stringify(o));
  assert.ok(g.reasons.includes("Valores afines") && g.reasons.includes("Estilo de vida afín") && g.reasons.includes("Buscan lo mismo"), g.reasons.join("|"));
  assert.ok(!o.reasons.includes("Valores afines") && !o.reasons.includes("Buscan lo mismo"));
  assert.ok(g.score >= o.score + 30, `gemela=${g.score} opuesta=${o.score}`);
  assert.ok(g.score <= 100 && r.indexOf(g) < r.indexOf(o), "el más afín va antes");
});
await test("pareja ideal estructurada: mezcla 70 % lo que buscas y 30 % la reciprocidad", async () => {
  // La buscadora quiere {Familia, Lealtad}; a Gemela le basta con Familia: 1 de 2 = 50 %. Ella busca {Honestidad, Familia} y la buscadora tiene ambos: 100 %.
  await q("update public.profiles set core_values = '{Familia}' where id = $1", [gemela]);
  const g = (await como(buscadora, "select * from public.recommend_people(p_min_height => 170, p_max_height => 170, p_limit => 60)")).find((x) => x.person_id === gemela);
  assert.equal(g.pct_values, Math.round(100 * (0.7 * 0.5 + 0.3 * 1)), JSON.stringify(g)); // 65
  await q("update public.profiles set core_values = '{Familia,Lealtad}' where id = $1", [gemela]);
});
await test("pareja ideal estructurada: sin datos suficientes el porcentaje es NULL (no un 0 % engañoso) y no suma puntos", async () => {
  const s = (await como(buscadora, "select * from public.recommend_people(p_min_height => 170, p_max_height => 170, p_limit => 60)")).find((x) => x.person_id === sinDatos);
  assert.deepEqual([s.pct_values, s.pct_lifestyle, s.pct_relation], [null, null, null], JSON.stringify(s));
  const desdeSinDatos = (await como(sinDatos, "select * from public.recommend_people(p_min_height => 170, p_max_height => 170, p_limit => 60)")).find((x) => x.person_id === gemela);
  assert.equal(desdeSinDatos.pct_values, null, "sin valores propios ni buscados no hay con qué comparar");
  // Quien no indicó qué busca se compara con lo que ya es: la afinidad por parecido rellena los huecos.
  await q("update public.profiles set core_values = '{Familia,Lealtad}', lifestyle = '{Viajero}' where id = $1", [sinDatos]);
  const parecido = (await como(sinDatos, "select * from public.recommend_people(p_min_height => 170, p_max_height => 170, p_limit => 60)")).find((x) => x.person_id === gemela);
  // Compara lo que él ya es con lo que la gemela tiene (100) y, por reciprocidad, lo que ella busca ({Honestidad, Familia}) con lo que él es (1 de 2): 0,7 + 0,15 = 85.
  assert.deepEqual([parecido.pct_values, parecido.pct_lifestyle], [85, 85], JSON.stringify(parecido));
});
await test("pareja ideal estructurada: lo que buscas es privado; los valores propios son públicos", async () => {
  assert.equal((await como(gemela, "select ideal_values from public.user_private where user_id = $1", [buscadora])).length, 0);
  assert.deepEqual((await como(buscadora, "select ideal_values, ideal_lifestyle from public.user_private where user_id = $1", [buscadora]))[0], { ideal_values: ["Familia", "Lealtad"], ideal_lifestyle: ["Casera", "Viajero"] });
  assert.deepEqual((await como(null, "select core_values from public.profiles where id = $1", [gemela]))[0].core_values, ["Familia", "Lealtad"]);
  await falla(como(gemela, "select public._afinidad('{a}', '{a}', '{a}', '{a}')"), /permission denied/);
  await falla(como(gemela, "select public._tags('{a}')"), /permission denied/);
});
await test("pareja ideal estructurada: solo el dueño la edita y se validan los límites", async () => {
  await como(buscadora, "update public.user_private set ideal_values = '{A,B,C}', ideal_lifestyle = '{X}' where user_id = $1", [buscadora]);
  await como(buscadora, "update public.profiles set core_values = '{Fe}' where id = $1", [buscadora]);
  assert.equal((await como(gemela, "update public.user_private set ideal_values = '{Hack}' where user_id = $1 returning user_id", [buscadora])).length, 0);
  assert.equal((await como(gemela, "update public.profiles set core_values = '{Hack}' where id = $1 returning id", [buscadora])).length, 0);
  await falla(como(buscadora, "update public.profiles set core_values = '{a,b,c,d,e,f,g,h,i}' where id = $1", [buscadora]), /core_values|check/);
  await falla(como(buscadora, "update public.user_private set ideal_lifestyle = array_fill('x'::text, array[9]) where user_id = $1", [buscadora]), /ideal_lifestyle|check/);
  await q("update public.user_private set ideal_values = '{Familia,Lealtad}', ideal_lifestyle = '{Casera,Viajero}' where user_id = $1", [buscadora]);
  await q("update public.profiles set core_values = '{Honestidad,Familia}' where id = $1", [buscadora]);
});
await test("recommend_people: un perfil espejo alcanza casi el 100 % con las tres dimensiones al 100", async () => {
  // Perfil «espejo»: mismo texto, universidad, colegio, intereses, zona, valores, estilo y relación.
  const yoE = await nuevoUsuario("YoEspejo"), elE = await nuevoUsuario("ElEspejo");
  for (const uid of [yoE, elE]) {
    await perfilListo(uid, { edad: 30, altura: 170, bio: "Amante del senderismo y la cocina casera", uni: "Espejo U", colegio: "Espejo C", intereses: ["amigos", "roomie"], zonas: ["Centro"] });
    await q("update public.profiles set core_values = '{Familia,Fe}', lifestyle = '{Viajero}', relations = '{pareja}', sign = 'aries' where id = $1", [uid]);
    await q("update public.user_private set ideal_partner = 'Persona amante del senderismo y la cocina casera', ideal_values = '{Familia,Fe}', ideal_lifestyle = '{Viajero}' where user_id = $1", [uid]);
  }
  const e = (await como(yoE, "select * from public.recommend_people(p_min_height => 170, p_max_height => 170, p_limit => 60)")).find((x) => x.person_id === elE);
  assert.deepEqual([e.pct_values, e.pct_lifestyle, e.pct_relation], [100, 100, 100]);
  assert.ok(e.score >= 90 && e.score <= 100, `espejo=${e.score}`);
});
await test("los campos académicos: se editan solo en el propio perfil y respetan sus rangos", async () => {
  await como(yo3, "update public.profiles set university = 'U Nueva', school = 'Colegio Nuevo', height_cm = 171 where id = $1", [yo3]);
  await falla(como(yo3, "update public.profiles set height_cm = 50 where id = $1", [yo3]), /height_cm|check/);
  assert.equal((await como(afin, "update public.profiles set school = 'x' where id = $1 returning id", [yo3])).length, 0);
  await falla(como(yo3, "update public.profiles set referral_code = 'robado' where id = $1", [yo3]), /permission denied/);
});

const anfitrion = await nuevoUsuario("Anfitrion");
const codigo = (await q("select referral_code from public.profiles where id = $1", [anfitrion]))[0].referral_code;
await test("referidos: el código se genera solo; el registro con ?ref crea el vínculo; el autorreferido y códigos falsos no", async () => {
  assert.match(codigo, /^[0-9a-f]{10}$/);
  const i1 = await nuevoUsuario("Invitado1", { ref: codigo.toUpperCase() });
  assert.equal((await q("select referrer_id from public.referrals where referred_id = $1", [i1]))[0].referrer_id, anfitrion);
  await nuevoUsuario("ConCodigoFalso", { ref: "no-existe" }); // no debe impedir el registro
  assert.equal((await como(anfitrion, "select public.apply_referral($1) ok", [codigo]))[0].ok, false);
  const i2 = await nuevoUsuario("Invitado2");
  assert.equal((await como(i2, "select public.apply_referral($1) ok", [codigo]))[0].ok, true);
  assert.equal((await como(i2, "select public.apply_referral($1) ok", [codigo]))[0].ok, false, "un usuario solo puede tener un invitador");
  assert.equal((await como(i2, "select public.apply_referral('zzz') ok"))[0].ok, false);
  assert.equal((await como(i2, "select count(*)::int n from public.referrals"))[0].n, 1, "el invitado ve solo su vínculo");
  assert.equal((await como(dora, "select count(*)::int n from public.referrals"))[0].n, 0, "terceros no ven la red");
});
await test("referidos: se paga una sola vez al completar el perfil; hitos 3 → +50 extra; estadísticas y ranking", async () => {
  const ref = (await q("select referred_id from public.referrals where referrer_id = $1 order by created_at", [anfitrion])).map((r) => r.referred_id);
  assert.equal(ref.length, 2);
  const base = await monedas(anfitrion);                        // 20 de bienvenida
  await completarPerfil(ref[0], 0);
  assert.equal(await monedas(anfitrion), base + 50);
  assert.equal(await monedas(ref[0]), 20 + 25, "el invitado también recibe su bienvenida");
  await como(ref[0], "select public.complete_onboarding()");    // repetirlo no vuelve a pagar
  assert.equal(await monedas(anfitrion), base + 50);
  await completarPerfil(ref[1], 0);
  const i3 = await nuevoUsuario("Invitado3", { ref: codigo });
  await completarPerfil(i3, 0);                                  // tercer invitado confirmado
  assert.equal(await monedas(anfitrion), base + 3 * 50 + 50, "hito de 3 invitados");
  const st = (await como(anfitrion, "select public.referral_stats() s"))[0].s;
  assert.deepEqual([st.invited, st.confirmed, st.coins_earned, st.code], [3, 3, 200, codigo]);
  const top = await como(anfitrion, "select * from public.referral_leaderboard(5)");
  assert.equal(top[0].display_name, "Anfitrion");
  assert.equal(top[0].confirmed, 3);
  assert.equal((await q("select count(*)::int n from public.wallet_ledger where user_id = $1 and reason like 'referral_milestone:%'", [anfitrion]))[0].n, 1);
});

const jugador = await nuevoUsuario("Jugador");
await test("retos diarios: estado, cobro único por día, validación en servidor y bono por completar todo", async () => {
  const estado = async () => (await como(jugador, "select public.daily_challenges_status() s"))[0].s;
  const e0 = await estado();
  assert.deepEqual(e0.map((c) => c.id), ["checkin", "conectar", "publicar", "mensaje", "reflexion", "invitar", "completo"]);
  assert.equal(e0.find((c) => c.id === "reflexion").done, true);
  assert.equal(e0.find((c) => c.id === "checkin").done, false);
  await falla(como(jugador, "select public.claim_daily_challenge('checkin')"), /aún no está cumplido/);
  await falla(como(jugador, "select public.claim_daily_challenge('completo')"), /aún no está cumplido/);
  await falla(como(jugador, "select public.claim_daily_challenge('inventado')"), /inexistente/);
  const antes = await monedas(jugador);
  assert.equal((await como(jugador, "select public.claim_daily_challenge('reflexion') p"))[0].p, 5);
  await falla(como(jugador, "select public.claim_daily_challenge('reflexion')"), /duplicate|unique/);
  assert.equal(await monedas(jugador), antes + 5);
  await como(jugador, "select public.daily_checkin()");
  assert.equal((await como(jugador, "select public.claim_daily_challenge('checkin') p"))[0].p, 5);
  for (const c of ["conectar", "publicar", "mensaje"]) await q("insert into public.daily_challenge_claims (user_id, challenge_id) values ($1, $2)", [jugador, c]);
  assert.equal((await estado()).find((c) => c.id === "completo").done, true);
  assert.equal((await como(jugador, "select public.claim_daily_challenge('completo') p"))[0].p, 25);
  assert.equal((await estado()).filter((c) => c.claimed).length, 6, "los 5 retos base + el bono de día completo");
  assert.equal((await como(dora, "select count(*)::int n from public.daily_challenge_claims"))[0].n, 0, "los cobros son privados");
  await falla(como(jugador, "insert into public.daily_challenge_claims (user_id, challenge_id) values ($1, 'invitar')", [jugador]), /permission denied/);
});
await test("retos: 'conectar' y 'mensaje' se comprueban con actividad real de hoy", async () => {
  const rival = await nuevoUsuario("Rival");
  const hecho = async (id) => (await como(rival, "select public.daily_challenges_status() s"))[0].s.find((c) => c.id === id).done;
  assert.equal(await hecho("conectar"), false);
  for (const t of [yo3, afin, lejano]) await q("insert into public.person_swipes (from_user, to_user, action) values ($1, $2, 'like') on conflict do nothing", [rival, t]);
  assert.equal(await hecho("conectar"), true);
  assert.equal(await hecho("publicar"), false);
  await como(rival, "insert into public.posts (author_id, kind, body) values ($1, 'historia', 'Hola comunidad')", [rival]);
  assert.equal(await hecho("publicar"), true);
});
await test("community_stats: pública, con cifras reales (sin contar perfiles demo)", async () => {
  const s = (await como(null, "select public.community_stats() s"))[0].s;
  assert.deepEqual(Object.keys(s).sort(), ["invites_ok", "matches_7d", "members", "new_7d"]);
  const reales = (await q("select count(*)::int n from public.profiles where onboarding_completed and not is_demo"))[0].n;
  assert.equal(s.members, reales);
  assert.equal(s.invites_ok, 3);
  const o = (await como(yo3, "select public.opportunity_snapshot() s"))[0].s;
  assert.deepEqual(Object.keys(o).sort(), ["likes_pending", "new_people_7d"]);
});
await test("MIGRACIÓN: update_003 sobre una base con 002 (dos veces) rellena códigos, conserva datos y no toca los perfiles previos", async () => {
  const completo = fs.readFileSync(esquema, "utf8").replace(/\r\n/g, "\n");
  const ini = completo.indexOf("-- ACTUALIZACION-003-INICIO");
  const fin = completo.indexOf("-- ACTUALIZACION-003-FIN");
  assert.ok(ini > 0 && fin > ini, "faltan los marcadores de la actualización 003 en schema.sql");
  const actualizacion = fs.readFileSync(path.join(aqui, "..", "update_003_conexion_viral.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(completo.slice(completo.indexOf("\n", ini) + 1, fin).trim(), actualizacion.trim(), "schema.sql y update_003 difieren");
  await server.createDatabase("migracion3");
  const m = new pg.Client({ ...conn, database: "migracion3" });
  await m.connect();
  m.on("notice", () => {});
  try {
    await m.query(fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8").replace(/^create role .*$/gm, ""));
    await m.query(completo.slice(0, ini));
    await m.query("insert into auth.users (id, email) values (gen_random_uuid(), 'previo1@test.dev'), (gen_random_uuid(), 'previo2@test.dev')");
    await m.query("update public.profiles set onboarding_completed = true where id = (select id from auth.users where email = 'previo1@test.dev')");
    await m.query(actualizacion);
    await m.query(actualizacion);
    await m.query("insert into auth.users (id, email) values (gen_random_uuid(), 'posterior@test.dev')");
    const filas = (await m.query("select referral_code, onboarding_completed from public.profiles p join auth.users u on u.id = p.id order by u.email")).rows;
    assert.equal(filas.length, 3);
    assert.equal(new Set(filas.map((f) => f.referral_code)).size, 3, "códigos únicos");
    assert.ok(filas.every((f) => /^[0-9a-f]{10}$/.test(f.referral_code)));
    assert.deepEqual(filas.map((f) => f.onboarding_completed), [ "posterior", "previo1", "previo2" ].map((n) => n === "previo1"));
    const fns = (await m.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('recommend_people','apply_referral','referral_stats','claim_daily_challenge','daily_challenges_status','community_stats','opportunity_snapshot','referral_leaderboard')")).rows[0].n;
    assert.equal(fns, 8);
  } finally {
    await m.end();
  }
});

await test("MIGRACIÓN: update_004 sobre una base con 003 (dos veces) conserva perfiles y datos privados, y el motor sigue respondiendo", async () => {
  const completo = fs.readFileSync(esquema, "utf8").replace(/\r\n/g, "\n");
  const ini = completo.indexOf("-- ACTUALIZACION-004-INICIO");
  const fin = completo.indexOf("-- ACTUALIZACION-004-FIN");
  assert.ok(ini > 0 && fin > ini, "faltan los marcadores de la actualización 004 en schema.sql");
  const actualizacion = fs.readFileSync(path.join(aqui, "..", "update_004_pareja_ideal.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(completo.slice(completo.indexOf("\n", ini) + 1, fin).trim(), actualizacion.trim(), "schema.sql y update_004 difieren");
  await server.createDatabase("migracion4");
  const m = new pg.Client({ ...conn, database: "migracion4" });
  await m.connect();
  m.on("notice", () => {});
  try {
    await m.query(fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8").replace(/^create role .*$/gm, ""));
    await m.query(completo.slice(0, ini)); // esquema base + 002 + 003
    await m.query("insert into auth.users (id, email) values (gen_random_uuid(), 'a@test.dev'), (gen_random_uuid(), 'b@test.dev')");
    await m.query("update public.profiles set onboarding_completed = true, age = 30, bio = 'Bio previa', interests = '{amigos}' where true");
    await m.query("update public.user_private set ideal_partner = 'Alguien alegre y sincero con ganas de crecer' where true");
    await m.query(actualizacion);
    await m.query(actualizacion); // idempotente
    const p = (await m.query("select core_values, bio from public.profiles order by id limit 1")).rows[0];
    assert.deepEqual(p.core_values, [], "los perfiles previos quedan con valores vacíos");
    assert.equal(p.bio, "Bio previa");
    const u = (await m.query("select ideal_values, ideal_lifestyle, ideal_partner from public.user_private limit 1")).rows[0];
    assert.deepEqual([u.ideal_values, u.ideal_lifestyle], [[], []]);
    assert.match(u.ideal_partner, /alegre/, "el texto de la pareja ideal se conserva");
    const [a] = (await m.query("select id from public.profiles order by id limit 1")).rows;
    await m.query("begin");
    await m.query("set local role authenticated");
    await m.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: a.id, role: "authenticated" })]);
    const rec = (await m.query("select * from public.recommend_people()")).rows;
    await m.query("rollback");
    assert.equal(rec.length, 1);
    assert.deepEqual([rec[0].pct_values, rec[0].pct_lifestyle, rec[0].pct_relation], [null, null, null]);
    const fns = (await m.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('recommend_people','_tags','_cobertura','_afinidad')")).rows[0].n;
    assert.equal(fns, 4, "una sola recommend_people (la antigua se elimina) más las tres piezas del cálculo");
  } finally {
    await m.end();
  }
});

// ── 7d. Comunidad viva (update_005): reacciones, avisos, miembros recientes y Top Conectores ──
console.log("\nComunidad viva: reacciones, avisos, miembros recientes y Top Conectores");
const { puntosDeActividad } = await import("@/lib/comunidad");
/** Persona real con el perfil completo, en «Cuenca · Centro». */
const miembroReal = async (nombre) => {
  const id = await nuevoUsuario(nombre);
  await q("update public.profiles set onboarding_completed = true, location = 'Cuenca · Centro' where id = $1", [id]);
  return id;
};
const publicarPosts = async (autor, n = 1, cuerpo = "Publicación de prueba") =>
  (await q("insert into public.posts (author_id, kind, body) select $1, 'historia', $2 || ' ' || g from generate_series(1, $3::int) g returning id", [autor, cuerpo, n])).map((r) => r.id);

const autora = await miembroReal("Autora");
const lectora = await miembroReal("Lectora");
const [postA] = await publicarPosts(autora);
await test("reacciones: por defecto «like»; solo su dueña o dueño la cambia; solo valores válidos y sin duplicar", async () => {
  await como(lectora, "insert into public.post_likes (post_id, user_id) values ($1, $2)", [postA, lectora]);
  const reaccion = async () => (await q("select reaction from public.post_likes where post_id = $1 and user_id = $2", [postA, lectora]))[0].reaction;
  assert.equal(await reaccion(), "like");
  await como(lectora, "update public.post_likes set reaction = 'love' where post_id = $1 and user_id = $2", [postA, lectora]);
  assert.equal(await reaccion(), "love");
  assert.equal((await como(autora, "update public.post_likes set reaction = 'haha' where post_id = $1 and user_id = $2 returning user_id", [postA, lectora])).length, 0, "nadie más puede cambiarla");
  assert.equal(await reaccion(), "love");
  await falla(como(lectora, "update public.post_likes set reaction = 'ira' where post_id = $1 and user_id = $2", [postA, lectora]), /reaction|check/);
  await falla(como(lectora, "update public.post_likes set user_id = $2 where post_id = $1 and user_id = $2", [postA, autora]), /permission denied/);
  await falla(como(lectora, "insert into public.post_likes (post_id, user_id, reaction) values ($1, $2, 'wow')", [postA, lectora]), /duplicate|unique/);
  await falla(como(lectora, "insert into public.post_likes (post_id, user_id, reaction) values ($1, $2, 'wow')", [postA, autora]), /row-level security/);
  await como(lectora, "delete from public.post_likes where post_id = $1 and user_id = $2", [postA, lectora]);
  await como(lectora, "insert into public.post_likes (post_id, user_id, reaction) values ($1, $2, 'clap')", [postA, lectora]);
  assert.equal(await reaccion(), "clap");
});

const comentarista = await miembroReal("Comentarista");
const [postB] = await publicarPosts(autora, 1, "Otra publicación");
const avisosDe = (uid, post) => q("select type, title, body, href, data, read_at from public.notifications where user_id = $1 and data ->> 'post' = $2 order by created_at", [uid, post]);
await test("avisos: comentar o reaccionar avisa al autor una sola vez; las acciones sobre lo propio no avisan", async () => {
  await como(comentarista, "insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'Me encantó tu historia, gracias por compartirla')", [postB, comentarista]);
  let a = await avisosDe(autora, postB);
  assert.equal(a.length, 1);
  assert.equal(a[0].type, "sistema");
  assert.match(a[0].title, /💬 Comentarista comentó tu publicación/);
  assert.equal(a[0].body, "Me encantó tu historia, gracias por compartirla");
  assert.equal(a[0].href, "/comunidad");
  assert.equal(a[0].read_at, null);
  await como(comentarista, "insert into public.post_likes (post_id, user_id, reaction) values ($1, $2, 'love')", [postB, comentarista]);
  a = await avisosDe(autora, postB);
  assert.equal(a.length, 2);
  assert.match(a[1].title, /❤️ Comentarista reaccionó a tu publicación/);
  // Cambiar o quitar y volver a poner la reacción no duplica el aviso.
  await como(comentarista, "update public.post_likes set reaction = 'wow' where post_id = $1 and user_id = $2", [postB, comentarista]);
  await como(comentarista, "delete from public.post_likes where post_id = $1 and user_id = $2", [postB, comentarista]);
  await como(comentarista, "insert into public.post_likes (post_id, user_id) values ($1, $2)", [postB, comentarista]);
  assert.equal((await avisosDe(autora, postB)).length, 2);
  // Lo propio no avisa; y el aviso llega solo al autor.
  await como(autora, "insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'Gracias')", [postB, autora]);
  await como(autora, "insert into public.post_likes (post_id, user_id) values ($1, $2)", [postB, autora]);
  assert.equal((await avisosDe(autora, postB)).length, 2);
  assert.equal((await avisosDe(comentarista, postB)).length, 0);
});

const recienLlegada = await miembroReal("Sofía Recién Llegada");
const demoNueva = await miembroReal("Demo Reciente");
const sinTerminar = await nuevoUsuario("SinTerminar");
await q("update public.profiles set is_demo = true where id = $1", [demoNueva]);
await q("update public.profiles set created_at = now() + interval '2 hours' where id = $1", [recienLlegada]);
await q("update public.profiles set created_at = now() + interval '3 hours' where id = any($1)", [[demoNueva, sinTerminar]]);
await test("recent_members: solo personas reales con perfil completo, lo mínimo (nombre de pila y ciudad), más recientes primero, público", async () => {
  const r = await como(null, "select * from public.recent_members(30)");
  assert.deepEqual(Object.keys(r[0]).sort(), ["avatar_url", "city", "first_name", "joined_at", "member_id"]);
  assert.equal(r[0].member_id, recienLlegada, "la más reciente va primero");
  assert.equal(r[0].first_name, "Sofía", "solo el nombre de pila");
  assert.equal(r[0].city, "Cuenca", "solo la ciudad, no el barrio");
  const ids = r.map((x) => x.member_id);
  assert.ok(!ids.includes(demoNueva) && !ids.includes(sinTerminar), "ni perfiles demo ni perfiles sin terminar");
  assert.ok(r.every((x, i) => i === 0 || new Date(r[i - 1].joined_at) >= new Date(x.joined_at)), "orden descendente");
  assert.equal((await como(null, "select * from public.recent_members(1)")).length, 1);
  assert.ok((await como(null, "select * from public.recent_members(9999)")).length <= 30, "tope de 30");
});

// Actividad conocida de «Estrella»: 12 publicaciones (tope 30), 24 reacciones, 3 comentarios recibidos, 2 hechos y 1 match.
const estrella = await miembroReal("Estrella");
const fans = [await miembroReal("Fan1"), await miembroReal("Fan2"), await miembroReal("Fan3"), await miembroReal("Fan4")];
const postsEstrella = await publicarPosts(estrella, 12, "Post de Estrella");
for (const p of postsEstrella.slice(0, 6)) for (const f of fans) await q("insert into public.post_likes (post_id, user_id) values ($1, $2)", [p, f]);
for (const p of postsEstrella.slice(0, 3)) await q("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'Muy bueno')", [p, fans[0]]);
const [postFan] = await publicarPosts(fans[0], 1, "Post de Fan1");
for (let i = 0; i < 2; i++) await q("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'Gracias por compartir')", [postFan, estrella]);
await q("insert into public.post_likes (post_id, user_id) values ($1, $2)", [postsEstrella[6], estrella]);            // sobre lo propio: no cuenta
await q("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'Comento lo mío')", [postsEstrella[6], estrella]); // ídem
await q("insert into public.matches (user_a, user_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))", [estrella, fans[0]]);
const puntosSql = async (uid) => (await q("select score from public._connector_scores() where user_id = $1", [uid]))[0]?.score ?? 0;
await test("PARIDAD: los puntos de actividad en SQL == puntosDeActividad() en TypeScript (con topes y sin contar lo propio)", async () => {
  const esperado = puntosDeActividad({ publicaciones: 12, reaccionesRecibidas: 24, comentariosRecibidos: 3, comentariosHechos: 2, invitados: 0, matches: 1 });
  assert.equal(esperado, 30 + 24 + 6 + 2 + 0 + 2);
  assert.equal(await puntosSql(estrella), esperado);
  // Fan1: 1 publicación (3) + 3 comentarios hechos (3) + 2 recibidos (4) + 1 match (2)
  assert.equal(await puntosSql(fans[0]), puntosDeActividad({ publicaciones: 1, reaccionesRecibidas: 0, comentariosRecibidos: 2, comentariosHechos: 3, invitados: 0, matches: 1 }));
  // Topes: 40 publicaciones siguen sumando 30.
  const insistente = await miembroReal("Insistente");
  await publicarPosts(insistente, 40);
  assert.equal(await puntosSql(insistente), 30);
  assert.equal(puntosDeActividad({ publicaciones: 40, reaccionesRecibidas: 500, comentariosRecibidos: 500, comentariosHechos: 500, invitados: 500, matches: 500 }), 30 + 50 + 40 + 20 + 100 + 20);
});
await test("la actividad de hace más de 30 días no cuenta", async () => {
  const antigua = await miembroReal("Antigua");
  await publicarPosts(antigua, 5);
  assert.equal(await puntosSql(antigua), 15);
  await q("update public.posts set created_at = now() - interval '31 days' where author_id = $1", [antigua]);
  assert.equal(await puntosSql(antigua), 0);
});

const medio = await miembroReal("Medio");
const pobre = await miembroReal("Pobre");
const famosoDemo = await miembroReal("FamosoDemo");
const famosoSinTerminar = await nuevoUsuario("FamosoSinTerminar");
await publicarPosts(medio, 3);
await q("insert into public.post_likes (post_id, user_id) select id, $2 from public.posts where author_id = $1 limit 1", [medio, lectora]); // 9 + 1 = 10
await publicarPosts(pobre, 3); // 9: no llega
await q("update public.profiles set is_demo = true where id = $1", [famosoDemo]);
await publicarPosts(famosoDemo, 12);
await publicarPosts(famosoSinTerminar, 12);
await test("top_connectors: solo con ≥ 10 puntos, sin perfiles demo ni sin terminar, ordenado, con puesto y público", async () => {
  const r = await como(null, "select * from public.top_connectors(25)");
  assert.deepEqual(Object.keys(r[0]).sort(), ["avatar_url", "city", "display_name", "person_id", "rank", "score"]);
  const por = (id) => r.find((x) => x.person_id === id);
  assert.equal(por(estrella).score, 64);
  assert.equal(por(estrella).rank, 1);
  assert.equal(por(medio)?.score, 10, "10 puntos justos entran");
  assert.equal(por(pobre), undefined, "9 puntos no");
  assert.equal(por(famosoDemo), undefined, "los perfiles demo no participan");
  assert.equal(por(famosoSinTerminar), undefined);
  assert.ok(r.every((x) => x.score >= 10) && r.every((x, i) => i === 0 || r[i - 1].score >= x.score), "ordenado de mayor a menor");
  assert.equal(por(estrella).city, "Cuenca");
  assert.equal((await como(null, "select * from public.top_connectors(2)")).length, 2);
});
await test("my_connector_status: tu puntaje, puesto y lo que falta; exige sesión", async () => {
  const e = (await como(estrella, "select public.my_connector_status() s"))[0].s;
  assert.deepEqual([e.score, e.rank, e.is_top], [64, 1, true]);
  const p = (await como(pobre, "select public.my_connector_status() s"))[0].s;
  assert.deepEqual([p.score, p.is_top, p.threshold], [9, false, 10], "con menos de 10 personas en el ranking bastan 10 puntos");
  const nada = (await como(sinTerminar, "select public.my_connector_status() s"))[0].s;
  assert.deepEqual([nada.score, nada.rank, nada.is_top], [0, null, false]);
  await falla(como(null, "select public.my_connector_status()"), /permission denied|No autenticado/);
  await falla(como(estrella, "select * from public._connector_scores()"), /permission denied/);
});
await test("con el ranking lleno el umbral pasa a ser el puntaje del décimo puesto", async () => {
  const lleno = [];
  for (let i = 0; i < 10; i++) {
    const u = await miembroReal(`Cima${i}`);
    await publicarPosts(u, 10); // 30 puntos cada una
    lleno.push(u);
  }
  const p = (await como(pobre, "select public.my_connector_status() s"))[0].s;
  assert.deepEqual([p.is_top, p.threshold], [false, 30]);
  const top = await como(null, "select * from public.top_connectors(10)");
  assert.equal(top.length, 10);
  assert.ok(top.every((x) => x.score >= 30), "solo entran los 10 mejores");
  await q("delete from auth.users where id = any($1)", [lleno]);
});

await test("MIGRACIÓN: update_005 sobre una base con 004 (dos veces) conserva los «me gusta» como reacción «like» y activa avisos y ranking", async () => {
  const completo = fs.readFileSync(esquema, "utf8").replace(/\r\n/g, "\n");
  const ini = completo.indexOf("-- ACTUALIZACION-005-INICIO");
  const fin = completo.indexOf("-- ACTUALIZACION-005-FIN");
  assert.ok(ini > 0 && fin > ini, "faltan los marcadores de la actualización 005 en schema.sql");
  const actualizacion = fs.readFileSync(path.join(aqui, "..", "update_005_comunidad_viva.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(completo.slice(completo.indexOf("\n", ini) + 1, fin).trim(), actualizacion.trim(), "schema.sql y update_005 difieren");
  await server.createDatabase("migracion5");
  const m = new pg.Client({ ...conn, database: "migracion5" });
  await m.connect();
  m.on("notice", () => {});
  try {
    await m.query(fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8").replace(/^create role .*$/gm, ""));
    await m.query(completo.slice(0, ini)); // esquema base + 002 + 003 + 004
    await m.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'autor@test.dev', '{\"full_name\":\"Autor Previo\"}'), (gen_random_uuid(), 'fan@test.dev', '{\"full_name\":\"Fan Previo\"}')");
    const [autor, fan] = (await m.query("select id from auth.users order by email")).rows.map((r) => r.id);
    const post = (await m.query("insert into public.posts (author_id, kind, body) values ($1, 'historia', 'Previa') returning id", [autor])).rows[0].id;
    await m.query("insert into public.post_likes (post_id, user_id) values ($1, $2)", [post, fan]); // antes de existir la columna reaction
    await m.query(actualizacion);
    await m.query(actualizacion); // idempotente
    assert.equal((await m.query("select reaction from public.post_likes where post_id = $1", [post])).rows[0].reaction, "like");
    const fns = (await m.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('recent_members','top_connectors','my_connector_status','_connector_scores','_notify_post_comment','_notify_post_reaction')")).rows[0].n;
    assert.equal(fns, 6);
    assert.equal((await m.query("select count(*)::int n from pg_trigger where tgname in ('trg_notify_post_comment','trg_notify_post_reaction') and not tgisinternal")).rows[0].n, 2, "una sola vez cada disparador");
    await m.query("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'Después de migrar')", [post, fan]);
    const avisos = (await m.query("select title from public.notifications where user_id = $1", [autor])).rows;
    assert.equal(avisos.length, 1, "un solo aviso aunque la migración se ejecutó dos veces");
    assert.match(avisos[0].title, /Fan comentó tu publicación/);
  } finally {
    await m.end();
  }
});

// ── 7c. API de fotos (manejadores reales + Postgres real + almacenamiento local) ─
console.log("\nAPI de fotos: manejadores de /api/photos");
const { crearManejadores } = await import("@/lib/media/manejadores");
const { almacenamientoLocal, leerLocal } = await import("@/lib/media/almacenamiento");
const sharp = (await import("sharp")).default;
const dirMedia = fs.mkdtempSync(path.join(os.tmpdir(), "media-api-"));
const lienzo = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 120, b: 200 } } });

/** Dependencias reales: cada llamada a la base de datos se ejecuta como ese usuario (RLS incluida). */
const depsDe = (uid, extra = {}) => ({
  usuario: async () => (uid ? { id: uid } : null),
  rpc: async (nombre, args) => {
    const claves = Object.keys(args);
    const sql = `select * from public.${nombre}(${claves.map((k, i) => `${k} => $${i + 1}${Array.isArray(args[k]) ? "::uuid[]" : ""}`).join(", ")})`;
    try {
      const filas = await como(uid, sql, Object.values(args));
      return { data: nombre === "delete_profile_photo" ? filas : (filas[0]?.[nombre] ?? null), error: null };
    } catch (e) {
      return { data: null, error: { message: e.message, code: e.code } };
    }
  },
  almacenamiento: almacenamientoLocal(dirMedia),
  primeraMiniatura: async (u) => (await q("select thumb_path from public.profile_photos where user_id = $1 and sort_order = 0", [u]))[0]?.thumb_path ?? null,
  actualizarAvatar: async (u, url) => void (await q("update public.profiles set avatar_url = $2 where id = $1", [u, url])),
  urlMedia: (r) => `https://media.test/${r}`,
  nuevoId: randomUUID,
  ...extra,
});
const peticion = (buffer, nombre = "foto.jpg", tipo = "image/jpeg") => {
  const f = new FormData();
  f.set("file", new File([buffer], nombre, { type: tipo }));
  return new Request("http://localhost/api/photos", { method: "POST", body: f });
};
const archivosDe = (uid) => {
  const d = path.join(dirMedia, uid, "fotos");
  return fs.existsSync(d) ? fs.readdirSync(d).sort() : [];
};
const hugo = await nuevoUsuario("Hugo");
const api = crearManejadores(depsDe(hugo));

await test("subir: valida, procesa, guarda original + miniatura, registra la fila y fija el avatar", async () => {
  const r = await api.subir(peticion(await lienzo(2400, 3200).jpeg().toBuffer()));
  assert.equal(r.status, 201);
  const { foto } = await r.json();
  assert.match(foto.url, new RegExp(`^https://media.test/${hugo}/fotos/.+\\.webp$`));
  assert.match(foto.thumbUrl, /_thumb\.webp$/);
  assert.deepEqual([foto.ancho, foto.alto], [1500, 2000]);
  assert.equal(archivosDe(hugo).length, 2);
  const [fila] = await q("select sort_order, mime, width, height, bytes from public.profile_photos where id = $1", [foto.id]);
  assert.deepEqual([fila.sort_order, fila.mime, fila.width, fila.height], [0, "image/webp", 1500, 2000]);
  const meta = await sharp(await leerLocal(dirMedia, `${hugo}/fotos/${foto.url.split("/").pop()}`)).metadata();
  assert.equal(meta.format, "webp");
  assert.equal((await q("select avatar_url from public.profiles where id = $1", [hugo]))[0].avatar_url, foto.thumbUrl);
});
await test("subir: rechazos con el código HTTP y mensaje correctos (y sin dejar archivos)", async () => {
  const antes = archivosDe(hugo).length;
  const casos = [
    [Buffer.from("GIF89a\x01\x00\x01\x00", "latin1"), 415, "formato_no_permitido"],
    [Buffer.from("<svg onload=alert(1)/>"), 415, "formato_no_permitido"],
    [await lienzo(100, 100).jpeg().toBuffer(), 422, "muy_pequena"],
    [(await lienzo(1200, 1200).jpeg().toBuffer()).subarray(0, 900), 422, "corrupta"],
    [Buffer.alloc(5 * 1024 * 1024 + 10, 1), 413, "demasiado_grande"],
    [Buffer.alloc(0), 400, "vacio"],
  ];
  for (const [buf, status, codigo] of casos) {
    const r = await api.subir(peticion(buf));
    assert.equal(r.status, status, codigo);
    assert.equal((await r.json()).codigo, codigo);
  }
  assert.equal(archivosDe(hugo).length, antes);
  assert.equal((await q("select count(*)::int n from public.profile_photos where user_id = $1", [hugo]))[0].n, 1);
});
await test("subir: petición sin archivo, sin multipart o sin sesión", async () => {
  assert.equal((await api.subir(new Request("http://x/api/photos", { method: "POST", body: new FormData() }))).status, 400);
  assert.equal((await api.subir(new Request("http://x/api/photos", { method: "POST", body: "no soy multipart", headers: { "content-type": "text/plain" } }))).status, 400);
  const f = new FormData();
  f.set("file", "un texto, no un archivo");
  assert.equal((await api.subir(new Request("http://x/api/photos", { method: "POST", body: f }))).status, 400);
  assert.equal((await crearManejadores(depsDe(null)).subir(peticion(await lienzo(500, 500).jpeg().toBuffer()))).status, 401);
});
let fotosHugo = [];
await test("hasta 10 fotos; la 11.ª devuelve 409 y NO deja archivos huérfanos", async () => {
  const jpeg = await lienzo(800, 1000).jpeg().toBuffer();
  for (let i = 0; i < 9; i++) assert.equal((await api.subir(peticion(jpeg))).status, 201);
  assert.equal(archivosDe(hugo).length, 20);
  const r = await api.subir(peticion(jpeg));
  assert.equal(r.status, 409);
  assert.equal((await r.json()).codigo, "max_fotos");
  assert.equal(archivosDe(hugo).length, 20, "quedaron archivos sin fila en la base de datos");
  fotosHugo = (await q("select id from public.profile_photos where user_id = $1 order by sort_order", [hugo])).map((f) => f.id);
  assert.equal(fotosHugo.length, 10);
});
await test("si falla el registro en la base de datos se limpian los archivos subidos", async () => {
  const solo = await nuevoUsuario("SinRegistro");
  const roto = crearManejadores(depsDe(solo, { rpc: async () => ({ data: null, error: { message: "boom" } }) }));
  const r = await roto.subir(peticion(await lienzo(600, 600).jpeg().toBuffer()));
  assert.equal(r.status, 500);
  assert.deepEqual(archivosDe(solo), []);
});
await test("si falla el almacenamiento no se registra ninguna foto", async () => {
  const solo = await nuevoUsuario("SinDisco");
  const guardadas = [];
  const casiRoto = crearManejadores(depsDe(solo, {
    almacenamiento: { guardar: async (r) => { guardadas.push(r); if (guardadas.length === 2) throw new Error("disco lleno"); }, borrar: async (r) => void guardadas.push(...r.map((x) => "borrado:" + x)) },
  }));
  const r = await casiRoto.subir(peticion(await lienzo(600, 600).jpeg().toBuffer()));
  assert.equal(r.status, 502);
  assert.equal((await q("select count(*)::int n from public.profile_photos where user_id = $1", [solo]))[0].n, 0);
  assert.ok(guardadas.some((x) => x.startsWith("borrado:")), "no intentó limpiar");
});
await test("reordenar: cambia el orden y la foto principal (avatar); valida el cuerpo", async () => {
  const invertido = [...fotosHugo].reverse();
  const r = await api.reordenar(new Request("http://x/api/photos", { method: "PATCH", body: JSON.stringify({ ids: invertido }) }));
  assert.equal(r.status, 200);
  assert.deepEqual((await fotosDe(hugo)).map((f) => f.id), invertido);
  const [{ thumb_path }] = await q("select thumb_path from public.profile_photos where id = $1", [invertido[0]]);
  assert.equal((await q("select avatar_url from public.profiles where id = $1", [hugo]))[0].avatar_url, `https://media.test/${thumb_path}`);
  for (const cuerpo of [{}, { ids: "x" }, { ids: ["no-uuid"] }, { ids: [...invertido, randomUUID()] }, { ids: invertido.slice(1) }]) {
    const mala = await api.reordenar(new Request("http://x/api/photos", { method: "PATCH", body: JSON.stringify(cuerpo) }));
    assert.equal(mala.status, 400, JSON.stringify(cuerpo).slice(0, 40));
  }
  assert.equal((await api.reordenar(new Request("http://x/api/photos", { method: "PATCH", body: "{no json" }))).status, 400);
  fotosHugo = invertido;
});
await test("borrar: elimina fila y archivos, compacta el orden y actualiza el avatar; ajenas → 404", async () => {
  const otro = await nuevoUsuario("Intruso");
  const apiOtro = crearManejadores(depsDe(otro));
  assert.equal((await apiOtro.borrar(fotosHugo[0])).status, 404);
  assert.equal(archivosDe(hugo).length, 20);
  const antesPrincipal = fotosHugo[0];
  const [{ storage_path }] = await q("select storage_path from public.profile_photos where id = $1", [antesPrincipal]);
  assert.equal((await api.borrar(antesPrincipal)).status, 200);
  assert.equal(fs.existsSync(path.join(dirMedia, storage_path)), false);
  assert.equal(archivosDe(hugo).length, 18);
  assert.deepEqual((await fotosDe(hugo)).map((f) => f.sort_order), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const [nueva] = await q("select thumb_path from public.profile_photos where user_id = $1 and sort_order = 0", [hugo]);
  assert.equal((await q("select avatar_url from public.profiles where id = $1", [hugo]))[0].avatar_url, `https://media.test/${nueva.thumb_path}`);
  assert.equal((await api.borrar("no-es-uuid")).status, 400);
  assert.equal((await api.borrar(randomUUID())).status, 404);
  assert.equal((await crearManejadores(depsDe(null)).borrar(fotosHugo[1])).status, 401);
});
await test("borrar la última foto deja el avatar en null", async () => {
  const solo = await nuevoUsuario("UnaFoto");
  const a = crearManejadores(depsDe(solo));
  const { foto } = await (await a.subir(peticion(await lienzo(700, 700).png().toBuffer(), "x.png", "image/png"))).json();
  assert.ok((await q("select avatar_url from public.profiles where id = $1", [solo]))[0].avatar_url);
  await a.borrar(foto.id);
  assert.equal((await q("select avatar_url from public.profiles where id = $1", [solo]))[0].avatar_url, null);
  assert.deepEqual(archivosDe(solo), []);
});
await test("rendimiento: 10 fotos de 12 MP subidas por un usuario en menos de 8 s", async () => {
  const nuevo = await nuevoUsuario("Rapido");
  const a = crearManejadores(depsDe(nuevo));
  const foto = await lienzo(4000, 3000).jpeg({ quality: 88 }).toBuffer();
  const t0 = Date.now();
  for (let i = 0; i < 10; i++) assert.equal((await a.subir(peticion(foto))).status, 201);
  const ms = Date.now() - t0;
  console.log(`      (${ms} ms para 10 fotos)`);
  assert.ok(ms < 8000, `${ms} ms`);
});
fs.rmSync(dirMedia, { recursive: true, force: true });

// ── 8. Coherencia cliente ↔ esquema ─────────────────────────────────────────
console.log("\nCoherencia entre el código de la app (src/) y el esquema");
const srcDir = path.join(aqui, "..", "..", "src");
const recorrer = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? recorrer(path.join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []));
const fuentes = recorrer(srcDir).map((f) => ({ f: path.relative(srcDir, f), t: fs.readFileSync(f, "utf8") }));

await test("PostgREST: un upsert en listing_swipes (ON CONFLICT DO UPDATE de todas las columnas) funciona con los privilegios por columna", async () => {
  const l = (await q("select id from public.listings limit 1"))[0].id;
  const sql = `insert into public.listing_swipes (user_id, listing_id, action) values ($1, $2, $3)
               on conflict (user_id, listing_id) do update set user_id = excluded.user_id, listing_id = excluded.listing_id, action = excluded.action`;
  await como(ana, sql, [ana, l, "pass"]);
  await como(ana, sql, [ana, l, "save"]);
  assert.equal((await como(ana, "select action from public.listing_swipes where listing_id = $1", [l]))[0].action, "save");
  await falla(como(ana, sql, [beto, l, "save"]), /row-level security/); // no se puede escribir a nombre de otro
});
await test("todas las tablas usadas con .from('…') existen", async () => {
  const existentes = new Set((await q("select table_name from information_schema.tables where table_schema = 'public'")).map((r) => r.table_name));
  const usadas = new Set(fuentes.flatMap(({ t }) => [...t.matchAll(/\.from\(\s*"(\w+)"\s*\)/g)].map((m) => m[1])));
  assert.ok(usadas.size >= 15, `solo se detectaron ${usadas.size} tablas`);
  for (const t of usadas) assert.ok(existentes.has(t), `la tabla ${t} no existe`);
});
await test("todas las RPC llamadas existen y sus parámetros coinciden", async () => {
  const funciones = await q("select proname, proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'");
  const por = new Map(funciones.map((f) => [f.proname, f.proargnames ?? []]));
  const llamadas = fuentes.flatMap(({ f, t }) => [
    ...[...t.matchAll(/\.rpc\(\s*"(\w+)"(?:\s*,\s*\{([^}]*)\})?/g)].map((m) => ({ f, nombre: m[1], args: m[2] })),
    ...[...t.matchAll(/\bcanjear\(\s*"(\w+)"(?:\s*,\s*\{([^}]*)\})?/g)].map((m) => ({ f, nombre: m[1], args: m[2] })),
  ]);
  assert.ok(llamadas.length >= 25, `solo se detectaron ${llamadas.length} llamadas RPC`);
  for (const { f, nombre, args } of llamadas) {
    assert.ok(por.has(nombre), `${f}: la función ${nombre}() no existe`);
    const claves = [...(args ?? "").matchAll(/\b(p_\w+)\s*:/g)].map((m) => m[1]);
    for (const c of claves) assert.ok(por.get(nombre).includes(c), `${f}: ${nombre}() no tiene el parámetro ${c} (tiene: ${por.get(nombre).join(", ")})`);
  }
});
await test("las columnas usadas en select/eq/in/order existen en su tabla", async () => {
  const cols = {};
  for (const r of await q("select table_name, column_name from information_schema.columns where table_schema = 'public'")) (cols[r.table_name] ??= new Set()).add(r.column_name);
  let comprobadas = 0;
  for (const { f, t } of fuentes) {
    for (const m of t.matchAll(/\.from\(\s*"(\w+)"\s*\)([\s\S]*?)(?=;|\n\s*\n|\.from\()/g)) {
      const [, tabla, cadena] = m;
      const nombres = [
        ...[...cadena.matchAll(/\.select\(\s*"([^"*]+)"/g)].flatMap((x) => x[1].split(",").map((s) => s.trim())),
        ...[...cadena.matchAll(/\.(?:eq|in|order)\(\s*"(\w+)"/g)].map((x) => x[1]),
      ];
      for (const c of nombres) {
        assert.ok(cols[tabla]?.has(c), `${f}: ${tabla}.${c} no existe`);
        comprobadas++;
      }
    }
  }
  assert.ok(comprobadas >= 30, `solo se comprobaron ${comprobadas} columnas`);
});
await test("las columnas escritas con insert/update literales están concedidas al rol authenticated", async () => {
  const grants = {};
  for (const r of await q("select table_name, column_name, privilege_type from information_schema.column_privileges where grantee = 'authenticated' and table_schema = 'public'")) (grants[`${r.table_name}:${r.privilege_type}`] ??= new Set()).add(r.column_name);
  const objetivos = [
    ["listings", "INSERT", ["owner_id", "kind", "category", "operation", "subtype", "title", "description", "price", "budget_max", "currency", "zone", "area", "min_area", "attrs", "images", "flash_discount", "flash_until"]],
    ["jobs", "INSERT", ["owner_id", "kind", "title", "description", "category", "price_from", "currency", "delivery_days", "job_type", "modality", "location", "budget_text", "skills", "image_url"]],
    ["posts", "INSERT", ["author_id", "kind", "body", "zone", "image_url"]],
    ["messages", "INSERT", ["chat_id", "sender_id", "kind", "body", "amount", "currency", "days", "status"]],
    ["friendships", "INSERT", ["requester_id", "addressee_id"]],
    ["post_likes", "INSERT", ["post_id", "user_id", "reaction"]],
    ["post_likes", "UPDATE", ["reaction"]],
    ["post_comments", "INSERT", ["post_id", "author_id", "body"]],
    ["profiles", "UPDATE", ["display_name", "handle", "bio", "location", "interests", "zones", "relations", "lifestyle", "budget", "age", "sign", "avatar_url", "professional", "core_values", "university", "school", "height_cm"]],
    ["user_private", "UPDATE", ["birth_date", "ideal_partner", "ideal_values", "ideal_lifestyle"]],
    ["friendships", "UPDATE", ["status"]],
  ];
  for (const [tabla, priv, columnas] of objetivos) for (const c of columnas) assert.ok(grants[`${tabla}:${priv}`]?.has(c), `${tabla}.${c} sin privilegio ${priv}`);
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
await su.end();
await server.stop();
fs.rmSync(dir, { recursive: true, force: true });
process.exit(fallos ? 1 : 0);
