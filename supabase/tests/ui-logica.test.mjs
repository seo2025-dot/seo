/**
 * Lógica de cliente de fotos y onboarding (sin navegador): sincronización con el servidor y validación de pasos.
 *   npx tsx supabase/tests/ui-logica.test.mjs
 */
import assert from "node:assert/strict";
import { sincronizarFotos } from "@/features/fotos/sincronizar";
import { BORRADOR_VACIO, MIN_PAREJA_IDEAL, PASOS, edadDesde, estaturaCm, normalizarUsuario, validarBasico, validarFotos, validarIntereses, validarPareja } from "@/features/onboarding/validacion";
import { bienvenidaNueva, frasesPruebaSocial, itemsOportunidad, saludoRecurrente } from "@/lib/mensajes";
import { REFLEXIONES, reflexionDelDia } from "@/lib/reflexiones";
import { MINIMOS, completitudPerfil, datosCompletitud } from "@/lib/completitud";
import { MAX_VALORES, VALORES } from "@/data/catalogos";
import { RETOS, msHastaReinicio, resumenRetos } from "@/lib/retos";
import { HITOS, codigoValido, mensajeInvitacion, nivelDe, progresoCirculo, siguienteHito, siguienteNivel, urlInvitacion } from "@/lib/referidos";

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

const FORMACION = { universidad: "Universidad Central", colegio: "Colegio Norte" };
const json = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
const guardada = (id) => ({ key: id, tipo: "guardada", id, url: `/u/${id}.webp`, thumbUrl: `/u/${id}_t.webp` });
const nueva = (key, nombre = `${key}.jpg`) => ({ key, tipo: "nueva", file: new File([new Uint8Array([1, 2, 3])], nombre, { type: "image/jpeg" }), preview: `blob:${key}` });

/** fetch falso que registra las llamadas; `responder` decide la respuesta de cada una. */
function falso(responder) {
  const llamadas = [];
  const f = async (url, init = {}) => {
    const l = { url: String(url), metodo: init.method ?? "GET", cuerpo: init.body };
    llamadas.push(l);
    return responder(l, llamadas.length);
  };
  return { f, llamadas };
}

console.log("\nsincronizarFotos");
await test("borra primero, sube una a una en orden y reordena con una sola petición PATCH", async () => {
  let n = 0;
  const { f, llamadas } = falso((l) => {
    if (l.metodo === "DELETE") return json(200, { ok: true });
    if (l.metodo === "POST") return json(201, { foto: guardada(`nueva${++n}`) });
    return json(200, { ok: true });
  });
  const items = [nueva("k1"), guardada("b"), nueva("k2"), guardada("a")];
  const progreso = [];
  const r = await sincronizarFotos(items, ["a", "b", "c"], (h, t) => progreso.push([h, t]), f);
  assert.deepEqual(llamadas.map((l) => `${l.metodo} ${l.url}`), ["DELETE /api/photos/c", "POST /api/photos", "POST /api/photos", "PATCH /api/photos"]);
  assert.deepEqual(JSON.parse(llamadas[3].cuerpo), { ids: ["nueva1", "b", "nueva2", "a"] });
  assert.deepEqual(r.ids, ["nueva1", "b", "nueva2", "a"]);
  assert.deepEqual(r.errores, []);
  assert.deepEqual(Object.keys(r.subidas), ["k1", "k2"]);
  assert.deepEqual(progreso, [[1, 4], [2, 4], [3, 4], [4, 4]]);
  assert.ok(llamadas[1].cuerpo instanceof FormData && llamadas[1].cuerpo.get("file").name === "k1.jpg");
});
await test("sin cambios de orden ni altas/bajas no hace ninguna petición", async () => {
  const { f, llamadas } = falso(() => json(200, {}));
  const r = await sincronizarFotos([guardada("a"), guardada("b")], ["a", "b"], undefined, f);
  assert.equal(llamadas.length, 0);
  assert.deepEqual(r.ids, ["a", "b"]);
});
await test("un fallo al subir una foto no bloquea las demás y se informa con el mensaje del servidor", async () => {
  const { f, llamadas } = falso((l, i) => {
    if (l.metodo === "POST" && i === 1) return json(415, { mensaje: "Formato no permitido" });
    if (l.metodo === "POST") return json(201, { foto: guardada("ok1") });
    return json(200, {});
  });
  const r = await sincronizarFotos([nueva("k1", "mala.gif"), nueva("k2", "buena.jpg")], [], undefined, f);
  assert.equal(llamadas.filter((l) => l.metodo === "POST").length, 2);
  assert.deepEqual(r.errores, ["«mala.gif»: Formato no permitido"]);
  assert.deepEqual(Object.keys(r.subidas), ["k2"]);
  assert.deepEqual(r.ids, ["ok1"]); // la fallida no entra en el orden
});
await test("errores de red y de borrado se acumulan sin lanzar; un 404 al borrar se considera ya borrada", async () => {
  const { f } = falso((l) => {
    if (l.metodo === "DELETE" && l.url.endsWith("/x")) return json(404, {});
    if (l.metodo === "DELETE") return json(500, {});
    throw new TypeError("fetch failed");
  });
  const r = await sincronizarFotos([nueva("k1", "a.jpg")], ["x", "y"], undefined, f);
  assert.equal(r.errores.length, 2);
  assert.match(r.errores[0], /No se pudo eliminar una foto: Error 500/);
  assert.match(r.errores[1], /«a\.jpg»: sin conexión/);
});
await test("si falla el PATCH se informa del orden pero las subidas se conservan", async () => {
  const { f } = falso((l) => (l.metodo === "PATCH" ? json(409, { mensaje: "Lista de fotos no válida" }) : l.metodo === "POST" ? json(201, { foto: guardada("n") }) : json(200, {})));
  const r = await sincronizarFotos([nueva("k1"), guardada("a")], ["a"], undefined, f);
  assert.deepEqual(r.errores, ["No se pudo guardar el orden: Lista de fotos no válida"]);
  assert.deepEqual(r.ids, ["n", "a"]);
});

console.log("\nValidación del onboarding");
await test("edadDesde: cumpleaños, fechas imposibles y futuras", () => {
  const hoy = new Date(2026, 8, 19); // 19-sep-2026
  assert.equal(edadDesde("2008-09-19", hoy), 18); // cumple hoy
  assert.equal(edadDesde("2008-09-20", hoy), 17); // mañana
  assert.equal(edadDesde("2000-02-29", hoy), 26);
  assert.equal(edadDesde("2001-02-29", hoy), null); // no bisiesto
  assert.equal(edadDesde("2026-09-20", hoy), null); // futura
  assert.equal(edadDesde("1899-01-01", hoy), null);
  assert.equal(edadDesde("19/09/2000", hoy), null);
  assert.equal(edadDesde("", hoy), null);
});
await test("normalizarUsuario: sin acentos, @ ni caracteres raros, máx. 40", () => {
  assert.equal(normalizarUsuario("@@María José!"), "maria_jose");
  assert.equal(normalizarUsuario("  Ñandú.99 "), "nandu.99");
  assert.equal(normalizarUsuario("Ünï-cödé"), "unicode");
  assert.equal(normalizarUsuario("a".repeat(60)).length, 40);
  assert.equal(normalizarUsuario("$$$"), "");
});
await test("validarBasico: nombre, usuario y mayoría de edad", () => {
  const hoy = new Date(2026, 8, 19);
  assert.deepEqual(Object.keys(validarBasico(BORRADOR_VACIO, hoy)).sort(), ["colegio", "nacimiento", "nombre", "universidad", "usuario"]);
  assert.deepEqual(validarBasico({ ...BORRADOR_VACIO, ...FORMACION, nombre: "Ana Ruiz", nacimiento: "1990-01-01" }, hoy), {}); // el usuario se deriva del nombre
  assert.match(validarBasico({ ...BORRADOR_VACIO, ...FORMACION, nombre: "Ana", nacimiento: "2010-01-01" }, hoy).nacimiento, /18 años/);
  assert.match(validarBasico({ ...BORRADOR_VACIO, ...FORMACION, nombre: "Ana", nacimiento: "1900-01-01" }, hoy).nacimiento, /no es válida/);
  assert.ok(validarBasico({ ...BORRADOR_VACIO, ...FORMACION, nombre: "x".repeat(61), nacimiento: "1990-01-01" }, hoy).nombre);
});
await test("validarIntereses y validarFotos: mínimos y máximo de 10", () => {
  assert.deepEqual(Object.keys(validarIntereses(BORRADOR_VACIO)).sort(), ["intereses", "zonas"]);
  assert.deepEqual(validarIntereses({ ...BORRADOR_VACIO, intereses: ["roomie"], zonas: ["Centro"] }), {});
  assert.ok(validarFotos(BORRADOR_VACIO).fotos);
  const fotos = (n) => Array.from({ length: n }, (_, i) => guardada(`f${i}`));
  assert.deepEqual(validarFotos({ ...BORRADOR_VACIO, fotos: fotos(1) }), {});
  assert.deepEqual(validarFotos({ ...BORRADOR_VACIO, fotos: fotos(10) }), {});
  assert.match(validarFotos({ ...BORRADOR_VACIO, fotos: fotos(11) }).fotos, /Máximo 10/);
});
await test("los pasos están en el orden esperado y el último limita la bio a 300", () => {
  assert.deepEqual(PASOS.map((p) => p.id), ["basico", "intereses", "pareja", "fotos", "confirmar"]);
  const ultimo = PASOS[PASOS.length - 1];
  assert.deepEqual(ultimo.validar({ ...BORRADOR_VACIO, bio: "x".repeat(300) }), {});
  assert.ok(ultimo.validar({ ...BORRADOR_VACIO, bio: "x".repeat(301) }).bio);
});
await test("formación obligatoria, estatura opcional en 120–230 cm (admite metros) y pareja ideal de 20 a 1000 caracteres", () => {
  const hoy = new Date(2026, 5, 1);
  const ok = { ...BORRADOR_VACIO, ...FORMACION, nombre: "Ana", nacimiento: "1990-01-01" };
  assert.match(validarBasico({ ...ok, universidad: " " }, hoy).universidad, /universidad/i);
  assert.match(validarBasico({ ...ok, colegio: "x" }, hoy).colegio, /colegio/i);
  assert.ok(validarBasico({ ...ok, universidad: "u".repeat(121) }, hoy).universidad);
  assert.deepEqual(validarBasico({ ...ok, estatura: "" }, hoy), {});
  assert.deepEqual(validarBasico({ ...ok, estatura: "172" }, hoy), {});
  assert.ok(validarBasico({ ...ok, estatura: "abc" }, hoy).estatura);
  assert.ok(validarBasico({ ...ok, estatura: "90" }, hoy).estatura);
  assert.equal(estaturaCm("1,75"), 175);
  assert.equal(estaturaCm("1.8"), 180);
  assert.equal(estaturaCm("172"), 172);
  assert.equal(estaturaCm("250"), null);
  assert.equal(estaturaCm(""), null);
  assert.ok(validarPareja(BORRADOR_VACIO).parejaIdeal);
  assert.ok(validarPareja({ ...BORRADOR_VACIO, parejaIdeal: "x".repeat(19) }).parejaIdeal);
  assert.deepEqual(validarPareja({ ...BORRADOR_VACIO, parejaIdeal: "  " + "x".repeat(20) + "  " }), {});
  assert.ok(validarPareja({ ...BORRADOR_VACIO, parejaIdeal: "x".repeat(1001) }).parejaIdeal);
});

console.log("\nMensajes, retos, referidos y reflexiones");
await test("saludo recurrente: usa el primer nombre, rota por día y es determinista", () => {
  const a = saludoRecurrente("María José Pérez", new Date(2026, 0, 10));
  assert.match(a.titulo + a.texto, /María/);
  assert.doesNotMatch(a.titulo, /Pérez/);
  assert.deepEqual(saludoRecurrente("Luis", new Date(2026, 0, 10)), saludoRecurrente("Luis", new Date(2026, 0, 10)));
  const titulos = new Set(Array.from({ length: 14 }, (_, i) => saludoRecurrente("Luis", new Date(2026, 0, 1 + i)).titulo));
  assert.ok(titulos.size >= 5, "los saludos deben variar de un día a otro");
});
await test("bienvenida: nombra a la persona; el rango de fundador solo con cifras reales pequeñas", () => {
  const b = bienvenidaNueva("Sofía Ramos", 42);
  assert.match(b.titulo, /^Sofía,/);
  assert.equal(b.rango, "Miembro fundador · #42");
  assert.equal(bienvenidaNueva("Sofía", 5000).rango, "Miembro de la comunidad");
  assert.equal(bienvenidaNueva("Sofía", 0).rango, "Miembro de la comunidad", "sin cifra no se inventa rango");
});
await test("oportunidad: solo lista lo que de verdad está pendiente", () => {
  const nada = { likesPendientes: 0, personasNuevas7d: 0, mensajesSinLeer: 0, monedasPorCobrar: 0, monedasEnJuego: 0, racha: 0, bonoDiarioHecho: true, horasParaReinicio: 20 };
  assert.deepEqual(itemsOportunidad(nada), []);
  const ids = (d) => itemsOportunidad({ ...nada, ...d }).map((i) => i.id);
  assert.deepEqual(ids({ likesPendientes: 2, mensajesSinLeer: 1 }), ["likes", "mensajes"]);
  assert.ok(ids({ racha: 3, bonoDiarioHecho: false }).includes("racha"));
  assert.ok(!ids({ racha: 3, bonoDiarioHecho: true }).includes("racha"), "no hay racha en riesgo si ya reclamó");
  assert.ok(!ids({ racha: 1, bonoDiarioHecho: false }).includes("racha"));
  assert.deepEqual(ids({ monedasEnJuego: 40, horasParaReinicio: 3 }), ["reinicio"]);
  assert.deepEqual(ids({ monedasEnJuego: 40, horasParaReinicio: 15 }), [], "sin urgencia real no se fabrica");
  assert.deepEqual(ids({ monedasPorCobrar: 10, monedasEnJuego: 40, horasParaReinicio: 2 }), ["cobrar"]);
  assert.match(itemsOportunidad({ ...nada, likesPendientes: 1 })[0].texto, /^1 persona mostró interés/);
});
await test("prueba social: solo cifras reales y sin exagerar las pequeñas", () => {
  assert.deepEqual(frasesPruebaSocial(null), []);
  assert.deepEqual(frasesPruebaSocial({ members: 3, new_7d: 1, matches_7d: 0, invites_ok: 0 }), ["Estás entre las primeras personas en formar esta comunidad"]);
  const f = frasesPruebaSocial({ members: 1250, new_7d: 40, matches_7d: 1, invites_ok: 7 });
  assert.equal(f.length, 4);
  assert.match(f[0], /1\D?250 personas/);
  assert.match(f[2], /^1 conexión nació/);
});
await test("retos: premios en sync con el servidor y resumen de cobros pendientes", async () => {
  const fs = await import("node:fs");
  const sql = fs.readFileSync(new URL("../update_003_conexion_viral.sql", import.meta.url), "utf8");
  const bloque = /_challenge_catalog[\s\S]*?values (\([^;]*\)) as c/.exec(sql)[1];
  const delServidor = Object.fromEntries([...bloque.matchAll(/\('(\w+)',\s*(\d+),\s*\d+\)/g)].map((m) => [m[1], Number(m[2])]));
  assert.deepEqual(Object.fromEntries(RETOS.map((r) => [r.id, r.premio])), delServidor);
  const r = resumenRetos([{ id: "a", prize: 5, done: true, claimed: false }, { id: "b", prize: 10, done: false, claimed: false }, { id: "c", prize: 15, done: true, claimed: true }]);
  assert.deepEqual([r.hechos, r.total, r.monedasPorCobrar, r.monedasEnJuego], [1, 3, 5, 15]);
  assert.equal(msHastaReinicio(Date.UTC(2026, 0, 1, 23, 0, 0)), 3_600_000, "el reinicio es a medianoche UTC, como current_date del servidor");
});
await test("referidos: niveles, hitos y enlaces coinciden con las reglas del servidor", async () => {
  assert.equal(nivelDe(0).nombre, "Semilla");
  assert.equal(nivelDe(3).nombre, "Conector");
  assert.equal(nivelDe(4).nombre, "Conector");
  assert.equal(nivelDe(20).nombre, "Faro");
  assert.equal(nivelDe(99).nombre, "Faro");
  assert.equal(siguienteNivel(20), null);
  assert.equal(siguienteNivel(4).nombre, "Embajador");
  assert.equal(siguienteHito(3).n, 5);
  assert.equal(siguienteHito(20), null);
  assert.equal(progresoCirculo(5), 25);
  assert.equal(progresoCirculo(50), 100);
  const fs = await import("node:fs");
  const sql = fs.readFileSync(new URL("../update_003_conexion_viral.sql", import.meta.url), "utf8");
  const casos = /case v_n (.*?) else 0 end/.exec(sql)[1];
  assert.deepEqual([...casos.matchAll(/when (\d+) then (\d+)/g)].map((m) => ({ n: Number(m[1]), bonus: Number(m[2]) })), HITOS.map((h) => ({ ...h })));
  assert.match(sql, /_earn\(v_ref, 50, 'referral'\)/);
  assert.match(sql, /_earn\(p_user, 25, 'referred_welcome'\)/);
  assert.equal(urlInvitacion("https://conectari.com/", "abc123def4"), "https://conectari.com/registro?ref=abc123def4");
  assert.match(mensajeInvitacion("Lucía Gómez", "https://x/y"), /^Hola, soy Lucía\./);
  assert.ok(codigoValido("AbC123def4") && !codigoValido("no-valido!") && !codigoValido("") && !codigoValido(null));
});
await test("reflexiones: rotan por día, son deterministas y solo llevan fuente las citas de la obra", () => {
  assert.ok(REFLEXIONES.length >= 10);
  assert.deepEqual(reflexionDelDia(new Date(2026, 3, 1)), reflexionDelDia(new Date(2026, 3, 1)));
  const distintas = new Set(Array.from({ length: REFLEXIONES.length }, (_, i) => reflexionDelDia(new Date(2026, 3, 1 + i)).texto));
  assert.equal(distintas.size, REFLEXIONES.length);
  assert.notEqual(reflexionDelDia(new Date(2026, 3, 1), 1).texto, reflexionDelDia(new Date(2026, 3, 1)).texto);
  for (const r of REFLEXIONES) assert.ok(!r.fuente || /Kardec/.test(r.fuente), "solo llevan fuente las citas de la obra");
  assert.ok(REFLEXIONES.filter((r) => r.fuente).length <= 3, "las citas textuales son pocas y comprobables");
});

const PERFIL_VACIO = { bio: "", fotos: 0, ubicacion: "", zonas: [], intereses: [], estilo: [], parejaIdeal: "", relaciones: [], parejaIdealValores: [], parejaIdealEstilo: [] };
const PERFIL_LLENO = {
  bio: "Restauro pintura colonial y modelo cerámica en un taller junto al río, y creo en las sobremesas largas.",
  fotos: 4, ubicacion: "Cuenca", zonas: ["Centro"], intereses: ["amigos"], estilo: ["Creativo", "Lector"],
  parejaIdeal: "Alguien sereno, honesto y con ganas de construir un hogar", relaciones: ["pareja"], parejaIdealValores: ["Honestidad"], parejaIdealEstilo: ["Lector"],
};

await test("completitud: perfil vacío 0 %, perfil completo 100 % y los pesos suman 100", () => {
  const v = completitudPerfil(PERFIL_VACIO);
  assert.equal(v.porcentaje, 0);
  assert.equal(v.faltantes.length, 6);
  assert.equal(v.items.reduce((t, i) => t + i.peso, 0), 100);
  const l = completitudPerfil(PERFIL_LLENO);
  assert.equal(l.porcentaje, 100);
  assert.deepEqual(l.faltantes, []);
  assert.ok(l.items.every((i) => i.hecho));
});

await test("completitud: cada apartado aporta su peso y admite avance parcial", () => {
  const solo = (campos) => completitudPerfil({ ...PERFIL_VACIO, ...campos });
  assert.equal(solo({ fotos: 3 }).porcentaje, 20);
  assert.equal(solo({ fotos: 1 }).porcentaje, 7); // 1/3 de 20
  assert.equal(solo({ fotos: 9 }).porcentaje, 20, "más fotos de las necesarias no pasan del tope");
  assert.equal(solo({ bio: "x".repeat(60) }).porcentaje, 15);
  assert.equal(solo({ bio: "x".repeat(30) }).porcentaje, 8); // 7,5 redondeado
  assert.equal(solo({ ubicacion: "Quito" }).porcentaje, 8);
  assert.equal(solo({ ubicacion: "Quito", zonas: ["Centro"] }).porcentaje, 15);
  assert.equal(solo({ intereses: ["amigos"], estilo: ["Lector", "Foodie"] }).porcentaje, 15);
  assert.equal(solo({ parejaIdeal: "x".repeat(20) }).porcentaje, 15);
  assert.equal(solo({ relaciones: ["pareja"] }).porcentaje, 7);
  assert.equal(solo({ relaciones: ["pareja"], parejaIdealValores: ["Fe"], parejaIdealEstilo: ["Gamer"] }).porcentaje, 20);
  assert.equal(solo({ bio: "   " }).porcentaje, 0, "los espacios no cuentan");
});

await test("completitud: los faltantes van del apartado que más suma al que menos y dan una ayuda concreta", () => {
  const c = completitudPerfil({ ...PERFIL_LLENO, fotos: 1, bio: "", relaciones: [] });
  // Sin biografía faltan 15 puntos; con 1 de 3 fotos, 13,3; con 2 de 3 opciones de «qué buscas» marcadas, 6,7.
  assert.deepEqual(c.faltantes.map((f) => f.id), ["bio", "fotos", "parejaBusca"]);
  assert.match(c.faltantes[1].ayuda, /Sube 3 fotos \(tienes 1\)/);
  assert.equal(c.porcentaje, 100 - 13 - 15 - 7);
});

await test("completitud: el mínimo de la pareja ideal coincide con el que exige el servidor (20 caracteres)", () => {
  assert.equal(MINIMOS.parejaTexto, MIN_PAREJA_IDEAL);
  assert.equal(completitudPerfil({ ...PERFIL_LLENO, parejaIdeal: "x".repeat(19) }).faltantes[0].id, "parejaTexto");
});

await test("completitud: datosCompletitud toma los campos privados del perfil propio", () => {
  const d = datosCompletitud({ bio: "b", ubicacion: "u", zonas: [], intereses: [], parejaIdeal: "p", relaciones: ["pareja"], parejaIdealValores: ["Fe"] }, 2);
  assert.deepEqual([d.fotos, d.estilo, d.parejaIdealEstilo, d.parejaIdealValores, d.relaciones], [2, [], [], ["Fe"], ["pareja"]]);
  assert.equal(datosCompletitud({ bio: "", ubicacion: "", zonas: [], intereses: [] }, 0).parejaIdeal, "");
});

await test("catálogo de valores: sin repetidos, con límite razonable", () => {
  assert.equal(new Set(VALORES).size, VALORES.length);
  assert.ok(VALORES.length >= 10 && MAX_VALORES >= 3 && MAX_VALORES <= 8, "el servidor admite como máximo 8");
  assert.ok(VALORES.every((v) => v.length <= 40));
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
process.exit(fallos ? 1 : 0);
