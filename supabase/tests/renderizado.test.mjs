/**
 * Pruebas contra el «código en vez de la página» (sin base de datos ni red):
 *   npm i --no-save tsx
 *   npx tsx supabase/tests/renderizado.test.mjs
 *
 * Next.js sirve la misma dirección como HTML o como datos (RSC) según la petición; una caché intermedia que los mezcla enseña el código a la
 * persona. Aquí se comprueba la política de cachés (next.config.ts), la recuperación de errores de carga y las pantallas de error.
 * La comprobación con el servidor real (curl con y sin la cabecera RSC) está descrita en docs/renderizado-y-errores.md.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as modConfig from "../../next.config.ts";
import { esErrorDeCarga, puedeRecargarPorCarga } from "@/lib/carga";

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
const fuente = (ruta) => fs.readFileSync(path.join(process.cwd(), ruta), "utf8");
const valor = (regla, clave) => regla.headers.find((h) => h.key === clave)?.value;
// Las rutas de next.config son patrones tipo path-to-regexp; esta forma («/(<regex>)») equivale a una expresión regular anclada.
const coincide = (source, ruta) => new RegExp(`^${source}$`).test(ruta);

// tsx puede envolver el export por defecto de un .ts en otro «default»
const nextConfig = modConfig.default?.default ?? modConfig.default;
const CABECERAS_CACHE = modConfig.CABECERAS_CACHE ?? modConfig.default?.CABECERAS_CACHE;
const [reglaRsc, reglaHtml] = CABECERAS_CACHE;

console.log("Política de cachés");
await test("next.config.ts publica las reglas de caché", async () => {
  assert.equal(CABECERAS_CACHE.length, 2);
  assert.deepEqual(await nextConfig.headers(), CABECERAS_CACHE);
});
await test("las respuestas de datos (RSC) no se guardan NUNCA en cachés: ni compartidas, ni de CDN, ni del navegador", () => {
  assert.equal(reglaRsc.source, "/:path*");
  assert.deepEqual(reglaRsc.has, [{ type: "header", key: "rsc", value: "1" }]);
  const cc = valor(reglaRsc, "Cache-Control");
  for (const t of ["private", "no-store", "max-age=0"]) assert.ok(cc.includes(t), t);
  assert.equal(valor(reglaRsc, "CDN-Cache-Control"), "no-store");
  assert.ok(!/public|s-maxage/.test(cc));
});
await test("el HTML de las páginas no se guarda en cachés compartidas y se revalida siempre (nada de un año de caché)", () => {
  assert.deepEqual(reglaHtml.missing, [{ type: "header", key: "rsc" }], "solo cuando NO se pide como datos");
  const cc = valor(reglaHtml, "Cache-Control");
  for (const t of ["private", "no-cache", "must-revalidate"]) assert.ok(cc.includes(t), t);
  assert.ok(!/public|s-maxage=\d{3,}/.test(cc), "sin caché pública");
});
await test("la regla de HTML alcanza a las páginas y deja en paz a los archivos, la API y las imágenes de marca", () => {
  for (const ruta of ["/", "/perfil", "/directorio/delivery", "/directorio/delivery/sabor-cuencano-a1b2", "/admin/kyc", "/monedas/resultado"]) assert.ok(coincide(reglaHtml.source, ruta), ruta);
  for (const ruta of ["/_next/static/chunks/app.js", "/api/pagos/crear", "/api/avisos/procesar", "/brand/conectari-header.png", "/icon.png", "/favicon.ico"]) assert.ok(!coincide(reglaHtml.source, ruta), ruta);
});

console.log("\nErrores de carga");
await test("esErrorDeCarga reconoce los fallos al cargar archivos de una versión anterior y no confunde errores de lógica", () => {
  for (const m of ["ChunkLoadError: Loading chunk 123 failed.", "Loading chunk app-page-abc failed", "Failed to fetch dynamically imported module: https://x/a.js", "error loading dynamically imported module", "Importing a module script failed.", "Uncaught SyntaxError: Unexpected token '<'", "Loading CSS chunk 9 failed"]) assert.ok(esErrorDeCarga(m), m);
  const e = new Error("Loading chunk 5 failed");
  e.name = "ChunkLoadError";
  assert.ok(esErrorDeCarga(e));
  for (const m of ["Cannot read properties of undefined (reading 'nombre')", "Network request failed", "", null, undefined, 42]) assert.ok(!esErrorDeCarga(m), String(m));
});
await test("puedeRecargarPorCarga: una sola recarga cada 30 segundos (nunca un bucle) y sin almacenamiento no se arriesga", () => {
  const datos = new Map();
  const almacen = { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) };
  assert.equal(puedeRecargarPorCarga(1_000_000, almacen), true, "la primera vez sí");
  assert.equal(puedeRecargarPorCarga(1_005_000, almacen), false, "5 s después no");
  assert.equal(puedeRecargarPorCarga(1_029_999, almacen), false);
  assert.equal(puedeRecargarPorCarga(1_031_000, almacen), true, "pasada la ventana sí");
  assert.equal(puedeRecargarPorCarga(1_040_000, almacen), false);
  assert.equal(puedeRecargarPorCarga(1, null), true, "sin almacén no hay dónde recordarlo pero tampoco falla");
  const roto = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => {} };
  assert.equal(puedeRecargarPorCarga(1, roto), false, "si no se puede recordar, no se recarga (evita el bucle)");
});

console.log("\nPantallas de error");
await test("hay error.tsx, global-error.tsx y not-found.tsx en español, con salidas claras, y el diseño general recupera los errores de carga", () => {
  const err = fuente("src/app/error.tsx");
  assert.match(err, /^"use client"/);
  assert.match(err, /reset\(\)/);
  assert.ok(err.includes("Intentar de nuevo") && err.includes("Ir al inicio"));
  assert.match(err, /esErrorDeCarga\(error\)/);
  const glob = fuente("src/app/global-error.tsx");
  assert.match(glob, /^"use client"/);
  assert.match(glob, /<html lang="es">/);
  assert.match(glob, /<body/);
  assert.ok(!/className=/.test(glob), "estilos en línea: no depende de ningún archivo que pudiera ser el que falló");
  assert.ok(glob.includes("Intentar de nuevo") && glob.includes('href="/"'));
  const nf = fuente("src/app/not-found.tsx");
  assert.ok(nf.includes("No encontramos esta página") && nf.includes('href="/"'));
  const layout = fuente("src/app/layout.tsx");
  assert.match(layout, /<RecuperarDeCarga \/>/);
  const rec = fuente("src/components/RecuperarDeCarga.tsx");
  assert.match(rec, /unhandledrejection/);
  assert.match(rec, /puedeRecargarPorCarga/);
});
await test("las rutas de retorno de las pasarelas de pago siempre redirigen a una página (nunca dejan JSON en pantalla)", () => {
  for (const r of ["paypal/retorno", "payphone/retorno", "prueba/retorno"]) {
    const src = fuente(`src/app/api/pagos/${r}/route.ts`);
    assert.match(src, /NextResponse\.redirect/, r);
    assert.ok(!/NextResponse\.json/.test(src), `${r} no responde JSON`);
  }
  assert.match(fuente("src/app/api/pagos/cancelado/route.ts"), /NextResponse\.redirect/);
  assert.match(fuente("src/app/auth/callback/route.ts"), /NextResponse\.redirect/);
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
process.exit(fallos ? 1 : 0);
