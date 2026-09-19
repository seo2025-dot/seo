/**
 * Lógica de cliente de fotos y onboarding (sin navegador): sincronización con el servidor y validación de pasos.
 *   npx tsx supabase/tests/ui-logica.test.mjs
 */
import assert from "node:assert/strict";
import { sincronizarFotos } from "@/features/fotos/sincronizar";
import { BORRADOR_VACIO, PASOS, edadDesde, normalizarUsuario, validarBasico, validarFotos, validarIntereses } from "@/features/onboarding/validacion";

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
  assert.deepEqual(Object.keys(validarBasico(BORRADOR_VACIO, hoy)).sort(), ["nacimiento", "nombre", "usuario"]);
  assert.deepEqual(validarBasico({ ...BORRADOR_VACIO, nombre: "Ana Ruiz", nacimiento: "1990-01-01" }, hoy), {}); // el usuario se deriva del nombre
  assert.match(validarBasico({ ...BORRADOR_VACIO, nombre: "Ana", nacimiento: "2010-01-01" }, hoy).nacimiento, /18 años/);
  assert.match(validarBasico({ ...BORRADOR_VACIO, nombre: "Ana", nacimiento: "1900-01-01" }, hoy).nacimiento, /no es válida/);
  assert.ok(validarBasico({ ...BORRADOR_VACIO, nombre: "x".repeat(61), nacimiento: "1990-01-01" }, hoy).nombre);
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
  assert.deepEqual(PASOS.map((p) => p.id), ["basico", "intereses", "fotos", "confirmar"]);
  assert.deepEqual(PASOS[3].validar({ ...BORRADOR_VACIO, bio: "x".repeat(300) }), {});
  assert.ok(PASOS[3].validar({ ...BORRADOR_VACIO, bio: "x".repeat(301) }).bio);
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
process.exit(fallos ? 1 : 0);
