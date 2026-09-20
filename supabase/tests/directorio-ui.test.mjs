/**
 * Lógica de la interfaz de los directorios (sin navegador ni base de datos): contacto, horarios, validación del alta,
 * filtros de URL, datos estructurados, mapeo de filas y completitud.
 *   npx tsx supabase/tests/directorio-ui.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { CANALES, VERTICALES, VERTICALES_ACTIVAS, VERTICAL_POR_ID, estaAbierto, horarioValido, partesEcuador } from "@/data/directorio";
import { completitudNegocio } from "@/lib/directorio/completitud";
import { enlaceTel, enlaceWhatsapp, formatearTelefono, mensajePedido, normalizarTelefonoEC, telefonoValido } from "@/lib/directorio/contacto";
import { FILTROS_INICIALES, TAM_PAGINA, argumentosBusqueda, consultaDesdeFiltros, consultaUniversal, filtrosActivos, filtrosDesdeParams, hrefLista } from "@/lib/directorio/filtros";
import { PRESETS_HORARIO, copiarTramos, instanteEcuador, ponerTramos, presetHorario, resumenHorario, textoEstadoAbierto, valorLocalEcuador } from "@/lib/directorio/horarios";
import { agruparCatalogo, estaDeTurno, mapearHit, mapearItem, mapearProveedor, mapearResena, mapearResultado, textoPrecio, turnosVigentes, vistaPreviaDesdeBorrador } from "@/lib/directorio/mapeo";
import { jsonLdProveedor, jsonLdSeguro, tipoSchema } from "@/lib/directorio/schema";
import {
  LIMITES, borradorDesdeProveedor, borradorVacio, filaActualizacion, filaContacto, filaProveedor, filasItems, horarioLimpio, itemVacio, numeroDecimal, validarBorrador, validarItem, validarPasoCatalogo,
  validarPasoContacto, validarPasoDatos, validarPasoHorario, validarPasoSeccion,
} from "@/lib/directorio/validacion";

const SQL_006 = fs.readFileSync(new URL("../update_006_directorios.sql", import.meta.url), "utf8");

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

console.log("\nCatálogo y plantillas");
await test("secciones activas: Delivery y Farmacias; las demás llegan en otra fase", () => {
  assert.deepEqual(VERTICALES_ACTIVAS.map((v) => v.id), ["delivery", "salud"]);
  assert.equal(VERTICALES.filter((v) => !v.activa).length, 4);
});
await test("cada plantilla de alta es coherente: canales válidos, horario existente, tipo de elemento permitido y ejemplos con precio", () => {
  const canales = new Set(CANALES.map((c) => c.id));
  for (const v of VERTICALES) {
    const p = v.plantilla;
    assert.ok(p.canales.length >= 1 && p.canales.every((c) => canales.has(c)), `canales de ${v.id}`);
    assert.ok(PRESETS_HORARIO.some((h) => h.id === p.horario), `horario «${p.horario}» de ${v.id}`);
    assert.ok(v.capacidades.catalogo.includes(p.tipoItem) || v.capacidades.catalogo.length === 0, `tipo de ${v.id}`);
    assert.ok(p.item.singular && p.item.plural && v.buscador, v.id);
    assert.ok(p.secciones.every((s) => s.length <= LIMITES.seccionMax));
    for (const e of p.ejemplos) assert.ok(numeroDecimal(e.precio) !== null && e.nombre.length >= LIMITES.itemNombreMin, `ejemplo de ${v.id}`);
  }
  assert.ok(VERTICAL_POR_ID.salud.plantilla.aviso?.includes("receta"), "Farmacias avisa sobre las recetas");
  assert.equal(VERTICAL_POR_ID.delivery.plantilla.tipoItem, "menu_item");
  assert.equal(VERTICAL_POR_ID.salud.plantilla.tipoItem, "product");
});

console.log("\nContacto");
await test("teléfonos de Ecuador: validación igual que SQL y normalización a formato internacional", () => {
  for (const ok_ of ["0991234567", "099 123 4567", "+593 99 123 4567", "07 2345678", "07-234-5678"]) assert.equal(telefonoValido(ok_), true, ok_);
  for (const mal of ["", "abc", "123", "llámame", "12345678901234567890123", "(07) 234-5678"]) assert.equal(telefonoValido(mal), false, mal);
  const enSql = /phone ~ '([^']+)'/.exec(SQL_006)[1];
  assert.equal(new RegExp(enSql).source, /^\+?[0-9][0-9 ()-]{6,19}$/.source, "el patrón coincide con provider_contacts");
  const casos = { "0991234567": "593991234567", "099 123 4567": "593991234567", "+593 99 123 4567": "593991234567", "593991234567": "593991234567", "00593991234567": "593991234567", "07 2345678": "59372345678", "991234567": "593991234567", "+1 555 123 4567": "15551234567" };
  for (const [entrada, salida] of Object.entries(casos)) assert.equal(normalizarTelefonoEC(entrada), salida, entrada);
  for (const mal of ["123", "", "abc", "+12345"]) assert.equal(normalizarTelefonoEC(mal), null, mal);
});
await test("enlaces de WhatsApp y llamada, y formato legible", () => {
  assert.equal(enlaceWhatsapp("099 123 4567"), "https://wa.me/593991234567");
  assert.equal(enlaceWhatsapp("0991234567", "Hola, ¿tienen paracetamol?"), "https://wa.me/593991234567?text=Hola%2C%20%C2%BFtienen%20paracetamol%3F");
  assert.equal(enlaceWhatsapp("123"), null);
  assert.equal(enlaceTel("07 2345678"), "tel:+59372345678");
  assert.match(mensajePedido("Sabor Cuencano"), /Sabor Cuencano.*conectari\.com/);
  assert.deepEqual(["0991234567", "072345678", "raro"].map(formatearTelefono), ["099 123 4567", "07 234 5678", "raro"]);
});

console.log("\nHorarios");
await test("los preajustes son válidos y el de 24 horas no necesita tramos", () => {
  for (const p of PRESETS_HORARIO) assert.equal(horarioValido(p.horario), true, p.id);
  assert.equal(presetHorario("24h").abierto24h, true);
  assert.equal(presetHorario("no-existe").id, "lun-vie", "cae en uno por defecto");
  assert.equal(Object.keys(presetHorario("diario").horario).length, 7);
});
await test("resumenHorario agrupa días consecutivos iguales", () => {
  assert.equal(resumenHorario(presetHorario("farmacia").horario, false), "Lun–Sáb 08:00–20:00 · Dom 09:00–13:00");
  assert.equal(resumenHorario(presetHorario("lun-vie").horario, false), "Lun–Vie 08:00–18:00 · Sáb–Dom cerrado");
  assert.equal(resumenHorario(presetHorario("diario").horario, false), "Lun–Dom 08:00–20:00");
  assert.equal(resumenHorario({ lun: [["08:00", "12:00"], ["14:00", "18:00"]], mar: [["08:00", "12:00"], ["14:00", "18:00"]], vie: [["10:00", "14:00"]] }, false), "Lun–Mar 08:00–12:00 · 14:00–18:00 · Mié–Jue cerrado · Vie 10:00–14:00 · Sáb–Dom cerrado");
  assert.equal(resumenHorario({}, true), "Abierto 24 horas");
  assert.equal(resumenHorario({}, false), "Sin horario publicado");
});
await test("textoEstadoAbierto: abierto, próximo cierre y próxima apertura (hora de Ecuador)", () => {
  const h = { lun: [["08:00", "13:00"], ["15:00", "19:00"]], mar: [["08:00", "13:00"]], sab: [["09:00", "24:00"]] };
  const en = (iso) => textoEstadoAbierto(h, false, new Date(iso));
  assert.deepEqual(en("2026-06-01T15:00:00Z"), { abierto: true, texto: "Abierto ahora · cierra a las 13:00" }); // lunes 10:00
  assert.deepEqual(en("2026-06-01T19:00:00Z"), { abierto: false, texto: "Cerrado · abre hoy a las 15:00" }); // lunes 14:00
  assert.deepEqual(en("2026-06-02T03:00:00Z"), { abierto: false, texto: "Cerrado · abre mañana a las 08:00" }); // lunes 22:00
  assert.deepEqual(en("2026-06-03T15:00:00Z"), { abierto: false, texto: "Cerrado · abre el Sáb a las 09:00" }); // miércoles 10:00
  assert.deepEqual(en("2026-06-06T16:00:00Z"), { abierto: true, texto: "Abierto ahora · cierra a medianoche" }); // sábado 11:00
  assert.deepEqual(textoEstadoAbierto({}, true), { abierto: true, texto: "Abierto 24 horas" });
  assert.deepEqual(textoEstadoAbierto({}, false), { abierto: false, texto: "Sin horario publicado" });
  // Coherencia con estaAbierto() en todos los instantes de una semana
  for (let m = 0; m < 7 * 24 * 60; m += 37) {
    const t = new Date(Date.UTC(2026, 5, 1) + m * 60_000);
    assert.equal(textoEstadoAbierto(h, false, t).abierto, estaAbierto(h, false, t));
  }
  assert.deepEqual(partesEcuador(new Date("2026-06-01T05:00:00Z")), { dia: "lun", indiceDia: 0, hora: "00:00" });
});
await test("editar horarios: ponerTramos y copiarTramos no mutan y quitan los días sin tramos", () => {
  const base = { lun: [["08:00", "12:00"]] };
  const con = ponerTramos(base, "mar", [["09:00", "10:00"]]);
  assert.deepEqual(Object.keys(con), ["lun", "mar"]);
  assert.deepEqual(Object.keys(base), ["lun"], "no muta el original");
  assert.deepEqual(Object.keys(ponerTramos(con, "lun", [])), ["mar"]);
  const copiado = copiarTramos(base, "lun", ["mar", "mie", "jue"]);
  assert.deepEqual(copiado.jue, [["08:00", "12:00"]]);
  assert.equal(copiado.mar === base.lun, false, "copia los tramos, no la referencia");
  assert.deepEqual(horarioLimpio({ mar: [["10:00", "12:00"], ["08:00", "09:00"]], lun: [], mie: [["", ""]] }), { mar: [["08:00", "09:00"], ["10:00", "12:00"]] });
});

console.log("\nValidación del alta");
const negocioValido = () => ({
  ...borradorVacio(),
  vertical: "delivery", subtipo: "restaurante", nombre: "Sabor Cuencano", descripcion: "Comida casera", zona: "Zona Norte",
  canales: ["local", "entrega"], costoEnvio: "1,50", pedidoMinimo: "5", telefono: "", whatsapp: "099 123 4567", direccion: "Av. Solano 1-23",
  horario: presetHorario("restaurante").horario, abierto24h: false,
  items: [{ seccion: "Bebidas", nombre: "Jugo de naranjilla", descripcion: "", precio: "2", receta: false }],
});
await test("numeroDecimal acepta coma y punto, hasta 2 decimales y nada más", () => {
  assert.deepEqual(["1,5", "2", "1.50", "$3", " 4.25 "].map(numeroDecimal), [1.5, 2, 1.5, 3, 4.25]);
  for (const mal of ["", "abc", "-1", "1.234", "1,2,3", "1e3"]) assert.equal(numeroDecimal(mal), null, mal);
});
await test("un negocio bien rellenado no tiene errores", () => {
  assert.deepEqual(validarBorrador(negocioValido()), {});
});
await test("paso 1: sección y categoría", () => {
  assert.deepEqual(Object.keys(validarPasoSeccion(borradorVacio())), ["vertical"]);
  assert.deepEqual(Object.keys(validarPasoSeccion({ ...borradorVacio(), vertical: "salud" })), ["subtipo"]);
  assert.deepEqual(Object.keys(validarPasoSeccion({ ...borradorVacio(), vertical: "salud", subtipo: "plomero" })), ["subtipo"], "una categoría de otra sección no vale");
  assert.deepEqual(validarPasoSeccion({ ...borradorVacio(), vertical: "salud", subtipo: "farmacia" }), {});
});
await test("paso 2: nombre, zona, canales y costos", () => {
  const b = negocioValido();
  assert.deepEqual(Object.keys(validarPasoDatos({ ...b, nombre: "  a " })), ["nombre"]);
  assert.deepEqual(Object.keys(validarPasoDatos({ ...b, nombre: "x".repeat(81) })), ["nombre"]);
  assert.deepEqual(Object.keys(validarPasoDatos({ ...b, zona: " " })), ["zona"]);
  assert.deepEqual(Object.keys(validarPasoDatos({ ...b, canales: [] })), ["canales"]);
  assert.deepEqual(Object.keys(validarPasoDatos({ ...b, canales: ["teletransporte"] })), ["canales"]);
  assert.deepEqual(Object.keys(validarPasoDatos({ ...b, costoEnvio: "mucho", pedidoMinimo: "-2" })).sort(), ["costoEnvio", "pedidoMinimo"]);
  assert.deepEqual(validarPasoDatos({ ...b, canales: ["local"], costoEnvio: "mucho" }), {}, "sin entrega, el costo de envío no cuenta");
  assert.deepEqual(Object.keys(validarPasoDatos({ ...b, descripcion: "x".repeat(1001) })), ["descripcion"]);
});
await test("paso 3: hace falta un contacto válido y, si atiende en local, la dirección", () => {
  const b = negocioValido();
  assert.deepEqual(Object.keys(validarPasoContacto({ ...b, whatsapp: "", telefono: "" })), ["contacto"]);
  assert.deepEqual(Object.keys(validarPasoContacto({ ...b, whatsapp: "hola" })), ["whatsapp"]);
  assert.deepEqual(Object.keys(validarPasoContacto({ ...b, whatsapp: "", telefono: "12" })), ["telefono"]);
  assert.deepEqual(Object.keys(validarPasoContacto({ ...b, direccion: "" })), ["direccion"]);
  assert.deepEqual(validarPasoContacto({ ...b, direccion: "", canales: ["entrega"] }), {}, "solo a domicilio: no exige dirección");
  assert.deepEqual(validarPasoContacto({ ...b, telefono: "07 234 5678" }), {}, "teléfono y WhatsApp a la vez");
});
await test("paso 4: horario válido o 24 horas", () => {
  const b = negocioValido();
  assert.deepEqual(Object.keys(validarPasoHorario({ ...b, horario: {} })), ["horario"]);
  assert.deepEqual(validarPasoHorario({ ...b, horario: {}, abierto24h: true }), {});
  assert.deepEqual(Object.keys(validarPasoHorario({ ...b, horario: { lun: [["18:00", "09:00"]] } })), ["horario"]);
});
await test("paso 5: catálogo (las filas vacías se ignoran; precio obligatorio; receta solo en Salud; tope del asistente)", () => {
  const b = negocioValido();
  assert.deepEqual(validarPasoCatalogo({ ...b, items: [itemVacio(), itemVacio()] }), {}, "el catálogo es opcional");
  const e = validarPasoCatalogo({ ...b, items: [{ ...itemVacio(), nombre: "Sopa", precio: "" }, { ...itemVacio(), nombre: "x", precio: "2" }, { seccion: "", nombre: "Jugo", descripcion: "", precio: "2", receta: true }] });
  assert.deepEqual(Object.keys(e).sort(), ["items.0.precio", "items.1.nombre", "items.2.receta"]);
  assert.deepEqual(Object.keys(validarItem({ ...itemVacio(), nombre: "Amoxicilina", precio: "5", receta: true }, "salud")), []);
  const muchos = Array.from({ length: LIMITES.itemsAlta + 1 }, (_, i) => ({ ...itemVacio(), nombre: `Plato ${i}`, precio: "1" }));
  assert.ok("items" in validarPasoCatalogo({ ...b, items: muchos }));
});
await test("PARIDAD: las filas generadas solo usan columnas que el cliente puede insertar según SQL, y respetan los límites", () => {
  const grant = (tabla) => new RegExp(`grant insert \\(([^)]*)\\)[^;]*on public\\.${tabla} to authenticated`, "s").exec(SQL_006)[1].split(",").map((c) => c.trim());
  const b = { ...negocioValido(), items: [{ seccion: "Bebidas", nombre: "Jugo", descripcion: "Natural", precio: "2,5", receta: false }, itemVacio()] };
  const prov = filaProveedor(b, "uid-1", { logoUrl: "https://x/logo.png" });
  for (const c of Object.keys(prov)) assert.ok(grant("providers").includes(c), `providers.${c} no es insertable`);
  const contacto = filaContacto(b, "prov-1");
  for (const c of Object.keys(contacto)) assert.ok(grant("provider_contacts").includes(c), `provider_contacts.${c}`);
  const items = filasItems(b, "prov-1");
  assert.equal(items.length, 1, "la fila vacía se descarta");
  for (const c of Object.keys(items[0])) assert.ok(grant("provider_items").includes(c), `provider_items.${c}`);
  assert.deepEqual([prov.delivery_fee, prov.min_order, prov.name, prov.hours.lun], [1.5, 5, "Sabor Cuencano", [["11:00", "15:00"], ["18:00", "22:00"]]]);
  assert.deepEqual([items[0].kind, items[0].price, items[0].section, items[0].sort_order], ["menu_item", 2.5, "Bebidas", 0]);
  assert.equal(filasItems({ ...negocioValido(), vertical: "salud", items: [{ ...itemVacio(), nombre: "Paracetamol", precio: "1.8" }] }, "p")[0].kind, "product");
  assert.deepEqual(filaProveedor({ ...b, canales: ["local"] }, "u").delivery_fee, 0, "sin entrega, costos a cero");
  assert.deepEqual(filaProveedor({ ...b, abierto24h: true }, "u").hours, {});
  assert.deepEqual(filaContacto({ ...b, telefono: "", direccion: "" }, "p"), { provider_id: "p", phone: null, whatsapp: "099 123 4567", address: null });
  // Los límites de SQL
  assert.equal(LIMITES.nombreMin, 3);
  assert.match(SQL_006, /char_length\(btrim\(name\)\) between 3 and 80/);
  assert.match(SQL_006, /description\s+text not null default '' check \(char_length\(description\) <= 1000\)/);
  assert.match(SQL_006, /check \(char_length\(btrim\(name\)\) between 2 and 100\)/);
  assert.match(SQL_006, />= 200 then/);
  assert.equal(LIMITES.itemsMax, 200);
});

console.log("\nFiltros de la URL");
await test("filtrosDesdeParams: valida, limita y descarta lo desconocido", () => {
  assert.deepEqual(filtrosDesdeParams({}, "delivery"), FILTROS_INICIALES);
  const f = filtrosDesdeParams({ subtipo: "cafeteria", q: "  ceviche   mixto ", zona: "Zona Norte", abierto: "1", entrega: "1", verificados: "1", turno: "1", pagina: "3" }, "delivery");
  assert.deepEqual(f, { subtipo: "cafeteria", q: "ceviche mixto", zona: "Zona Norte", abierto: true, entrega: true, verificados: true, deTurno: false, pagina: 3 });
  assert.equal(filtrosDesdeParams({ turno: "1" }, "salud").deTurno, true, "de turno solo en secciones con turnos");
  assert.equal(filtrosDesdeParams({ subtipo: "farmacia" }, "delivery").subtipo, undefined, "categoría de otra sección");
  assert.equal(filtrosDesdeParams({ q: "x".repeat(200) }, "delivery").q.length, 60);
  assert.deepEqual(["0", "-5", "abc", "999999"].map((p) => filtrosDesdeParams({ pagina: p }, "delivery").pagina), [1, 1, 1, 200]);
  assert.equal(filtrosDesdeParams({ q: ["a", "b"] }, "delivery").q, "a", "si llega repetido, el primero");
  assert.equal(filtrosDesdeParams({ abierto: "si" }, "delivery").abierto, false, "solo «1» activa un filtro");
});
await test("consulta y enlaces canónicos: sin valores por defecto, en orden fijo, y la página vuelve a 1 al cambiar un filtro", () => {
  assert.equal(consultaDesdeFiltros(FILTROS_INICIALES), "");
  const f = { ...FILTROS_INICIALES, q: "café", abierto: true, pagina: 2 };
  assert.equal(consultaDesdeFiltros(f), "?q=caf%C3%A9&abierto=1&pagina=2");
  assert.deepEqual(filtrosDesdeParams(Object.fromEntries(new URLSearchParams(consultaDesdeFiltros(f))), "delivery"), f, "ida y vuelta");
  assert.equal(hrefLista("salud", f, { entrega: true }), "/directorio/salud?q=caf%C3%A9&abierto=1&entrega=1");
  assert.equal(hrefLista("salud", f, { pagina: 3 }), "/directorio/salud?q=caf%C3%A9&abierto=1&pagina=3");
  assert.equal(hrefLista("delivery", f), "/directorio/delivery?q=caf%C3%A9&abierto=1&pagina=2");
  assert.equal(hrefLista("delivery", f, { q: undefined, abierto: false }), "/directorio/delivery");
  assert.equal(filtrosActivos(f), 2);
  assert.equal(filtrosActivos(FILTROS_INICIALES), 0);
});
await test("argumentosBusqueda usa los nombres de parámetros de search_providers y pide una fila de más", () => {
  const a = argumentosBusqueda("salud", { ...FILTROS_INICIALES, deTurno: true, zona: "Centro", pagina: 3 });
  assert.deepEqual(a, { p_vertical: "salud", p_subtype: null, p_zone: "Centro", p_q: null, p_open_now: false, p_delivers: false, p_verified: false, p_on_duty: true, p_limit: TAM_PAGINA + 1, p_offset: 2 * TAM_PAGINA });
  const firma = /create or replace function public\.search_providers\(([^)]*)\)/s.exec(fs.readFileSync(new URL("../update_007_buscador_universal.sql", import.meta.url), "utf8"))[1];
  for (const k of Object.keys(a)) assert.ok(firma.includes(k), `search_providers no tiene ${k}`);
  assert.deepEqual(["  ", "a", " ceviche  mixto ", ["pan", "x"], undefined].map(consultaUniversal), ["", "", "ceviche mixto", "pan", ""]);
});

console.log("\nDatos estructurados y mapeo");
const proveedor = (extra = {}) => mapearProveedor({
  id: "p1", owner_id: "u1", slug: "sabor-cuencano-abc123", vertical: "delivery", subtype: "restaurante", name: "Sabor Cuencano", description: "Comida casera", city: "Cuenca", zone: "Zona Norte",
  lat: "-2.9001", lng: "-79.0059", logo_url: "https://x/logo.png", cover_url: null, channels: ["local", "entrega"], open_24h: false, hours: { lun: [["08:00", "13:00"]], sab: [["09:00", "24:00"]] },
  delivery_fee: "1.50", min_order: "5.00", status: "active", verified_at: "2026-01-01T00:00:00Z", rating: "4.5", reviews_count: 12, orders_count: 30, created_at: "2026-01-01T00:00:00Z", ...extra,
});
await test("JSON-LD: tipo por categoría, horario, valoración y SIN teléfono ni dirección exacta", () => {
  const p = proveedor();
  assert.deepEqual(["restaurante", "cafeteria", "farmacia", "odontologia", "algo_raro"].map(tipoSchema), ["Restaurant", "CafeOrCoffeeShop", "Pharmacy", "Dentist", "LocalBusiness"]);
  const ld = jsonLdProveedor(p, "https://conectari.com/directorio/delivery/sabor-cuencano-abc123");
  assert.equal(ld["@type"], "Restaurant");
  assert.deepEqual(ld.address, { "@type": "PostalAddress", addressLocality: "Cuenca", addressCountry: "EC", addressRegion: "Zona Norte" });
  assert.deepEqual(ld.aggregateRating, { "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 12, bestRating: 5, worstRating: 1 });
  assert.deepEqual(ld.openingHoursSpecification.map((h) => [h.dayOfWeek, h.opens, h.closes]), [["Monday", "08:00", "13:00"], ["Saturday", "09:00", "23:59"]]);
  assert.deepEqual([ld.geo.latitude, ld.logo, "image" in ld], [-2.9001, "https://x/logo.png", false]);
  for (const privado of ["telephone", "streetAddress"]) assert.ok(!(privado in ld) && !(privado in ld.address));
  assert.ok(!("aggregateRating" in jsonLdProveedor(proveedor({ reviews_count: 0 }), "u")), "sin reseñas no se inventa valoración");
  assert.equal(jsonLdProveedor(proveedor({ open_24h: true }), "u").openingHoursSpecification.length, 7);
});
await test("JSON-LD seguro: un nombre malicioso no puede cerrar el <script>", () => {
  const ld = jsonLdProveedor(proveedor({ name: "</script><script>alert(1)</script>", description: "a b" }), "u");
  const texto = jsonLdSeguro(ld);
  assert.ok(!texto.includes("<"), "sin «<» sin escapar");
  assert.ok(!texto.includes(" "));
  assert.equal(JSON.parse(texto).name, "</script><script>alert(1)</script>", "al leerlo se recupera el texto original");
});
await test("mapeo de filas: valores por defecto, secciones desconocidas descartadas y horarios corruptos neutralizados", () => {
  assert.equal(mapearProveedor({ ...proveedorFila(), vertical: "inventada" }), null);
  assert.deepEqual(proveedor({ hours: "roto" }).horario, {});
  const p = proveedor();
  assert.deepEqual([p.verificado, p.rating, p.costoEnvio, p.pedidoMinimo, p.lat, p.portadaUrl], [true, 4.5, 1.5, 5, -2.9001, undefined]);
  assert.equal(proveedor({ verified_at: null }).verificado, false);
  const r = mapearResultado({ id: "1", slug: "s", vertical: "salud", subtype: "farmacia", name: "F", description: "", zone: "Centro", logo_url: null, cover_url: null, channels: ["local"], open_now: true, on_duty: true, verified: true, rating: "4.20", reviews_count: 3, delivery_fee: "0", min_order: "0", distance_km: null, boosted: false });
  assert.deepEqual([r.rating, r.distanciaKm, r.deTurno, r.canales], [4.2, undefined, true, ["local"]]);
  assert.equal(mapearResultado({ ...filaResultado(), vertical: "xx" }), null);
  const hit = mapearHit({ kind: "item", provider_id: "p", slug: "s", vertical: "salud", subtype: "farmacia", name: "Cruz Azul", zone: "Centro", logo_url: null, verified: true, open_now: false, on_duty: true, rating: 4.7, item_name: "Paracetamol", item_price: "1.80", requires_prescription: false });
  assert.deepEqual([hit.tipo, hit.item], ["producto", { nombre: "Paracetamol", precio: 1.8, receta: false }]);
  assert.deepEqual([mapearHit({ ...filaHit(), kind: "provider", item_name: null }).tipo, mapearHit({ ...filaHit(), kind: "provider", item_name: null }).item], ["negocio", undefined]);
  const rs = mapearResena({ id: "r", rating: 5, comment: "Excelente", verified_purchase: true, created_at: "2026-02-01T00:00:00Z", autor: { display_name: "María José Pérez", avatar_url: null } });
  assert.deepEqual([rs.autor, rs.compraVerificada], ["María", true], "solo el nombre de pila");
  assert.equal(mapearResena({ id: "r", rating: 4, comment: "", verified_purchase: false, created_at: "2026-02-01T00:00:00Z", autor: null }).autor, "Una persona");
});
function proveedorFila() { return { id: "p", owner_id: "u", slug: "s", vertical: "delivery", subtype: "restaurante", name: "N", description: "", city: "Cuenca", zone: "", lat: null, lng: null, logo_url: null, cover_url: null, channels: ["local"], open_24h: false, hours: {}, delivery_fee: 0, min_order: 0, status: "active", verified_at: null, rating: 0, reviews_count: 0, orders_count: 0, created_at: "2026-01-01T00:00:00Z" }; }
function filaResultado() { return { id: "1", slug: "s", vertical: "salud", subtype: "farmacia", name: "F", description: "", zone: "", logo_url: null, cover_url: null, channels: [], open_now: false, on_duty: false, verified: false, rating: 0, reviews_count: 0, delivery_fee: 0, min_order: 0, distance_km: null, boosted: false }; }
function filaHit() { return { kind: "item", provider_id: "p", slug: "s", vertical: "salud", subtype: "farmacia", name: "F", zone: "", logo_url: null, verified: false, open_now: false, on_duty: false, rating: 0, item_name: "x", item_price: null, requires_prescription: null }; }

const item = (id, seccion, nombre, precio, extra = {}) => mapearItem({ id, provider_id: "p", kind: "menu_item", section: seccion, name: nombre, description: "", price: precio, price_to: null, unit: "unidad", image_url: null, available: true, requires_prescription: false, sort_order: extra.orden ?? 0, ...extra });
await test("catálogo: precios legibles y agrupación por sección con «Otros» al final", () => {
  assert.deepEqual([item("1", "", "a", "1.8"), item("2", "", "b", 5), item("3", "", "c", null), item("4", "", "d", 5, { price_to: 8 }), item("5", "", "e", 2.5)].map(textoPrecio), ["$1.80", "$5", "A convenir", "$5 – $8", "$2.50"]);
  const g = agruparCatalogo([item("1", "Bebidas", "Jugo", 2, { orden: 3 }), item("2", "", "Extra", 1, { orden: 1 }), item("3", "Entradas", "Empanada", 1.5, { orden: 0 }), item("4", "Bebidas", "Café", 1, { orden: 2 })]);
  assert.deepEqual(g.map((x) => [x.seccion, x.items.map((i) => i.nombre)]), [["Entradas", ["Empanada"]], ["Bebidas", ["Café", "Jugo"]], ["Otros", ["Extra"]]]);
  assert.deepEqual(agruparCatalogo([item("1", "", "Solo", 1)]).map((x) => x.seccion), [""], "sin ninguna sección no hace falta el título «Otros»");
  assert.deepEqual(agruparCatalogo([]), []);
});
await test("turnos: solo los vigentes de la próxima semana y «de turno ahora»", () => {
  const ahora = Date.UTC(2026, 5, 1, 12);
  const h = 3_600_000;
  const t = (id, d, a) => ({ id, desde: ahora + d * h, hasta: ahora + a * h, nota: "" });
  const turnos = [t("pasado", -10, -2), t("actual", -1, 5), t("manana", 20, 30), t("lejano", 24 * 9, 24 * 9 + 8)];
  assert.deepEqual(turnosVigentes(turnos, ahora).map((x) => x.id), ["actual", "manana"]);
  assert.equal(estaDeTurno(turnos, ahora), true);
  assert.equal(estaDeTurno([turnos[0], turnos[2]], ahora), false);
});

console.log("\nCompletitud del negocio");
await test("completitud: 100 puntos repartidos; vacío 0 %; completo 100 %", () => {
  const vacio = proveedor({ description: "", logo_url: null, cover_url: null, hours: {}, open_24h: false });
  const c0 = completitudNegocio(vacio, null, []);
  assert.equal(c0.porcentaje, 0);
  assert.equal(c0.items.reduce((t, i) => t + i.peso, 0), 100);
  assert.equal(c0.faltantes[0].id, "catalogo", "lo que más suma va primero");
  const lleno = proveedor({ description: "x".repeat(70), logo_url: "https://x/l.png", cover_url: "https://x/c.png" });
  const c1 = completitudNegocio(lleno, { whatsapp: "0991234567" }, Array.from({ length: 6 }, (_, i) => ({ id: String(i) })));
  assert.deepEqual([c1.porcentaje, c1.faltantes.length], [100, 0]);
  const parcial = completitudNegocio(lleno, { telefono: "072345678" }, [{ id: "1" }, { id: "2" }]);
  assert.equal(parcial.porcentaje, 100 - 15, "2 de 5 elementos = 40 % de 25 puntos");
  assert.match(parcial.faltantes[0].ayuda, /tienes 2/);
  assert.equal(completitudNegocio(proveedor({ open_24h: true, hours: {} }), null, []).items.find((i) => i.id === "horario").hecho, true);
});


console.log("\nEdición, vista previa e integración");
await test("borradorDesdeProveedor y filaActualizacion: solo columnas actualizables y las imágenes solo si cambian", () => {
  const p = proveedor();
  const b = borradorDesdeProveedor(p, { whatsapp: "0991234567", direccion: "Av. Solano 1-23" });
  assert.deepEqual([b.vertical, b.subtipo, b.nombre, b.costoEnvio, b.pedidoMinimo, b.whatsapp, b.telefono, b.direccion, b.items], ["delivery", "restaurante", "Sabor Cuencano", "1.5", "5", "0991234567", "", "Av. Solano 1-23", []]);
  assert.equal(borradorDesdeProveedor(proveedor({ delivery_fee: 0, min_order: 0 }), null).costoEnvio, "", "cero = vacío en el formulario");
  const fila = filaActualizacion(b);
  const grantUpdate = new RegExp("grant update \\(([^)]*)\\)[^;]*on public\\.providers to authenticated", "s").exec(SQL_006)[1].split(",").map((c) => c.trim());
  for (const c of Object.keys(fila)) assert.ok(grantUpdate.includes(c), `providers.${c} no es actualizable`);
  assert.ok(!("logo_url" in fila) && !("cover_url" in fila), "sin cambio de imagen no se toca");
  assert.deepEqual([filaActualizacion(b, { logoUrl: "https://x/n.png" }).logo_url, filaActualizacion(b, { portadaUrl: null }).cover_url], ["https://x/n.png", null], "null = quitar");
  for (const prohibido of ["vertical", "subtype", "owner_id", "status", "verified_at", "slug", "rating"]) assert.ok(!(prohibido in fila), prohibido);
  assert.deepEqual(filaActualizacion({ ...b, canales: ["local"] }).delivery_fee, 0);
});
await test("turnos: los valores de datetime-local se interpretan en hora de Ecuador, sin depender del dispositivo", () => {
  assert.equal(instanteEcuador("2026-06-01T20:00"), "2026-06-02T01:00:00.000Z");
  assert.equal(instanteEcuador("2026-06-01T00:00"), "2026-06-01T05:00:00.000Z");
  for (const mal of ["", "2026-06-01", "2026-13-01T10:00", "hoy", "2026-06-01T25:00"]) assert.equal(instanteEcuador(mal), null, mal);
  assert.equal(valorLocalEcuador(Date.UTC(2026, 5, 2, 1, 0)), "2026-06-01T20:00");
  for (const v of ["2026-06-01T08:30", "2026-12-31T23:59", "2026-01-01T00:00"]) assert.equal(valorLocalEcuador(new Date(instanteEcuador(v)).getTime()), v, "ida y vuelta");
});
await test("vistaPreviaDesdeBorrador: la tarjeta que verá la persona antes de publicar", () => {
  assert.equal(vistaPreviaDesdeBorrador(borradorVacio()), null);
  const b = { ...borradorVacio(), vertical: "delivery", subtipo: "cafeteria", nombre: "", canales: ["local", "entrega"], costoEnvio: "1,5", pedidoMinimo: "4", horario: { lun: [["08:00", "18:00"]] }, logo: "data:image/png;base64,xx" };
  const v = vistaPreviaDesdeBorrador(b, new Date("2026-06-01T15:00:00Z")); // lunes 10:00 en Ecuador
  assert.deepEqual([v.nombre, v.costoEnvio, v.pedidoMinimo, v.abiertoAhora, v.verificado, v.logoUrl], ["Nombre de tu negocio", 1.5, 4, true, false, "data:image/png;base64,xx"]);
  assert.equal(vistaPreviaDesdeBorrador({ ...b, canales: ["local"] }).costoEnvio, 0, "sin entrega no hay envío");
  assert.equal(vistaPreviaDesdeBorrador(b, new Date("2026-06-02T03:00:00Z")).abiertoAhora, false, "lunes 22:00");
});
await test("integración: los alias de next.config.ts coinciden con el catálogo; «Mi negocio» exige sesión; la portada enlaza las secciones activas", () => {
  const config = fs.readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  const enConfig = [...config.matchAll(/\["(\w+)", "(\w+)"\]/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(enConfig, VERTICALES.map((v) => [v.alias, v.id]), "alias de next.config.ts distintos a VERTICALES");
  const middleware = fs.readFileSync(new URL("../../src/lib/supabase/middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /"\/directorio\/mi-negocio"/);
  const marca = fs.readFileSync(new URL("../../src/lib/marca.ts", import.meta.url), "utf8");
  assert.match(marca, /id: "delivery", href: "\/directorio\/delivery"/);
  assert.match(marca, /id: "farmacias", href: "\/directorio\/salud"/);
  const home = fs.readFileSync(new URL("../../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(home, /<BuscadorUniversal \/>/, "la portada usa el buscador universal");
  const buscador = fs.readFileSync(new URL("../../src/components/BuscadorUniversal.tsx", import.meta.url), "utf8");
  for (const v of VERTICALES_ACTIVAS) assert.ok(buscador.includes(`/directorio/${v.id}`), `el buscador universal no lleva a ${v.id}`);
  assert.ok(buscador.includes("/directorio/buscar"));
  assert.ok(buscador.includes(`nombre: "turno"`) && buscador.includes(`nombre: "abierto"`), "los filtros rápidos usan los parámetros que entiende el listado");
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
process.exit(fallos ? 1 : 0);
