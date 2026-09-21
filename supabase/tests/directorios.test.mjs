/**
 * Pruebas de los directorios colaborativos (supabase/update_006_directorios.sql) contra un PostgreSQL real embebido.
 *
 *   npm i --no-save embedded-postgres pg tsx
 *   npx tsx supabase/tests/directorios.test.mjs
 *
 * Verifica: catálogo (paridad con TypeScript), autoservicio y permisos por columna, contacto solo con sesión, menús y límites,
 * turnos, búsqueda y orden, pedidos con precios calculados por el servidor, máquina de estados (paridad con TypeScript),
 * solicitudes y ofertas (KYC en Movilidad), eventos con aforo atómico bajo concurrencia, reseñas con interacción real,
 * denuncias con ocultación automática, moderación y la migración 006 sobre una base con la 005.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { DENUNCIAS_PARA_OCULTAR, ETIQUETA_ESTADO_PEDIDO, MAX_PERFILES_POR_PERSONA, MONEDAS_PRIMER_PERFIL, VERTICALES, estaAbierto, horarioValido, transicionesPedido } from "@/data/directorio";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const esquema = path.join(aqui, "..", "schema.sql");
const puerto = 55445;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dir-test-"));

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

/** Ejecuta SQL como un usuario autenticado (o anónimo si uid es null), en una transacción propia. */
async function como(uid, sql, params) {
  const c = new pg.Client(conn);
  await c.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(uid ? { sub: uid, role: "authenticated" } : { role: "anon" })]);
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

await su.query(fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8"));
try {
  await su.query(fs.readFileSync(esquema, "utf8"));
  console.log("  schema.sql aplicado");
} catch (e) {
  console.log("  ✗ schema.sql →", e.message, e.position ? `(posición ${e.position})` : "");
  process.exit(1);
}

// ── Utilidades de datos ─────────────────────────────────────────────────────
const persona = async (nombre, { verificada = false, admin = false } = {}) => {
  const id = randomUUID();
  await q("insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3, now())", [id, `${nombre.toLowerCase()}@test.dev`, JSON.stringify({ full_name: nombre })]);
  if (verificada) await q("update public.profiles set identity_verified = true, kyc_status = 'verified' where id = $1", [id]);
  if (admin) await q("insert into public.app_admins (user_id) values ($1)", [id]);
  // Estas pruebas no miden la economía de monedas (eso lo hace monedas.test.mjs): saldo de sobra para no toparse con las tarifas de uso.
  await q("update public.wallets set coins = 100000 where user_id = $1", [id]);
  return id;
};
/** Crea un perfil como esa persona (así se prueban los privilegios por columna). */
const perfil = async (uid, { vertical = "delivery", subtype = "restaurante", name = "Sabor Cuencano", ...extra } = {}) => {
  const cols = { owner_id: uid, vertical, subtype, name, ...extra };
  const claves = Object.keys(cols);
  return (await como(uid, `insert into public.providers (${claves.join(", ")}) values (${claves.map((_, i) => `$${i + 1}`).join(", ")}) returning id, slug`, Object.values(cols)))[0];
};
const articulo = async (prov, nombre, precio, { kind = "menu_item", disponible = true, receta = false } = {}) =>
  (await q("insert into public.provider_items (provider_id, kind, name, price, available, requires_prescription) values ($1, $2, $3, $4, $5, $6) returning id", [prov, kind, nombre, precio, disponible, receta]))[0].id;
const pedir = (uid, prov, lineas, { tipo = "delivery", dir = "Av. Solano 1-23", zona = "Centro", notas = "", pago = "cash", tel = "0991234567" } = {}) =>
  como(uid, "select public.place_order($1, $2, $3::jsonb, $4, $5, $6, $7, $8) id", [prov, tipo, JSON.stringify(lineas), dir, zona, notas, pago, tel]).then((r) => r[0].id);
const avisos = (uid, clave, valor) => q("select title, body, href from public.notifications where user_id = $1 and data ->> $2 = $3 order by created_at", [uid, clave, valor]);

// ── 1. Catálogo ─────────────────────────────────────────────────────────────
console.log("\nCatálogo y utilidades");
await test("PARIDAD: las categorías en SQL == VERTICALES en TypeScript", async () => {
  const sql = (await q("select vertical || '/' || subtype as k from public._directory_catalog()")).map((r) => r.k).sort();
  const ts = VERTICALES.flatMap((v) => v.subtipos.map((s) => `${v.id}/${s.id}`)).sort();
  assert.deepEqual(sql, ts);
  assert.equal(VERTICALES.length, 6);
  const checkSql = (await q("select pg_get_constraintdef(oid) d from pg_constraint where conrelid = 'public.providers'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%vertical%'"))[0].d;
  for (const v of VERTICALES) assert.ok(checkSql.includes(`'${v.id}'`), v.id);
});
await test("_slugify, _km y _valid_hours", async () => {
  // Minúsculas acentuadas: el PostgreSQL de prueba usa --locale=C, donde lower() no convierte «Ñ» (en producción, con UTF-8, sí).
  assert.equal((await q(`select public._slugify('Café "el ñandú" 24h!') s`))[0].s, "cafe-el-nandu-24h");
  assert.equal((await q("select public._slugify('!!!') s"))[0].s, "perfil");
  const km = Number((await q("select public._km(-2.9001, -79.0059, -0.1807, -78.4678) k"))[0].k);
  assert.ok(km > 280 && km < 330, `Cuenca–Quito ${km} km`);
  assert.equal((await q("select public._km(null, 1, 2, 3) k"))[0].k, null);
  const valido = async (h) => (await q("select public._valid_hours($1::jsonb) v", [JSON.stringify(h)]))[0].v;
  const casos = [
    [{}, true], [{ lun: [["08:00", "13:00"], ["15:00", "24:00"]] }, true], [{ dom: [] }, true],
    [{ lun: [["18:00", "09:00"]] }, false], [{ lun: [["08:00", "08:00"]] }, false], [{ xxx: [] }, false], [{ lun: [["8:00", "13:00"]] }, false],
    [{ lun: [["08:00", "25:00"]] }, false], [{ lun: [["24:00", "24:00"]] }, false], [{ lun: "abierto" }, false], [{ lun: [["01:00", "02:00"], ["03:00", "04:00"], ["05:00", "06:00"], ["07:00", "08:00"], ["09:00", "10:00"]] }, false],
  ];
  for (const [h, esperado] of casos) {
    assert.equal(await valido(h), esperado, JSON.stringify(h));
    assert.equal(horarioValido(h), esperado, `TS ${JSON.stringify(h)}`);
  }
});
await test("PARIDAD: _is_open en SQL == estaAbierto() en TypeScript (una semana entera, cada 30 min, hora de Ecuador)", async () => {
  const horario = { lun: [["08:00", "13:00"], ["15:00", "19:00"]], mar: [["00:00", "24:00"]], sab: [["09:00", "24:00"]], dom: [] };
  const inicio = Date.UTC(2026, 5, 1, 0, 0); // lunes 1-jun-2026 00:00 UTC
  const filas = await q("select t, public._is_open($1::jsonb, false, t) o, public._is_open($1::jsonb, true, t) o24 from generate_series($2::timestamptz, $2::timestamptz + interval '8 days', interval '30 minutes') t", [JSON.stringify(horario), new Date(inicio).toISOString()]);
  assert.equal(filas.length, 8 * 48 + 1);
  let abiertos = 0;
  for (const f of filas) {
    assert.equal(f.o, estaAbierto(horario, false, new Date(f.t)), f.t.toISOString());
    assert.equal(f.o24, true);
    assert.equal(estaAbierto(horario, true, new Date(f.t)), true);
    if (f.o) abiertos++;
  }
  assert.ok(abiertos > 50 && abiertos < filas.length, "hay tramos abiertos y cerrados");
  // Casos concretos: lunes 10:00 Ecuador = 15:00 UTC (abierto); 13:00 Ecuador = 18:00 UTC (cierre exclusivo); 15:00 = 20:00 UTC (abierto); lunes 22:00 = martes 03:00 UTC (cerrado).
  const en = (iso) => estaAbierto(horario, false, new Date(iso));
  assert.deepEqual([en("2026-06-01T15:00:00Z"), en("2026-06-01T18:00:00Z"), en("2026-06-01T20:00:00Z"), en("2026-06-02T03:00:00Z")], [true, false, true, false]);
});

// ── 2. Perfiles: autoservicio y permisos ────────────────────────────────────
console.log("\nPerfiles (autoservicio, permisos y contacto)");
const dueno = await persona("Dueno");
const cliente = await persona("Cliente");
const otro = await persona("Otro");
const sabor = await perfil(dueno, { channels: ["local", "entrega", "retiro"], delivery_fee: 1.5, min_order: 5, zone: "Centro", description: "Ceviche y jugos naturales" });
await test("alta: el servidor genera slug, estado y contadores; nadie los fija desde el cliente", async () => {
  assert.match(sabor.slug, /^sabor-cuencano-[0-9a-f]{6}$/);
  const [p] = await q("select status, verified_at, rating, reviews_count, orders_count, city, boosted_until from public.providers where id = $1", [sabor.id]);
  assert.deepEqual([p.status, p.verified_at, Number(p.rating), p.reviews_count, p.orders_count, p.city, p.boosted_until], ["active", null, 0, 0, 0, "Cuenca", null]);
  for (const col of ["verified_at = now()", "rating = 5", "status = 'suspended'", "slug = 'robado'", "orders_count = 99", "boosted_until = now() + interval '9 days'", "owner_id = gen_random_uuid()", "vertical = 'salud'"]) {
    await falla(como(dueno, `update public.providers set ${col} where id = $1`, [sabor.id]), /permission denied/);
  }
  await falla(perfil(cliente, { verified_at: new Date().toISOString() }), /permission denied/);
  await falla(perfil(cliente, { slug: "mio" }), /permission denied/);
});
await test("recompensa de autoservicio: +30 monedas solo por el primer perfil", async () => {
  const monedas = async () => (await q("select coalesce(sum(delta), 0)::int n from public.wallet_ledger where user_id = $1 and reason = 'directory_first_provider'", [dueno]))[0].n;
  assert.equal(await monedas(), MONEDAS_PRIMER_PERFIL);
  await perfil(dueno, { vertical: "hogar", subtype: "plomero", name: "Plomería Express" });
  assert.equal(await monedas(), MONEDAS_PRIMER_PERFIL, "el segundo perfil no vuelve a pagar");
  assert.equal((await q("select coins from public.wallets where user_id = $1", [dueno]))[0].coins, 100000 + MONEDAS_PRIMER_PERFIL);
});
await test("validaciones: categoría de otra sección, canales, horario, nombre y límite de perfiles", async () => {
  await falla(perfil(cliente, { vertical: "salud", subtype: "plomero" }), /no existe en esta secci/);
  await falla(perfil(cliente, { vertical: "inventada", subtype: "x" }), /no existe en esta secci|check|vertical/);
  await falla(perfil(cliente, { channels: ["teletransporte"] }), /channels|check/);
  await falla(perfil(cliente, { channels: [] }), /channels|check/);
  await falla(perfil(cliente, { hours: { lun: [["18:00", "09:00"]] } }), /horario no es válido/);
  await falla(perfil(cliente, { name: "  a " }), /name|check/);
  await falla(perfil(cliente, { delivery_fee: -1 }), /delivery_fee|check/);
  const bien = await perfil(cliente, { name: "Horario Válido", hours: { lun: [["08:00", "13:00"]] }, open_24h: false });
  assert.ok(bien.id);
  const prolifico = await persona("Prolifico");
  for (let i = 0; i < MAX_PERFILES_POR_PERSONA; i++) await perfil(prolifico, { name: `Perfil número ${i + 1}` });
  await falla(perfil(prolifico, { name: "Perfil de más" }), /máximo de 5 perfiles/);
});
await test("visibilidad: solo se ve lo activo; el dueño ve y edita lo suyo; los demás no editan ni borran", async () => {
  assert.equal((await como(null, "select id from public.providers where id = $1", [sabor.id])).length, 1, "público sin sesión");
  assert.equal((await como(otro, "update public.providers set name = 'Hackeado' where id = $1 returning id", [sabor.id])).length, 0);
  assert.equal((await como(otro, "delete from public.providers where id = $1 returning id", [sabor.id])).length, 0);
  await como(dueno, "select public.set_provider_active($1, false)", [sabor.id]);
  assert.equal((await como(otro, "select id from public.providers where id = $1", [sabor.id])).length, 0, "pausado: invisible");
  assert.equal((await como(null, "select id from public.providers where id = $1", [sabor.id])).length, 0);
  assert.equal((await como(dueno, "select id from public.providers where id = $1", [sabor.id])).length, 1, "el dueño lo sigue viendo");
  await falla(como(otro, "select public.set_provider_active($1, true)", [sabor.id]), /No se puede cambiar/);
  await como(dueno, "select public.set_provider_active($1, true)", [sabor.id]);
  assert.equal((await como(dueno, "update public.providers set description = 'Ceviche, encebollado y jugos' where id = $1 returning id", [sabor.id])).length, 1);
});
await test("contacto: solo con sesión, nunca para anónimos; solo el dueño lo escribe; teléfono válido", async () => {
  await como(dueno, "insert into public.provider_contacts (provider_id, phone, whatsapp, address) values ($1, '+593 99 123 4567', '+593991234567', 'Av. Solano 1-23')", [sabor.id]);
  await falla(como(null, "select phone from public.provider_contacts"), /permission denied/);
  assert.equal((await como(otro, "select phone from public.provider_contacts where provider_id = $1", [sabor.id]))[0].phone, "+593 99 123 4567");
  await falla(como(otro, "insert into public.provider_contacts (provider_id, phone) values ($1, '0999999999')", [sabor.id]), /row-level security|duplicate/);
  assert.equal((await como(otro, "update public.provider_contacts set phone = '0000000' where provider_id = $1 returning provider_id", [sabor.id])).length, 0);
  await falla(como(dueno, "update public.provider_contacts set phone = 'llámame' where provider_id = $1", [sabor.id]), /phone|check/);
  await como(dueno, "select public.set_provider_active($1, false)", [sabor.id]);
  assert.equal((await como(otro, "select phone from public.provider_contacts where provider_id = $1", [sabor.id])).length, 0, "un perfil pausado no expone su contacto");
  await como(dueno, "select public.set_provider_active($1, true)", [sabor.id]);
});
await test("vínculos con «Negocios» y «Empleos»: solo con anuncios y servicios propios", async () => {
  const [anuncio] = await q("insert into public.listings (owner_id, kind, category, title, price) values ($1, 'offer', 'business', 'Local comercial', 1000) returning id", [dueno]);
  const [ajeno] = await q("insert into public.listings (owner_id, kind, category, title, price) values ($1, 'offer', 'business', 'Local ajeno', 1000) returning id", [otro]);
  assert.equal((await como(dueno, "update public.providers set listing_id = $2 where id = $1 returning id", [sabor.id, anuncio.id])).length, 1);
  await falla(como(dueno, "update public.providers set listing_id = $2 where id = $1", [sabor.id, ajeno.id]), /propios anuncios/);
  await falla(como(dueno, "update public.providers set job_id = gen_random_uuid() where id = $1", [sabor.id]), /foreign key|propios servicios/);
});
await test("las funciones internas no son invocables por clientes", async () => {
  await falla(como(dueno, "select public._is_open('{}', false)"), /permission denied/);
  await falla(como(dueno, "select * from public._directory_catalog()"), /permission denied/);
  await falla(como(dueno, "select public._interaction_level($1, $2)", [dueno, sabor.id]), /permission denied/);
});

// ── 3. Menú, catálogo y turnos ──────────────────────────────────────────────
console.log("\nMenú, catálogo y turnos");
const ceviche = await articulo(sabor.id, "Ceviche mixto", 6.5);
const jugo = await articulo(sabor.id, "Jugo de naranjilla", 2);
const agotado = await articulo(sabor.id, "Plato agotado", 9, { disponible: false });
const sinPrecio = (await q("insert into public.provider_items (provider_id, kind, name, price) values ($1, 'menu_item', 'Plato del día (a convenir)', null) returning id", [sabor.id]))[0].id;
await test("elementos: solo el dueño gestiona su menú; cada tipo encaja con su sección", async () => {
  const nuevo = (await como(dueno, "insert into public.provider_items (provider_id, kind, section, name, price, unit) values ($1, 'menu_item', 'Bebidas', 'Café pasado', 1.25, 'unidad') returning id", [sabor.id]))[0].id;
  assert.equal((await como(otro, "select id from public.provider_items where id = $1", [nuevo])).length, 1, "el menú es público");
  await falla(como(otro, "insert into public.provider_items (provider_id, kind, name, price) values ($1, 'menu_item', 'Intruso', 1)", [sabor.id]), /row-level security/);
  assert.equal((await como(otro, "update public.provider_items set price = 0 where id = $1 returning id", [nuevo])).length, 0);
  assert.equal((await como(otro, "delete from public.provider_items where id = $1 returning id", [nuevo])).length, 0);
  await falla(como(dueno, "update public.provider_items set provider_id = $2 where id = $1", [nuevo, cliente]), /permission denied/);
  await falla(como(dueno, "insert into public.provider_items (provider_id, kind, name, price) values ($1, 'rate', 'Tarifa', 1)", [sabor.id]), /solo para Movilidad/);
  await falla(como(dueno, "insert into public.provider_items (provider_id, kind, name, price, requires_prescription) values ($1, 'product', 'Pastilla', 1, true)", [sabor.id]), /solo aplica a Salud/);
  await falla(como(dueno, "insert into public.provider_items (provider_id, kind, name, price) values ($1, 'menu_item', 'Gratis negativo', -1)", [sabor.id]), /price|check/);
  await falla(como(dueno, "insert into public.provider_items (provider_id, kind, name, price, price_to) values ($1, 'service', 'Rango al revés', 10, 5)", [sabor.id]), /price_to|check/);
});
await test("límite de 200 elementos por perfil", async () => {
  const lleno = (await perfil(await persona("Catalogo"), { name: "Perfil con catálogo grande" })).id;
  await q("insert into public.provider_items (provider_id, kind, name, price) select $1, 'menu_item', 'Plato ' || g, 1 from generate_series(1, 200) g", [lleno]);
  const dueño = (await q("select owner_id from public.providers where id = $1", [lleno]))[0].owner_id;
  await falla(como(dueño, "insert into public.provider_items (provider_id, kind, name, price) values ($1, 'menu_item', 'Uno más', 1)", [lleno]), /máximo 200/);
});
const farmaciaDueno = await persona("DuenoFarmacia");
const farmaciaV = await perfil(farmaciaDueno, { vertical: "salud", subtype: "farmacia", name: "Farmacia Central", zone: "ZonaFarm", channels: ["local", "entrega"], delivery_fee: 1 });
const [aspirina, antibiotico] = [await articulo(farmaciaV.id, "Paracetamol 500 mg", 1.8, { kind: "product" }), await articulo(farmaciaV.id, "Antibiótico (con receta)", 12, { kind: "product", receta: true })];
await test("turnos: solo Salud y Hogar; duración razonable; el dueño los gestiona", async () => {
  const turno = (uid, prov, desde, hasta) => como(uid, `insert into public.provider_duty_shifts (provider_id, starts_at, ends_at, note) values ($1, ${desde}, ${hasta}, 'Turno de la noche') returning id`, [prov]);
  assert.equal((await turno(farmaciaDueno, farmaciaV.id, "now() - interval '1 hour'", "now() + interval '5 hours'")).length, 1);
  await falla(turno(dueno, sabor.id, "now()", "now() + interval '5 hours'"), /solo aplican a Salud y Hogar/);
  await falla(turno(farmaciaDueno, farmaciaV.id, "now()", "now() + interval '49 hours'"), /ends_at|check/);
  await falla(turno(farmaciaDueno, farmaciaV.id, "now()", "now() - interval '1 hour'"), /ends_at|check/);
  await falla(turno(otro, farmaciaV.id, "now()", "now() + interval '5 hours'"), /row-level security/);
  assert.equal((await como(null, "select id from public.provider_duty_shifts where provider_id = $1", [farmaciaV.id])).length, 1, "los turnos son públicos");
});

// ── 4. Búsqueda ─────────────────────────────────────────────────────────────
console.log("\nBúsqueda del directorio");
const zonaB = "ZonaBusq";
const dB = await persona("DuenosBusq");
const mk = async (name, extra, sql = "") => {
  const p = await perfil(await persona(`Owner${name.replace(/\W/g, "")}`), { name, zone: zonaB, ...extra });
  if (sql) await q(`update public.providers set ${sql} where id = $1`, [p.id]);
  return p.id;
};
const pVerificado = await mk("Resto Verificado", { description: "Comida casera" }, "verified_at = now(), rating = 4.8, reviews_count = 10");
const pMejorNota = await mk("Resto Mejor Nota", { description: "Parrilla argentina" }, "rating = 4.9, reviews_count = 3");
const pImpulsado = await mk("Resto Impulsado", { description: "Pizzas", channels: ["local", "entrega"] }, "boosted_until = now() + interval '1 day', rating = 1");
const pAbierto24 = await mk("Resto Abierto 24h", { description: "Empanadas y café", open_24h: true }, "rating = 3");
const pCercano = await mk("Resto Cercano", { zone: "ZonaDist", lat: -2.901, lng: -79.006 });
const pLejano = await mk("Resto Lejano", { zone: "ZonaDist", lat: -2.95, lng: -79.05 });
const pSuspendido = await mk("Resto Suspendido", {}, "status = 'suspended'");
await test("search_providers: público, solo perfiles activos, con las columnas esperadas", async () => {
  const r = await como(null, "select * from public.search_providers('delivery', p_zone => $1)", [zonaB]);
  assert.deepEqual(Object.keys(r[0]).sort(), ["boosted", "channels", "cover_url", "delivery_fee", "description", "distance_km", "id", "logo_url", "min_order", "name", "on_duty", "open_now", "rating", "reviews_count", "slug", "subtype", "verified", "vertical", "zone"].sort());
  const ids = r.map((x) => x.id);
  assert.ok(!ids.includes(pSuspendido), "los suspendidos no salen");
  assert.equal(ids.length, 4);
  assert.deepEqual((await como(null, "select * from public.search_providers('no_existe')")), []);
});
await test("search_providers: orden — impulsado, verificado, mejor valorado, resto", async () => {
  const r = await como(cliente, "select id from public.search_providers('delivery', p_zone => $1)", [zonaB]);
  assert.deepEqual(r.map((x) => x.id), [pImpulsado, pVerificado, pMejorNota, pAbierto24]);
});
await test("search_providers: filtros por texto (sin comodines), canal, verificación y horario abierto", async () => {
  const buscar = async (extra) => (await como(cliente, `select id from public.search_providers('delivery', p_zone => $1${extra.sql ?? ""})`, [zonaB, ...(extra.params ?? [])])).map((x) => x.id);
  assert.deepEqual(await buscar({ sql: ", p_q => $2", params: ["parrilla"] }), [pMejorNota], "busca en la descripción");
  assert.deepEqual(await buscar({ sql: ", p_q => $2", params: ["RESTO CERCANO"] }), [], "el cercano está en otra zona");
  assert.equal((await buscar({ sql: ", p_q => $2", params: ["%"] })).length, 0, "el % se busca literalmente: ningún nombre lo contiene");
  assert.deepEqual(await buscar({ sql: ", p_delivers => true" }), [pImpulsado]);
  assert.deepEqual(await buscar({ sql: ", p_verified => true" }), [pVerificado]);
  assert.deepEqual(await buscar({ sql: ", p_open_now => true" }), [pAbierto24], "solo el de 24 h está abierto a cualquier hora");
  assert.deepEqual(await buscar({ sql: ", p_subtype => $2", params: ["cafeteria"] }), []);
  assert.equal((await como(cliente, "select id from public.search_providers('delivery', p_zone => lower($1))", [zonaB])).length, 4, "la zona no distingue mayúsculas");
  assert.equal((await como(cliente, "select id from public.search_providers('delivery', p_zone => $1, p_limit => 2)", [zonaB])).length, 2);
  assert.equal((await como(cliente, "select id from public.search_providers('delivery', p_zone => $1, p_limit => 2, p_offset => 3)", [zonaB])).length, 1);
});
await test("search_providers: con coordenadas ordena por cercanía y devuelve la distancia", async () => {
  const r = await como(cliente, "select id, distance_km from public.search_providers('delivery', p_zone => 'ZonaDist', p_lat => -2.9001, p_lng => -79.0059)");
  assert.deepEqual(r.map((x) => x.id), [pCercano, pLejano]);
  assert.ok(Number(r[0].distance_km) < 0.5 && Number(r[1].distance_km) > 5, JSON.stringify(r));
});
const farmaciaU = await perfil(await persona("DuenoFarmaciaU"), { vertical: "salud", subtype: "farmacia", name: "Farmacia Sin Verificar", zone: "ZonaFarm" });
const farmaciaN = await perfil(await persona("DuenoFarmaciaN"), { vertical: "salud", subtype: "farmacia", name: "Farmacia Sin Turno", zone: "ZonaFarm" });
await q("update public.providers set verified_at = now() where id = any($1)", [[farmaciaV.id, farmaciaN.id]]);
await q("insert into public.provider_duty_shifts (provider_id, starts_at, ends_at) values ($1, now() - interval '1 hour', now() + interval '3 hours')", [farmaciaU.id]);
await test("farmacias de turno: primero las verificadas de turno; el turno sin verificar se ve pero no encabeza", async () => {
  const r = await como(cliente, "select id, on_duty, verified from public.search_providers('salud', p_zone => 'ZonaFarm')");
  assert.deepEqual(r.map((x) => x.id), [farmaciaV.id, farmaciaN.id, farmaciaU.id]);
  assert.deepEqual(r.map((x) => x.on_duty), [true, false, true]);
  assert.deepEqual((await como(cliente, "select id from public.search_providers('salud', p_zone => 'ZonaFarm', p_on_duty => true)")).map((x) => x.id).sort(), [farmaciaV.id, farmaciaU.id].sort());
});
await test("directory_counts: cifras reales por sección, públicas", async () => {
  const r = Object.fromEntries((await como(null, "select * from public.directory_counts()")).map((x) => [x.vertical, x]));
  assert.ok(r.delivery.providers >= 6 && r.delivery.verified >= 1);
  assert.equal(r.salud.providers, 3);
  assert.equal(r.salud.verified, 2);
  const activos = await q("select count(*)::int n from public.providers where status = 'active' and vertical = 'delivery'");
  assert.equal(r.delivery.providers, activos[0].n);
});

// ── 4b. Buscador universal (update_007) ─────────────────────────────────────
console.log("\nBuscador universal");
const zonaU = "ZonaUniversal";
const cruzAzul = await mk("Farmacia Cruz Azul", { vertical: "salud", subtype: "farmacia", zone: zonaU, description: "Medicinas y cuidado personal" }, "verified_at = now(), rating = 4.7");
const delPueblo = await mk("Farmacia Del Pueblo", { vertical: "salud", subtype: "farmacia", zone: zonaU }, "rating = 3.5");
const buenSabor = await mk("Cafetería El Buen Sabor", { zone: zonaU, subtype: "cafeteria", description: "Desayunos y almuerzos caseros" });
const pizzaNonna = await mk("Pizza Nonna", { zone: zonaU, description: "Horno de leña" });
const otraZona = await mk("Farmacia Lejana", { vertical: "salud", subtype: "farmacia", zone: "ZonaOtra" });
await articulo(cruzAzul, "Paracetamol 500 mg", 1.8, { kind: "product" });
await articulo(cruzAzul, "Ibuprofeno 400 mg", 2.5, { kind: "product" });
await articulo(cruzAzul, "Amoxicilina 500 mg (con receta)", 6, { kind: "product", receta: true });
for (const [n, p] of [["Paracetamol infantil", 3.2], ["Paracetamol 1 g", 2.9], ["Paracetamol gotas", 4], ["Paracetamol jarabe", 5]]) await articulo(delPueblo, n, p, { kind: "product" });
await articulo(delPueblo, "Paracetamol agotado", 1, { kind: "product", disponible: false });
await articulo(buenSabor, "Café pasado", 1.25);
await articulo(buenSabor, "Empanada de viento", 1.5);
await articulo(pizzaNonna, "Pizza margarita", 8);
await articulo(otraZona, "Paracetamol 500 mg", 1.6, { kind: "product" });
await q("insert into public.provider_duty_shifts (provider_id, starts_at, ends_at) values ($1, now() - interval '1 hour', now() + interval '6 hours')", [cruzAzul]);
await q("update public.providers set status = 'paused' where id = $1", [pizzaNonna]);
const universal = (uid, q_, extra = "", params = []) => como(uid, `select * from public.search_directory($1, p_zone => $2${extra})`, [q_, zonaU, ...params]);
await test("search_providers: sin distinguir acentos ni mayúsculas, y los comodines se buscan literalmente", async () => {
  const buscar = async (texto) => (await como(cliente, "select id from public.search_providers('delivery', p_zone => $1, p_q => $2)", [zonaU, texto])).map((x) => x.id);
  assert.deepEqual(await buscar("cafeteria"), [buenSabor], "«cafeteria» encuentra «Cafetería»");
  assert.deepEqual(await buscar("CAFETERIA"), [buenSabor]);
  assert.deepEqual(await buscar("desayunos"), [buenSabor], "también en la descripción");
  assert.deepEqual(await buscar("%"), [], "un % no es un comodín");
  assert.deepEqual(await buscar("_"), [], "un _ tampoco");
  assert.deepEqual(await buscar("buen_abor"), []);
  assert.deepEqual(await buscar("pizza"), [], "los perfiles pausados no salen");
});
await test("search_directory: encuentra lo que venden los negocios, con precio, y no lista lo agotado ni lo inactivo", async () => {
  const r = await universal(cliente, "paracetamol");
  assert.deepEqual(Object.keys(r[0]).sort(), ["item_name", "item_price", "kind", "logo_url", "name", "on_duty", "open_now", "provider_id", "rating", "requires_prescription", "slug", "subtype", "verified", "vertical", "zone"].sort());
  assert.ok(r.every((x) => x.kind === "item" && x.zone === zonaU), "solo productos y de esa zona");
  assert.equal(r[0].provider_id, cruzAzul, "de turno y verificada, primero");
  assert.deepEqual([r[0].item_name, Number(r[0].item_price), r[0].on_duty, r[0].verified], ["Paracetamol 500 mg", 1.8, true, true]);
  const delante = r.filter((x) => x.provider_id === delPueblo);
  assert.equal(delante.length, 3, "máximo 3 productos por negocio (tiene 4 disponibles)");
  assert.ok(!r.some((x) => /agotado/.test(x.item_name)), "lo no disponible no sale");
  assert.deepEqual(delante.map((x) => Number(x.item_price)), [2.9, 3.2, 4], "del más barato al más caro dentro de cada negocio");
  assert.ok(!r.some((x) => x.provider_id === otraZona), "otra zona");
});
await test("search_directory: negocios por nombre o categoría y los medicamentos con receta se marcan", async () => {
  const r = await universal(cliente, "farmacia");
  assert.deepEqual(r.map((x) => x.kind), ["provider", "provider"]);
  assert.equal(r[0].provider_id, cruzAzul, "verificada de turno primero");
  assert.equal(r[0].item_name, null);
  const cat = await universal(cliente, "cafeteria");
  assert.deepEqual(cat.map((x) => [x.kind, x.provider_id]), [["provider", buenSabor]]);
  const rx = await universal(cliente, "amoxicilina");
  assert.deepEqual([rx.length, rx[0].requires_prescription, rx[0].kind], [1, true, "item"], "se lista para informar, marcado como con receta");
  const norx = await universal(cliente, "ibuprofeno");
  assert.equal(norx[0].requires_prescription, false);
  assert.deepEqual((await universal(cliente, "empanada")).map((x) => x.item_name), ["Empanada de viento"]);
});
await test("search_directory: filtros de sección y zona, mínimo de 2 letras, límite y acceso público", async () => {
  assert.deepEqual(await universal(cliente, "paracetamol", ", p_vertical => 'delivery'"), [], "el paracetamol no está en Delivery");
  assert.ok((await universal(cliente, "paracetamol", ", p_vertical => 'salud'")).length >= 4);
  assert.deepEqual(await universal(cliente, "a"), []);
  assert.deepEqual(await universal(cliente, "  "), []);
  assert.deepEqual(await como(cliente, "select * from public.search_directory(null)"), []);
  assert.equal((await universal(cliente, "paracetamol", ", p_limit => 2")).length, 2);
  assert.ok((await como(cliente, "select provider_id from public.search_directory('paracetamol')")).some((x) => x.provider_id === otraZona), "sin zona, entra toda la ciudad");
  assert.ok((await como(null, "select provider_id from public.search_directory('paracetamol', $1)", [zonaU])).length >= 4, "también sin sesión");
  assert.deepEqual(await universal(cliente, "100%"), [], "un % no rompe ni actúa de comodín");
  assert.deepEqual(await universal(cliente, "\\"), []);
  assert.deepEqual(await universal(cliente, "pizza"), [], "perfil pausado y su plato: fuera");
});

// ── 5. Pedidos ──────────────────────────────────────────────────────────────
console.log("\nPedidos (precios y estados los fija el servidor)");
let pedido;
await test("place_order: el servidor calcula subtotal, envío y total; el cliente solo dice qué y cuánto", async () => {
  pedido = await pedir(cliente, sabor.id, [{ item_id: ceviche, qty: 2 }, { item_id: jugo, qty: 1 }], { notas: "Sin picante" });
  const [o] = await q("select * from public.orders where id = $1", [pedido]);
  assert.deepEqual([o.status, Number(o.subtotal), Number(o.delivery_fee), Number(o.total), o.kind, o.payment_method, o.provider_name, o.notes], ["placed", 15, 1.5, 16.5, "delivery", "cash", "Sabor Cuencano", "Sin picante"]);
  const lineas = await q("select name, unit_price, qty from public.order_lines where order_id = $1 order by line_no", [pedido]);
  assert.deepEqual(lineas.map((l) => [l.name, Number(l.unit_price), l.qty]), [["Ceviche mixto", 6.5, 2], ["Jugo de naranjilla", 2, 1]]);
  await q("update public.provider_items set price = 99, name = 'Cambiado' where id = $1", [ceviche]);
  assert.equal(Number((await q("select total from public.orders where id = $1", [pedido]))[0].total), 16.5, "el pedido conserva los precios de ese momento");
  await q("update public.provider_items set price = 6.5, name = 'Ceviche mixto' where id = $1", [ceviche]);
  const chat = (await q("select chat_id from public.orders where id = $1", [pedido]))[0].chat_id;
  assert.equal((await q("select count(*)::int n from public.chat_members where chat_id = $1", [chat]))[0].n, 2);
  const av = await avisos(dueno, "order", pedido);
  assert.equal(av.length, 1);
  assert.match(av[0].title, /Nuevo pedido de Cliente/);
  assert.match(av[0].body, /2 producto\(s\) · 16\.5 USD/);
});
await test("pedidos: privados para el cliente y el negocio; sin escritura directa", async () => {
  assert.equal((await como(cliente, "select id from public.orders where id = $1", [pedido])).length, 1);
  assert.equal((await como(dueno, "select id from public.orders where id = $1", [pedido])).length, 1);
  assert.equal((await como(otro, "select id from public.orders where id = $1", [pedido])).length, 0);
  assert.equal((await como(otro, "select order_id from public.order_lines where order_id = $1", [pedido])).length, 0);
  assert.equal((await como(cliente, "select order_id from public.order_lines where order_id = $1", [pedido])).length, 2);
  await falla(como(null, "select id from public.orders"), /permission denied/);
  await falla(como(cliente, "update public.orders set total = 0 where id = $1", [pedido]), /permission denied/);
  await falla(como(cliente, "insert into public.orders (provider_owner_id, provider_name, customer_id, kind, subtotal, total, payment_method) values ($1, 'x', $2, 'delivery', 0, 0, 'cash')", [dueno, cliente]), /permission denied/);
  await falla(como(cliente, "insert into public.order_lines (order_id, line_no, name, unit_price, qty) values ($1, 9, 'x', 0.01, 1)", [pedido]), /permission denied/);
});
await test("place_order: rechaza lo inválido (mínimo, dirección, productos ajenos o agotados, cantidades, repetidos)", async () => {
  await falla(pedir(cliente, sabor.id, [{ item_id: jugo, qty: 1 }]), /pedido mínimo es de 5/);
  await falla(pedir(cliente, sabor.id, [{ item_id: ceviche, qty: 1 }], { dir: " " }), /dirección de entrega/);
  await falla(pedir(cliente, sabor.id, [{ item_id: ceviche, qty: 1 }, { item_id: ceviche, qty: 1 }]), /repetido/);
  await falla(pedir(cliente, sabor.id, [{ item_id: agotado, qty: 1 }]), /ya no está disponible/);
  await falla(pedir(cliente, sabor.id, [{ item_id: aspirina, qty: 1 }]), /ya no está disponible/, "de otro perfil");
  await falla(pedir(cliente, sabor.id, [{ item_id: sinPrecio, qty: 1 }]), /no tiene precio fijo/);
  for (const qty of [0, 21, -1, "abc", 1.5, null]) await falla(pedir(cliente, sabor.id, [{ item_id: ceviche, qty }]), /cantidad|Línea de pedido/);
  await falla(pedir(cliente, sabor.id, [{ item_id: "no-es-uuid", qty: 1 }]), /Línea de pedido/);
  await falla(pedir(cliente, sabor.id, []), /entre 1 y 30/);
  await falla(pedir(cliente, sabor.id, [{ item_id: ceviche, qty: 1 }], { pago: "bitcoin" }), /Forma de pago/);
  await falla(pedir(cliente, sabor.id, [{ item_id: ceviche, qty: 1 }], { tipo: "teletransporte" }), /Tipo de pedido/);
  await falla(pedir(dueno, sabor.id, [{ item_id: ceviche, qty: 1 }]), /a ti mismo/);
  await falla(pedir(null, sabor.id, [{ item_id: ceviche, qty: 1 }]), /permission denied|No autenticado/);
  await falla(pedir(cliente, randomUUID(), [{ item_id: ceviche, qty: 1 }]), /no está disponible/);
});
await test("place_order: retiro sin envío, medicamentos con receta bloqueados y perfiles pausados o sin pedidos", async () => {
  const retiro = await pedir(cliente, sabor.id, [{ item_id: ceviche, qty: 1 }], { tipo: "pickup", dir: "" });
  assert.deepEqual((await q("select delivery_fee, total, kind from public.orders where id = $1", [retiro])).map((o) => [Number(o.delivery_fee), Number(o.total), o.kind])[0], [0, 6.5, "pickup"]);
  const ok = await pedir(cliente, farmaciaV.id, [{ item_id: aspirina, qty: 2 }]);
  assert.equal(Number((await q("select total from public.orders where id = $1", [ok]))[0].total), 4.6);
  await falla(pedir(cliente, farmaciaV.id, [{ item_id: antibiotico, qty: 1 }]), /requiere receta médica/);
  await como(dueno, "select public.set_provider_active($1, false)", [sabor.id]);
  await falla(pedir(cliente, sabor.id, [{ item_id: ceviche, qty: 1 }]), /no está disponible/);
  await como(dueno, "select public.set_provider_active($1, true)", [sabor.id]);
  const taxi = await perfil(await persona("DuenoTaxiPedido"), { vertical: "movilidad", subtype: "taxi", name: "Taxi sin pedidos" });
  await falla(pedir(cliente, taxi.id, [{ item_id: ceviche, qty: 1 }]), /no recibe pedidos/);
  const sinEntrega = await perfil(await persona("DuenoSinEntrega"), { name: "Solo en local", channels: ["local"] });
  const it = await articulo(sinEntrega.id, "Sopa", 3);
  await falla(pedir(cliente, sinEntrega.id, [{ item_id: it, qty: 1 }]), /no entrega a domicilio/);
  const soloEntrega = await perfil(await persona("DuenoSoloEntrega"), { name: "Solo entrega", channels: ["entrega"] });
  const it2 = await articulo(soloEntrega.id, "Pan", 3);
  await falla(pedir(cliente, soloEntrega.id, [{ item_id: it2, qty: 1 }], { tipo: "pickup" }), /no ofrece retiro en el local/);
});
await test("place_order: máximo 5 pedidos sin responder por persona", async () => {
  const impaciente = await persona("Impaciente");
  for (let i = 0; i < 5; i++) await pedir(impaciente, sabor.id, [{ item_id: ceviche, qty: 1 }]);
  await falla(pedir(impaciente, sabor.id, [{ item_id: ceviche, qty: 1 }]), /demasiados pedidos sin responder/);
});
await test("PARIDAD: la máquina de estados de pedidos en SQL == transicionesPedido() en TypeScript (todas las combinaciones)", async () => {
  const estados = Object.keys(ETIQUETA_ESTADO_PEDIDO);
  assert.equal(estados.length, 7);
  const enSql = (await q("select pg_get_constraintdef(oid) d from pg_constraint where conrelid = 'public.orders'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%placed%'"))[0].d;
  for (const e of estados) assert.ok(enSql.includes(`'${e}'`), e);
  const p = await pedir(await persona("ClienteEstados"), sabor.id, [{ item_id: ceviche, qty: 1 }]);
  const antes = (await q("select orders_count from public.providers where id = $1", [sabor.id]))[0].orders_count;
  let entregas = 0;
  for (const [rol, uid] of [["negocio", dueno], ["cliente", (await q("select customer_id from public.orders where id = $1", [p]))[0].customer_id]]) {
    for (const desde of estados) {
      const permitidos = transicionesPedido(rol, desde);
      for (const hacia of estados) {
        await q("update public.orders set status = $2 where id = $1", [p, desde]);
        const intento = como(uid, "select public.set_order_status($1, $2)", [p, hacia]);
        if (permitidos.includes(hacia)) {
          await intento;
          assert.equal((await q("select status from public.orders where id = $1", [p]))[0].status, hacia, `${rol}: ${desde}→${hacia}`);
          if (hacia === "delivered") entregas++;
        } else {
          await falla(intento, /No se puede pasar el pedido/);
          assert.equal((await q("select status from public.orders where id = $1", [p]))[0].status, desde, `${rol}: ${desde}→${hacia} no debía cambiar`);
        }
      }
    }
  }
  assert.ok(entregas >= 2, "se probaron entregas");
  assert.equal((await q("select orders_count from public.providers where id = $1", [sabor.id]))[0].orders_count, antes + entregas, "cada entrega suma una al negocio");
  await falla(como(otro, "select public.set_order_status($1, 'accepted')", [p]), /Pedido inexistente/);
});
await test("estado del pedido: avisa a la otra parte y deja constancia en el chat", async () => {
  const c = await persona("ClienteAvisos");
  const p = await pedir(c, sabor.id, [{ item_id: ceviche, qty: 1 }]);
  await como(dueno, "select public.set_order_status($1, 'accepted')", [p]);
  await como(dueno, "select public.set_order_status($1, 'on_the_way')", [p]);
  const av = await avisos(c, "order", p);
  assert.deepEqual(av.map((a) => a.title), ["✅ Pedido aceptado", "🛵 Tu pedido va en camino"]);
  const chat = (await q("select chat_id from public.orders where id = $1", [p]))[0].chat_id;
  assert.ok(av.every((a) => a.href === `/directorio/pedidos/${p}`), "los avisos llevan a la pantalla del pedido");
  const sis = (await q("select body from public.messages where chat_id = $1 and kind = 'system' order by created_at", [chat])).map((m) => m.body);
  assert.ok(sis.includes("✅ Pedido aceptado") && sis.includes("🛵 Tu pedido va en camino"));
  await como(c, "select public.set_order_status($1, 'cancelled')", [p]).then(() => { throw new Error("no debía poder cancelar"); }, () => {});
});

// ── 5b. Pedidos operables (update_008): teléfono, caducidad y avisos ─────────
console.log("\nPedidos operables (teléfono, caducidad y avisos)");
await test("teléfono del cliente: obligatorio a domicilio, válido, y solo lo ven la persona y el negocio", async () => {
  const c = await persona("ClienteTelefono");
  const linea = [{ item_id: ceviche, qty: 1 }];
  await falla(pedir(c, sabor.id, linea, { tel: "" }), /Indica un teléfono/);
  await falla(pedir(c, sabor.id, linea, { tel: null }), /Indica un teléfono/);
  await falla(pedir(c, sabor.id, linea, { tel: "llámame" }), /teléfono válido/);
  await falla(pedir(c, sabor.id, linea, { tel: "12" }), /teléfono válido/);
  const conTel = await pedir(c, sabor.id, linea, { tel: " 099 123 4567 " });
  assert.equal((await q("select customer_phone from public.orders where id = $1", [conTel]))[0].customer_phone, "099 123 4567", "se guarda recortado");
  assert.equal((await como(dueno, "select customer_phone from public.orders where id = $1", [conTel]))[0].customer_phone, "099 123 4567", "el negocio lo ve");
  assert.equal((await como(c, "select customer_phone from public.orders where id = $1", [conTel]))[0].customer_phone, "099 123 4567");
  assert.equal((await como(otro, "select customer_phone from public.orders where id = $1", [conTel])).length, 0, "nadie más");
  // Retirar en el local: el teléfono es opcional, pero si se escribe debe ser válido.
  const retiro = await pedir(c, sabor.id, linea, { tipo: "pickup", dir: "", tel: null });
  assert.equal((await q("select customer_phone from public.orders where id = $1", [retiro]))[0].customer_phone, null);
  await falla(pedir(c, sabor.id, linea, { tipo: "pickup", dir: "", tel: "abc" }), /teléfono válido/);
  await falla(como(c, "update public.orders set customer_phone = '0000000' where id = $1", [conTel]), /permission denied/);
});
await test("caducidad: un pedido sin respuesta en 3 horas se cancela solo, avisa en el chat y libera el cupo", async () => {
  const c = await persona("ClienteImpaciente2");
  const linea = [{ item_id: ceviche, qty: 1 }];
  const viejos = [];
  for (let i = 0; i < 5; i++) viejos.push(await pedir(c, sabor.id, linea));
  await falla(pedir(c, sabor.id, linea), /demasiados pedidos sin responder/);
  await q("update public.orders set created_at = now() - interval '3 hours 1 minute' where id = any($1)", [viejos.slice(0, 3)]);
  await q("update public.orders set created_at = now() - interval '2 hours 59 minutes' where id = $1", [viejos[3]]);
  const nuevo = await pedir(c, sabor.id, linea); // al pedir se caducan los 3 viejos y vuelve a haber cupo
  const estados = Object.fromEntries((await q("select id, status from public.orders where id = any($1)", [[...viejos, nuevo]])).map((r) => [r.id, r.status]));
  assert.deepEqual(viejos.map((v) => estados[v]), ["cancelled", "cancelled", "cancelled", "placed", "placed"], "solo los de más de 3 horas");
  assert.equal(estados[nuevo], "placed");
  const chat = (await q("select chat_id from public.orders where id = $1", [viejos[0]]))[0].chat_id;
  assert.ok((await q("select body from public.messages where chat_id = $1 and kind = 'system'", [chat])).some((m) => /no respondió a tiempo/.test(m.body)));
  // Ni los aceptados ni los entregados caducan.
  await q("update public.orders set status = 'accepted', created_at = now() - interval '9 hours' where id = $1", [viejos[4]]);
  assert.equal((await como(c, "select public.expire_stale_orders() n"))[0].n, 0);
  assert.equal((await q("select status from public.orders where id = $1", [viejos[4]]))[0].status, "accepted");
});
await test("expire_stale_orders: la bandeja del negocio también los caduca; solo afecta a quien participa; exige sesión", async () => {
  const c1 = await persona("ClienteCaduca1");
  const p1 = await pedir(c1, sabor.id, [{ item_id: ceviche, qty: 1 }]);
  const otroNegocio = await perfil(await persona("DuenoOtroNegocio"), { name: "Otro negocio", channels: ["entrega"] });
  const it = await articulo(otroNegocio.id, "Pan", 3);
  const p2 = await pedir(c1, otroNegocio.id, [{ item_id: it, qty: 1 }]);
  await q("update public.orders set created_at = now() - interval '4 hours' where id = any($1)", [[p1, p2]]);
  assert.equal((await como(otro, "select public.expire_stale_orders() n"))[0].n, 0, "una persona ajena no caduca nada");
  assert.equal((await como(dueno, "select public.expire_stale_orders() n"))[0].n >= 1, true);
  assert.deepEqual([(await q("select status from public.orders where id = $1", [p1]))[0].status, (await q("select status from public.orders where id = $1", [p2]))[0].status], ["cancelled", "placed"], "solo los de su negocio");
  await falla(como(null, "select public.expire_stale_orders()"), /permission denied|No autenticado/);
  await falla(como(dueno, "select public._expire_stale_orders($1)", [dueno]), /permission denied/);
});
await test("avisos del pedido: llevan a /directorio/pedidos/<id>; en pedidos para retirar dicen «listo para retirar» y «retirado»", async () => {
  const c = await persona("ClienteRetira");
  const p = await pedir(c, sabor.id, [{ item_id: ceviche, qty: 1 }], { tipo: "pickup", dir: "", tel: null });
  assert.equal((await avisos(dueno, "order", p))[0].href, `/directorio/pedidos/${p}`, "el negocio: nuevo pedido");
  await como(dueno, "select public.set_order_status($1, 'accepted')", [p]);
  await como(dueno, "select public.set_order_status($1, 'on_the_way')", [p]);
  await como(dueno, "select public.set_order_status($1, 'delivered')", [p]);
  const av = await avisos(c, "order", p);
  assert.deepEqual(av.map((a) => a.title), ["✅ Pedido aceptado", "📦 Tu pedido está listo para retirar", "🎉 Pedido retirado"]);
  assert.ok(av.every((a) => a.href === `/directorio/pedidos/${p}`));
  const dom = await pedir(c, sabor.id, [{ item_id: ceviche, qty: 1 }]);
  await como(dueno, "select public.set_order_status($1, 'accepted')", [dom]);
  await como(dueno, "select public.set_order_status($1, 'on_the_way')", [dom]);
  await como(dueno, "select public.set_order_status($1, 'delivered')", [dom]);
  assert.deepEqual((await avisos(c, "order", dom)).map((a) => a.title), ["✅ Pedido aceptado", "🛵 Tu pedido va en camino", "🎉 Pedido entregado"]);
});

// ── 5c. Paridad carrito ↔ servidor ───────────────────────────────────────────
console.log("\nCarrito: paridad con place_order()");
const { cambiarCantidad, lineasParaRpc, totales, tiposDisponibles } = await import("@/lib/directorio/carrito");
const { argumentosPedido, validarPago } = await import("@/lib/directorio/pedidos");
const decimales = { g: await articulo(sabor.id, "Plato 19.99", 19.99), c1: await articulo(sabor.id, "Caramelo 0.10", 0.1), c2: await articulo(sabor.id, "Chicle 0.20", 0.2), e: await articulo(sabor.id, "Empanada 1.15", 1.15) };
const INFO = { id: sabor.id, slug: sabor.slug, vertical: "delivery", nombre: "Sabor Cuencano", canales: ["local", "entrega", "retiro"], costoEnvio: 1.5, pedidoMinimo: 5 };
const carritoDe = async (cantidades) => {
  let c = null;
  for (const [id, n] of Object.entries(cantidades)) {
    const [it] = await q("select id, name, price from public.provider_items where id = $1", [id]);
    c = cambiarCantidad(c, INFO, { id: it.id, nombre: it.name, precio: Number(it.price) }, n).carrito;
  }
  return c;
};
await test("PARIDAD: subtotal, envío y total del carrito == los que calcula place_order (decimales delicados incluidos)", async () => {
  const casos = [
    { [ceviche]: 2, [jugo]: 1 },
    { [decimales.g]: 3, [decimales.c1]: 3, [decimales.c2]: 1 },
    { [decimales.e]: 7, [decimales.c1]: 20, [decimales.g]: 1 },
    { [decimales.g]: 20, [decimales.e]: 20, [ceviche]: 20, [decimales.c1]: 20 },
  ];
  for (const cantidades of casos) {
    for (const tipo of ["delivery", "pickup"]) {
      const c = await carritoDe(cantidades);
      const cliente_ = await persona(`ClienteParidad${tipo}${Math.random().toString(36).slice(2, 8)}`);
      const id = await pedir(cliente_, sabor.id, lineasParaRpc(c), { tipo, dir: tipo === "delivery" ? "Av. Solano 1-23" : "" });
      const [o] = await q("select subtotal, delivery_fee, total from public.orders where id = $1", [id]);
      const t = totales(c, tipo);
      assert.deepEqual([t.subtotal, t.envio, t.total], [Number(o.subtotal), Number(o.delivery_fee), Number(o.total)], `${tipo} ${JSON.stringify(cantidades)}`);
    }
  }
  assert.deepEqual(tiposDisponibles(["local", "entrega", "retiro"]), ["delivery", "pickup"]);
});
await test("PARIDAD: si validarPago() da el visto bueno, place_order() no rechaza por datos; si no, el servidor también rechaza", async () => {
  const c = await carritoDe({ [ceviche]: 1 }); // 6.50: llega al mínimo de 5
  const corto = await carritoDe({ [jugo]: 1 }); // 2.00: no llega
  const escenarios = [
    ["todo bien, a domicilio", pagoOk(), c],
    ["retirar sin dirección ni teléfono", pagoOk({ tipo: "pickup", direccion: "", telefono: "" }), c],
    ["retirar con teléfono", pagoOk({ tipo: "pickup", direccion: "", telefono: "099 123 4567" }), c],
    ["domicilio sin dirección", pagoOk({ direccion: "" }), c],
    ["domicilio con dirección corta", pagoOk({ direccion: "Av" }), c],
    ["domicilio sin teléfono", pagoOk({ telefono: "" }), c],
    ["teléfono inválido", pagoOk({ telefono: "llámame" }), c],
    ["retirar con teléfono inválido", pagoOk({ tipo: "pickup", direccion: "", telefono: "abc" }), c],
    ["pedido mínimo no alcanzado (domicilio)", pagoOk(), corto],
    ["pedido mínimo no alcanzado (retirar)", pagoOk({ tipo: "pickup", direccion: "", telefono: "" }), corto],
    ["transferencia", pagoOk({ pago: "transfer" }), c],
  ];
  for (const [nombre, datos, carrito] of escenarios) {
    const clienteE = await persona(`ClienteEsc${Math.random().toString(36).slice(2, 9)}`);
    const clienteRechaza = Object.keys(validarPago(datos, carrito)).length > 0;
    const a = argumentosPedido(datos, carrito);
    let servidorRechaza = false;
    try {
      await como(clienteE, "select public.place_order($1, $2, $3::jsonb, $4, $5, $6, $7, $8)", [a.p_provider, a.p_kind, JSON.stringify(a.p_lines), a.p_address, a.p_zone, a.p_notes, a.p_payment, a.p_phone]);
    } catch (e) {
      servidorRechaza = true;
      if (!clienteRechaza) throw new Error(`«${nombre}»: el cliente lo daba por bueno y el servidor lo rechazó (${e.message})`);
    }
    assert.equal(servidorRechaza, clienteRechaza, `«${nombre}»: cliente ${clienteRechaza ? "rechaza" : "acepta"}, servidor ${servidorRechaza ? "rechaza" : "acepta"}`);
  }
});
function pagoOk(extra = {}) {
  return { tipo: "delivery", direccion: "Av. Solano 1-23", zona: "Centro", telefono: "099 123 4567", notas: "", pago: "cash", ...extra };
}

// ── 6. Solicitudes y ofertas («Busco» de servicios) ─────────────────────────
console.log("\nSolicitudes y ofertas");
const pasajero = await persona("Pasajero");
const taxistaV = await persona("TaxistaVerificado", { verificada: true });
const taxistaN = await persona("TaxistaSinKyc");
const plomeroU = await persona("PlomeroPedro");
const taxiV = await perfil(taxistaV, { vertical: "movilidad", subtype: "taxi", name: "Taxi Juan", zone: "Centro" });
const taxiN = await perfil(taxistaN, { vertical: "movilidad", subtype: "taxi", name: "Taxi Sin Verificar", zone: "Centro" });
const plomero = await perfil(plomeroU, { vertical: "hogar", subtype: "plomero", name: "Plomería Pedro", zone: "Centro" });
const solicitar = (uid, o = {}) => como(uid, "select public.create_service_request($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb) id", [
  o.vertical ?? "movilidad", o.subtype ?? "taxi", o.title ?? "Del Centro al aeropuerto", o.desc ?? "Con equipaje", o.zone ?? "Centro", o.dest ?? "Aeropuerto",
  o.when ?? "now", o.at ?? null, o.budget ?? 8, JSON.stringify(o.details ?? { pasajeros: 2 })]).then((r) => r[0].id);
let viaje;
await test("create_service_request: avisa a los profesionales que encajan (en Movilidad, solo con identidad verificada)", async () => {
  viaje = await solicitar(pasajero);
  assert.equal((await avisos(taxistaV, "request", viaje)).length, 1);
  assert.match((await avisos(taxistaV, "request", viaje))[0].title, /Nueva solicitud: Del Centro al aeropuerto/);
  assert.equal((await avisos(taxistaN, "request", viaje)).length, 0, "sin KYC no recibe solicitudes de viajes");
  assert.equal((await avisos(plomeroU, "request", viaje)).length, 0, "otra categoría");
  assert.equal((await avisos(pasajero, "request", viaje)).length, 0, "no se avisa a quien la publica");
  const fontaneria = await solicitar(pasajero, { vertical: "hogar", subtype: "plomero", title: "Fuga en el baño", dest: "", when: "today" });
  assert.equal((await avisos(plomeroU, "request", fontaneria)).length, 1);
});
await test("create_service_request: caducidad según el momento y validaciones", async () => {
  const dur = async (id) => Number((await q("select extract(epoch from expires_at - created_at) / 60 m from public.service_requests where id = $1", [id]))[0].m);
  assert.ok(Math.abs((await dur(viaje)) - 60) < 1, "ahora: 1 hora");
  const persona2 = await persona("Solicitante2");
  assert.ok(Math.abs((await dur(await solicitar(persona2, { when: "today" }))) - 720) < 1, "hoy: 12 horas");
  const manana = new Date(Date.now() + 86_400_000).toISOString();
  const prog = await solicitar(persona2, { when: "scheduled", at: manana });
  const [r] = await q("select scheduled_at, expires_at from public.service_requests where id = $1", [prog]);
  assert.equal(new Date(r.expires_at).getTime() - new Date(r.scheduled_at).getTime(), 2 * 3_600_000, "programada: 2 h después");
  await falla(solicitar(persona2, { when: "scheduled", at: new Date(Date.now() - 1000).toISOString() }), /próximos 90 días/);
  await falla(solicitar(persona2, { when: "scheduled", at: new Date(Date.now() + 91 * 86_400_000).toISOString() }), /próximos 90 días/);
  await falla(solicitar(persona2, { when: "scheduled" }), /próximos 90 días/);
  await falla(solicitar(persona2, { vertical: "delivery", subtype: "restaurante" }), /no admite solicitudes/);
  await falla(solicitar(persona2, { vertical: "movilidad", subtype: "plomero" }), /no existe en esta secci/);
  await falla(solicitar(persona2, { title: "no" }), /title|check/);
  await falla(solicitar(persona2, { when: "mañana" }), /Momento no válido/);
  await falla(solicitar(persona2, { details: "no-es-objeto" }), /details|json/);
  await falla(solicitar(null), /permission denied|No autenticado/);
  const saturada = await persona("Saturada");
  for (let i = 0; i < 5; i++) await solicitar(saturada, { title: `Necesito un taxi ${i}` });
  await falla(solicitar(saturada, { title: "Un taxi más" }), /5 solicitudes abiertas/);
});
let oferta;
await test("send_offer: identidad verificada en Movilidad, misma categoría, perfil propio; reofertar actualiza", async () => {
  oferta = (await como(taxistaV, "select public.send_offer($1, $2, 9.5, 12, 'Llego en 12 minutos') id", [viaje, taxiV.id]))[0].id;
  await falla(como(taxistaN, "select public.send_offer($1, $2, 8, 10)", [viaje, taxiN.id]), /verificar tu identidad/);
  await falla(como(plomeroU, "select public.send_offer($1, $2, 8, 10)", [viaje, plomero.id]), /no ofrece este tipo de servicio/);
  await falla(como(otro, "select public.send_offer($1, $2, 8, 10)", [viaje, taxiV.id]), /no es tuyo/);
  await falla(como(pasajero, "select public.send_offer($1, $2, 8, 10)", [viaje, taxiV.id]), /no es tuyo/);
  await falla(como(taxistaV, "select public.send_offer($1, $2, 0, 10)", [viaje, taxiV.id]), /precio válido/);
  await falla(como(taxistaV, "select public.send_offer($1, $2, 8, 0)", [viaje, taxiV.id]), /tiempo estimado/);
  const otra = (await como(taxistaV, "select public.send_offer($1, $2, 9, 10, 'Mejor precio') id", [viaje, taxiV.id]))[0].id;
  assert.equal(otra, oferta, "una sola oferta por perfil y solicitud");
  const [o] = await q("select price, eta_minutes, message, status from public.service_offers where id = $1", [oferta]);
  assert.deepEqual([Number(o.price), o.eta_minutes, o.message, o.status], [9, 10, "Mejor precio", "sent"]);
  const av = await avisos(pasajero, "offer", oferta);
  assert.ok(av.length >= 1 && /Taxi Juan te ofrece 9 USD/.test(av.at(-1).title));
  assert.equal((await q("select count(*)::int n from public.chat_members where chat_id = (select chat_id from public.service_offers where id = $1)", [oferta]))[0].n, 2);
});
await test("solicitudes y ofertas: visibilidad (con sesión; las ofertas solo para las dos partes)", async () => {
  await falla(como(null, "select id from public.service_requests"), /permission denied/);
  assert.equal((await como(otro, "select id from public.service_requests where id = $1", [viaje])).length, 1, "las solicitudes abiertas se ven con sesión");
  assert.equal((await como(pasajero, "select id from public.service_offers where id = $1", [oferta])).length, 1);
  assert.equal((await como(taxistaV, "select id from public.service_offers where id = $1", [oferta])).length, 1);
  assert.equal((await como(otro, "select id from public.service_offers where id = $1", [oferta])).length, 0);
  assert.equal((await como(taxistaN, "select id from public.service_offers where id = $1", [oferta])).length, 0);
  await falla(como(pasajero, "update public.service_requests set status = 'accepted' where id = $1", [viaje]), /permission denied/);
  await falla(como(taxistaV, "update public.service_offers set price = 0.01 where id = $1", [oferta]), /permission denied/);
});
await test("accept_offer: solo quien pidió, una vez; rechaza las demás y avisa al elegido", async () => {
  const segundo = await persona("TaxistaDos", { verificada: true });
  const taxi2 = await perfil(segundo, { vertical: "movilidad", subtype: "taxi", name: "Taxi Dos" });
  const oferta2 = (await como(segundo, "select public.send_offer($1, $2, 7, 5) id", [viaje, taxi2.id]))[0].id;
  await falla(como(otro, "select public.accept_offer($1)", [oferta]), /Solo quien publicó/);
  await falla(como(taxistaV, "select public.accept_offer($1)", [oferta]), /Solo quien publicó/);
  await como(pasajero, "select public.accept_offer($1)", [oferta2]);
  const estados = Object.fromEntries((await q("select id, status from public.service_offers where request_id = $1", [viaje])).map((r) => [r.id, r.status]));
  assert.deepEqual([estados[oferta2], estados[oferta]], ["accepted", "rejected"]);
  const [r] = await q("select status, accepted_offer_id from public.service_requests where id = $1", [viaje]);
  assert.deepEqual([r.status, r.accepted_offer_id], ["accepted", oferta2]);
  assert.match((await avisos(segundo, "offer", oferta2)).at(-1).title, /Aceptaron tu oferta de 7 USD/);
  await falla(como(pasajero, "select public.accept_offer($1)", [oferta]), /ya no está abierta/);
  await falla(como(taxistaV, "select public.send_offer($1, $2, 5, 5)", [viaje, taxiV.id]), /ya no está abierta/);
});
await test("withdraw_offer, close_service_request y solicitudes caducadas", async () => {
  const s = await solicitar(pasajero, { title: "Otro viaje al terminal", when: "today" }).catch(async () => solicitar(await persona("PasajeroB"), { title: "Otro viaje al terminal", when: "today" }));
  const dueñoS = (await q("select requester_id from public.service_requests where id = $1", [s]))[0].requester_id;
  const of = (await como(taxistaV, "select public.send_offer($1, $2, 6, 8) id", [s, taxiV.id]))[0].id;
  await como(taxistaV, "select public.withdraw_offer($1)", [of]);
  assert.equal((await q("select status from public.service_offers where id = $1", [of]))[0].status, "withdrawn");
  await falla(como(taxistaV, "select public.withdraw_offer($1)", [of]), /No se puede retirar/);
  await como(taxistaV, "select public.send_offer($1, $2, 6, 8)", [s, taxiV.id]);
  await falla(como(otro, "select public.close_service_request($1)", [s]), /No se puede cerrar/);
  await como(dueñoS, "select public.close_service_request($1)", [s]);
  assert.equal((await q("select status from public.service_offers where request_id = $1", [s]))[0].status, "rejected");
  const caduca = await solicitar(await persona("PasajeroC"), { title: "Viaje que caduca pronto" });
  await q("update public.service_requests set expires_at = now() - interval '1 minute' where id = $1", [caduca]);
  await falla(como(taxistaV, "select public.send_offer($1, $2, 5, 5)", [caduca, taxiV.id]), /ya no está abierta/);
  assert.equal((await como(otro, "select id from public.service_requests where id = $1", [caduca])).length, 0, "las caducadas dejan de verse");
});

// ── 6b. Paridad solicitudes/ofertas ↔ servidor ──────────────────────────────
console.log("\nSolicitudes: paridad con create_service_request() y send_offer()");
const { argumentosOferta, argumentosSolicitud, validarOferta, validarSolicitud } = await import("@/lib/directorio/solicitudes");
const solicitudOk = (extra = {}) => ({ vertical: "hogar", subtipo: "plomero", titulo: "Fuga en el baño", descripcion: "Gotea bajo el lavabo", zona: "Centro", destino: "", momento: "today", programada: "", presupuesto: "20", detalles: { urgente: true }, ...extra });
const enEcuador = (ms) => new Date(ms - 5 * 3_600_000).toISOString().slice(0, 16); // valor de un input datetime-local
await test("PARIDAD: si validarSolicitud() da el visto bueno el servidor acepta; si no, y la regla es del servidor, también rechaza", async () => {
  const manana = enEcuador(Date.now() + 86_400_000);
  const escenarios = [
    // [nombre, datos, ¿la regla es también del servidor?]
    ["hogar urgente", solicitudOk(), false],
    ["hogar sin presupuesto", solicitudOk({ presupuesto: "" }), false],
    ["presupuesto con coma y símbolo", solicitudOk({ presupuesto: "$12,50" }), false],
    ["viaje programado para mañana", solicitudOk({ vertical: "movilidad", subtipo: "taxi", destino: "Aeropuerto", momento: "scheduled", programada: manana, detalles: { pasajeros: 3 } }), false],
    ["encomienda ahora", solicitudOk({ vertical: "movilidad", subtipo: "encomienda", destino: "Sayausí", momento: "now", detalles: { tamano: "mediano" } }), false],
    ["mascotas: paseador", solicitudOk({ vertical: "mascotas", subtipo: "paseador", titulo: "Pasear a mi perro", detalles: { mascota: "perro" } }), false],
    ["detalles manipulados se descartan", solicitudOk({ detalles: { urgente: "sí", otro: "x".repeat(5000), pasajeros: 99 } }), false],
    ["título demasiado corto", solicitudOk({ titulo: "Ay" }), true],
    ["título de 101 letras", solicitudOk({ titulo: "a".repeat(101) }), true],
    ["fecha pasada", solicitudOk({ momento: "scheduled", programada: enEcuador(Date.now() - 3_600_000) }), true],
    ["fecha a más de 90 días", solicitudOk({ momento: "scheduled", programada: enEcuador(Date.now() + 100 * 86_400_000) }), true],
    ["programada sin fecha", solicitudOk({ momento: "scheduled", programada: "" }), true],
    ["categoría de otra sección", solicitudOk({ vertical: "movilidad", subtipo: "plomero", destino: "X" }), true],
    ["sección sin solicitudes", solicitudOk({ vertical: "delivery", subtipo: "restaurante" }), true],
    ["presupuesto cero", solicitudOk({ presupuesto: "0" }), false],
    ["presupuesto absurdo", solicitudOk({ presupuesto: "abc" }), false],
    ["viaje sin destino", solicitudOk({ vertical: "movilidad", subtipo: "taxi", destino: "" }), false],
    ["sin zona", solicitudOk({ zona: "" }), false],
  ];
  for (const [nombre, datos, delServidor] of escenarios) {
    const quien = await persona(`Solicitante${Math.random().toString(36).slice(2, 9)}`);
    const clienteRechaza = Object.keys(validarSolicitud(datos)).length > 0;
    let a;
    try {
      a = argumentosSolicitud(datos);
    } catch {
      a = null;
    }
    let servidorRechaza = false;
    try {
      if (!a) throw new Error("argumentos imposibles");
      await como(quien, "select public.create_service_request($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb) id", [a.p_vertical, a.p_subtype, a.p_title, a.p_description, a.p_zone, a.p_dest_zone, a.p_when, a.p_scheduled_at, a.p_budget, JSON.stringify(a.p_details)]);
    } catch (e) {
      servidorRechaza = true;
      if (!clienteRechaza) throw new Error(`«${nombre}»: el cliente lo daba por bueno y el servidor lo rechazó (${e.message})`);
    }
    if (delServidor) assert.ok(servidorRechaza && clienteRechaza, `«${nombre}»: ambos deben rechazarlo (cliente ${clienteRechaza}, servidor ${servidorRechaza})`);
  }
  const limpios = argumentosSolicitud(solicitudOk({ detalles: { urgente: "sí", otro: "x".repeat(5000), pasajeros: 99 } })).p_details;
  assert.deepEqual(limpios, {}, "solo se envían los campos conocidos y con valores válidos");
});
await test("PARIDAD: validarOferta() y send_offer() coinciden en precio, tiempo y mensaje", async () => {
  const cliente_ = await persona(`Pide${Math.random().toString(36).slice(2, 8)}`);
  const prof = await persona(`Profe${Math.random().toString(36).slice(2, 8)}`);
  const fontanero = await perfil(prof, { vertical: "hogar", subtype: "plomero", name: "Plomería Rápida" });
  const sol = await solicitar(cliente_, { vertical: "hogar", subtype: "plomero", title: "Cambiar un grifo", dest: "", when: "today" });
  const casos = [
    ["oferta normal", { precio: "18.50", minutos: "45", mensaje: "Llevo repuestos" }],
    ["precio con coma", { precio: "18,5", minutos: "45", mensaje: "" }],
    ["precio cero", { precio: "0", minutos: "45", mensaje: "" }],
    ["precio no numérico", { precio: "barato", minutos: "45", mensaje: "" }],
    ["sin precio", { precio: "", minutos: "45", mensaje: "" }],
    ["tiempo cero", { precio: "10", minutos: "0", mensaje: "" }],
    ["tiempo fuera de rango", { precio: "10", minutos: "10081", mensaje: "" }],
    ["tiempo máximo", { precio: "10", minutos: "10080", mensaje: "" }],
    ["tiempo decimal", { precio: "10", minutos: "1.5", mensaje: "" }],
    ["mensaje de 301 letras", { precio: "10", minutos: "30", mensaje: "a".repeat(301) }],
    ["mensaje de 300 letras", { precio: "10", minutos: "30", mensaje: "a".repeat(300) }],
  ];
  for (const [nombre, datos] of casos) {
    const clienteRechaza = Object.keys(validarOferta(datos)).length > 0;
    const a = argumentosOferta(sol, fontanero.id, datos);
    let servidorRechaza = false;
    try {
      await como(prof, "select public.send_offer($1, $2, $3, $4, $5) id", [a.p_request, a.p_provider, a.p_price, Number.isNaN(a.p_eta) ? null : a.p_eta, a.p_message]);
    } catch (e) {
      servidorRechaza = true;
      if (!clienteRechaza) throw new Error(`«${nombre}»: el cliente lo daba por bueno y el servidor lo rechazó (${e.message})`);
    }
    // El servidor recorta el mensaje a 300 letras en vez de rechazarlo: el cliente es más estricto a propósito (no deja escribir de más).
    if (nombre.startsWith("mensaje de 301")) assert.ok(clienteRechaza && !servidorRechaza);
    else assert.equal(servidorRechaza, clienteRechaza, `«${nombre}»: cliente ${clienteRechaza ? "rechaza" : "acepta"}, servidor ${servidorRechaza ? "rechaza" : "acepta"}`);
  }
});

// ── 7. Eventos y entradas ───────────────────────────────────────────────────
console.log("\nEventos y entradas");
const organizador = await persona("Organizador");
const orga = await perfil(organizador, { vertical: "eventos", subtype: "organizador", name: "Cultura Cuenca" });
const evento = (uid, prov, o = {}) => como(uid, `insert into public.events (provider_id, title, category, starts_at, venue_name, zone) values ($1, $2, $3, ${o.cuando ?? "now() + interval '10 days'"}, 'Teatro Sucre', 'Centro') returning id`, [prov, o.titulo ?? "Concierto de la Orquesta", o.cat ?? "concierto"]).then((r) => r[0].id);
let ev, entrada;
await test("eventos: solo un perfil de Eventos publica; fecha futura; solo el organizador gestiona", async () => {
  ev = await evento(organizador, orga.id);
  await falla(evento(organizador, orga.id, { cuando: "now() - interval '1 day'" }), /fecha del evento debe ser futura/);
  await falla(evento(dueno, sabor.id), /sección Eventos|row-level security/);
  await falla(evento(otro, orga.id), /row-level security/);
  await falla(evento(organizador, orga.id, { cat: "orgía" }), /category|check/);
  await falla(como(organizador, "insert into public.events (provider_id, title, category, starts_at, external_ticket_url) values ($1, 'Evento con enlace', 'otro', now() + interval '3 days', 'javascript:alert(1)')", [orga.id]), /external_ticket_url|check/);
  assert.equal((await como(otro, "update public.events set title = 'Hackeado' where id = $1 returning id", [ev])).length, 0);
  entrada = (await como(organizador, "insert into public.event_ticket_types (event_id, name, price, quantity, max_per_order) values ($1, 'General', 12.5, 30, 4) returning id", [ev]))[0].id;
  await falla(como(otro, "insert into public.event_ticket_types (event_id, name, price, quantity) values ($1, 'Falsa', 0, 10)", [ev]), /row-level security/);
  await falla(como(organizador, "update public.event_ticket_types set sold = 0 where id = $1", [entrada]), /permission denied/);
  assert.equal((await como(null, "select id from public.events where id = $1", [ev])).length, 1, "la cartelera es pública");
  assert.equal((await como(null, "select id from public.event_ticket_types where event_id = $1", [ev])).length, 1);
});
await test("reserve_tickets: cantidades, propio evento, una reserva vigente por persona y tipo", async () => {
  const a = await persona("AsistenteA");
  const r = (await como(a, "select public.reserve_tickets($1, 2) r", [entrada]))[0].r;
  assert.deepEqual([r.qty, r.total, r.type, r.payment], [2, 25, "General", "pay_at_door"]);
  assert.match(r.code, /^[0-9A-F]{10}$/);
  assert.equal((await q("select sold from public.event_ticket_types where id = $1", [entrada]))[0].sold, 2);
  await falla(como(a, "select public.reserve_tickets($1, 1)", [entrada]), /Ya tienes una reserva/);
  assert.equal((await q("select sold from public.event_ticket_types where id = $1", [entrada]))[0].sold, 2, "el intento fallido no descuenta aforo");
  const b = await persona("AsistenteB");
  await falla(como(b, "select public.reserve_tickets($1, 5)", [entrada]), /agotadas, venta cerrada o cantidad no permitida/);
  await falla(como(b, "select public.reserve_tickets($1, 0)", [entrada]), /entre 1 y 20/);
  await falla(como(organizador, "select public.reserve_tickets($1, 1)", [entrada]), /propio evento/);
  await falla(como(null, "select public.reserve_tickets($1, 1)", [entrada]), /permission denied|No autenticado/);
});
await test("reservas: el aforo nunca se supera aunque lleguen 12 peticiones a la vez", async () => {
  const evento2 = await evento(organizador, orga.id, { titulo: "Taller de cerámica de aforo limitado", cat: "taller" });
  const tipo = (await como(organizador, "insert into public.event_ticket_types (event_id, name, price, quantity) values ($1, 'Cupo', 0, 5) returning id", [evento2]))[0].id;
  const gente = await Promise.all(Array.from({ length: 12 }, (_, i) => persona(`Concurrente${i}`)));
  const res = await Promise.allSettled(gente.map((u) => como(u, "select public.reserve_tickets($1, 1) r", [tipo])));
  const buenas = res.filter((r) => r.status === "fulfilled");
  assert.equal(buenas.length, 5, `se vendieron ${buenas.length}`);
  assert.ok(res.filter((r) => r.status === "rejected").every((r) => /agotadas/.test(r.reason.message)));
  assert.equal((await q("select sold from public.event_ticket_types where id = $1", [tipo]))[0].sold, 5);
  assert.equal((await q("select count(*)::int n from public.event_reservations where ticket_type_id = $1 and status = 'reserved'", [tipo]))[0].n, 5);
  assert.equal(new Set(buenas.map((r) => r.value[0].r.code)).size, 5, "códigos únicos");
  assert.equal(buenas[0].value[0].r.payment, "free", "las entradas gratuitas se marcan como tales");
  await falla(q("update public.event_ticket_types set quantity = 3 where id = $1", [tipo]), /sold|check/, "no se puede reducir por debajo de lo vendido");
  await como(organizador, "update public.event_ticket_types set quantity = 6 where id = $1", [tipo]);
  const extra = await persona("ExtraCupo");
  await como(extra, "select public.reserve_tickets($1, 1)", [tipo]);
  assert.equal((await q("select sold from public.event_ticket_types where id = $1", [tipo]))[0].sold, 6, "ampliar el aforo libera cupo");
});
await test("cancelar reserva devuelve el cupo; solo la persona que reservó; no si ya entró", async () => {
  const c = await persona("CancelaReserva");
  const antes = (await q("select sold from public.event_ticket_types where id = $1", [entrada]))[0].sold;
  const r = (await como(c, "select public.reserve_tickets($1, 1) r", [entrada]))[0].r;
  await falla(como(otro, "select public.cancel_reservation($1)", [r.id]), /No se puede cancelar/);
  await como(c, "select public.cancel_reservation($1)", [r.id]);
  assert.equal((await q("select sold from public.event_ticket_types where id = $1", [entrada]))[0].sold, antes);
  await falla(como(c, "select public.cancel_reservation($1)", [r.id]), /No se puede cancelar/);
  const nuevaReserva = (await como(c, "select public.reserve_tickets($1, 1) r", [entrada]))[0].r;
  assert.notEqual(nuevaReserva.code, r.code);
});
await test("check_in: solo el organizador, código sin distinguir mayúsculas, una sola vez", async () => {
  const d = await persona("AsistenteDoor");
  const r = (await como(d, "select public.reserve_tickets($1, 1) r", [entrada]))[0].r;
  const otroOrg = await persona("OtroOrganizador");
  await perfil(otroOrg, { vertical: "eventos", subtype: "teatro", name: "Otro Teatro" });
  await falla(como(otroOrg, "select public.check_in($1)", [r.code]), /Código no válido para tus eventos/);
  await falla(como(d, "select public.check_in($1)", [r.code]), /Código no válido para tus eventos/);
  const dentro = (await como(organizador, "select public.check_in($1) r", [` ${r.code.toLowerCase()} `]))[0].r;
  assert.deepEqual([dentro.qty, dentro.type, dentro.name], [1, "General", "AsistenteDoor"]);
  await falla(como(organizador, "select public.check_in($1)", [r.code]), /ya fue usada/);
  await falla(como(d, "select public.cancel_reservation($1)", [r.id]), /No se puede cancelar/);
  const cancelada = (await como(await persona("CancelaYEntra"), "select public.reserve_tickets($1, 1) r", [entrada]))[0].r;
  await q("update public.event_reservations set status = 'cancelled' where id = $1", [cancelada.id]);
  await falla(como(organizador, "select public.check_in($1)", [cancelada.code]), /fue cancelada/);
});
await test("reservas: privadas (persona y organizador); venta cerrada, evento cancelado o ya empezado", async () => {
  const e = await persona("VeReserva");
  const r = (await como(e, "select public.reserve_tickets($1, 1) r", [entrada]))[0].r;
  assert.equal((await como(e, "select id from public.event_reservations where id = $1", [r.id])).length, 1);
  assert.equal((await como(organizador, "select id from public.event_reservations where id = $1", [r.id])).length, 1);
  assert.equal((await como(otro, "select id from public.event_reservations where id = $1", [r.id])).length, 0);
  await falla(como(null, "select id from public.event_reservations"), /permission denied/);
  const ev3 = await evento(organizador, orga.id, { titulo: "Feria que se cancela" });
  const t3 = (await q("insert into public.event_ticket_types (event_id, name, price, quantity) values ($1, 'Feria', 5, 50) returning id", [ev3]))[0].id;
  await q("update public.event_ticket_types set sales_end = now() - interval '1 minute' where id = $1", [t3]);
  await falla(como(await persona("TardeVenta"), "select public.reserve_tickets($1, 1)", [t3]), /agotadas, venta cerrada/);
  await q("update public.event_ticket_types set sales_end = null where id = $1", [t3]);
  await q("update public.events set status = 'cancelled' where id = $1", [ev3]);
  await falla(como(await persona("EventoCancelado"), "select public.reserve_tickets($1, 1)", [t3]), /agotadas, venta cerrada/);
  assert.equal((await como(otro, "select id from public.events where id = $1", [ev3])).length, 0, "un evento cancelado ya no se ve");
  assert.equal((await como(organizador, "select id from public.events where id = $1", [ev3])).length, 1);
  await q("update public.events set status = 'published', starts_at = now() - interval '1 hour' where id = $1", [ev3]);
  await falla(como(await persona("YaEmpezo"), "select public.reserve_tickets($1, 1)", [t3]), /agotadas, venta cerrada/);
});
await test("interés en un evento: alterna y es privado", async () => {
  const i = await persona("Interesada");
  assert.equal((await como(i, "select public.toggle_event_interest($1) r", [ev]))[0].r, true);
  assert.equal((await como(i, "select event_id from public.event_interest"))[0].event_id, ev);
  assert.equal((await como(otro, "select event_id from public.event_interest")).length, 0);
  assert.equal((await como(i, "select public.toggle_event_interest($1) r", [ev]))[0].r, false);
  await falla(como(i, "select public.toggle_event_interest($1)", [randomUUID()]), /Evento inexistente/);
});
await test("límite de 30 eventos futuros por organizador", async () => {
  const org2 = await persona("OrganizadorMasivo");
  const p = await perfil(org2, { vertical: "eventos", subtype: "sala_de_conciertos", name: "Sala Masiva" });
  await q("insert into public.events (provider_id, title, category, starts_at) select $1, 'Función ' || g, 'concierto', now() + (g || ' days')::interval from generate_series(1, 30) g", [p.id]);
  await falla(evento(org2, p.id), /máximo 30 eventos futuros/);
});

// ── 7b. Eventos operables (update_009): cancelar, reprogramar y topes ────────
console.log("\nEventos operables (update_009)");
await test("cancel_event: solo el organizador; cancela las reservas vigentes y avisa a cada asistente", async () => {
  const orgB = await persona("OrganizadorB");
  const perfilB = await perfil(orgB, { vertical: "eventos", subtype: "teatro", name: "Teatro Central" });
  const evB = await evento(orgB, perfilB.id, { titulo: "Función de gala" });
  const tipoB = (await como(orgB, "insert into public.event_ticket_types (event_id, name, price, quantity) values ($1, 'Platea', 10, 20) returning id", [evB]))[0].id;
  const uno = await persona("AsistenteUno");
  const dos = await persona("AsistenteDos");
  const tres = await persona("AsistenteTres");
  await como(uno, "select public.reserve_tickets($1, 2)", [tipoB]);
  await como(dos, "select public.reserve_tickets($1, 1)", [tipoB]);
  const rTres = (await como(tres, "select public.reserve_tickets($1, 1) r", [tipoB]))[0].r;
  await como(tres, "select public.cancel_reservation($1)", [rTres.id]); // ya canceló por su cuenta: no se le avisa
  await falla(como(uno, "select public.cancel_event($1)", [evB]), /No se puede cancelar ese evento/);
  await falla(como(organizador, "select public.cancel_event($1)", [evB]), /No se puede cancelar ese evento/, "otro organizador no puede");
  await falla(como(null, "select public.cancel_event($1)", [evB]), /permission denied|No autenticado/);
  await falla(como(orgB, "select public.cancel_event($1)", [randomUUID()]), /No se puede cancelar ese evento/);
  const n = (await como(orgB, "select public.cancel_event($1) n", [evB]))[0].n;
  assert.equal(n, 2, "se avisa a quienes tenían reserva vigente");
  assert.equal((await q("select status from public.events where id = $1", [evB]))[0].status, "cancelled");
  const estados = (await q("select status, count(*)::int n from public.event_reservations where event_id = $1 group by status", [evB])).map((r) => [r.status, r.n]);
  assert.deepEqual(estados, [["cancelled", 3]]);
  const av = await avisos(uno, "event", evB);
  assert.equal(av.length, 1);
  assert.match(av[0].title, /Se canceló «Función de gala»/);
  assert.match(av[0].body, /2 entradas/);
  assert.equal(av[0].href, "/directorio/entradas");
  assert.match((await avisos(dos, "event", evB))[0].body, /1 entrada quedó/);
  assert.equal((await avisos(tres, "event", evB)).length, 0);
  assert.equal((await como(uno, "select id from public.events where id = $1", [evB])).length, 1, "quien tenía reserva sigue viendo el evento cancelado");
  assert.equal((await como(dos, "select title, status from public.events where id = $1", [evB]))[0].status, "cancelled");
  const ajeno = await persona("AjenoAlEvento");
  assert.equal((await como(ajeno, "select id from public.events where id = $1", [evB])).length, 0, "quien no reservó no ve un evento cancelado");
  assert.equal((await como(null, "select id from public.events where id = $1", [evB])).length, 0, "ni se ve sin sesión (y la política no falla para anónimos)");
  assert.equal((await como(orgB, "select id from public.events where id = $1", [evB])).length, 1, "el organizador siempre lo ve");
  await q("update public.events set status = 'review' where id = $1", [evB]);
  assert.equal((await como(uno, "select id from public.events where id = $1", [evB])).length, 0, "un evento oculto por moderación no se ve aunque hubiera reserva");
  await q("update public.events set status = 'cancelled' where id = $1", [evB]);
  await falla(como(orgB, "select public.cancel_event($1)", [evB]), /No se puede cancelar ese evento/, "no se cancela dos veces");
  const cuatro = await persona("AsistenteCuatro");
  await falla(como(cuatro, "select public.reserve_tickets($1, 1)", [tipoB]), /agotadas, venta cerrada/, "ya no se venden entradas");
});
await test("cambiar la fecha de un evento avisa a quienes tienen reserva vigente (y solo a ellos)", async () => {
  const orgC = await persona("OrganizadorC");
  const perfilC = await perfil(orgC, { vertical: "eventos", subtype: "organizador", name: "Cultura Viva" });
  const evC = await evento(orgC, perfilC.id, { titulo: "Taller de cerámica" });
  const tipoC = (await como(orgC, "insert into public.event_ticket_types (event_id, name, price, quantity) values ($1, 'Cupo', 0, 10) returning id", [evC]))[0].id;
  const con = await persona("ConReserva");
  const sin = await persona("SinReserva");
  const canc = await persona("Canceladora");
  await como(con, "select public.reserve_tickets($1, 1)", [tipoC]);
  const rc = (await como(canc, "select public.reserve_tickets($1, 1) r", [tipoC]))[0].r;
  await como(canc, "select public.cancel_reservation($1)", [rc.id]);
  await como(orgC, "update public.events set title = 'Taller de cerámica II' where id = $1", [evC]);
  assert.equal((await avisos(con, "event", evC)).length, 0, "cambiar otra cosa no avisa");
  await como(orgC, "update public.events set starts_at = now() + interval '20 days' where id = $1", [evC]);
  const av = await avisos(con, "event", evC);
  assert.equal(av.length, 1);
  assert.match(av[0].title, /Cambió la fecha de «Taller de cerámica II»/);
  assert.equal(av[0].href, "/directorio/entradas");
  assert.equal((await avisos(sin, "event", evC)).length, 0);
  assert.equal((await avisos(canc, "event", evC)).length, 0);
});
await test("create_service_request: tope de tamaño en los detalles y en el presupuesto", async () => {
  const p1 = await persona(`Topes${Math.random().toString(36).slice(2, 8)}`);
  await falla(solicitar(p1, { vertical: "hogar", subtype: "plomero", dest: "", details: { texto: "x".repeat(600) } }), /detalles de la solicitud son demasiado largos/);
  await falla(solicitar(p1, { vertical: "hogar", subtype: "plomero", dest: "", budget: 100000000 }), /presupuesto es demasiado alto/);
  await solicitar(p1, { vertical: "hogar", subtype: "plomero", dest: "", budget: 99999999.99, details: { urgente: true } });
  await solicitar(p1, { vertical: "hogar", subtype: "plomero", dest: "", title: "Otra reparación", details: { texto: "x".repeat(400) } });
});

// ── 7c. Paridad eventos y entradas ↔ servidor ────────────────────────────────
console.log("\nEventos: paridad con la base de datos");
const { CATEGORIAS_EVENTO, bloqueoReserva, borradorEventoVacio, codigoValido, filaActualizacionEvento, filaEntrada, filaEvento, mapearEvento, mapearTipoEntrada, validarEntrada, validarEvento } = await import("@/lib/directorio/eventos");
const insertarFila = (uid, tabla, fila) => {
  const cols = Object.keys(fila);
  return como(uid, `insert into public.${tabla} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(fila)).then((r) => r[0].id);
};
const enEcuadorEv = (ms) => new Date(ms - 5 * 3_600_000).toISOString().slice(0, 16); // valor de un datetime-local
const sufijo = () => Math.random().toString(36).slice(2, 9);
const orgP = await persona(`OrgParidad${sufijo()}`);
const perfilP = await perfil(orgP, { vertical: "eventos", subtype: "organizador", name: "Paridad Eventos" });
await test("PARIDAD: las 9 categorías de la interfaz son exactamente las que acepta la base", async () => {
  for (const c of CATEGORIAS_EVENTO) {
    const b = { ...borradorEventoVacio(perfilP.id), titulo: `Evento de ${c.id}`, categoria: c.id, lugar: "Sala", zona: "Centro", inicia: enEcuadorEv(Date.now() + 5 * 86_400_000) };
    assert.deepEqual(validarEvento(b, { nuevo: true }), {});
    await insertarFila(orgP, "events", filaEvento(b, null));
  }
  const b = { ...borradorEventoVacio(perfilP.id), titulo: "Categoría falsa", categoria: "inventada", lugar: "Sala", zona: "Centro", inicia: enEcuadorEv(Date.now() + 5 * 86_400_000) };
  await falla(insertarFila(orgP, "events", filaEvento(b, null)), /category|check/);
  assert.ok(validarEvento(b, { nuevo: true }).categoria);
  await q("delete from public.events where provider_id = $1", [perfilP.id]); // no acercarse al tope de 30 eventos futuros
});
await test("PARIDAD: si validarEvento() da el visto bueno el servidor acepta; si no, y la regla es del servidor, también rechaza", async () => {
  const ok = { ...borradorEventoVacio(perfilP.id), titulo: "Noche de jazz", categoria: "concierto", lugar: "Teatro Sucre", zona: "Centro", direccion: "Sucre y Borrero", inicia: enEcuadorEv(Date.now() + 3 * 86_400_000), termina: enEcuadorEv(Date.now() + 3 * 86_400_000 + 3 * 3_600_000), enlaceEntradas: "https://entradas.example.com/e" };
  const escenarios = [
    // [nombre, cambios, ¿la regla es también del servidor?]
    ["todo bien", {}, false],
    ["descripción de 2000 letras", { descripcion: "a".repeat(2000) }, false],
    ["sin fin", { termina: "" }, false],
    ["título corto", { titulo: "Ay" }, true],
    ["título de 121 letras", { titulo: "a".repeat(121) }, true],
    ["descripción de 2001 letras", { descripcion: "a".repeat(2001) }, true],
    ["lugar de 101 letras", { lugar: "a".repeat(101) }, true],
    ["dirección de 161 letras", { direccion: "a".repeat(161) }, true],
    ["zona de 81 letras", { zona: "a".repeat(81) }, true],
    ["fecha pasada", { inicia: enEcuadorEv(Date.now() - 86_400_000), termina: "" }, true],
    ["fin igual al inicio", { termina: null }, true],
    ["fin anterior al inicio", { termina: enEcuadorEv(Date.now() + 86_400_000) }, true],
    ["enlace http", { enlaceEntradas: "http://x.com/e" }, true],
    ["enlace con espacios", { enlaceEntradas: "https://x com/e" }, true],
    ["enlace sin protocolo", { enlaceEntradas: "x.com/e" }, true],
    ["sin lugar (la base lo admite)", { lugar: "" }, false],
    ["sin zona (la base lo admite)", { zona: "" }, false],
  ];
  for (const [nombre, cambios, delServidor] of escenarios) {
    const c = { ...cambios };
    if (c.termina === null) c.termina = ok.inicia;
    const b = { ...ok, ...c };
    const clienteRechaza = Object.keys(validarEvento(b, { nuevo: true })).length > 0;
    let servidorRechaza = false;
    try {
      await insertarFila(orgP, "events", filaEvento(b, null));
    } catch (e) {
      servidorRechaza = true;
      if (!clienteRechaza) throw new Error(`«${nombre}»: el cliente lo daba por bueno y el servidor lo rechazó (${e.message})`);
    }
    if (delServidor) assert.ok(servidorRechaza && clienteRechaza, `«${nombre}»: ambos deben rechazarlo (cliente ${clienteRechaza}, servidor ${servidorRechaza})`);
    await q("delete from public.events where provider_id = $1", [perfilP.id]);
  }
});
await test("PARIDAD: la edición envía solo columnas actualizables y el evento sigue siendo del mismo organizador", async () => {
  const b = { ...borradorEventoVacio(perfilP.id), titulo: "Feria de diseño", categoria: "feria", lugar: "Plaza", zona: "Centro", inicia: enEcuadorEv(Date.now() + 4 * 86_400_000) };
  const id = await insertarFila(orgP, "events", filaEvento(b, null));
  const cambio = { ...b, titulo: "Feria de diseño y arte", gratis: true, termina: enEcuadorEv(Date.now() + 4 * 86_400_000 + 5 * 3_600_000) };
  assert.deepEqual(validarEvento(cambio, { nuevo: false }), {});
  const fila = filaActualizacionEvento(cambio);
  const cols = Object.keys(fila);
  await como(orgP, `update public.events set ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")} where id = $1`, [id, ...Object.values(fila)]);
  const [ev] = await q("select title, is_free, provider_id, cover_url from public.events where id = $1", [id]);
  assert.deepEqual([ev.title, ev.is_free, ev.provider_id, ev.cover_url], ["Feria de diseño y arte", true, perfilP.id, null]);
  await q("delete from public.events where provider_id = $1", [perfilP.id]);
});
await test("PARIDAD: validarEntrada() y event_ticket_types coinciden en precio, cupo y máximo por persona", async () => {
  const evId = await evento(orgP, perfilP.id, { titulo: "Evento con entradas" });
  const ok = { nombre: "General", precio: "12.50", cupo: "100", maxPorPedido: "6", ventaHasta: "" };
  // Estos tres los frena solo el cliente: filaEntrada() los normaliza a 0 antes de llegar a la base.
  const soloCliente = ["precio negativo", "precio con 3 decimales", "precio no numérico"];
  const escenarios = [
    ["normal", {}], ["gratis", { precio: "0" }], ["precio con coma", { precio: "7,5" }], ["precio máximo", { precio: "999999.99" }], ["cupo máximo", { cupo: "100000" }], ["máximo por persona 20", { maxPorPedido: "20" }],
    ["nombre corto", { nombre: "A" }], ["nombre de 61", { nombre: "a".repeat(61) }], ["cupo cero", { cupo: "0" }], ["cupo excesivo", { cupo: "100001" }],
    ["por persona 0", { maxPorPedido: "0" }], ["por persona 21", { maxPorPedido: "21" }],
    ["precio negativo", { precio: "-1" }], ["precio con 3 decimales", { precio: "1.234" }], ["precio no numérico", { precio: "gratis" }],
  ];
  for (const [nombre, cambios] of escenarios) {
    const b = { ...ok, ...cambios };
    const clienteRechaza = Object.keys(validarEntrada(b)).length > 0;
    let servidorRechaza = false;
    let id;
    try {
      id = await insertarFila(orgP, "event_ticket_types", filaEntrada(b, evId));
    } catch (e) {
      servidorRechaza = true;
      if (!clienteRechaza) throw new Error(`«${nombre}»: el cliente lo daba por bueno y el servidor lo rechazó (${e.message})`);
    }
    if (soloCliente.includes(nombre)) assert.ok(clienteRechaza, `«${nombre}»: el cliente debe rechazarlo`);
    else assert.equal(servidorRechaza, clienteRechaza, `«${nombre}»: cliente ${clienteRechaza ? "rechaza" : "acepta"}, servidor ${servidorRechaza ? "rechaza" : "acepta"}`);
    if (id) await q("delete from public.event_ticket_types where id = $1", [id]);
  }
});
await test("PARIDAD: bloqueoReserva() y reserve_tickets() coinciden (cupo, máximo, cierre de venta, evento empezado o cancelado)", async () => {
  const escenarios = [
    // [nombre, {cupo, vendidas, max, ventaHasta, inicia, estado}, cantidad]
    ["reserva normal", { cupo: 10, vendidas: 0, max: 4 }, 2],
    ["justo lo que queda", { cupo: 10, vendidas: 8, max: 6 }, 2],
    ["más de lo permitido por persona", { cupo: 10, vendidas: 0, max: 4 }, 5],
    ["más de lo que queda", { cupo: 10, vendidas: 9, max: 6 }, 2],
    ["agotada", { cupo: 10, vendidas: 10, max: 6 }, 1],
    ["venta cerrada", { cupo: 10, vendidas: 0, max: 6, ventaHasta: "now() - interval '1 minute'" }, 1],
    ["venta abierta hasta mañana", { cupo: 10, vendidas: 0, max: 6, ventaHasta: "now() + interval '1 day'" }, 1],
    ["el evento ya empezó", { cupo: 10, vendidas: 0, max: 6, inicia: "now() - interval '1 hour'" }, 1],
    ["evento cancelado", { cupo: 10, vendidas: 0, max: 6, estado: "cancelled" }, 1],
    ["cantidad 0", { cupo: 10, vendidas: 0, max: 6 }, 0],
    ["cantidad 21", { cupo: 30, vendidas: 0, max: 20 }, 21],
    ["cantidad 20 con cupo", { cupo: 30, vendidas: 0, max: 20 }, 20],
  ];
  for (const [nombre, s, cantidad] of escenarios) {
    const evId = await evento(orgP, perfilP.id, { titulo: `Paridad ${nombre}`.slice(0, 60) });
    const tipoId = (await q(`insert into public.event_ticket_types (event_id, name, price, quantity, max_per_order, sales_end) values ($1, 'General', 9.99, $2, $3, ${s.ventaHasta ?? "null"}) returning id`, [evId, s.cupo, s.max]))[0].id;
    if (s.vendidas) await q("update public.event_ticket_types set sold = $2 where id = $1", [tipoId, s.vendidas]);
    if (s.inicia) await q(`update public.events set starts_at = ${s.inicia} where id = $1`, [evId]);
    if (s.estado) await q("update public.events set status = $2 where id = $1", [evId, s.estado]);
    const [fe] = await q("select * from public.events where id = $1", [evId]);
    const [ft] = await q("select * from public.event_ticket_types where id = $1", [tipoId]);
    const filaEv = { ...fe, starts_at: new Date(fe.starts_at).toISOString(), ends_at: null, created_at: new Date(fe.created_at).toISOString() };
    const clienteRechaza = bloqueoReserva(mapearTipoEntrada(ft), mapearEvento(filaEv), cantidad) !== null;
    const asistente = await persona(`Paridad${sufijo()}`);
    let servidorRechaza = false;
    try {
      await como(asistente, "select public.reserve_tickets($1, $2)", [tipoId, cantidad]);
    } catch {
      servidorRechaza = true;
    }
    assert.equal(servidorRechaza, clienteRechaza, `«${nombre}»: cliente ${clienteRechaza ? "rechaza" : "acepta"}, servidor ${servidorRechaza ? "rechaza" : "acepta"}`);
    if (!servidorRechaza) {
      const [r] = await q("select code, total from public.event_reservations where ticket_type_id = $1", [tipoId]);
      assert.ok(codigoValido(r.code), `el código ${r.code} no cumple el formato de la interfaz`);
      assert.equal(Number(r.total), Math.round(9.99 * 100 * cantidad) / 100, "total de la reserva");
    }
  }
});

// ── 8. Reseñas ──────────────────────────────────────────────────────────────
console.log("\nReseñas");
const resenar = (uid, prov, rating, comentario = "") => como(uid, "select public.review_provider($1, $2, $3)", [prov, rating, comentario]);
await test("reseñar exige haber contactado o contratado; la valoración se recalcula", async () => {
  const conocido = await persona("SoloChat");
  const nadie = await persona("SinRelacion");
  await falla(resenar(nadie, sabor.id, 5), /hayas contactado o contratado/);
  await falla(resenar(dueno, sabor.id, 5), /tu propio perfil/);
  await falla(resenar(null, sabor.id, 5), /permission denied|No autenticado/);
  // Nivel 1: una conversación con mensaje propio
  const chat = (await q("select public._ensure_chat('direct', $3, null, null, null, $1, $2, null) id", [conocido, dueno, `test:resena:${conocido}`]))[0].id;
  await falla(resenar(conocido, sabor.id, 4), /hayas contactado o contratado/, "un chat vacío no basta");
  await q("insert into public.messages (chat_id, sender_id, kind, body) values ($1, $2, 'text', 'Hola, ¿hasta qué hora atienden?')", [chat, conocido]);
  await resenar(conocido, sabor.id, 4, "Buena atención");
  let [r] = await q("select rating, verified_purchase, comment from public.provider_reviews where provider_id = $1 and author_id = $2", [sabor.id, conocido]);
  assert.deepEqual([r.rating, r.verified_purchase, r.comment], [4, false, "Buena atención"]);
  // Nivel 2: pedido entregado → compra verificada
  const comprador = await persona("CompradorReal");
  const p = await pedir(comprador, sabor.id, [{ item_id: ceviche, qty: 1 }]);
  await q("update public.orders set status = 'delivered' where id = $1", [p]);
  await resenar(comprador, sabor.id, 5, "Excelente");
  [r] = await q("select verified_purchase from public.provider_reviews where provider_id = $1 and author_id = $2", [sabor.id, comprador]);
  assert.equal(r.verified_purchase, true);
  const [pr] = await q("select rating, reviews_count from public.providers where id = $1", [sabor.id]);
  assert.deepEqual([Number(pr.rating), pr.reviews_count], [4.5, 2]);
  await resenar(conocido, sabor.id, 3, "Cambié de opinión");
  assert.equal(Number((await q("select rating from public.providers where id = $1", [sabor.id]))[0].rating), 4);
  assert.equal((await q("select count(*)::int n from public.provider_reviews where provider_id = $1", [sabor.id]))[0].n, 2, "una reseña por persona");
  await falla(resenar(comprador, sabor.id, 6), /rating|check/);
  await falla(resenar(comprador, sabor.id, 0), /rating|check/);
  await falla(como(comprador, "insert into public.provider_reviews (provider_id, author_id, rating) values ($1, $2, 5)", [sabor.id, comprador]), /permission denied/);
  assert.equal((await como(null, "select id from public.provider_reviews where provider_id = $1", [sabor.id])).length, 2, "las reseñas son públicas");
  await q("delete from public.provider_reviews where provider_id = $1", [sabor.id]);
  assert.deepEqual((await q("select rating, reviews_count from public.providers where id = $1", [sabor.id])).map((x) => [Number(x.rating), x.reviews_count])[0], [0, 0]);
});
await test("reseñar tras una transacción real: oferta aceptada o entrada usada cuentan como compra verificada", async () => {
  const nivel = async (a, p) => (await q("select public._interaction_level($1, $2) n", [a, p]))[0].n;
  const segundo = (await q("select p.id from public.providers p where p.name = 'Taxi Dos'"))[0].id;
  assert.equal(await nivel(pasajero, segundo), 2, "oferta aceptada");
  assert.equal(await nivel(pasajero, taxiV.id), 0, "oferta rechazada y sin mensajes propios: sin relación");
  const asistente = (await q("select user_id from public.event_reservations where status = 'checked_in' limit 1"))[0].user_id;
  assert.equal(await nivel(asistente, orga.id), 2, "entrada usada");
  assert.equal(await nivel(otro, orga.id), 0);
});

// ── 9. Denuncias y moderación ───────────────────────────────────────────────
console.log("\nDenuncias y moderación");
const moderador = await persona("Moderador", { admin: true });
const denunciantes = await Promise.all(Array.from({ length: 4 }, (_, i) => persona(`Denunciante${i}`)));
const objetivo = await perfil(await persona("DuenoDudoso"), { name: "Negocio Dudoso", zone: "ZonaDenuncia" });
const dueñoObjetivo = (await q("select owner_id from public.providers where id = $1", [objetivo.id]))[0].owner_id;
const denunciar = (uid, tipo, id, razon = "fraude") => como(uid, "select public.report_content($1, $2, $3, 'no cumple')", [tipo, id, razon]);
await test("denuncias: 3 personas distintas ocultan el perfil y avisan al dueño y a la moderación", async () => {
  await denunciar(denunciantes[0], "provider", objetivo.id);
  await denunciar(denunciantes[0], "provider", objetivo.id, "duplicado"); // la misma persona no suma
  await denunciar(denunciantes[1], "provider", objetivo.id);
  assert.equal((await q("select status from public.providers where id = $1", [objetivo.id]))[0].status, "active", "con 2 personas todavía visible");
  assert.equal((await q("select count(*)::int n from public.content_reports where target_id = $1", [objetivo.id]))[0].n, 2);
  await denunciar(denunciantes[2], "provider", objetivo.id);
  assert.equal(DENUNCIAS_PARA_OCULTAR, 3);
  assert.equal((await q("select status from public.providers where id = $1", [objetivo.id]))[0].status, "review");
  assert.equal((await como(otro, "select id from public.providers where id = $1", [objetivo.id])).length, 0);
  assert.equal((await como(dueñoObjetivo, "select id from public.providers where id = $1", [objetivo.id])).length, 1);
  assert.equal((await como(otro, "select id from public.search_providers('delivery', p_zone => 'ZonaDenuncia')")).length, 0);
  assert.equal((await avisos(dueñoObjetivo, "kind", "moderation")).length, 1);
  assert.ok((await avisos(moderador, "target", objetivo.id)).length === 1, "avisa a la moderación una sola vez");
  await denunciar(denunciantes[3], "provider", objetivo.id);
  assert.equal((await avisos(moderador, "target", objetivo.id)).length, 1, "una cuarta denuncia no vuelve a avisar");
  assert.equal((await como(dueñoObjetivo, "update public.providers set description = 'reabro' where id = $1 returning id", [objetivo.id])).length, 0, "en revisión no se edita");
});
await test("denuncias: no se denuncia lo propio ni lo inexistente; razón válida; solo se ven las propias", async () => {
  await falla(denunciar(dueñoObjetivo, "provider", objetivo.id), /tu propio contenido/);
  await falla(denunciar(denunciantes[0], "provider", randomUUID()), /Contenido inexistente/);
  await falla(denunciar(denunciantes[0], "provider", sabor.id, "me cae mal"), /reason|check/);
  await falla(denunciar(denunciantes[0], "cosa", sabor.id), /Contenido inexistente|check/);
  const propias = await como(denunciantes[0], "select reporter_id from public.content_reports");
  assert.ok(propias.length >= 1 && propias.every((r) => r.reporter_id === denunciantes[0]), "solo ve las suyas");
  assert.equal((await como(denunciantes[1], "select id from public.content_reports where reporter_id = $1", [denunciantes[0]])).length, 0);
  assert.ok((await como(moderador, "select id from public.content_reports")).length >= 4, "la moderación ve todas");
  await falla(como(denunciantes[0], "insert into public.content_reports (reporter_id, target_type, target_id, reason) values ($1, 'provider', $2, 'fraude')", [denunciantes[0], sabor.id]), /permission denied/);
});
await test("moderate_content: solo administradores; verificar, suspender y restaurar", async () => {
  await falla(como(dueñoObjetivo, "select public.moderate_content('provider', $1, 'restore')", [objetivo.id]), /Solo administradores/);
  await falla(como(otro, "select public.moderate_content('provider', $1, 'verify')", [sabor.id]), /Solo administradores/);
  await falla(como(moderador, "select public.moderate_content('provider', $1, 'explotar')", [sabor.id]), /Acción no válida/);
  await falla(como(moderador, "select public.moderate_content('foto', $1, 'restore')", [sabor.id]), /Tipo no válido/);
  await como(moderador, "select public.moderate_content('provider', $1, 'restore')", [objetivo.id]);
  assert.equal((await q("select status from public.providers where id = $1", [objetivo.id]))[0].status, "active");
  assert.equal((await q("select count(*)::int n from public.content_reports where target_id = $1 and status = 'open'", [objetivo.id]))[0].n, 0, "las denuncias quedan revisadas");
  await como(moderador, "select public.moderate_content('provider', $1, 'verify')", [objetivo.id]);
  assert.notEqual((await q("select verified_at from public.providers where id = $1", [objetivo.id]))[0].verified_at, null);
  await como(moderador, "select public.moderate_content('provider', $1, 'suspend')", [objetivo.id]);
  assert.equal((await como(otro, "select id from public.providers where id = $1", [objetivo.id])).length, 0);
  assert.equal((await como(dueñoObjetivo, "update public.providers set name = 'Sigo editando' where id = $1 returning id", [objetivo.id])).length, 0, "un perfil suspendido no se edita");
  await falla(como(dueñoObjetivo, "select public.set_provider_active($1, true)", [objetivo.id]), /No se puede cambiar/, "ni se reactiva por su cuenta");
  await como(moderador, "select public.moderate_content('provider', $1, 'unverify')", [objetivo.id]);
  await como(moderador, "select public.moderate_content('provider', $1, 'restore')", [objetivo.id]);
});
await test("denuncias también ocultan eventos, solicitudes y artículos", async () => {
  const evD = await evento(organizador, orga.id, { titulo: "Evento sospechoso" });
  for (const d of denunciantes.slice(0, 3)) await denunciar(d, "event", evD, "informacion_falsa");
  assert.equal((await q("select status from public.events where id = $1", [evD]))[0].status, "review");
  assert.equal((await como(otro, "select id from public.events where id = $1", [evD])).length, 0);
  await como(moderador, "select public.moderate_content('event', $1, 'restore')", [evD]);
  assert.equal((await q("select status from public.events where id = $1", [evD]))[0].status, "published");
  const solD = await solicitar(await persona("PasajeroDenunciado"), { title: "Solicitud sospechosa" });
  for (const d of denunciantes.slice(0, 3)) await denunciar(d, "request", solD);
  assert.equal((await q("select status from public.service_requests where id = $1", [solD]))[0].status, "closed");
  const artD = await articulo(sabor.id, "Producto engañoso", 1);
  for (const d of denunciantes.slice(0, 3)) await denunciar(d, "item", artD);
  assert.equal((await q("select available from public.provider_items where id = $1", [artD]))[0].available, false);
});

// ── 9b. Asistente de alta y editor: los MISMOS payloads que envía la interfaz ──
console.log("\nAsistente de alta y editor de «Mi negocio»");
const { borradorVacio, borradorDesdeProveedor, filaActualizacion, filaContacto, filaProveedor, filasItems, itemVacio, validarBorrador } = await import("@/lib/directorio/validacion");
const { instanteEcuador, presetHorario } = await import("@/lib/directorio/horarios");
const { mapearProveedor } = await import("@/lib/directorio/mapeo");
/** Inserta una fila como esa persona con las columnas que trae el objeto (así se prueban los privilegios por columna reales). */
const insertar = (uid, tabla, fila, retorno = "id") => como(uid, `insert into public.${tabla} (${Object.keys(fila).join(", ")}) values (${Object.keys(fila).map((_, i) => `$${i + 1}`).join(", ")}) returning ${retorno}`, Object.values(fila)).then((r) => r[0]);
const actualizar = (uid, tabla, fila, donde, params) => como(uid, `update public.${tabla} set ${Object.keys(fila).map((c, i) => `${c} = $${i + 1}`).join(", ")} where ${donde.replace(/\$(\d)/g, (_, n) => `$${Number(n) + Object.keys(fila).length}`)} returning *`, [...Object.values(fila), ...params]);
const borradorFarmacia = () => ({
  ...borradorVacio(), vertical: "salud", subtipo: "farmacia", nombre: "Farmacia San Roque", descripcion: "Medicinas, cuidado personal y entrega a domicilio en toda la zona norte.", zona: "Zona Norte",
  canales: ["local", "entrega"], costoEnvio: "1,5", pedidoMinimo: "3", telefono: "07 234 5678", whatsapp: "099 123 4567", direccion: "Av. Solano 1-23", horario: presetHorario("farmacia").horario,
  items: [
    { seccion: "Analgésicos", nombre: "Paracetamol 500 mg", descripcion: "Caja x 10", precio: "1,80", receta: false },
    { seccion: "Analgésicos", nombre: "Ibuprofeno 400 mg", descripcion: "", precio: "2.50", receta: false },
    { seccion: "Antibióticos", nombre: "Amoxicilina 500 mg", descripcion: "", precio: "6", receta: true },
    itemVacio(),
  ],
});
let farmaciaAlta;
await test("alta guiada de una farmacia: proveedor + contacto + catálogo, con los permisos por columna reales", async () => {
  const dueno_ = await persona("DuenoAltaFarmacia");
  const b = borradorFarmacia();
  assert.deepEqual(validarBorrador(b), {});
  const p = await insertar(dueno_, "providers", filaProveedor(b, dueno_, { logoUrl: "https://x/logo.png", portadaUrl: null }), "id, slug, status, channels, hours, delivery_fee, min_order, logo_url, cover_url");
  assert.match(p.slug, /^farmacia-san-roque-[0-9a-f]{6}$/);
  assert.deepEqual([p.status, p.channels, Number(p.delivery_fee), Number(p.min_order), p.logo_url, p.cover_url], ["active", ["local", "entrega"], 1.5, 3, "https://x/logo.png", null]);
  assert.deepEqual(p.hours.lun, [["08:00", "20:00"]]);
  assert.deepEqual(p.hours.dom, [["09:00", "13:00"]]);
  await insertar(dueno_, "provider_contacts", filaContacto(b, p.id), "provider_id");
  for (const fila of filasItems(b, p.id)) await insertar(dueno_, "provider_items", fila);
  farmaciaAlta = { uid: dueno_, id: p.id, slug: p.slug };
  const items = await como(null, "select name, kind, section, price, requires_prescription, sort_order from public.provider_items where provider_id = $1 order by sort_order", [p.id]);
  assert.deepEqual(items.map((i) => [i.name, i.kind, i.section, Number(i.price), i.requires_prescription]), [
    ["Paracetamol 500 mg", "product", "Analgésicos", 1.8, false], ["Ibuprofeno 400 mg", "product", "Analgésicos", 2.5, false], ["Amoxicilina 500 mg", "product", "Antibióticos", 6, true],
  ], "la fila vacía no se guarda y el orden se conserva");
  assert.deepEqual((await como(cliente, "select phone, whatsapp, address from public.provider_contacts where provider_id = $1", [p.id]))[0], { phone: "07 234 5678", whatsapp: "099 123 4567", address: "Av. Solano 1-23" });
});
await test("lo publicado es encontrable: listado, buscador universal y ficha por slug (como lo consulta la interfaz)", async () => {
  const lista = await como(null, "select id, verified, open_now, delivery_fee from public.search_providers('salud', p_zone => 'Zona Norte', p_q => 'san roque')");
  assert.deepEqual([lista.length, lista[0].id, lista[0].verified, Number(lista[0].delivery_fee)], [1, farmaciaAlta.id, false, 1.5]);
  const hits = await como(null, "select kind, item_name, requires_prescription from public.search_directory('amoxicilina', p_zone => 'Zona Norte')");
  assert.deepEqual(hits.map((h) => [h.kind, h.item_name, h.requires_prescription]), [["item", "Amoxicilina 500 mg", true]], "con receta: se lista para informar");
  const ficha = await como(null, "select id, name, vertical from public.providers where slug = $1 and vertical = $2", [farmaciaAlta.slug, "salud"]);
  assert.equal(ficha[0].name, "Farmacia San Roque");
  assert.equal((await como(null, "select id from public.providers where slug = $1 and vertical = $2", [farmaciaAlta.slug, "delivery"])).length, 0, "el slug solo vale en su sección");
  await falla(como(farmaciaAlta.uid, "select public.place_order($1, 'delivery', $2::jsonb, 'Calle 1 y 2', 'Centro', '', 'cash')", [farmaciaAlta.id, JSON.stringify([{ item_id: randomUUID(), qty: 1 }])]), /a ti mismo/);
});
await test("alta de un restaurante: menú con precios decimales, canales y horario de restaurante", async () => {
  const d = await persona("DuenoAltaRestaurante");
  const b = { ...borradorVacio(), vertical: "delivery", subtipo: "restaurante", nombre: "Sabor Cuencano 2", zona: "Centro", canales: ["local", "entrega", "retiro"], costoEnvio: "", pedidoMinimo: "", whatsapp: "0991234567", direccion: "Calle Larga 5-10", horario: presetHorario("restaurante").horario, items: [{ seccion: "Bebidas", nombre: "Jugo de naranjilla", descripcion: "", precio: "2", receta: false }] };
  assert.deepEqual(validarBorrador(b), {});
  const p = await insertar(d, "providers", filaProveedor(b, d), "id, delivery_fee, min_order, hours");
  assert.deepEqual([Number(p.delivery_fee), Number(p.min_order), p.hours.sab.length], [0, 0, 2], "sin costo indicado: envío gratis y sin mínimo; almuerzo y cena");
  await insertar(d, "provider_contacts", filaContacto(b, p.id), "provider_id");
  const [item] = filasItems(b, p.id);
  assert.equal((await insertar(d, "provider_items", item, "kind")).kind, "menu_item");
  const rx = { ...b, items: [{ ...itemVacio(), nombre: "Sopa", precio: "3", receta: true }] };
  await falla(insertar(d, "provider_items", filasItems(rx, p.id)[0]), /solo aplica a Salud/, "la validación del cliente ya lo evita; el servidor también");
});
await test("editor: cambios de datos, horario, contacto y catálogo con las columnas actualizables; sección y verificación no se tocan", async () => {
  const [fila] = await q("select * from public.providers where id = $1", [farmaciaAlta.id]);
  const prov = mapearProveedor(fila);
  const b = { ...borradorDesdeProveedor(prov, { whatsapp: "099 123 4567", telefono: "07 234 5678", direccion: "Av. Solano 1-23" }), nombre: "Farmacia San Roque Norte", costoEnvio: "2", abierto24h: true };
  const [nuevo] = await actualizar(farmaciaAlta.uid, "providers", filaActualizacion(b, { logoUrl: null }), "id = $1", [farmaciaAlta.id]);
  assert.deepEqual([nuevo.name, Number(nuevo.delivery_fee), nuevo.open_24h, nuevo.hours, nuevo.logo_url, nuevo.slug], ["Farmacia San Roque Norte", 2, true, {}, null, farmaciaAlta.slug], "el slug no cambia al renombrar");
  const [contacto] = await actualizar(farmaciaAlta.uid, "provider_contacts", { phone: "07 999 8888", whatsapp: null, address: "Otra dirección 45" }, "provider_id = $1", [farmaciaAlta.id]);
  assert.deepEqual([contacto.phone, contacto.whatsapp, contacto.address], ["07 999 8888", null, "Otra dirección 45"]);
  const [item] = await q("select id from public.provider_items where provider_id = $1 and name = 'Paracetamol 500 mg'", [farmaciaAlta.id]);
  const [cambiado] = await actualizar(farmaciaAlta.uid, "provider_items", { name: "Paracetamol 500 mg x 20", price: 3.2, section: "Dolor" }, "id = $1", [item.id]);
  assert.deepEqual([cambiado.name, Number(cambiado.price), cambiado.section], ["Paracetamol 500 mg x 20", 3.2, "Dolor"]);
  assert.equal((await actualizar(farmaciaAlta.uid, "provider_items", { available: false }, "id = $1", [item.id]))[0].available, false);
  assert.equal((await como(farmaciaAlta.uid, "delete from public.provider_items where id = $1 returning id", [item.id])).length, 1);
  await falla(actualizar(farmaciaAlta.uid, "providers", { vertical: "delivery" }, "id = $1", [farmaciaAlta.id]), /permission denied/);
  await falla(actualizar(farmaciaAlta.uid, "providers", { verified_at: new Date().toISOString() }, "id = $1", [farmaciaAlta.id]), /permission denied/);
  assert.equal((await actualizar(otro, "providers", { name: "Robada" }, "id = $1", [farmaciaAlta.id])).length, 0, "nadie más edita");
  assert.equal((await actualizar(otro, "provider_items", { price: 0.01 }, "provider_id = $1", [farmaciaAlta.id])).length, 0);
});
await test("turnos desde el editor: fechas en hora de Ecuador; el negocio aparece «de turno» mientras dura", async () => {
  const d = farmaciaAlta.uid;
  const ahora = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const turno = { provider_id: farmaciaAlta.id, starts_at: iso(ahora - 3_600_000), ends_at: iso(ahora + 5 * 3_600_000), note: "Turno nocturno" };
  await insertar(d, "provider_duty_shifts", turno);
  const [bus] = await como(cliente, "select on_duty, verified from public.search_providers('salud', p_zone => 'Zona Norte', p_on_duty => true)");
  assert.deepEqual([bus.on_duty, bus.verified], [true, false], "de turno pero sin verificar: se muestra como turno declarado");
  await q("update public.providers set verified_at = now() where id = $1", [farmaciaAlta.id]);
  assert.equal((await como(cliente, "select id from public.search_providers('salud', p_zone => 'Zona Norte', p_on_duty => true)"))[0].id, farmaciaAlta.id);
  assert.equal(instanteEcuador("2026-06-01T20:00"), "2026-06-02T01:00:00.000Z", "lo que guarda el editor");
  await falla(insertar(d, "provider_duty_shifts", { ...turno, ends_at: iso(ahora + 60 * 3_600_000) }), /ends_at|check/, "más de 48 horas: lo rechaza el servidor");
});
await test("visibilidad y borrado desde «Mi negocio»: pausar oculta, eliminar borra en cascada", async () => {
  const d = await persona("DuenoBorrado");
  const b = { ...borradorFarmacia(), nombre: "Farmacia Efímera" };
  const p = await insertar(d, "providers", filaProveedor(b, d), "id, slug");
  await insertar(d, "provider_contacts", filaContacto(b, p.id), "provider_id");
  for (const fila of filasItems(b, p.id)) await insertar(d, "provider_items", fila);
  await como(d, "select public.set_provider_active($1, false)", [p.id]);
  assert.equal((await como(null, "select id from public.providers where id = $1", [p.id])).length, 0);
  assert.equal((await como(d, "select id from public.providers where owner_id = $1", [d])).length, 1, "el panel lo sigue mostrando a su dueño");
  assert.equal((await como(d, "delete from public.providers where id = $1 returning id", [p.id])).length, 1);
  assert.equal((await q("select (select count(*) from public.provider_items where provider_id = $1) + (select count(*) from public.provider_contacts where provider_id = $1) n", [p.id]))[0].n, "0", "sin restos");
});

// ── 10. Migración ───────────────────────────────────────────────────────────
console.log("\nMigración");
await test("MIGRACIÓN: update_006 sobre una base con 005 (dos veces) conserva datos y deja todo operativo", async () => {
  const completo = fs.readFileSync(esquema, "utf8").replace(/\r\n/g, "\n");
  const ini = completo.indexOf("-- ACTUALIZACION-006-INICIO");
  const fin = completo.indexOf("-- ACTUALIZACION-006-FIN");
  assert.ok(ini > 0 && fin > ini, "faltan los marcadores de la actualización 006 en schema.sql");
  const actualizacion = fs.readFileSync(path.join(aqui, "..", "update_006_directorios.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(completo.slice(completo.indexOf("\n", ini) + 1, fin).trim(), actualizacion.trim(), "schema.sql y update_006 difieren");
  await server.createDatabase("migracion6");
  const m = new pg.Client({ ...conn, database: "migracion6" });
  await m.connect();
  m.on("notice", () => {});
  try {
    await m.query(fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8").replace(/^create role .*$/gm, ""));
    await m.query(completo.slice(0, ini)); // esquema base + 002 + 003 + 004 + 005
    await m.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'previo@test.dev', '{\"full_name\":\"Previo\"}')");
    const uid = (await m.query("select id from auth.users")).rows[0].id;
    await m.query(actualizacion);
    await m.query(actualizacion); // idempotente
    const tablas = (await m.query("select count(*)::int n from information_schema.tables where table_schema = 'public' and table_name in ('providers','provider_contacts','provider_items','provider_duty_shifts','orders','order_lines','service_requests','service_offers','events','event_ticket_types','event_reservations','event_interest','provider_reviews','content_reports')")).rows[0].n;
    assert.equal(tablas, 14);
    const fns = (await m.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('place_order','set_order_status','create_service_request','send_offer','accept_offer','withdraw_offer','close_service_request','reserve_tickets','cancel_reservation','check_in','toggle_event_interest','review_provider','report_content','moderate_content','set_provider_active','search_providers','directory_counts')")).rows[0].n;
    assert.equal(fns, 17);
    assert.equal((await m.query("select count(*)::int n from pg_trigger where not tgisinternal and tgname in ('providers_prepare','providers_reward','provider_items_prepare','duty_shifts_prepare','events_prepare','provider_reviews_recalc')")).rows[0].n, 6, "sin disparadores duplicados");
    assert.equal((await m.query("select count(*)::int n from pg_policies where tablename = 'providers'")).rows[0].n, 4, "sin políticas duplicadas");
    await m.query("begin");
    await m.query("set local role authenticated");
    await m.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    const p = (await m.query("insert into public.providers (owner_id, vertical, subtype, name) values ($1, 'hogar', 'cerrajero', 'Cerrajería 24h') returning slug", [uid])).rows[0];
    assert.match(p.slug, /^cerrajeria-24h-[0-9a-f]{6}$/);
    const r = (await m.query("select count(*)::int n from public.search_providers('hogar')")).rows[0].n;
    assert.equal(r, 1);
    await m.query("rollback");
  } finally {
    await m.end();
  }
});

await test("MIGRACIÓN: update_007 sobre una base con 006 (dos veces) conserva perfiles y activa el buscador universal", async () => {
  const completo = fs.readFileSync(esquema, "utf8").replace(/\r\n/g, "\n");
  const ini = completo.indexOf("-- ACTUALIZACION-007-INICIO");
  const fin = completo.indexOf("-- ACTUALIZACION-007-FIN");
  assert.ok(ini > 0 && fin > ini, "faltan los marcadores de la actualización 007 en schema.sql");
  const actualizacion = fs.readFileSync(path.join(aqui, "..", "update_007_buscador_universal.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(completo.slice(completo.indexOf("\n", ini) + 1, fin).trim(), actualizacion.trim(), "schema.sql y update_007 difieren");
  await server.createDatabase("migracion7");
  const m = new pg.Client({ ...conn, database: "migracion7" });
  await m.connect();
  m.on("notice", () => {});
  try {
    await m.query(fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8").replace(/^create role .*$/gm, ""));
    await m.query(completo.slice(0, ini)); // esquema base + 002 … + 006
    await m.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'previo7@test.dev', '{\"full_name\":\"Previo\"}')");
    const uid = (await m.query("select id from auth.users")).rows[0].id;
    const prov = (await m.query("insert into public.providers (owner_id, vertical, subtype, name, description, zone) values ($1, 'salud', 'farmacia', 'Farmacia Previa', 'Desde antes', 'Centro') returning id", [uid])).rows[0].id;
    await m.query("insert into public.provider_items (provider_id, kind, name, price) values ($1, 'product', 'Suero oral', 2.5)", [prov]);
    await m.query(actualizacion);
    await m.query(actualizacion); // idempotente
    assert.equal((await m.query("select count(*)::int n from public.providers")).rows[0].n, 1, "los perfiles previos se conservan");
    assert.equal((await m.query("select count(*)::int n from pg_indexes where indexname in ('providers_name_norm_trgm_idx', 'provider_items_name_norm_trgm_idx')")).rows[0].n, 2);
    assert.equal((await m.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('search_directory', 'search_providers', '_like_pattern')")).rows[0].n, 3, "una sola search_providers");
    const r = (await m.query("select kind, item_name, item_price from public.search_directory('SUERO')")).rows;
    assert.deepEqual(r.map((x) => [x.kind, x.item_name, Number(x.item_price)]), [["item", "Suero oral", 2.5]]);
    assert.equal((await m.query("select count(*)::int n from public.search_providers('salud', p_q => 'farmacia previa')")).rows[0].n, 1);
  } finally {
    await m.end();
  }
});

await test("MIGRACIÓN: update_008 sobre una base con 007 (dos veces) conserva pedidos, sustituye place_order y no toca lo demás", async () => {
  const completo = fs.readFileSync(esquema, "utf8").replace(/\r\n/g, "\n");
  const ini = completo.indexOf("-- ACTUALIZACION-008-INICIO");
  const fin = completo.indexOf("-- ACTUALIZACION-008-FIN");
  assert.ok(ini > 0 && fin > ini, "faltan los marcadores de la actualización 008 en schema.sql");
  const actualizacion = fs.readFileSync(path.join(aqui, "..", "update_008_pedidos.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(completo.slice(completo.indexOf("\n", ini) + 1, fin).trim(), actualizacion.trim(), "schema.sql y update_008 difieren");
  await server.createDatabase("migracion8");
  const m = new pg.Client({ ...conn, database: "migracion8" });
  await m.connect();
  m.on("notice", () => {});
  try {
    await m.query(fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8").replace(/^create role .*$/gm, ""));
    await m.query(completo.slice(0, ini)); // esquema base + 002 … + 007
    await m.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'due8@test.dev', '{\"full_name\":\"Dueno Ocho\"}'), (gen_random_uuid(), 'cli8@test.dev', '{\"full_name\":\"Cliente Ocho\"}')");
    const [dueno8, cliente8] = (await m.query("select id from auth.users order by email")).rows.map((r) => r.id);
    const prov = (await m.query("insert into public.providers (owner_id, vertical, subtype, name, channels) values ($1, 'delivery', 'restaurante', 'Resto Ocho', '{local,entrega}') returning id", [dueno8])).rows[0].id;
    const item = (await m.query("insert into public.provider_items (provider_id, kind, name, price) values ($1, 'menu_item', 'Sopa', 4) returning id", [prov])).rows[0].id;
    // Un pedido hecho con la función de la 006 (sin teléfono)
    await m.query("begin");
    await m.query("set local role authenticated");
    await m.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: cliente8, role: "authenticated" })]);
    const previo = (await m.query("select public.place_order($1, 'delivery', $2::jsonb, 'Calle 1 y 2', 'Centro', '', 'cash') id", [prov, JSON.stringify([{ item_id: item, qty: 1 }])])).rows[0].id;
    await m.query("commit");
    await m.query(actualizacion);
    await m.query(actualizacion); // idempotente
    assert.deepEqual((await m.query("select status, customer_phone, total from public.orders where id = $1", [previo])).rows.map((o) => [o.status, o.customer_phone, Number(o.total)])[0], ["placed", null, 4], "el pedido previo se conserva");
    assert.equal((await m.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname = 'place_order'")).rows[0].n, 1, "una sola place_order (la de 7 parámetros se elimina)");
    assert.equal((await m.query("select pronargs from pg_proc where proname = 'place_order'")).rows[0].pronargs, 8);
    await m.query("begin");
    await m.query("set local role authenticated");
    await m.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: cliente8, role: "authenticated" })]);
    const nuevo = (await m.query("select public.place_order($1, 'delivery', $2::jsonb, 'Calle 1 y 2', 'Centro', '', 'cash', '099 111 2222') id", [prov, JSON.stringify([{ item_id: item, qty: 2 }])])).rows[0].id;
    await m.query("commit");
    assert.equal((await m.query("select customer_phone from public.orders where id = $1", [nuevo])).rows[0].customer_phone, "099 111 2222");
    assert.match((await m.query("select href from public.notifications where user_id = $1 and data ->> 'order' = $2", [dueno8, nuevo])).rows[0].href, /^\/directorio\/pedidos\//);
  } finally {
    await m.end();
  }
});

await test("MIGRACIÓN: update_009 sobre una base con 008 (dos veces) conserva eventos y reservas, y añade cancel_event y los topes", async () => {
  const completo = fs.readFileSync(esquema, "utf8").replace(/\r\n/g, "\n");
  const ini = completo.indexOf("-- ACTUALIZACION-009-INICIO");
  const fin = completo.indexOf("-- ACTUALIZACION-009-FIN");
  assert.ok(ini > 0 && fin > ini, "faltan los marcadores de la actualización 009 en schema.sql");
  const actualizacion = fs.readFileSync(path.join(aqui, "..", "update_009_eventos.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(completo.slice(completo.indexOf("\n", ini) + 1, fin).trim(), actualizacion.trim(), "schema.sql y update_009 difieren");
  await server.createDatabase("migracion9");
  const m = new pg.Client({ ...conn, database: "migracion9" });
  await m.connect();
  m.on("notice", () => {});
  const como9 = async (uid, sql, params = []) => {
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
    await m.query(completo.slice(0, ini)); // esquema base + 002 … + 008
    await m.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'org9@test.dev', '{\"full_name\":\"Organizador Nueve\"}'), (gen_random_uuid(), 'asi9@test.dev', '{\"full_name\":\"Asistente Nueve\"}')");
    const [org9, asi9] = (await m.query("select id from auth.users order by email")).rows.map((r) => r.id);
    const prov = (await m.query("insert into public.providers (owner_id, vertical, subtype, name) values ($1, 'eventos', 'organizador', 'Org Nueve') returning id", [org9])).rows[0].id;
    const ev = (await m.query("insert into public.events (provider_id, title, category, starts_at) values ($1, 'Feria del libro', 'feria', now() + interval '5 days') returning id", [prov])).rows[0].id;
    const tipo = (await m.query("insert into public.event_ticket_types (event_id, name, price, quantity) values ($1, 'General', 3, 50) returning id", [ev])).rows[0].id;
    await como9(asi9, "select public.reserve_tickets($1, 2)", [tipo]);
    assert.equal((await m.query("select count(*)::int n from pg_proc where proname = 'cancel_event'")).rows[0].n, 0, "antes de la 009 no existe cancel_event");
    await m.query(actualizacion);
    await m.query(actualizacion); // idempotente
    assert.equal((await m.query("select count(*)::int n from pg_proc where proname = 'cancel_event'")).rows[0].n, 1);
    assert.equal((await m.query("select count(*)::int n from pg_proc where proname = 'create_service_request'")).rows[0].n, 1, "una sola create_service_request");
    assert.equal((await m.query("select count(*)::int n from pg_trigger where tgname = 'events_reschedule_notice' and not tgisinternal")).rows[0].n, 1);
    assert.equal((await m.query("select count(*)::int n from pg_proc where proname = '_has_reservation_on'")).rows[0].n, 1);
    assert.equal((await m.query("select sold from public.event_ticket_types where id = $1", [tipo])).rows[0].sold, 2, "las ventas previas se conservan");
    assert.equal((await como9(org9, "select public.cancel_event($1) n", [ev]))[0].n, 1);
    assert.equal((await m.query("select status from public.event_reservations where event_id = $1", [ev])).rows[0].status, "cancelled");
    await assert.rejects(como9(asi9, "select public.create_service_request('hogar', 'plomero', 'Arreglo urgente', '', 'Centro', '', 'today', null, null, $1::jsonb)", [JSON.stringify({ t: "x".repeat(600) })]), /demasiado largos/);
  } finally {
    await m.end();
  }
});

// ── Geolocalización e internacionalización (update_012) ─────────────────────
console.log("\nGeolocalización (update_012)");
await test("set_my_location: valida, redondea a ~1 km y guarda el país en el perfil (público) y el punto en user_private (privado)", async () => {
  const ana = await persona("GeoAna");
  const beto = await persona("GeoBeto");
  await como(ana, "select public.set_my_location('EC', 'Cuenca', -2.90123456, -79.00589123, 'America/Guayaquil')");
  const [priv] = await como(ana, "select city, lat, lng, timezone, geo_updated from public.user_private where user_id = $1", [ana]);
  assert.deepEqual([priv.city, Number(priv.lat), Number(priv.lng), priv.timezone], ["Cuenca", -2.9, -79.01, "America/Guayaquil"], "guarda 2 decimales aunque el cliente envíe más");
  assert.ok(priv.geo_updated);
  // El país es público (solo dice el país); el punto y la ciudad no los lee nadie más.
  assert.equal((await como(beto, "select country from public.profiles where id = $1", [ana]))[0].country, "EC");
  assert.equal((await como(beto, "select lat from public.user_private where user_id = $1", [ana])).length, 0, "otra persona no ve la ubicación");
  assert.equal((await como(null, "select country from public.profiles where id = $1", [ana]))[0].country, "EC");
  await falla(como(null, "select lat from public.user_private"), /permission denied/);
  // Cambiar de ciudad reemplaza, no acumula
  await como(ana, "select public.set_my_location('ES', 'Madrid', 40.4201, -3.7043, 'Europe/Madrid')");
  const [madrid] = await q("select p.country, u.city, u.lat, u.lng, u.timezone from public.profiles p join public.user_private u on u.user_id = p.id where p.id = $1", [ana]);
  assert.deepEqual([madrid.country, madrid.city, Number(madrid.lat), Number(madrid.lng), madrid.timezone], ["ES", "Madrid", 40.42, -3.7, "Europe/Madrid"]);
  // Sin ciudad: queda nula
  await como(ana, "select public.set_my_location('CO', '   ', 4.7110, -74.0721, 'America/Bogota')");
  assert.equal((await q("select city from public.user_private where user_id = $1", [ana]))[0].city, null);
});
await test("set_my_location: rechaza sesión ausente, país, coordenadas, zona y ciudad no válidos; nadie escribe la ubicación por otra vía", async () => {
  const ana = await persona("GeoValida");
  const llamar = (uid, ...a) => como(uid, "select public.set_my_location($1, $2, $3, $4, $5)", a);
  await falla(llamar(null, "EC", "Cuenca", -2.9, -79, "America/Guayaquil"), /permission denied|No autenticado/);
  await falla(llamar(ana, "ec", "Cuenca", -2.9, -79, "America/Guayaquil"), /País no válido/);
  await falla(llamar(ana, "ECU", "Cuenca", -2.9, -79, "America/Guayaquil"), /País no válido/);
  await falla(llamar(ana, null, "Cuenca", -2.9, -79, "America/Guayaquil"), /País no válido/);
  await falla(llamar(ana, "EC", "Cuenca", 91, -79, "America/Guayaquil"), /Coordenadas no válidas/);
  await falla(llamar(ana, "EC", "Cuenca", -2.9, 181, "America/Guayaquil"), /Coordenadas no válidas/);
  await falla(llamar(ana, "EC", "Cuenca", null, null, "America/Guayaquil"), /Coordenadas no válidas/);
  await falla(llamar(ana, "EC", "Cuenca", -2.9, -79, "<script>"), /Zona horaria no válida/);
  await falla(llamar(ana, "EC", "Cuenca", -2.9, -79, null), /Zona horaria no válida/);
  await falla(llamar(ana, "EC", "x".repeat(61), -2.9, -79, "America/Guayaquil"), /máximo 60/);
  assert.equal((await q("select lat from public.user_private where user_id = $1", [ana]))[0].lat, null, "nada se guardó");
  // Las columnas nuevas no se escriben directamente: solo por la función (que valida y redondea)
  await falla(como(ana, "update public.user_private set lat = -2.901234 where user_id = $1", [ana]), /permission denied/);
  await falla(como(ana, "update public.user_private set timezone = 'X/Y' where user_id = $1", [ana]), /permission denied/);
  await falla(como(ana, "update public.profiles set country = 'CO' where id = $1", [ana]), /permission denied/);
  await falla(como(null, "select public.clear_my_location()"), /permission denied|No autenticado/);
});
await test("clear_my_location: borra el país y la ubicación de quien la llama y de nadie más", async () => {
  const ana = await persona("GeoBorra");
  const beto = await persona("GeoQueda");
  await como(ana, "select public.set_my_location('PE', 'Lima', -12.0464, -77.0428, 'America/Lima')");
  await como(beto, "select public.set_my_location('MX', 'Ciudad de México', 19.4326, -99.1332, 'America/Mexico_City')");
  await como(ana, "select public.clear_my_location()");
  const [a] = await q("select p.country, u.city, u.lat, u.lng, u.timezone, u.geo_updated from public.profiles p join public.user_private u on u.user_id = p.id where p.id = $1", [ana]);
  assert.deepEqual(Object.values(a), [null, null, null, null, null, null]);
  const [b] = await q("select p.country, u.city, u.timezone from public.profiles p join public.user_private u on u.user_id = p.id where p.id = $1", [beto]);
  assert.deepEqual(Object.values(b), ["MX", "Ciudad de México", "America/Mexico_City"]);
  await como(ana, "select public.clear_my_location()"); // repetirlo no falla
});
await test("providers.country: por defecto EC, se fija al crear y al editar, con formato válido; no lo cambia otra persona", async () => {
  const dueno = await persona("DuenoPais");
  const otro = await persona("OtroPais");
  const porDefecto = await perfil(dueno, { name: "Sin país", subtype: "restaurante" });
  assert.equal((await q("select country from public.providers where id = $1", [porDefecto.id]))[0].country, "EC");
  const bogota = await perfil(dueno, { name: "Arepas de Bogotá", country: "CO", city: "Bogotá", lat: 4.711, lng: -74.072 });
  assert.equal((await q("select country from public.providers where id = $1", [bogota.id]))[0].country, "CO");
  await como(dueno, "update public.providers set country = 'PE', city = 'Lima' where id = $1", [bogota.id]);
  assert.equal((await q("select country from public.providers where id = $1", [bogota.id]))[0].country, "PE");
  await falla(perfil(dueno, { name: "Mal país", country: "colombia" }), /violates check|providers_country_check/);
  await falla(perfil(dueno, { name: "Mal país 2", country: "C" }), /violates check|providers_country_check/);
  assert.equal((await como(otro, "update public.providers set country = 'MX' where id = $1 returning id", [bogota.id])).length, 0, "una persona ajena no edita el negocio");
  assert.equal((await q("select country from public.providers where id = $1", [bogota.id]))[0].country, "PE");
});
await test("search_providers: p_country filtra por país, sin p_country lista todos, y con p_lat/p_lng ordena por cercanía con la distancia", async () => {
  const d = await persona("BuscaPais");
  const nombre = (s) => `${s} ${randomUUID().slice(0, 4)}`;
  const lejos = await perfil(d, { name: nombre("Lejos Quito"), subtype: "restaurante", country: "EC", city: "Quito", lat: -0.1807, lng: -78.4678 });
  const cerca = await perfil(d, { name: nombre("Cerca Cuenca"), subtype: "restaurante", country: "EC", city: "Cuenca", lat: -2.9001, lng: -79.0059 });
  const medio = await perfil(d, { name: nombre("Medio Loja"), subtype: "restaurante", country: "EC", city: "Loja", lat: -3.9931, lng: -79.2042 });
  const sinPunto = await perfil(d, { name: nombre("Sin punto"), subtype: "restaurante", country: "EC" });
  const colombia = await perfil(d, { name: nombre("Bogotá Sabor"), subtype: "restaurante", country: "CO", city: "Bogotá", lat: 4.711, lng: -74.072 });
  const buscar = (extra) => como(null, "select id, distance_km from public.search_providers('delivery', p_subtype => 'restaurante', p_country => $1, p_lat => $2, p_lng => $3, p_limit => 60)", [extra.pais ?? null, extra.lat ?? null, extra.lng ?? null]);
  const ids = (filas) => filas.map((f) => f.id);
  const ecuador = await buscar({ pais: "EC", lat: -2.9, lng: -79.0 });
  assert.ok(!ids(ecuador).includes(colombia.id), "los negocios de otro país no salen");
  const orden = ids(ecuador).filter((id) => [cerca.id, medio.id, lejos.id, sinPunto.id].includes(id));
  assert.deepEqual(orden, [cerca.id, medio.id, lejos.id, sinPunto.id], "de más cerca a más lejos y los que no tienen punto al final");
  const dist = Object.fromEntries(ecuador.map((f) => [f.id, f.distance_km === null ? null : Number(f.distance_km)]));
  assert.ok(dist[cerca.id] < 2 && dist[medio.id] > 100 && dist[medio.id] < 160 && dist[lejos.id] > 280 && dist[lejos.id] < 330, JSON.stringify(dist));
  assert.equal(dist[sinPunto.id], null);
  assert.deepEqual(ids(await buscar({ pais: "CO" })).filter((id) => [cerca.id, lejos.id, colombia.id].includes(id)), [colombia.id]);
  assert.equal(ids(await buscar({ pais: "ZZ" })).length, 0, "un país sin negocios devuelve una lista vacía");
  const todos = ids(await buscar({}));
  assert.ok([cerca.id, colombia.id].every((id) => todos.includes(id)), "sin país no se filtra");
  // La firma anterior (12 argumentos) ya no existe: hay una sola search_providers
  assert.equal((await q("select count(*)::int n from pg_proc where proname = 'search_providers'"))[0].n, 1);
});
await test("MIGRACIÓN: update_012 sobre una base con 011 (dos veces) conserva negocios y perfiles, y añade país y ubicación", async () => {
  const completo = fs.readFileSync(esquema, "utf8").replace(/\r\n/g, "\n");
  const ini = completo.indexOf("-- ACTUALIZACION-012-INICIO");
  const fin = completo.indexOf("-- ACTUALIZACION-012-FIN");
  assert.ok(ini > 0 && fin > ini, "faltan los marcadores de la actualización 012 en schema.sql");
  const actualizacion = fs.readFileSync(path.join(aqui, "..", "update_012_geolocalizacion.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(completo.slice(completo.indexOf("\n", ini) + 1, fin).trim(), actualizacion.trim(), "schema.sql y update_012 difieren");
  await server.createDatabase("migracion12");
  const m = new pg.Client({ ...conn, database: "migracion12" });
  await m.connect();
  m.on("notice", () => {});
  const como12 = async (uid, sql, params = []) => {
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
    await m.query(completo.slice(0, ini)); // esquema base + 002 … + 011
    await m.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'geo12@test.dev', '{\"full_name\":\"Geo Doce\"}')");
    const uid = (await m.query("select id from auth.users where email = 'geo12@test.dev'")).rows[0].id;
    const prov = (await m.query("insert into public.providers (owner_id, vertical, subtype, name, lat, lng) values ($1, 'delivery', 'restaurante', 'Antes de la 012', -2.9, -79.0) returning id", [uid])).rows[0].id;
    assert.equal((await m.query("select count(*)::int n from information_schema.columns where table_name = 'providers' and column_name = 'country'")).rows[0].n, 0, "antes de la 012 no existe providers.country");
    await m.query(actualizacion);
    await m.query(actualizacion); // idempotente
    assert.equal((await m.query("select country from public.providers where id = $1", [prov])).rows[0].country, "EC", "los negocios existentes quedan en Ecuador");
    assert.equal((await m.query("select count(*)::int n from pg_proc where proname = 'search_providers'")).rows[0].n, 1, "una sola search_providers");
    assert.equal((await m.query("select count(*)::int n from pg_proc where proname in ('set_my_location', 'clear_my_location')")).rows[0].n, 2);
    assert.equal((await m.query("select count(*)::int n from public.search_providers('delivery', p_country => 'EC', p_lat => -2.9, p_lng => -79.0)")).rows[0].n, 1);
    await como12(uid, "select public.set_my_location('EC', 'Cuenca', -2.9012, -79.0058, 'America/Guayaquil')");
    assert.equal(Number((await m.query("select lat from public.user_private where user_id = $1", [uid])).rows[0].lat), -2.9);
    assert.equal((await m.query("select country from public.profiles where id = $1", [uid])).rows[0].country, "EC");
  } finally {
    await m.end();
  }
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
await su.end();
await server.stop();
fs.rmSync(dir, { recursive: true, force: true });
process.exit(fallos ? 1 : 0);
