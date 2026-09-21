/**
 * Lógica de la interfaz de los directorios (sin navegador ni base de datos): contacto, horarios, validación del alta,
 * filtros de URL, datos estructurados, mapeo de filas y completitud.
 *   npx tsx supabase/tests/directorio-ui.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { CANALES, ETIQUETA_ESTADO_PEDIDO, VERTICALES, VERTICALES_ACTIVAS, VERTICAL_POR_ID, estaAbierto, horarioValido, partesEcuador, transicionesPedido } from "@/data/directorio";
import {
  CADUCIDAD_CARRITO_MS, MAX_CANTIDAD, MAX_LINEAS, cambiarCantidad, cantidadDe, leerCarrito, lineasParaRpc, reconciliar, reemplazarNegocio, serializarCarrito, tiposDisponibles, totales, unidadesEnCarrito,
} from "@/lib/directorio/carrito";
import {
  PAGOS, TTL_SIN_RESPUESTA_MS, accionesNegocio, agruparBandeja, argumentosPedido, etiquetaEstado, grupoDe, haceCuanto, carritoDesdePedido, mapearPedido, mensajeErrorPedido, puedeCancelarCliente, resumenLineas, seguimiento,
  tiempoParaCaducar, validarPago,
} from "@/lib/directorio/pedidos";
import {
  VERTICALES_SOLICITUD, argumentosOferta, argumentosSolicitud, bloqueoOferta, camposDetalle, destacadas, estadoVisible, instanteDesdeLocal, limpiarDetalles, mapearOferta, mapearSolicitud,
  mensajeErrorSolicitud, ordenarOfertas, perfilesQueEncajan, resumenDetalles, textoMomento, textoTiempoOferta, tiempoRestante, validarOferta, validarSolicitud,
} from "@/lib/directorio/solicitudes";
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
await test("secciones activas: todas menos Eventos (que llega en otra fase)", () => {
  assert.deepEqual(VERTICALES_ACTIVAS.map((v) => v.id), ["movilidad", "delivery", "salud", "mascotas", "hogar"]);
  assert.deepEqual(VERTICALES.filter((v) => !v.activa).map((v) => v.id), ["eventos"]);
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
  for (const ruta of ["mi-negocio", "pedidos", "solicitudes"]) assert.match(middleware, new RegExp(`"/directorio/${ruta}"`), `${ruta} debe estar protegida`);
  const marca = fs.readFileSync(new URL("../../src/lib/marca.ts", import.meta.url), "utf8");
  assert.match(marca, /id: "delivery", href: "\/directorio\/delivery"/);
  assert.match(marca, /id: "farmacias", href: "\/directorio\/salud"/);
  const home = fs.readFileSync(new URL("../../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(home, /<BuscadorUniversal \/>/, "la portada usa el buscador universal");
  const buscador = fs.readFileSync(new URL("../../src/components/BuscadorUniversal.tsx", import.meta.url), "utf8");
  // El buscador de la portada tiene pestañas solo para Comida y Farmacias; el resto se busca desde «Todo» o desde su sección.
  for (const id of ["delivery", "salud"]) assert.ok(buscador.includes(`/directorio/${id}`), `el buscador universal no lleva a ${id}`);
  assert.ok(buscador.includes("/directorio/buscar"));
  assert.ok(buscador.includes(`nombre: "turno"`) && buscador.includes(`nombre: "abierto"`), "los filtros rápidos usan los parámetros que entiende el listado");
});


console.log("\nCarrito");
const SQL_008 = fs.readFileSync(new URL("../update_008_pedidos.sql", import.meta.url), "utf8");
const NEGOCIO = { id: "n1", slug: "sabor-cuencano-a1", vertical: "delivery", nombre: "Sabor Cuencano", canales: ["local", "entrega", "retiro"], costoEnvio: 1.5, pedidoMinimo: 5 };
const OTRO_NEGOCIO = { ...NEGOCIO, id: "n2", slug: "otro", nombre: "Otro" };
const prod = (id, precio, nombre = `Producto ${id}`) => ({ id, nombre, precio });
await test("cambiarCantidad: añade, actualiza, quita, acota, no muta y avisa del conflicto entre negocios", () => {
  const AHORA = 1_000;
  const a = cambiarCantidad(null, NEGOCIO, prod("i1", 6.5, "Ceviche"), 2, AHORA);
  assert.deepEqual([a.conflicto, a.limite, a.carrito.lineas, a.carrito.actualizado], [false, false, [{ itemId: "i1", nombre: "Ceviche", precio: 6.5, cantidad: 2 }], AHORA]);
  const b = cambiarCantidad(a.carrito, NEGOCIO, prod("i2", 2), 1, 2_000);
  assert.equal(b.carrito.lineas.length, 2);
  assert.equal(a.carrito.lineas.length, 1, "no muta el carrito anterior");
  assert.equal(cantidadDe(b.carrito, "i1"), 2);
  assert.equal(cantidadDe(null, "i1"), 0);
  assert.equal(unidadesEnCarrito(b.carrito), 3);
  assert.equal(cambiarCantidad(b.carrito, NEGOCIO, prod("i1", 6.5), 5).carrito.lineas[0].cantidad, 5);
  assert.equal(cambiarCantidad(b.carrito, NEGOCIO, prod("i1", 6.5), 99).carrito.lineas[0].cantidad, MAX_CANTIDAD, "tope de 20");
  assert.equal(cambiarCantidad(b.carrito, NEGOCIO, prod("i1", 6.5), -3).carrito.lineas.length, 1, "negativo = quitar");
  assert.equal(cambiarCantidad(b.carrito, NEGOCIO, prod("i1", 6.5), Number.NaN).carrito.lineas.length, 1, "NaN = quitar");
  assert.equal(cambiarCantidad(b.carrito, NEGOCIO, prod("i1", 6.5), 2.9).carrito.lineas.find((l) => l.itemId === "i1").cantidad, 2, "trunca decimales");
  const sinNada = cambiarCantidad(cambiarCantidad(b.carrito, NEGOCIO, prod("i1", 1), 0).carrito, NEGOCIO, prod("i2", 1), 0);
  assert.equal(sinNada.carrito, null, "sin líneas no hay carrito");
  const conflicto = cambiarCantidad(b.carrito, OTRO_NEGOCIO, prod("x", 1), 1);
  assert.deepEqual([conflicto.conflicto, conflicto.carrito], [true, b.carrito], "de otro negocio: no cambia nada y avisa");
  assert.equal(cambiarCantidad(b.carrito, OTRO_NEGOCIO, prod("x", 1), 0).conflicto, false, "quitar algo que no está no es conflicto");
  const nuevo = reemplazarNegocio(OTRO_NEGOCIO, prod("x", 3), 2);
  assert.deepEqual([nuevo.id, nuevo.lineas.length], ["n2", 1]);
  const refrescado = cambiarCantidad(b.carrito, { ...NEGOCIO, costoEnvio: 2 }, prod("i2", 2), 3).carrito;
  assert.equal(refrescado.costoEnvio, 2, "los datos del negocio se refrescan");
});
await test("cambiarCantidad: máximo de 30 productos distintos y precio/nombre actualizados al volver a añadir", () => {
  let c = null;
  for (let i = 0; i < MAX_LINEAS; i++) c = cambiarCantidad(c, NEGOCIO, prod(`p${i}`, 1), 1).carrito;
  assert.equal(c.lineas.length, MAX_LINEAS);
  const extra = cambiarCantidad(c, NEGOCIO, prod("p-extra", 1), 1);
  assert.deepEqual([extra.limite, extra.carrito.lineas.length], [true, MAX_LINEAS]);
  assert.equal(cambiarCantidad(c, NEGOCIO, prod("p3", 9, "Nuevo nombre"), 4).carrito.lineas.find((l) => l.itemId === "p3").precio, 9, "un producto existente sí se puede cambiar");
});
await test("totales: en centavos exactos, el envío solo a domicilio y el mínimo sobre el subtotal", () => {
  let c = null;
  c = cambiarCantidad(c, NEGOCIO, prod("a", 0.1), 3).carrito;
  c = cambiarCantidad(c, NEGOCIO, prod("b", 0.2), 1).carrito;
  assert.deepEqual(totales(c, "pickup"), { unidades: 4, subtotal: 0.5, envio: 0, total: 0.5, faltaMinimo: 4.5 }, "0.1 × 3 + 0.2 = 0.5 sin errores de coma flotante");
  assert.deepEqual(totales(c, "delivery"), { unidades: 4, subtotal: 0.5, envio: 1.5, total: 2, faltaMinimo: 4.5 });
  const grande = cambiarCantidad(c, NEGOCIO, prod("c", 6.5), 2).carrito;
  assert.deepEqual([totales(grande, "delivery").subtotal, totales(grande, "delivery").total, totales(grande, "delivery").faltaMinimo], [13.5, 15, 0]);
  assert.deepEqual(totales(null, "delivery"), { unidades: 0, subtotal: 0, envio: 0, total: 0, faltaMinimo: 0 });
  const raro = cambiarCantidad(null, NEGOCIO, prod("z", 19.99), 3).carrito;
  assert.equal(totales(raro, "pickup").subtotal, 59.97);
});
await test("tiposDisponibles y lineasParaRpc (nunca envía precios)", () => {
  assert.deepEqual(tiposDisponibles(["local"]), ["pickup"]);
  assert.deepEqual(tiposDisponibles(["entrega"]), ["delivery"]);
  assert.deepEqual(tiposDisponibles(["local", "entrega"]), ["delivery", "pickup"]);
  assert.deepEqual(tiposDisponibles(["retiro"]), ["pickup"]);
  assert.deepEqual(tiposDisponibles(["visita", "en_linea"]), []);
  const c = cambiarCantidad(null, NEGOCIO, prod("a", 3), 2).carrito;
  assert.deepEqual(lineasParaRpc(c), [{ item_id: "a", qty: 2 }]);
  assert.ok(!JSON.stringify(lineasParaRpc(c)).includes("3"), "ni un precio");
  assert.equal(MAX_CANTIDAD, 20);
  assert.equal(MAX_LINEAS, 30);
});
await test("leerCarrito: ida y vuelta, y desconfía de lo guardado (corrupto, caducado, manipulado)", () => {
  const AHORA = Date.UTC(2026, 5, 1);
  const c = cambiarCantidad(cambiarCantidad(null, NEGOCIO, prod("a", 2.5, "Jugo"), 2, AHORA).carrito, NEGOCIO, prod("b", 1), 1, AHORA).carrito;
  assert.deepEqual(leerCarrito(serializarCarrito(c), AHORA), c);
  assert.equal(leerCarrito(null), null);
  assert.equal(leerCarrito("no es json"), null);
  assert.equal(leerCarrito("[]"), null);
  assert.equal(leerCarrito(serializarCarrito(null)), null);
  assert.equal(leerCarrito(serializarCarrito(c), AHORA + CADUCIDAD_CARRITO_MS + 1), null, "más de una semana");
  assert.notEqual(leerCarrito(serializarCarrito(c), AHORA + CADUCIDAD_CARRITO_MS - 1), null);
  const mod = (f) => { const x = JSON.parse(serializarCarrito(c)); f(x); return leerCarrito(JSON.stringify(x), AHORA); };
  assert.equal(mod((x) => (x.vertical = "hackeo")), null, "sección desconocida");
  assert.equal(mod((x) => (x.costoEnvio = -1)), null);
  assert.equal(mod((x) => (x.pedidoMinimo = "5")), null);
  assert.equal(mod((x) => (x.id = "")), null);
  assert.equal(mod((x) => (x.lineas = [])), null, "sin líneas");
  assert.equal(mod((x) => (x.lineas = "nada")), null);
  assert.equal(mod((x) => x.lineas[0].cantidad = 500).lineas[0].cantidad, MAX_CANTIDAD, "acota la cantidad");
  assert.equal(mod((x) => x.lineas[0].cantidad = 0).lineas.length, 1, "descarta cantidades nulas");
  assert.equal(mod((x) => x.lineas.push({ ...x.lineas[0] })).lineas.length, 2, "descarta duplicados");
  assert.equal(mod((x) => (x.lineas[0].precio = Number.NaN)).lineas.length, 1, "descarta precios inválidos");
  assert.equal(mod((x) => x.lineas.push(null, 5, "x", { itemId: 1 })).lineas.length, 2, "descarta basura");
  assert.deepEqual(mod((x) => (x.canales = ["entrega", "teletransporte", 3])).canales, ["entrega"]);
  assert.equal(mod((x) => { x.lineas = Array.from({ length: 80 }, (_, i) => ({ itemId: `p${i}`, nombre: "n", precio: 1, cantidad: 1 })); }).lineas.length, MAX_LINEAS);
});
await test("reconciliar: quita lo agotado, con receta o sin precio; actualiza precios y datos de entrega; detecta bloqueos", () => {
  const c = cambiarCantidad(cambiarCantidad(cambiarCantidad(cambiarCantidad(null, NEGOCIO, prod("a", 2, "Jugo"), 1).carrito, NEGOCIO, prod("b", 3, "Sopa"), 2).carrito, NEGOCIO, prod("c", 4, "Pastilla"), 1).carrito, NEGOCIO, prod("d", 5, "Antibiótico"), 1).carrito;
  const items = [
    { id: "a", nombre: "Jugo de naranjilla", precio: 2.5, disponible: true, receta: false },
    { id: "b", nombre: "Sopa", precio: 3, disponible: false, receta: false },
    { id: "c", nombre: "Pastilla", precio: null, disponible: true, receta: false },
    { id: "d", nombre: "Antibiótico", precio: 5, disponible: true, receta: true },
  ];
  const r = reconciliar(c, items, { activo: true, canales: ["entrega"], costoEnvio: 2, pedidoMinimo: 8 });
  assert.deepEqual(r.carrito.lineas.map((l) => [l.itemId, l.nombre, l.precio]), [["a", "Jugo de naranjilla", 2.5]]);
  assert.equal(r.cambios.length, 4);
  assert.match(r.cambios[0], /cambió de \$2\.00 a \$2\.50/);
  assert.match(r.cambios[1], /«Sopa» ya no está disponible/);
  assert.match(r.cambios[2], /no tiene precio fijo/);
  assert.match(r.cambios[3], /requiere receta médica/);
  assert.deepEqual([r.carrito.costoEnvio, r.carrito.pedidoMinimo, r.carrito.canales, r.bloqueo], [2, 8, ["entrega"], null]);
  assert.equal(reconciliar(c, [], { activo: true, canales: ["entrega"], costoEnvio: 0, pedidoMinimo: 0 }).carrito, null, "todo agotado: sin carrito");
  assert.match(reconciliar(c, items, { activo: false, canales: ["entrega"], costoEnvio: 0, pedidoMinimo: 0 }).bloqueo, /no está disponible/);
  assert.match(reconciliar(c, items, { activo: true, canales: ["visita"], costoEnvio: 0, pedidoMinimo: 0 }).bloqueo, /no recibe pedidos/);
  const igual = reconciliar(cambiarCantidad(null, NEGOCIO, prod("a", 2.5, "Jugo"), 1).carrito, [{ id: "a", nombre: "Jugo", precio: 2.5, disponible: true, receta: false }], { activo: true, canales: ["entrega"], costoEnvio: 1.5, pedidoMinimo: 5 });
  assert.deepEqual(igual.cambios, [], "sin novedades no molesta");
});

console.log("\nPedidos");
await test("etiquetas y seguimiento: el pedido para retirar habla de «retirar» y no de «entregar»", () => {
  assert.deepEqual([etiquetaEstado("delivery", "on_the_way").etiqueta, etiquetaEstado("pickup", "on_the_way").etiqueta], ["En camino", "Listo para retirar"]);
  assert.deepEqual([etiquetaEstado("delivery", "delivered").etiqueta, etiquetaEstado("pickup", "delivered").etiqueta], ["Entregado", "Retirado"]);
  for (const e of Object.keys(ETIQUETA_ESTADO_PEDIDO)) for (const t of ["delivery", "pickup"]) assert.ok(etiquetaEstado(t, e).etiqueta && etiquetaEstado(t, e).emoji, `${t}/${e}`);
  const s = seguimiento("delivery", "preparing");
  assert.deepEqual(s.pasos.map((p) => [p.estado, p.hecho, p.actual]), [["placed", true, false], ["accepted", true, false], ["preparing", true, true], ["on_the_way", false, false], ["delivered", false, false]]);
  assert.equal(s.terminal, null);
  assert.deepEqual(seguimiento("pickup", "delivered").pasos.map((p) => p.hecho), [true, true, true, true, true]);
  assert.equal(seguimiento("pickup", "on_the_way").pasos[3].etiqueta, "Listo para retirar");
  for (const t of ["rejected", "cancelled"]) {
    const x = seguimiento("delivery", t);
    assert.deepEqual([x.terminal, x.pasos.some((p) => p.hecho || p.actual)], [t, false], "sin progreso que mostrar");
  }
});
await test("acciones del negocio: derivadas de la máquina de estados de SQL, con texto según entrega o retiro", () => {
  for (const tipo of ["delivery", "pickup"]) {
    for (const estado of Object.keys(ETIQUETA_ESTADO_PEDIDO)) {
      const acciones = accionesNegocio(tipo, estado);
      assert.deepEqual(acciones.map((a) => a.estado), transicionesPedido("negocio", estado), `${tipo}/${estado}`);
      assert.ok(acciones.every((a) => a.etiqueta), "todas con texto");
    }
  }
  assert.deepEqual(accionesNegocio("delivery", "placed").map((a) => [a.etiqueta, a.tono]), [["Aceptar pedido", "principal"], ["Rechazar", "peligro"]]);
  assert.deepEqual(accionesNegocio("pickup", "accepted").map((a) => a.etiqueta), ["Empezar a preparar", "Listo para retirar", "Rechazar"]);
  assert.deepEqual(accionesNegocio("delivery", "on_the_way").map((a) => a.etiqueta), ["Marcar entregado"]);
  assert.deepEqual(accionesNegocio("pickup", "preparing").map((a) => a.etiqueta), ["Listo para retirar", "Marcar retirado"]);
  assert.deepEqual(accionesNegocio("delivery", "delivered"), []);
  assert.deepEqual([puedeCancelarCliente("placed"), puedeCancelarCliente("accepted"), puedeCancelarCliente("delivered")], [true, false, false]);
});
const pedidoFila = (id, estado, creado, extra = {}) => ({ id, provider_id: "n1", provider_owner_id: "d1", provider_name: "Sabor", customer_id: "c1", kind: "delivery", status: estado, subtotal: "13.00", delivery_fee: "1.50", total: "14.50", payment_method: "cash", address: "Calle 1", zone: "Centro", notes: "", customer_phone: "099 123 4567", chat_id: "ch1", created_at: new Date(creado).toISOString(), updated_at: new Date(creado + 1000).toISOString(), ...extra });
await test("Repetir pedido: rehace el carrito con las mismas cantidades y omite lo que el negocio ya borró", () => {
  const t = Date.UTC(2026, 5, 1, 12);
  const linea = (n, item, nombre, precio, qty, oid = "o1") => ({ order_id: oid, line_no: n, item_id: item, name: nombre, unit_price: precio, qty });
  const p = mapearPedido(pedidoFila("o1", "delivered", t), [linea(1, "i1", "Ceviche", "6.50", 2), linea(2, null, "Plato retirado", "3.00", 1), linea(3, "i3", "Jugo", "2.00", 3)]);
  assert.equal(p.lineas[0].itemId, "i1");
  assert.equal(p.lineas[1].itemId, undefined);
  const negocio = { id: "n1", slug: "cevicheria", vertical: "delivery", nombre: "Cevichería", canales: ["entrega"], costoEnvio: 1.5, pedidoMinimo: 0 };
  const r = carritoDesdePedido(p, negocio, t);
  assert.equal(r.omitidos, 1);
  assert.deepEqual(r.carrito.lineas.map((l) => [l.itemId, l.cantidad, l.precio]), [["i1", 2, 6.5], ["i3", 3, 2]]);
  assert.equal(r.carrito.id, "n1");
  const vacio = carritoDesdePedido(mapearPedido(pedidoFila("o2", "delivered", t), [linea(1, null, "Borrado", "1", 1, "o2")]), negocio, t);
  assert.equal(vacio.carrito, null, "si no queda nada, no hay carrito");
  assert.equal(vacio.omitidos, 1);
});

await test("mapearPedido y bandejas: agrupa, ordena y calcula lo que queda antes de caducar", () => {
  const t = Date.UTC(2026, 5, 1, 12);
  const linea = (id, n, nombre, precio, qty) => ({ order_id: id, line_no: n, name: nombre, unit_price: precio, qty });
  const p = mapearPedido(pedidoFila("o1", "accepted", t), [linea("o1", 2, "Jugo", "2.00", 1), linea("o1", 1, "Ceviche", "6.50", 2), linea("otro", 1, "Ajeno", "1", 1)]);
  assert.deepEqual([p.total, p.envio, p.pago, p.telefono, p.lineas.map((l) => `${l.cantidad}×${l.nombre}`)], [14.5, 1.5, "cash", "099 123 4567", ["2×Ceviche", "1×Jugo"]], "solo sus líneas, en orden");
  assert.equal(resumenLineas(p.lineas), "2 × Ceviche, 1 × Jugo");
  assert.equal(resumenLineas(Array.from({ length: 5 }, (_, i) => ({ nombre: `P${i}`, precio: 1, cantidad: 1 }))), "1 × P0, 1 × P1, 1 × P2 y 2 más");
  assert.equal(mapearPedido(pedidoFila("x", "raro", t)), null);
  assert.equal(mapearPedido(pedidoFila("x", "placed", t, { kind: "teletransporte" })), null);
  assert.equal(mapearPedido(pedidoFila("x", "placed", t, { customer_phone: null, chat_id: null })).telefono, undefined);
  assert.equal(mapearPedido(pedidoFila("x", "placed", t, { payment_method: "transfer" })).pago, "transfer");
  const lista = [pedidoFila("n2", "placed", t + 5000), pedidoFila("n1", "placed", t), pedidoFila("e1", "preparing", t + 1000), pedidoFila("f1", "delivered", t - 5000, { updated_at: new Date(t + 9000).toISOString() }), pedidoFila("f2", "cancelled", t - 9000, { updated_at: new Date(t + 2000).toISOString() })].map((f) => mapearPedido(f));
  const g = agruparBandeja(lista);
  assert.deepEqual([g.nuevos.map((x) => x.id), g.en_curso.map((x) => x.id), g.finalizados.map((x) => x.id)], [["n1", "n2"], ["e1"], ["f1", "f2"]], "urgentes: el más antiguo primero; finalizados: el más reciente primero");
  assert.deepEqual(["placed", "accepted", "preparing", "on_the_way", "delivered", "rejected", "cancelled"].map(grupoDe), ["nuevos", "en_curso", "en_curso", "en_curso", "finalizados", "finalizados", "finalizados"]);
  assert.equal(tiempoParaCaducar({ estado: "placed", creado: t }, t + 3_600_000), 2 * 3_600_000);
  assert.equal(tiempoParaCaducar({ estado: "placed", creado: t }, t + 4 * 3_600_000), 0);
  assert.equal(tiempoParaCaducar({ estado: "accepted", creado: t }, t), null);
  assert.equal(TTL_SIN_RESPUESTA_MS, 3 * 3_600_000);
  assert.match(SQL_008, /interval '3 hours'/, "el mismo plazo que SQL");
  assert.deepEqual([0, 30_000, 5 * 60_000, 3 * 3_600_000, 86_400_000, 3 * 86_400_000].map((ms) => haceCuanto(t - ms, t)), ["ahora", "ahora", "hace 5 min", "hace 3 h", "hace 1 día", "hace 3 días"]);
});
const cartaValida = () => cambiarCantidad(cambiarCantidad(null, NEGOCIO, prod("a", 6.5, "Ceviche"), 2).carrito, NEGOCIO, prod("b", 2, "Jugo"), 1).carrito;
const pagoValido = (extra = {}) => ({ tipo: "delivery", direccion: "Av. Solano 1-23", zona: "Centro", telefono: "099 123 4567", notas: "", pago: "cash", ...extra });
await test("validarPago: las mismas reglas que place_order()", () => {
  const c = cartaValida();
  assert.deepEqual(validarPago(pagoValido(), c), {});
  assert.deepEqual(Object.keys(validarPago(pagoValido(), null)), ["carrito"]);
  assert.deepEqual(Object.keys(validarPago(pagoValido({ direccion: " a " }), c)), ["direccion"]);
  assert.deepEqual(validarPago(pagoValido({ tipo: "pickup", direccion: "", telefono: "" }), c), {}, "retirar: ni dirección ni teléfono obligatorios");
  assert.deepEqual(Object.keys(validarPago(pagoValido({ telefono: "" }), c)), ["telefono"]);
  assert.deepEqual(Object.keys(validarPago(pagoValido({ telefono: "llámame" }), c)), ["telefono"]);
  assert.deepEqual(Object.keys(validarPago(pagoValido({ tipo: "pickup", direccion: "", telefono: "abc" }), c)), ["telefono"], "si se escribe, debe ser válido");
  assert.deepEqual(Object.keys(validarPago(pagoValido({ notas: "x".repeat(301) }), c)), ["notas"]);
  assert.deepEqual(Object.keys(validarPago(pagoValido({ direccion: "x".repeat(201) }), c)), ["direccion"]);
  assert.deepEqual(Object.keys(validarPago(pagoValido({ pago: "bitcoin" }), c)), ["pago"]);
  const sinEntrega = { ...c, canales: ["local"] };
  assert.match(validarPago(pagoValido(), sinEntrega).tipo, /no entrega a domicilio/);
  assert.match(validarPago(pagoValido({ tipo: "pickup" }), { ...c, canales: ["entrega"] }).tipo, /no ofrece retiro/);
  const corto = cambiarCantidad(null, NEGOCIO, prod("j", 2), 1).carrito;
  assert.match(validarPago(pagoValido(), corto).minimo, /te faltan \$3\.00/);
  assert.deepEqual(validarPago(pagoValido(), { ...corto, pedidoMinimo: 0 }), {});
});
await test("argumentosPedido usa exactamente los parámetros de place_order() en SQL y no manda precios", () => {
  const c = cartaValida();
  const a = argumentosPedido(pagoValido({ notas: "  Sin picante " }), c);
  assert.deepEqual(a, { p_provider: "n1", p_kind: "delivery", p_lines: [{ item_id: "a", qty: 2 }, { item_id: "b", qty: 1 }], p_address: "Av. Solano 1-23", p_zone: "Centro", p_notes: "Sin picante", p_payment: "cash", p_phone: "099 123 4567" });
  const firma = /create or replace function public\.place_order\(([^)]*)\)/s.exec(SQL_008)[1];
  const parametros = [...firma.matchAll(/\b(p_\w+)\b/g)].map((m) => m[1]);
  assert.deepEqual(Object.keys(a).sort(), [...parametros].sort(), "los nombres deben coincidir con SQL");
  const retiro = argumentosPedido(pagoValido({ tipo: "pickup", direccion: "Calle que no importa", telefono: "" }), c);
  assert.deepEqual([retiro.p_kind, retiro.p_address, retiro.p_phone], ["pickup", "", null], "retirar: sin dirección y sin teléfono (null)");
  assert.ok(!JSON.stringify(a.p_lines).includes("6.5"));
});
await test("mensajeErrorPedido traduce los errores del servidor", () => {
  assert.match(mensajeErrorPedido("Tienes demasiados pedidos sin responder"), /varios pedidos esperando respuesta/);
  assert.match(mensajeErrorPedido("Un producto ya no está disponible"), /Revisa tu carrito/);
  assert.match(mensajeErrorPedido("«Amoxicilina» requiere receta médica y no se vende por la app"), /receta médica/);
  assert.match(mensajeErrorPedido("No se puede pasar el pedido de placed a placed"), /ya cambió de estado/);
  assert.match(mensajeErrorPedido("permission denied for function place_order"), /carrito se conserva/);
  assert.equal(mensajeErrorPedido("El pedido mínimo es de 5 USD"), "El pedido mínimo es de 5 USD");
  assert.equal(mensajeErrorPedido("algo raro"), "algo raro");
  assert.deepEqual(Object.keys(PAGOS), ["cash", "transfer"]);
});

console.log("\nSolicitudes y ofertas");
const parametrosSql = (sql, fn) => {
  const m = sql.match(new RegExp(`function public\\.${fn}\\(([^)]*)\\)`));
  assert.ok(m, `no se encontró ${fn} en el SQL`);
  return m[1].split(",").map((p) => p.trim().split(/\s+/)[0]).filter(Boolean);
};
const ahoraSol = Date.UTC(2026, 5, 1, 17, 0); // 12:00 en Ecuador
const solOk = (extra = {}) => ({ vertical: "hogar", subtipo: "plomero", titulo: "Fuga en el baño", descripcion: "", zona: "Centro", destino: "", momento: "today", programada: "", presupuesto: "", detalles: {}, ...extra });
await test("validarSolicitud: campos obligatorios, límites y fechas (hora de Ecuador)", () => {
  assert.deepEqual(validarSolicitud(solOk(), ahoraSol), {});
  assert.ok(validarSolicitud(solOk({ titulo: "Ay" }), ahoraSol).titulo);
  assert.ok(validarSolicitud(solOk({ titulo: "a".repeat(101) }), ahoraSol).titulo);
  assert.ok(validarSolicitud(solOk({ descripcion: "a".repeat(601) }), ahoraSol).descripcion);
  assert.ok(validarSolicitud(solOk({ zona: " " }), ahoraSol).zona);
  assert.ok(validarSolicitud(solOk({ subtipo: "taxi" }), ahoraSol).subtipo, "una categoría de otra sección no vale");
  assert.ok(validarSolicitud(solOk({ vertical: "delivery", subtipo: "restaurante" }), ahoraSol).vertical);
  assert.ok(validarSolicitud(solOk({ vertical: "movilidad", subtipo: "taxi" }), ahoraSol).destino, "un viaje necesita destino");
  assert.deepEqual(validarSolicitud(solOk({ vertical: "movilidad", subtipo: "moto_mensajero" }), ahoraSol), {}, "el mensajero solo pide zona");
  for (const p of ["0", "-3", "abc", "1.234", "$"]) assert.ok(validarSolicitud(solOk({ presupuesto: p }), ahoraSol).presupuesto, `presupuesto «${p}»`);
  for (const p of ["8", "12.50", "12,5", "$20"]) assert.equal(validarSolicitud(solOk({ presupuesto: p }), ahoraSol).presupuesto, undefined, `presupuesto «${p}»`);
  const prog = (t) => validarSolicitud(solOk({ momento: "scheduled", programada: t }), ahoraSol).programada;
  assert.ok(prog(""), "sin fecha");
  assert.ok(prog("no-es-fecha"));
  assert.ok(prog("2026-06-01T11:59"), "pasada (12:00 en Ecuador)");
  assert.equal(prog("2026-06-01T12:01"), undefined);
  assert.equal(prog("2026-08-30T12:00"), undefined, "dentro de 90 días");
  assert.ok(prog("2026-09-02T12:00"), "más de 90 días");
});
await test("instanteDesdeLocal: el valor del input se interpreta en hora de Ecuador", () => {
  assert.equal(instanteDesdeLocal("2026-06-01T12:00"), Date.UTC(2026, 5, 1, 17, 0));
  assert.ok(Number.isNaN(instanteDesdeLocal("2026-06-01")));
  assert.ok(Number.isNaN(instanteDesdeLocal("")));
});
await test("argumentosSolicitud usa exactamente los parámetros de create_service_request() en SQL y depura los detalles", () => {
  const a = argumentosSolicitud(solOk({ presupuesto: "12,5", detalles: { urgente: true, pasajeros: 3, extra: "x".repeat(2000) } }));
  assert.deepEqual(Object.keys(a).sort(), parametrosSql(SQL_006, "create_service_request").sort());
  assert.deepEqual([a.p_budget, a.p_when, a.p_scheduled_at, a.p_dest_zone, a.p_details], [12.5, "today", null, "", { urgente: true }]);
  const viaje = argumentosSolicitud(solOk({ vertical: "movilidad", subtipo: "taxi", destino: " Aeropuerto ", momento: "scheduled", programada: "2026-06-02T08:30", detalles: { pasajeros: 2, urgente: true } }));
  assert.deepEqual([viaje.p_dest_zone, viaje.p_scheduled_at, viaje.p_details], ["Aeropuerto", "2026-06-02T13:30:00.000Z", { pasajeros: 2 }]);
  assert.equal(argumentosSolicitud(solOk({ vertical: "movilidad", subtipo: "taxi", destino: "X", momento: "now", programada: "2026-06-02T08:30" })).p_scheduled_at, null, "solo se envía la fecha si es programada");
  assert.equal(argumentosSolicitud(solOk({ destino: "Otro sitio" })).p_dest_zone, "", "el destino solo cuenta en viajes y encomiendas");
});
await test("camposDetalle / limpiarDetalles / resumenDetalles", () => {
  assert.deepEqual(camposDetalle("movilidad", "taxi").map((c) => c.id), ["pasajeros"]);
  assert.deepEqual(camposDetalle("movilidad", "encomienda").map((c) => c.id), ["tamano"]);
  assert.deepEqual(camposDetalle("hogar", "plomero").map((c) => c.id), ["urgente"]);
  assert.deepEqual(camposDetalle("mascotas", "paseador").map((c) => c.id), ["mascota"]);
  assert.deepEqual(camposDetalle("delivery", "restaurante"), []);
  const c = camposDetalle("movilidad", "taxi");
  assert.deepEqual(limpiarDetalles(c, { pasajeros: 4 }), { pasajeros: 4 });
  for (const malo of [0, 7, 2.5, "3", null, NaN]) assert.deepEqual(limpiarDetalles(c, { pasajeros: malo }), {}, `pasajeros ${String(malo)}`);
  assert.deepEqual(limpiarDetalles(camposDetalle("mascotas", "veterinaria"), { mascota: "dragón" }), {});
  assert.deepEqual(limpiarDetalles(camposDetalle("hogar", "plomero"), { urgente: false }), {}, "«no urgente» no se guarda");
  assert.equal(resumenDetalles("movilidad", "taxi", { pasajeros: 1 }), "1 pasajero");
  assert.equal(resumenDetalles("movilidad", "taxi", { pasajeros: 3 }), "3 pasajeros");
  assert.equal(resumenDetalles("hogar", "plomero", { urgente: true }), "Urgente");
  assert.equal(resumenDetalles("movilidad", "encomienda", { tamano: "pequeno" }), "Pequeño");
  assert.equal(resumenDetalles("hogar", "plomero", {}), "");
  for (const v of VERTICALES_SOLICITUD) for (const s of VERTICAL_POR_ID[v].subtipos) assert.ok(camposDetalle(v, s.id).length >= 1, `${v}/${s.id} sin detalles`);
});
await test("VERTICALES_SOLICITUD sale del catálogo (movilidad, hogar y mascotas)", () => {
  assert.deepEqual([...VERTICALES_SOLICITUD].sort(), ["hogar", "mascotas", "movilidad"]);
});
const filaSol = (extra = {}) => ({ id: "s1", requester_id: "u1", vertical: "hogar", subtype: "plomero", title: "Fuga", description: "", zone: "Centro", dest_zone: "", when_kind: "today", scheduled_at: null, budget_max: "20.00", details: { urgente: true }, status: "open", accepted_offer_id: null, expires_at: new Date(ahoraSol + 3_600_000).toISOString(), created_at: new Date(ahoraSol).toISOString(), ...extra });
await test("mapearSolicitud / mapearOferta y estado visible (una abierta con la hora vencida es «caducada»)", () => {
  const s = mapearSolicitud(filaSol());
  assert.deepEqual([s.presupuesto, s.programada, s.estado, s.detalles, s.caduca], [20, undefined, "open", { urgente: true }, ahoraSol + 3_600_000]);
  assert.equal(mapearSolicitud(filaSol({ budget_max: null })).presupuesto, undefined);
  assert.equal(mapearSolicitud(filaSol({ details: null })).detalles && Object.keys(mapearSolicitud(filaSol({ details: null })).detalles).length, 0);
  assert.equal(mapearSolicitud(filaSol({ vertical: "inventada" })), null);
  assert.equal(mapearSolicitud(filaSol({ status: "rara" })), null);
  assert.equal(mapearSolicitud(filaSol({ when_kind: "cuando sea" })), null);
  assert.equal(estadoVisible(s, ahoraSol), "open");
  assert.equal(estadoVisible(s, ahoraSol + 3_600_000), "expired");
  assert.equal(estadoVisible({ ...s, estado: "accepted" }, ahoraSol + 9e9), "accepted", "solo caducan las abiertas");
  const o = mapearOferta({ id: "o1", request_id: "s1", provider_id: "p1", price: "9.50", eta_minutes: 12, message: null, status: "sent", chat_id: null, created_at: new Date(ahoraSol).toISOString() });
  assert.deepEqual([o.precio, o.minutos, o.mensaje, o.chatId], [9.5, 12, "", undefined]);
  assert.equal(mapearOferta({ ...{ id: "o", request_id: "s", provider_id: "p", price: 1, eta_minutes: 1, message: "", chat_id: null, created_at: new Date(0).toISOString() }, status: "rara" }), null);
});
await test("textos: tiempo restante, tiempo de la oferta y momento", () => {
  assert.equal(tiempoRestante(ahoraSol, ahoraSol), "Caducada");
  assert.equal(tiempoRestante(ahoraSol + 45 * 60_000, ahoraSol), "Quedan 45 min");
  assert.equal(tiempoRestante(ahoraSol + 130 * 60_000, ahoraSol), "Quedan 2 h 10 min");
  assert.equal(tiempoRestante(ahoraSol + 120 * 60_000, ahoraSol), "Quedan 2 h");
  assert.equal(tiempoRestante(ahoraSol + 3 * 86_400_000, ahoraSol), "Quedan 3 d");
  assert.deepEqual([12, 60, 90, 1440, 2880].map(textoTiempoOferta), ["~12 min", "1 h", "1 h 30 min", "1 día", "2 días"]);
  assert.equal(textoMomento({ momento: "now" }), "Ahora mismo");
  assert.equal(textoMomento({ momento: "today" }), "Hoy");
  assert.match(textoMomento({ momento: "scheduled", programada: Date.UTC(2026, 5, 2, 13, 30) }), /08:30/, "hora de Ecuador");
});
await test("validarOferta y argumentosOferta usan las reglas y los parámetros de send_offer()", () => {
  assert.deepEqual(validarOferta({ precio: "9.50", minutos: "12", mensaje: "" }), {});
  assert.ok(validarOferta({ precio: "0", minutos: "12", mensaje: "" }).precio);
  assert.ok(validarOferta({ precio: "9", minutos: "0", mensaje: "" }).minutos);
  assert.ok(validarOferta({ precio: "9", minutos: "10081", mensaje: "" }).minutos);
  assert.ok(validarOferta({ precio: "9", minutos: "1.5", mensaje: "" }).minutos);
  assert.ok(validarOferta({ precio: "9", minutos: "5", mensaje: "a".repeat(301) }).mensaje);
  const a = argumentosOferta("s1", "p1", { precio: "9,5", minutos: " 12 ", mensaje: " Llego rápido " });
  assert.deepEqual(a, { p_request: "s1", p_provider: "p1", p_price: 9.5, p_eta: 12, p_message: "Llego rápido" });
  assert.deepEqual(Object.keys(a).sort(), parametrosSql(SQL_006, "send_offer").sort());
});
await test("ofertas: orden (aceptada, vigentes por precio y rapidez, resto), destacadas y quién puede ofertar", () => {
  const of = (id, estado, precio, minutos, creado = 0) => ({ id, estado, precio, minutos, creado });
  const lista = [of("a", "rejected", 1, 1), of("b", "sent", 12, 10), of("c", "sent", 8, 40), of("d", "sent", 8, 15), of("e", "withdrawn", 2, 2), of("f", "accepted", 20, 30)];
  assert.deepEqual(ordenarOfertas(lista).map((o) => o.id), ["f", "d", "c", "b", "a", "e"]);
  assert.equal(lista[0].id, "a", "no muta");
  assert.deepEqual(destacadas(lista), { barata: "d", rapida: "b" });
  assert.deepEqual(destacadas([of("x", "sent", 5, 5)]), {}, "con una sola oferta no hay nada que comparar");
  const sol = { vertical: "hogar", estado: "open", caduca: ahoraSol + 1000 };
  assert.equal(bloqueoOferta(sol, { identidadVerificada: false, perfilesQueEncajan: 1 }, ahoraSol), null);
  assert.match(bloqueoOferta(sol, { identidadVerificada: false, perfilesQueEncajan: 0 }, ahoraSol), /perfil activo/);
  assert.match(bloqueoOferta({ ...sol, vertical: "movilidad" }, { identidadVerificada: false, perfilesQueEncajan: 1 }, ahoraSol), /verificar tu identidad/);
  assert.equal(bloqueoOferta({ ...sol, vertical: "movilidad" }, { identidadVerificada: true, perfilesQueEncajan: 1 }, ahoraSol), null);
  assert.match(bloqueoOferta(sol, { identidadVerificada: true, perfilesQueEncajan: 1 }, ahoraSol + 5000), /ya no recibe ofertas/);
  assert.match(bloqueoOferta({ ...sol, estado: "accepted" }, { identidadVerificada: true, perfilesQueEncajan: 1 }, ahoraSol), /ya no recibe ofertas/);
  const perfiles = [
    { id: "1", vertical: "hogar", subtipo: "plomero", estado: "active" },
    { id: "2", vertical: "hogar", subtipo: "plomero", estado: "paused" },
    { id: "3", vertical: "hogar", subtipo: "electricista", estado: "active" },
    { id: "4", vertical: "movilidad", subtipo: "plomero", estado: "active" },
  ];
  assert.deepEqual(perfilesQueEncajan({ vertical: "hogar", subtipo: "plomero" }, perfiles).map((p) => p.id), ["1"]);
});
await test("mensajeErrorSolicitud traduce los errores del servidor", () => {
  assert.match(mensajeErrorSolicitud("Ya tienes 5 solicitudes abiertas"), /Cierra alguna/);
  assert.match(mensajeErrorSolicitud("Para ofertar viajes y encomiendas debes verificar tu identidad"), /verificar tu identidad/);
  assert.match(mensajeErrorSolicitud("La solicitud ya no está abierta"), /ya no está abierta/);
  assert.match(mensajeErrorSolicitud("Esa oferta ya fue resuelta"), /Actualiza/);
  assert.match(mensajeErrorSolicitud("No se puede cerrar esa solicitud"), /Actualiza/);
  assert.match(mensajeErrorSolicitud("permission denied for table x"), /sesión caducó/);
  assert.equal(mensajeErrorSolicitud("algo raro"), "algo raro");
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
process.exit(fallos ? 1 : 0);
