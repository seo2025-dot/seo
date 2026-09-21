/**
 * Lógica de cliente de fotos y onboarding (sin navegador): sincronización con el servidor y validación de pasos.
 *   npx tsx supabase/tests/ui-logica.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { sincronizarFotos } from "@/features/fotos/sincronizar";
import { BORRADOR_VACIO, MIN_PAREJA_IDEAL, PASOS, edadDesde, estaturaCm, normalizarUsuario, validarBasico, validarFotos, validarIntereses, validarPareja } from "@/features/onboarding/validacion";
import { bienvenidaNueva, frasesPruebaSocial, itemsOportunidad, saludoRecurrente } from "@/lib/mensajes";
import { REFLEXIONES, TRADICIONES, ordenDeLaRonda, reflexionDelDia, semillaDePersona, numeroDeDia } from "@/lib/reflexiones";
import { BUSCAS, GENEROS, bienvenida, concordar, encaja, esBusca, esGenero, seQuierenConocer } from "@/lib/genero";
import { CIUDADES, CODIGOS_HISPANOS, CUENCA, esPaisHispano, PAISES, PAIS_POR_CODIGO, ciudadMasCercana, coordenadasValidas, distanciaKm, etiquetaUbicacion, leerUbicacion, paisDeZona, redondearCoordenada, textoDistancia, ubicacionDesdeGps, ubicacionManual, ubicacionPorZona, zonaValida } from "@/lib/geo";
import { SALUDO, TEMA_SEMANA, claveDiaLocal, efemerides, enesimoDomingo, faseLunar, fechaLarga, fechaLocal, fraseDeEntrada, horaTexto, momentoDelDia, pascua, proximaEfemeride, pulsoDelDia, solDelDia } from "@/lib/dia";
import { MINIMOS, completitudPerfil, datosCompletitud } from "@/lib/completitud";
import { MAX_VALORES, VALORES } from "@/data/catalogos";
import {
  LOTES_AUTOMATICOS, medallaDe, PUNTOS_ACTIVIDAD, PUNTOS_MINIMOS_TOP, partirEnlaces, progresoHaciaTop, puntosDeActividad, REACCION_POR_ID, REACCIONES,
  resumenReacciones, TAM_LOTE_VISIBLE, TOP_N, bloquesTrasPublicacion, tendenciasSemana, textoUnion, ventanaRotativa,
} from "@/lib/comunidad";
import {
  CANALES, CATEGORIAS_EVENTO, DENUNCIAS_PARA_OCULTAR, ETIQUETA_DIA, ETIQUETA_ESTADO_PEDIDO, MAX_PERFILES_POR_PERSONA, MONEDAS_PRIMER_PERFIL, RAZONES_DENUNCIA,
  VERTICAL_POR_ALIAS, VERTICAL_POR_ID, VERTICALES, VERTICALES_CON_SOLICITUDES, esPedidoAbierto, estaAbierto, etiquetaSubtipo, horarioValido, rutaProveedor, rutaVertical,
  textoHorarioDia, transicionesPedido,
} from "@/data/directorio";
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

const FORMACION = { universidad: "Universidad Central", colegio: "Colegio Norte", genero: "mujer" };
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
  assert.deepEqual(Object.keys(validarBasico(BORRADOR_VACIO, hoy)).sort(), ["colegio", "genero", "nacimiento", "nombre", "universidad", "usuario"]);
  assert.deepEqual(validarBasico({ ...BORRADOR_VACIO, ...FORMACION, nombre: "Ana Ruiz", nacimiento: "1990-01-01" }, hoy), {}); // el usuario se deriva del nombre
  assert.match(validarBasico({ ...BORRADOR_VACIO, ...FORMACION, nombre: "Ana", nacimiento: "2010-01-01" }, hoy).nacimiento, /18 años/);
  assert.match(validarBasico({ ...BORRADOR_VACIO, ...FORMACION, nombre: "Ana", nacimiento: "1900-01-01" }, hoy).nacimiento, /no es válida/);
  assert.ok(validarBasico({ ...BORRADOR_VACIO, ...FORMACION, nombre: "x".repeat(61), nacimiento: "1990-01-01" }, hoy).nombre);
});
await test("validarIntereses y validarFotos: mínimos y máximo de 10", () => {
  assert.deepEqual(Object.keys(validarIntereses(BORRADOR_VACIO)).sort(), ["intereses", "zonas"]);
  assert.deepEqual(validarIntereses({ ...BORRADOR_VACIO, intereses: ["roomie"], zonas: ["Centro"] }), {});
  // Fuera de Ecuador las zonas (que son de Cuenca) son opcionales: quien viene de Europa no tiene que elegir barrios de otra ciudad
  assert.deepEqual(validarIntereses({ ...BORRADOR_VACIO, pais: "ES", intereses: ["amigos"], zonas: [] }), {});
  assert.deepEqual(Object.keys(validarIntereses({ ...BORRADOR_VACIO, pais: "ES" })), ["intereses"]);
  assert.ok(validarFotos(BORRADOR_VACIO).fotos);
  const fotos = (n) => Array.from({ length: n }, (_, i) => guardada(`f${i}`));
  assert.deepEqual(validarFotos({ ...BORRADOR_VACIO, fotos: fotos(1) }), {});
  assert.deepEqual(validarFotos({ ...BORRADOR_VACIO, fotos: fotos(10) }), {});
  assert.match(validarFotos({ ...BORRADOR_VACIO, fotos: fotos(11) }).fotos, /Máximo 10/);
});
await test("inscripción: se pregunta a todas las personas si son hombre o mujer (o prefieren no decirlo) y a quién quieren conocer", () => {
  const hoy = new Date(2026, 8, 19);
  const base = { ...BORRADOR_VACIO, universidad: "Universidad", colegio: "Colegio", nombre: "Ana", nacimiento: "1990-01-01" };
  assert.match(validarBasico({ ...base, genero: "" }, hoy).genero, /hombre o mujer/i);
  for (const g of ["hombre", "mujer", "no_dice"]) assert.deepEqual(validarBasico({ ...base, genero: g }, hoy), {}, g);
  assert.ok(validarBasico({ ...base, genero: "otro" }, hoy).genero, "solo los valores del catálogo");
  for (const b of ["hombres", "mujeres", "todos"]) assert.equal(validarPareja({ ...BORRADOR_VACIO, parejaIdeal: "x".repeat(20), quiereConocer: b }).quiereConocer, undefined, b);
  assert.ok(validarPareja({ ...BORRADOR_VACIO, parejaIdeal: "x".repeat(20), quiereConocer: "nadie" }).quiereConocer);
  assert.equal(BORRADOR_VACIO.genero, "");
  assert.equal(BORRADOR_VACIO.quiereConocer, "", "no se elige nada por defecto: cada persona responde");
});
await test("género: catálogo, encaje en los dos sentidos (igual que _seek_ok en SQL) y concordancia sin adivinar por el nombre", () => {
  assert.deepEqual(GENEROS.map((g) => g.id), ["mujer", "hombre", "no_dice"]);
  assert.deepEqual(BUSCAS.map((b) => b.id), ["mujeres", "hombres", "todos"]);
  assert.ok(esGenero("hombre") && esGenero("no_dice") && !esGenero("x") && !esGenero(null) && esBusca("todos") && !esBusca("hombre"));
  // encaja(busca, género de la otra persona): sin preferencia encaja cualquiera, también quien no dijo su género
  assert.deepEqual([encaja("mujeres", "mujer"), encaja("mujeres", "hombre"), encaja("mujeres", "no_dice"), encaja("mujeres", null)], [true, false, false, false]);
  assert.deepEqual([encaja("hombres", "hombre"), encaja("hombres", "mujer"), encaja("todos", "no_dice"), encaja(null, null), encaja(undefined, "mujer")], [true, false, true, true, true]);
  // los dos sentidos
  assert.ok(seQuierenConocer({ genero: "hombre", busca: "mujeres" }, { genero: "mujer", busca: "hombres" }));
  assert.ok(seQuierenConocer({ genero: "hombre", busca: "hombres" }, { genero: "hombre", busca: "hombres" }));
  assert.ok(seQuierenConocer({ genero: "mujer", busca: "mujeres" }, { genero: "mujer", busca: "todos" }));
  assert.ok(!seQuierenConocer({ genero: "hombre", busca: "mujeres" }, { genero: "mujer", busca: "mujeres" }), "ella no quiere conocer hombres");
  assert.ok(!seQuierenConocer({ genero: "hombre", busca: "mujeres" }, { genero: "hombre", busca: "todos" }), "él no busca hombres");
  assert.ok(seQuierenConocer({ genero: "hombre" }, { genero: "mujer" }), "sin preferencias (personas anteriores a la actualización) nadie desaparece");
  // concordancia
  assert.deepEqual(["hombre", "mujer", "no_dice", null, undefined].map(bienvenida), ["Bienvenido", "Bienvenida", "Te damos la bienvenida", "Te damos la bienvenida", "Te damos la bienvenida"]);
  assert.equal(concordar("mujer", { hombre: "listo", mujer: "lista", neutro: "a punto" }), "lista");
  // La frase de entrada respeta el género y sigue teniendo el nombre
  const dia = { anio: 2026, mes: 9, dia: 23, hora: 9 };
  const frases = (g) => Array.from({ length: 12 }, (_, v) => fraseDeEntrada("Ana", dia, v, g));
  assert.ok(frases("mujer").some((f) => f.includes("Bienvenida")) && frases("hombre").some((f) => f.includes("Bienvenido")));
  assert.ok(!frases("mujer").some((f) => /Bienvenido|orgulloso|orgullosa u orgulloso/.test(f)), "a una mujer no se le habla en masculino");
  assert.ok(!frases("hombre").some((f) => /Bienvenida|orgullosa/.test(f)), "a un hombre no se le habla en femenino");
  assert.ok(!frases(null).some((f) => /Bienvenid[oa]\b|orgullos[oa]/.test(f)), "sin dato: fórmulas neutras");
  assert.ok(frases(undefined).every((f) => f.includes("Ana")));
});
await test("países: todo el mundo hispanohablante está y sale primero; cualquier otra persona, por ejemplo de Europa, también puede inscribirse", () => {
  const codigos = PAISES.map((p) => p.codigo);
  // Los 21 países donde el español es lengua oficial
  const HISPANOS = ["AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "SV", "GQ", "GT", "HN", "MX", "NI", "PA", "PY", "PE", "PR", "ES", "UY", "VE"];
  assert.deepEqual([...CODIGOS_HISPANOS].sort(), [...HISPANOS].sort());
  for (const c of HISPANOS) assert.ok(codigos.includes(c) && esPaisHispano(c), c);
  assert.deepEqual(codigos.slice(0, HISPANOS.length).sort(), [...HISPANOS].sort(), "los hispanohablantes van primero");
  assert.equal(codigos[0], "EC", "Ecuador, el mercado de arranque, al frente");
  const resto = PAISES.slice(HISPANOS.length).map((p) => p.nombre);
  assert.deepEqual(resto, [...resto].sort((a, b) => a.localeCompare(b, "es")), "el resto, por orden alfabético");
  for (const c of ["FR", "DE", "IT", "GB", "PT", "NL", "CH", "US", "BR", "JP", "AU"]) assert.ok(codigos.includes(c) && !esPaisHispano(c), c);
  assert.ok(PAISES.length >= 40);
  // Cada país tiene ciudad de referencia y se reconoce por su zona horaria
  for (const p of PAISES) assert.ok(CIUDADES.some((c) => c.pais === p.codigo), `sin ciudades: ${p.codigo}`);
  assert.deepEqual([paisDeZona("America/Havana"), paisDeZona("America/Managua"), paisDeZona("America/Puerto_Rico"), paisDeZona("Africa/Malabo"), paisDeZona("Europe/Amsterdam")], ["CU", "NI", "PR", "GQ", "NL"]);
  assert.equal(ubicacionPorZona("Europe/Amsterdam").pais, "NL");
  assert.equal(ubicacionManual("NI").ciudad, "Managua");
  assert.equal(ubicacionDesdeGps(52.37, 4.9, "Europe/Amsterdam").ciudad, "Ámsterdam");
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
  assert.match(validarPareja(BORRADOR_VACIO).quiereConocer, /a quién/i, "hay que elegir a quién se quiere conocer");
  assert.ok(validarPareja({ ...BORRADOR_VACIO, parejaIdeal: "x".repeat(19) }).parejaIdeal);
  assert.deepEqual(validarPareja({ ...BORRADOR_VACIO, quiereConocer: "todos", parejaIdeal: "  " + "x".repeat(20) + "  " }), {});
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
await test("reflexiones: tres tradiciones, sin repetir dentro de una ronda, con la fuente solo en frases textuales comprobables", () => {
  const por = (t) => REFLEXIONES.filter((r) => r.tradicion === t);
  assert.ok(REFLEXIONES.length >= 80);
  assert.ok(por("espiritismo").length >= 20 && por("estoicismo").length >= 30 && por("psicologia").length >= 30, "cada tradición tiene su propio catálogo");
  assert.equal(new Set(REFLEXIONES.map((r) => r.texto)).size, REFLEXIONES.length, "sin frases duplicadas");
  for (const r of REFLEXIONES) {
    assert.ok(r.texto.length >= 20 && r.texto.length <= 240, `longitud: ${r.texto}`);
    assert.ok(TRADICIONES[r.tradicion], r.tradicion);
    // Solo las frases textuales llevan «fuente» (obra y pasaje); las demás son propias y, si parten de un concepto, lo dicen en «idea»
    if (r.fuente) assert.match(r.fuente, /Kardec|Séneca|Epicteto|Marco Aurelio|Frankl|Rogers/, `fuente dudosa: ${r.fuente}`);
    if (r.idea) assert.ok(!r.fuente, "una frase es cita (fuente) o reflexión propia (idea), no las dos");
  }
  assert.ok(REFLEXIONES.filter((r) => r.fuente).length <= 12, "las citas textuales son pocas y comprobables");
  for (const r of REFLEXIONES.filter((x) => x.fuente && x.tradicion !== "espiritismo")) assert.match(r.fuente, /\(traducción libre\)/, "las traducciones se declaran");
});
await test("reflexionDelDia: cambia cada día, recorre todo el catálogo antes de repetir, no repite entre días seguidos y rota de tradición", () => {
  assert.deepEqual(reflexionDelDia(new Date(2026, 3, 1)), reflexionDelDia(new Date(2026, 3, 1)), "determinista");
  // Recorre una ronda completa (empezando en un múltiplo del tamaño del catálogo): cada reflexión sale exactamente una vez
  let inicio = new Date(2026, 0, 1);
  while (numeroDeDia(inicio) % REFLEXIONES.length !== 0) inicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 1);
  const ronda = Array.from({ length: REFLEXIONES.length }, (_, i) => reflexionDelDia(new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)));
  assert.equal(new Set(ronda.map((r) => r.texto)).size, REFLEXIONES.length, "todas distintas dentro de la ronda");
  // Ningún par de días seguidos repite reflexión, ni siquiera al cambiar de ronda (probado en 3 rondas)
  for (let i = 0; i < REFLEXIONES.length * 3; i++) {
    const d = (n) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + n);
    assert.notEqual(reflexionDelDia(d(i)).texto, reflexionDelDia(d(i + 1)).texto, `día ${i}`);
  }
  // La rotación entre tradiciones: en cualquier semana salen al menos dos tradiciones distintas y nunca 5 seguidas de la misma
  let seguidas = 1;
  let maxSeguidas = 1;
  for (let i = 1; i < ronda.length; i++) {
    seguidas = ronda[i].tradicion === ronda[i - 1].tradicion ? seguidas + 1 : 1;
    maxSeguidas = Math.max(maxSeguidas, seguidas);
  }
  assert.ok(maxSeguidas <= 4, `demasiados días seguidos de la misma tradición: ${maxSeguidas}`);
  for (let s = 0; s + 7 <= ronda.length; s += 7) assert.ok(new Set(ronda.slice(s, s + 7).map((r) => r.tradicion)).size >= 2, `semana ${s / 7}`);
  // Otra rondas se barajan distinto
  const ronda2 = ordenDeLaRonda(1).map((r) => r.texto);
  assert.notDeepEqual(ordenDeLaRonda(0).map((r) => r.texto), ronda2);
  assert.equal(new Set(ronda2).size, REFLEXIONES.length);
});
await test("reflexionDelDia: cada persona ve una distinta el mismo día y «otra reflexión» da la siguiente", () => {
  const dia = new Date(2026, 5, 15);
  const personas = ["ana", "beto", "carla", "diego", "eva", "fabian", "gina", "hugo"].map((id) => reflexionDelDia(dia, 0, id).texto);
  assert.ok(new Set(personas).size >= 6, "la mayoría de las personas ve una reflexión distinta");
  assert.deepEqual(reflexionDelDia(dia, 0, "ana"), reflexionDelDia(dia, 0, "ana"), "una misma persona ve siempre la misma ese día");
  assert.notEqual(reflexionDelDia(dia, 1, "ana").texto, reflexionDelDia(dia, 0, "ana").texto);
  assert.deepEqual(reflexionDelDia(dia, 1, "ana"), reflexionDelDia(new Date(2026, 5, 16), 0, "ana"), "«otra» es la de mañana, adelantada");
  assert.ok(semillaDePersona("ana") >= 0 && semillaDePersona("ana") < REFLEXIONES.length);
});

console.log("\nGeolocalización, hora y el día de hoy");
const CUENCA_ = CUENCA;
await test("geo: distancias, textos y coordenadas (el redondeo protege la privacidad)", () => {
  const quito = CIUDADES.find((c) => c.nombre === "Quito");
  const cuenca = CIUDADES.find((c) => c.nombre === "Cuenca");
  assert.ok(Math.abs(distanciaKm(cuenca, quito) - 308) < 6, "Cuenca–Quito ≈ 308 km");
  assert.equal(distanciaKm(cuenca, cuenca), 0);
  assert.ok(Math.abs(distanciaKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 }) - 20015) < 40, "media vuelta al mundo");
  assert.deepEqual([0.3, 0.97, 3.24, 9.96, 48.4, 1200].map(textoDistancia), ["300 m", "950 m", "3,2 km", "10,0 km", "48 km", "1200 km"]);
  assert.equal(textoDistancia(-1), "");
  assert.equal(textoDistancia(Number.NaN), "");
  assert.equal(redondearCoordenada(-2.90123), -2.9);
  assert.equal(redondearCoordenada(-79.00589, 3), -79.006);
  assert.ok(coordenadasValidas(-2.9, -79) && !coordenadasValidas(91, 0) && !coordenadasValidas(0, 181) && !coordenadasValidas(Number.NaN, 0) && !coordenadasValidas("1", "2") && !coordenadasValidas(null, null));
  assert.deepEqual(ciudadMasCercana(-2.95, -79.0).ciudad.nombre, "Cuenca");
  assert.equal(ciudadMasCercana(-2.95, -79.0, "CO").ciudad.pais, "CO", "se puede limitar a un país");
});
await test("geo: la ubicación se deduce de la zona horaria, del GPS o de la elección manual, y siempre sale redondeada", () => {
  assert.equal(paisDeZona("America/Guayaquil"), "EC");
  assert.equal(paisDeZona("Pacific/Galapagos"), "EC");
  assert.equal(paisDeZona("Europe/Madrid"), "ES");
  assert.equal(paisDeZona("Africa/Nairobi"), null);
  assert.deepEqual(ubicacionPorZona("Africa/Nairobi"), CUENCA_, "país desconocido: Cuenca");
  const co = ubicacionPorZona("America/Bogota");
  assert.deepEqual([co.pais, co.ciudad, co.zona, co.fuente], ["CO", "Bogotá", "America/Bogota", "zona_horaria"]);
  const gps = ubicacionDesdeGps(-2.90123456, -79.00589123, "America/Guayaquil");
  assert.deepEqual([gps.pais, gps.ciudad, gps.lat, gps.lng, gps.fuente], ["EC", "Cuenca", -2.9, -79.01, "gps"], "coordenadas a 2 decimales (~1 km)");
  const madrid = ubicacionDesdeGps(40.4201, -3.7043, "Europe/Madrid");
  assert.deepEqual([madrid.pais, madrid.ciudad, madrid.zona], ["ES", "Madrid", "Europe/Madrid"]);
  const campo = ubicacionDesdeGps(-1.5, -72, "America/Guayaquil");
  assert.deepEqual([campo.pais, campo.ciudad], ["EC", undefined], "lejos de una ciudad de referencia no se inventa una ciudad");
  assert.equal(ubicacionDesdeGps(200, 0, null), null);
  assert.equal(ubicacionDesdeGps(-2.9, -79, "Zona/Inventada").zona, "America/Guayaquil", "una zona que el navegador no entiende se sustituye por la del país");
  assert.deepEqual([ubicacionManual("PE", "Arequipa").ciudad, ubicacionManual("PE").ciudad, ubicacionManual("ZZ")], ["Arequipa", "Lima", null]);
  assert.equal(etiquetaUbicacion({ pais: "EC", ciudad: "Cuenca" }), "Cuenca, Ecuador");
  assert.equal(etiquetaUbicacion({ pais: "ES" }), "España");
  assert.ok(PAISES.every((p) => p.zonas.includes(p.zona) && zonaValida(p.zona) && /^[A-Z]{3}$/.test(p.moneda)), "el catálogo de países es coherente");
  assert.equal(new Set(PAISES.map((p) => p.codigo)).size, PAISES.length);
  assert.ok(CIUDADES.every((c) => PAIS_POR_CODIGO[c.pais] && coordenadasValidas(c.lat, c.lng)));
});
await test("geo: leerUbicacion descarta lo manipulado y redondea lo guardado", () => {
  const buena = JSON.stringify({ pais: "EC", ciudad: "Cuenca", lat: -2.9012, lng: -79.0088, zona: "America/Guayaquil", fuente: "gps" });
  assert.deepEqual(leerUbicacion(buena), { pais: "EC", ciudad: "Cuenca", lat: -2.9, lng: -79.01, zona: "America/Guayaquil", fuente: "gps" });
  for (const mala of [null, "", "no es json", "{}", JSON.stringify({ pais: "ZZ", lat: 0, lng: 0, zona: "America/Guayaquil" }), JSON.stringify({ pais: "EC", lat: 999, lng: 0, zona: "America/Guayaquil" }), JSON.stringify({ pais: "EC", lat: 0, lng: 0, zona: "<script>" }), JSON.stringify({ pais: "EC", lat: "0", lng: "0", zona: "America/Guayaquil" })]) assert.equal(leerUbicacion(mala), null, String(mala));
  assert.equal(leerUbicacion(JSON.stringify({ pais: "EC", lat: 0, lng: 0, zona: "America/Guayaquil", fuente: "hackeo" })).fuente, "defecto");
  assert.equal(leerUbicacion(JSON.stringify({ pais: "EC", ciudad: "x".repeat(200), lat: 0, lng: 0, zona: "America/Guayaquil" })).ciudad.length, 60);
});
const AHORA_D = Date.UTC(2026, 8, 23, 19, 32); // miércoles 23 de septiembre de 2026, 14:32 en Cuenca
await test("dia: la hora y la fecha son las del lugar de la persona (zonas, horario de verano y cambio de día)", () => {
  const cu = fechaLocal(AHORA_D, "America/Guayaquil");
  assert.deepEqual([cu.hora, cu.minuto, cu.dia, cu.mes, cu.diaSemana, cu.diaDelAnio], [14, 32, 23, 9, 3, 266]);
  assert.equal(fechaLarga(cu), "miércoles 23 de septiembre");
  assert.equal(horaTexto({ hora: 7, minuto: 5 }), "07:05");
  assert.equal(fechaLocal(AHORA_D, "Europe/Madrid").hora, 21, "Madrid en septiembre: UTC+2");
  assert.equal(fechaLocal(Date.UTC(2026, 0, 15, 12), "Europe/Madrid").hora, 13, "Madrid en enero: UTC+1");
  assert.equal(fechaLocal(Date.UTC(2026, 6, 1, 3), "America/Guayaquil").dia, 30, "3:00 UTC del 1 de julio todavía es 30 de junio en Cuenca");
  assert.equal(fechaLocal(Date.UTC(2026, 11, 31, 23, 30), "Asia/Tokyo").anio, 2027);
  assert.equal(claveDiaLocal(cu), "2026-09-23");
  assert.deepEqual([4, 5, 11, 12, 17, 18, 20, 21, 23, 0].map(momentoDelDia), ["noche", "manana", "manana", "tarde", "tarde", "atardecer", "atardecer", "noche", "noche", "noche"]);
  assert.deepEqual([SALUDO.manana.texto, SALUDO.tarde.texto, SALUDO.noche.texto], ["Buenos días", "Buenas tardes", "Buenas noches"]);
});
await test("dia: la luna sigue el calendario real (luna nueva del 11 de enero de 2024 y llena del 25)", () => {
  const nueva = faseLunar(Date.UTC(2024, 0, 11, 12));
  assert.deepEqual([nueva.nombre, nueva.emoji], ["Luna nueva", "🌑"]);
  assert.ok(nueva.iluminacion <= 2);
  assert.deepEqual([faseLunar(Date.UTC(2024, 0, 25, 18)).nombre, faseLunar(Date.UTC(2024, 0, 25, 18)).iluminacion >= 98], ["Luna llena", true]);
  assert.equal(faseLunar(Date.UTC(2024, 0, 18, 12)).nombre, "Cuarto creciente");
  assert.ok(faseLunar(Date.UTC(2024, 0, 3, 12)).nombre.includes("menguante"));
  for (let i = 0; i < 60; i++) {
    const f = faseLunar(Date.UTC(2026, 0, 1 + i, 12));
    assert.ok(f.edad >= 0 && f.edad < 29.54 && f.iluminacion >= 0 && f.iluminacion <= 100 && f.emoji, `día ${i}`);
  }
  // Un ciclo lunar completo pasa por las 8 fases
  assert.equal(new Set(Array.from({ length: 30 }, (_, i) => faseLunar(Date.UTC(2026, 0, 1 + i, 12)).nombre)).size, 8);
});
await test("dia: amanecer y ocaso por ubicación (equinoccio en Cuenca, verano e invierno en Madrid, sol de medianoche)", () => {
  const cuenca = solDelDia(AHORA_D, CUENCA_);
  assert.match(cuenca.amanece, /^0[56]:\d\d$/);
  assert.match(cuenca.anochece, /^18:\d\d$/);
  assert.ok(cuenca.horasDeLuz > 11.9 && cuenca.horasDeLuz < 12.3, "en el ecuador el día dura casi 12 h todo el año");
  for (let mes = 0; mes < 12; mes++) {
    const s = solDelDia(Date.UTC(2026, mes, 15, 17), CUENCA_);
    assert.ok(s.horasDeLuz >= 11.8 && s.horasDeLuz <= 12.4 && s.amanece < "06:30" && s.amanece > "05:40", `mes ${mes + 1}: ${s.amanece}`);
  }
  const madrid = ubicacionManual("ES", "Madrid");
  const verano = solDelDia(Date.UTC(2026, 5, 21, 12), madrid);
  const invierno = solDelDia(Date.UTC(2026, 11, 21, 12), madrid);
  assert.ok(verano.horasDeLuz > 14.5 && invierno.horasDeLuz < 9.8, `${verano.horasDeLuz} / ${invierno.horasDeLuz}`);
  assert.ok(verano.anochece > "21:00" && invierno.anochece < "18:30");
  const sur = solDelDia(Date.UTC(2026, 5, 21, 12), ubicacionManual("AR", "Buenos Aires"));
  assert.ok(sur.horasDeLuz < 10.5, "el invierno austral tiene días cortos en junio");
  const polar = solDelDia(Date.UTC(2026, 5, 21, 12), { lat: 80, lng: 10, zona: "Europe/Berlin" });
  assert.deepEqual(polar, { amanece: null, anochece: null, horasDeLuz: null });
});
await test("dia: Pascua, Carnaval, Viernes Santo y los días de la Madre y del Padre caen donde deben", () => {
  assert.deepEqual([2024, 2025, 2026, 2027, 2028].map((a) => [pascua(a).mes, pascua(a).dia]), [[3, 31], [4, 20], [4, 5], [3, 28], [4, 16]]);
  assert.deepEqual([efemerides({ anio: 2026, mes: 2, dia: 16 }, "EC")[0].titulo, efemerides({ anio: 2026, mes: 2, dia: 17 }, "EC")[0].titulo], ["Carnaval (lunes)", "Carnaval (martes)"]);
  assert.equal(efemerides({ anio: 2026, mes: 4, dia: 3 }, "EC")[0].titulo, "Viernes Santo");
  assert.equal(efemerides({ anio: 2026, mes: 5, dia: 10 }, "EC")[0].titulo, "Día de la Madre");
  assert.equal(efemerides({ anio: 2026, mes: 6, dia: 21 }, "EC")[0].titulo, "Día del Padre");
  assert.deepEqual([enesimoDomingo(2026, 5, 2), enesimoDomingo(2026, 6, 3), enesimoDomingo(2027, 5, 2)], [10, 21, 9]);
});
await test("dia: los feriados son de Ecuador y no se atribuyen a otros países; las conmemoraciones mundiales sí valen en todos", () => {
  const dia = (mes, d) => ({ anio: 2026, mes, dia: d });
  assert.equal(efemerides(dia(11, 3), "EC")[0].titulo, "Independencia de Cuenca (1820)");
  assert.equal(efemerides(dia(11, 3), "EC")[0].tipo, "feriado");
  assert.deepEqual(efemerides(dia(11, 3), "CO"), [], "Colombia no celebra la independencia de Cuenca");
  assert.deepEqual(efemerides(dia(5, 24), "PE"), []);
  assert.equal(efemerides(dia(3, 8), "ES")[0].titulo, "Día Internacional de la Mujer");
  assert.equal(efemerides(dia(10, 10), "MX")[0].titulo, "Día Mundial de la Salud Mental");
  assert.equal(efemerides(dia(4, 12), "EC")[0].tipo, "local");
  assert.deepEqual(efemerides(dia(7, 9), "EC"), [], "un día sin nada especial no inventa efemérides");
  // Desde el 23 de septiembre, lo próximo en Ecuador es la Independencia de Guayaquil (9 oct = 16 días)
  const p = proximaEfemeride(dia(9, 23), "EC");
  assert.deepEqual([p.efemeride.titulo, p.dias], ["Independencia de Guayaquil (1820)", 16]);
  assert.equal(proximaEfemeride(dia(9, 23), "EC", 10), null, "solo mira dentro del plazo");
  assert.equal(proximaEfemeride({ anio: 2026, mes: 12, dia: 30 }, "EC").dias, 1, "cruza el fin de año");
  assert.equal(proximaEfemeride({ anio: 2026, mes: 12, dia: 30 }, "EC").efemeride.titulo, "Año Viejo");
});
await test("dia: la frase de entrada cambia cada día y en cada visita, y respeta el momento del día", () => {
  const f = (dia, hora) => ({ anio: 2026, mes: 9, dia, hora });
  assert.equal(fraseDeEntrada("Ana", f(23, 9), 0), fraseDeEntrada("Ana", f(23, 9), 0), "determinista");
  const visitas = new Set(Array.from({ length: 6 }, (_, v) => fraseDeEntrada("Ana", f(23, 9), v)));
  assert.equal(visitas.size, 6, "seis visitas seguidas, seis frases distintas");
  const dias = new Set(Array.from({ length: 12 }, (_, d) => fraseDeEntrada("Ana", f(1 + d, 9), 0)));
  assert.ok(dias.size >= 6, "días distintos, frases distintas");
  for (const hora of [9, 14, 19, 23]) assert.ok(fraseDeEntrada("Ana", f(23, hora), 0).includes("Ana"), "usa el nombre");
  assert.notEqual(fraseDeEntrada("Ana", f(23, 9), 0), fraseDeEntrada("Ana", f(23, 23), 0), "de mañana y de noche no son las mismas");
  assert.equal(TEMA_SEMANA.length, 7);
  assert.ok(TEMA_SEMANA.every((t) => t.accion.href.startsWith("/") && t.texto.length > 20));
});
await test("dia: pulsoDelDia junta todo para un lugar (Cuenca por defecto) y cambia con la ubicación", () => {
  const p = pulsoDelDia(AHORA_D);
  assert.deepEqual([p.hora, p.fechaLarga, p.saludo.texto, p.signo.nombre, p.lugar, p.tema.accion.href], ["14:32", "miércoles 23 de septiembre", "Buenas tardes", "Libra", "Cuenca", "/comunidad"]);
  assert.ok(p.sol.amanece && p.luna.emoji);
  assert.deepEqual([p.proxima.efemeride.titulo, p.proxima.dias], ["Independencia de Guayaquil (1820)", 16]);
  const madrid = pulsoDelDia(AHORA_D, ubicacionManual("ES", "Madrid"));
  assert.deepEqual([madrid.hora, madrid.saludo.texto, madrid.lugar, madrid.proxima.efemeride.tipo !== "feriado"], ["21:32", "Buenas noches", "Madrid", true], "otra zona horaria, otro saludo, sin feriados de Ecuador");
  const tokio = pulsoDelDia(Date.UTC(2026, 11, 31, 23, 30), { pais: "EC", ciudad: "Tokio", lat: 35.68, lng: 139.65, zona: "Asia/Tokyo", fuente: "manual" });
  assert.deepEqual([tokio.fecha.anio, tokio.fechaLarga], [2027, "viernes 1 de enero"]);
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

const SQL_005 = fs.readFileSync(new URL("../update_005_comunidad_viva.sql", import.meta.url), "utf8");

await test("reacciones: el catálogo coincide con el check de la base de datos y el resumen ordena por frecuencia", () => {
  const enSql = /reaction in \(([^)]*)\)/.exec(SQL_005)[1].split(",").map((x) => x.trim().replace(/'/g, ""));
  assert.deepEqual(REACCIONES.map((r) => r.id), enSql, "ids distintos a post_likes.reaction");
  assert.ok(REACCIONES.every((r) => r.emoji && r.etiqueta) && REACCION_POR_ID.love.emoji === "❤️");
  assert.deepEqual(resumenReacciones({}), { total: 0, top: [] });
  const r = resumenReacciones({ a: "love", b: "like", c: "love", d: "wow", e: "love", f: "like" });
  assert.equal(r.total, 6);
  assert.deepEqual(r.top, [{ id: "love", n: 3 }, { id: "like", n: 2 }, { id: "wow", n: 1 }]);
  assert.deepEqual(resumenReacciones({ a: "clap", b: "like" }).top.map((x) => x.id), ["like", "clap"], "a igualdad, el orden del catálogo");
});

await test("fama: las reglas de puntos coinciden con la función SQL y los topes se respetan", () => {
  for (const p of PUNTOS_ACTIVIDAD) assert.ok(p.tope >= p.puntos && p.tope % p.puntos === 0, p.id);
  const topesEnSql = [...SQL_005.matchAll(/least\((\d+),\s*(?:(\d+)\s*\*\s*)?count\(\*\)\)/g)].map((m) => [Number(m[1]), Number(m[2] ?? 1)]);
  const previstos = PUNTOS_ACTIVIDAD.map((p) => [p.tope, p.puntos]);
  // El SQL tiene 6 categorías (una de ellas, matches, sobre la unión de user_a y user_b).
  assert.deepEqual(topesEnSql.sort((a, b) => a[0] - b[0] || a[1] - b[1]), previstos.sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  assert.match(SQL_005, /where s\.score >= 10/);
  assert.equal(PUNTOS_MINIMOS_TOP, 10);
  assert.equal(TOP_N, 10);
  const cero = { publicaciones: 0, reaccionesRecibidas: 0, comentariosRecibidos: 0, comentariosHechos: 0, invitados: 0, matches: 0 };
  assert.equal(puntosDeActividad(cero), 0);
  assert.equal(puntosDeActividad({ ...cero, publicaciones: 2 }), 6);
  assert.equal(puntosDeActividad({ ...cero, publicaciones: 999, invitados: 999 }), 30 + 100);
  assert.equal(puntosDeActividad({ ...cero, publicaciones: -5 }), 0, "cantidades negativas no restan");
});

await test("fama: el progreso hacia el Top 10 y las medallas", () => {
  assert.deepEqual(progresoHaciaTop({ score: 4, rank: 12, is_top: false, threshold: 10 }), { falta: 6, porcentaje: 40 });
  assert.deepEqual(progresoHaciaTop({ score: 0, rank: null, is_top: false, threshold: 10 }), { falta: 10, porcentaje: 0 });
  assert.deepEqual(progresoHaciaTop({ score: 64, rank: 1, is_top: true, threshold: 10 }), { falta: 0, porcentaje: 100 });
  assert.deepEqual(progresoHaciaTop({ score: 40, rank: 11, is_top: false, threshold: 30 }), { falta: 0, porcentaje: 100 }, "nunca pasa del 100 %");
  assert.deepEqual([1, 2, 3, 4].map(medallaDe), ["🥇", "🥈", "🥉", null]);
});

await test("miembros recientes: la ventana rotativa da la vuelta y «se unió hace…» usa la unidad adecuada", () => {
  assert.deepEqual(ventanaRotativa([], 3, 5), []);
  assert.deepEqual(ventanaRotativa(["a", "b", "c"], 0, 7), ["a", "b", "c"], "no repite si hay menos de los pedidos");
  assert.deepEqual(ventanaRotativa(["a", "b", "c", "d", "e"], 3, 3), ["d", "e", "a"]);
  assert.deepEqual(ventanaRotativa(["a", "b", "c"], -1, 2), ["c", "a"]);
  const t = Date.UTC(2026, 0, 1, 12);
  assert.deepEqual([0, 30_000, 5 * 60_000, 3 * 3_600_000, 2 * 86_400_000, 40 * 86_400_000].map((ms) => textoUnion(t - ms, t)),
    ["se unió ahora", "se unió ahora", "se unió hace 5 min", "se unió hace 3 h", "se unió hace 2 d", "se unió este mes"]);
});

await test("muro: los bloques intercalados van tras su publicación y un muro corto no los pierde", () => {
  const dondeVa = (mostradas) => Object.fromEntries(Array.from({ length: mostradas }, (_, i) => [i, bloquesTrasPublicacion(i, mostradas)]));
  const largo = dondeVa(12);
  assert.deepEqual(largo[2], ["sugerencias"]); // tras la 3.ª publicación
  assert.deepEqual(largo[5], ["invitar"]);
  assert.deepEqual(largo[7], ["conectores"]);
  assert.deepEqual(largo[9], ["ofertas"]);
  assert.deepEqual(largo[0], []);
  const corto = dondeVa(2);
  assert.deepEqual(corto[1].sort(), ["conectores", "invitar", "ofertas", "sugerencias"], "todos tras la última si hay solo 2");
  assert.deepEqual(dondeVa(1)[0].length, 4);
  assert.deepEqual(bloquesTrasPublicacion(0, 0), [], "sin publicaciones no hay posición: los pinta el muro aparte");
  assert.ok(LOTES_AUTOMATICOS >= 2 && TAM_LOTE_VISIBLE >= 4);
});

await test("enlaces: se reconocen http(s) y www, se excluye la puntuación final y nunca se enlaza javascript:", () => {
  assert.deepEqual(partirEnlaces("hola"), [{ tipo: "texto", valor: "hola" }]);
  assert.deepEqual(partirEnlaces("Mira https://ejemplo.com/casa?id=1, es genial."), [
    { tipo: "texto", valor: "Mira " },
    { tipo: "enlace", valor: "https://ejemplo.com/casa?id=1", href: "https://ejemplo.com/casa?id=1" },
    { tipo: "texto", valor: ", es genial." },
  ]);
  assert.deepEqual(partirEnlaces("(www.conectari.com)"), [
    { tipo: "texto", valor: "(" },
    { tipo: "enlace", valor: "www.conectari.com", href: "https://www.conectari.com" },
    { tipo: "texto", valor: ")" },
  ]);
  for (const peligroso of ["javascript:alert(1)", "data:text/html,<script>", "vbscript:x", "ftp://x.com"]) {
    assert.ok(partirEnlaces(peligroso).every((t) => t.tipo === "texto"), peligroso);
  }
  const mixto = partirEnlaces("http://a.com y https://b.com");
  assert.equal(mixto.filter((t) => t.tipo === "enlace").length, 2);
  assert.equal(mixto.map((t) => t.valor).join(""), "http://a.com y https://b.com", "no se pierde ni se inventa texto");
  assert.ok(partirEnlaces("https://x.com/\"onmouseover=alert(1)").every((t) => t.tipo === "texto" || !t.href.includes("\"")), "las comillas cortan el enlace");
});

await test("tendencias: solo la última semana, por zona, de más a menos y con desempate estable", () => {
  const ahora = Date.UTC(2026, 5, 15);
  const dia = 86_400_000;
  const posts = [
    { zona: "Centro", ts: ahora - dia }, { zona: "Centro", ts: ahora - 2 * dia }, { zona: " Centro ", ts: ahora - 3 * dia },
    { zona: "Valle Alto", ts: ahora - dia }, { zona: "Valle Alto", ts: ahora - 6 * dia },
    { zona: "Zona Sur", ts: ahora - dia },
    { zona: "Zona Norte", ts: ahora - 8 * dia }, // demasiado vieja
    { ts: ahora - dia }, { zona: "", ts: ahora - dia }, // sin zona
  ];
  assert.deepEqual(tendenciasSemana(posts, ahora), [["Centro", 3], ["Valle Alto", 2], ["Zona Sur", 1]]);
  assert.deepEqual(tendenciasSemana(posts, ahora, 1), [["Centro", 3]]);
  assert.deepEqual(tendenciasSemana([], ahora), []);
});

const SQL_006 = fs.readFileSync(new URL("../update_006_directorios.sql", import.meta.url), "utf8");

await test("directorios: secciones, alias y categorías bien formados y sin colisión con las rutas existentes", () => {
  assert.deepEqual(VERTICALES.map((v) => v.id), ["movilidad", "delivery", "salud", "eventos", "mascotas", "hogar"]);
  assert.equal(new Set(VERTICALES.map((v) => v.alias)).size, VERTICALES.length, "alias repetidos");
  const carpetas = fs.readdirSync(new URL("../../src/app", import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const v of VERTICALES) {
    assert.ok(!carpetas.includes(v.alias), `«/${v.alias}» chocaría con una ruta existente`);
    assert.ok(v.etiqueta && v.emoji && v.lema && v.proveedor && v.degradado, v.id);
    assert.ok(v.subtipos.length >= 3 && new Set(v.subtipos.map((s) => s.id)).size === v.subtipos.length, `subtipos de ${v.id}`);
    assert.ok(v.subtipos.every((s) => /^[a-z]+(_[a-z]+)*$/.test(s.id) && s.etiqueta && s.emoji), `ids de ${v.id}`);
    assert.equal(VERTICAL_POR_ID[v.id], v);
    assert.equal(VERTICAL_POR_ALIAS[v.alias], v);
  }
  assert.equal(etiquetaSubtipo("hogar", "cerrajero"), "Cerrajero");
  assert.equal(etiquetaSubtipo("hogar", "desconocido"), "desconocido");
});

await test("directorios: las capacidades de cada sección coinciden con las reglas del servidor", () => {
  const con = (f) => VERTICALES.filter(f).map((v) => v.id);
  // place_order(): delivery, salud y mascotas · create_service_request(): movilidad, hogar y mascotas
  assert.deepEqual(con((v) => v.capacidades.pedidos), ["delivery", "salud", "mascotas"]);
  assert.deepEqual(con((v) => v.capacidades.solicitudes), ["movilidad", "mascotas", "hogar"]); // en el orden de VERTICALES
  assert.match(SQL_006, /pr\.vertical not in \('delivery', 'salud', 'mascotas'\)/);
  assert.match(SQL_006, /p_vertical not in \('movilidad', 'hogar', 'mascotas'\)/);
  // _duty_prepare(): turnos solo en salud y hogar · _events_prepare(): eventos solo en «eventos»
  assert.deepEqual(con((v) => v.capacidades.turnos), ["salud", "hogar"]);
  assert.match(SQL_006, /vertical in \('salud', 'hogar'\)/);
  assert.deepEqual(con((v) => v.capacidades.eventos), ["eventos"]);
  // send_offer(): identidad verificada solo para Movilidad
  assert.deepEqual(con((v) => v.capacidades.ofertaRequiereKyc), ["movilidad"]);
  // _items_prepare(): qué tipo de elemento admite cada sección
  const admite = (tipo) => con((v) => v.capacidades.catalogo.includes(tipo));
  assert.deepEqual(admite("menu_item"), ["delivery"]);
  assert.deepEqual(admite("rate"), ["movilidad"]);
  assert.deepEqual(admite("product"), ["delivery", "salud", "mascotas"]);
  assert.match(SQL_006, /new\.kind = 'menu_item' and v_vertical <> 'delivery'/);
  assert.match(SQL_006, /new\.kind = 'rate' and v_vertical <> 'movilidad'/);
  assert.match(SQL_006, /new\.kind = 'product' and v_vertical not in \('delivery', 'salud', 'mascotas'\)/);
  assert.deepEqual(VERTICALES_CON_SOLICITUDES.map((v) => v.id), ["movilidad", "mascotas", "hogar"]);
  // Constantes duplicadas en SQL
  assert.match(SQL_006, new RegExp(`>= ${MAX_PERFILES_POR_PERSONA} then\\s+raise exception 'Has alcanzado el máximo de ${MAX_PERFILES_POR_PERSONA} perfiles'`));
  assert.match(SQL_006, new RegExp(`perform public\\._earn\\(new\\.owner_id, ${MONEDAS_PRIMER_PERFIL}, 'directory_first_provider'\\)`));
  assert.match(SQL_006, new RegExp(`if v_n >= ${DENUNCIAS_PARA_OCULTAR} then`));
  const canalesSql = /channels <@ array\[([^\]]*)\]/.exec(SQL_006)[1].split(",").map((x) => x.trim().replace(/'/g, ""));
  assert.deepEqual(CANALES.map((c) => c.id), canalesSql, "canales distintos a providers.channels");
  const eventosSql = /category in \(([^)]*)\)\)/.exec(SQL_006.slice(SQL_006.indexOf("create table if not exists public.events")))[1].split(",").map((x) => x.trim().replace(/'/g, ""));
  assert.deepEqual(CATEGORIAS_EVENTO.map((c) => c.id), eventosSql, "categorías de evento distintas a events.category");
  const razonesSql = /reason in \(([^)]*)\)/.exec(SQL_006)[1].split(",").map((x) => x.trim().replace(/'/g, ""));
  assert.deepEqual([...RAZONES_DENUNCIA.map((r) => r.id)].sort(), razonesSql.sort(), "razones distintas a content_reports.reason");
});

await test("pedidos: transiciones permitidas para el negocio y la persona", () => {
  assert.deepEqual(transicionesPedido("negocio", "placed"), ["accepted", "rejected"]);
  assert.deepEqual(transicionesPedido("negocio", "accepted"), ["preparing", "on_the_way", "rejected"]);
  assert.deepEqual(transicionesPedido("negocio", "on_the_way"), ["delivered"]);
  assert.deepEqual(transicionesPedido("cliente", "placed"), ["cancelled"]);
  assert.deepEqual(transicionesPedido("cliente", "accepted"), [], "aceptado: ya no se cancela solo");
  for (const fin of ["delivered", "rejected", "cancelled"]) {
    assert.deepEqual([transicionesPedido("negocio", fin), transicionesPedido("cliente", fin)], [[], []], `${fin} es definitivo`);
    assert.equal(esPedidoAbierto(fin), false);
  }
  assert.ok(["placed", "accepted", "preparing", "on_the_way"].every(esPedidoAbierto));
  assert.ok(Object.values(ETIQUETA_ESTADO_PEDIDO).every((e) => e.etiqueta && e.emoji));
});

await test("horarios: validación, «abierto ahora» a la hora de Ecuador y texto por día", () => {
  const h = { lun: [["08:00", "13:00"], ["15:00", "19:00"]], sab: [["09:00", "24:00"]] };
  assert.equal(horarioValido(h), true);
  assert.equal(horarioValido(null), false);
  assert.equal(horarioValido([]), false);
  assert.equal(horarioValido({ lun: [["13:00", "08:00"]] }), false);
  assert.equal(horarioValido({ funes: [] }), false);
  const en = (iso) => estaAbierto(h, false, new Date(iso));
  assert.equal(en("2026-06-01T15:00:00Z"), true, "lunes 10:00 en Ecuador");
  assert.equal(en("2026-06-01T18:00:00Z"), false, "lunes 13:00: el cierre es exclusivo");
  assert.equal(en("2026-06-01T17:59:00Z"), true);
  assert.equal(en("2026-06-02T15:00:00Z"), false, "martes sin horario");
  assert.equal(en("2026-06-07T04:59:00Z"), true, "sábado 23:59 en Ecuador (04:59 UTC del domingo)");
  assert.equal(en("2026-06-06T13:59:00Z"), false, "sábado 08:59 antes de abrir");
  assert.equal(estaAbierto({}, true, new Date("2026-06-02T15:00:00Z")), true, "24 horas");
  assert.equal(estaAbierto({}, false, new Date()), false, "sin horario definido: cerrado");
  assert.equal(textoHorarioDia(h, "lun"), "08:00–13:00 · 15:00–19:00");
  assert.equal(textoHorarioDia(h, "dom"), "Cerrado");
  assert.deepEqual([rutaVertical("salud"), rutaProveedor("hogar", "plomeria-pedro-ab12cd")], ["/directorio/salud", "/directorio/hogar/plomeria-pedro-ab12cd"]);
  assert.equal(ETIQUETA_DIA.mie, "Miércoles");
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
process.exit(fallos ? 1 : 0);
