/**
 * Pruebas de los avisos por correo al administrador y del panel de administración (sin base de datos ni red):
 *   npm i --no-save tsx
 *   npx tsx supabase/tests/avisos.test.mjs
 *
 * Comprueba la configuración (sin clave no se envía nada), el contenido de cada correo (datos clave, hora de Ecuador, texto de personas escapado,
 * sin inyección por saltos de línea), la forma exacta de la llamada a Resend, la cola con reintentos y que el aviso salga en los tres momentos
 * (registro, negocio nuevo y verificación enviada). La parte de base de datos está en directorios.test.mjs.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { armarCorreo, escaparHtml, fechaParaCorreo, leerConfigAvisos } from "@/lib/avisos/correo";
import { enviarConResend, procesarAvisos } from "@/lib/avisos/enviar";

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

const SITIO = "https://conectari.com/";
const USUARIO = { kind: "new_user", payload: { user_id: "u1", name: "Ana Ruiz", handle: "@ana_ruiz_1a2b3", email: "ana@correo.com", email_confirmed: false, role: "usuario", registered_at: "2026-09-21T19:32:00Z" } };
const NEGOCIO = { kind: "new_business", payload: { provider_id: "p1", name: "Sabor Cuencano", vertical: "delivery", subtype: "restaurante", city: "Cuenca", country: "EC", owner_name: "Luis Mora", owner_email: "luis@correo.com", created_at: "2026-09-21T19:40:00Z" } };
const KYC = { kind: "new_kyc", payload: { user_id: "u1", name: "Ana Ruiz", email: "ana@correo.com", created_at: "2026-09-21T20:05:00Z" } };

console.log("Configuración");
await test("sin clave de Resend o sin correo de destino no se envía nada; con ambos se usa el remitente de pruebas de Resend", () => {
  assert.equal(leerConfigAvisos({}), null);
  assert.equal(leerConfigAvisos({ RESEND_API_KEY: "re_x" }), null);
  assert.equal(leerConfigAvisos({ ADMIN_ALERT_EMAIL: "yo@correo.com" }), null);
  assert.equal(leerConfigAvisos({ RESEND_API_KEY: "re_x", ADMIN_ALERT_EMAIL: "no-es-un-correo" }), null, "un correo mal escrito se rechaza");
  assert.equal(leerConfigAvisos({ RESEND_API_KEY: "  ", ADMIN_ALERT_EMAIL: "yo@correo.com" }), null);
  assert.deepEqual(leerConfigAvisos({ RESEND_API_KEY: " re_x ", ADMIN_ALERT_EMAIL: " yo@correo.com " }), { apiKey: "re_x", destino: "yo@correo.com", desde: "Conectari <onboarding@resend.dev>" });
  assert.equal(leerConfigAvisos({ RESEND_API_KEY: "re_x", ADMIN_ALERT_EMAIL: "yo@correo.com", ALERT_FROM: "Avisos <avisos@conectari.com>" }).desde, "Avisos <avisos@conectari.com>");
});

console.log("\nContenido de los correos");
await test("fechaParaCorreo: hora de Ecuador (UTC-5), no la del servidor", () => {
  assert.match(fechaParaCorreo("2026-09-21T19:32:00Z"), /^21 sep?t? 2026, 14:32 \(hora de Ecuador\)$/);
  assert.match(fechaParaCorreo("2026-01-05T04:05:00Z"), /^4 ene 2026, 23:05/, "cruza el día hacia atrás");
  assert.equal(fechaParaCorreo("basura"), "fecha desconocida");
  assert.equal(fechaParaCorreo(undefined), "fecha desconocida");
});
await test("nuevo registro: correo, fecha de registro y rol inicial, con enlace al panel", () => {
  const c = armarCorreo(USUARIO, SITIO);
  assert.equal(c.asunto, "Nuevo registro: ana@correo.com");
  for (const t of ["Correo: ana@correo.com", "Nombre: Ana Ruiz", "Usuario: @ana_ruiz_1a2b3", "Rol inicial: usuario", "Correo confirmado: Todavía no", "Abrir el panel: https://conectari.com/admin"]) assert.ok(c.texto.includes(t), t);
  assert.match(c.texto, /Fecha de registro: 21 sep?t? 2026, 14:32/);
  assert.ok(c.html.includes('href="https://conectari.com/admin"') && c.html.includes("ana@correo.com") && c.html.includes("usuario"));
  assert.ok(armarCorreo({ ...USUARIO, payload: { ...USUARIO.payload, email_confirmed: true } }, SITIO).texto.includes("Correo confirmado: Sí"));
});
await test("nuevo negocio: nombre, sección, ubicación, dueño y su correo", () => {
  const c = armarCorreo(NEGOCIO, SITIO);
  assert.equal(c.asunto, "Nuevo negocio: Sabor Cuencano");
  for (const t of ["Negocio: Sabor Cuencano", "Sección: Delivery · restaurante", "Ubicación: Cuenca, EC", "Dueño o dueña: Luis Mora", "Correo del dueño: luis@correo.com"]) assert.ok(c.texto.includes(t), t);
});
await test("verificación enviada: avisa que hay cédula por revisar y enlaza directo a la cola de identidad", () => {
  const c = armarCorreo(KYC, SITIO);
  assert.equal(c.asunto, "Verificación de identidad pendiente: Ana Ruiz");
  assert.ok(c.texto.includes("https://conectari.com/admin/kyc") && c.html.includes('href="https://conectari.com/admin/kyc"'));
  assert.ok(!c.texto.includes("doc_path") && !/storage|signed|token/i.test(c.texto + c.html), "el correo nunca lleva la cédula ni enlaces a ella");
});
await test("lo que escribe una persona no rompe el correo: HTML escapado y sin saltos de línea en el asunto", () => {
  assert.equal(escaparHtml(`<img src=x onerror="alert('x')">&`), "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;");
  const malo = armarCorreo({ kind: "new_business", payload: { ...NEGOCIO.payload, name: `<script>alert(1)</script>\r\nBcc: otro@malo.com`, owner_name: `"><b>x</b>` } }, SITIO);
  assert.ok(!malo.html.includes("<script>") && !malo.html.includes("<b>x</b>") && malo.html.includes("&lt;script&gt;"));
  assert.ok(!/[\r\n]/.test(malo.asunto), "sin saltos de línea en el asunto (inyección de cabeceras)");
  assert.ok(malo.asunto.length <= 200);
  const largo = armarCorreo({ kind: "new_user", payload: { email: "a".repeat(500) + "@x.com" } }, SITIO);
  assert.ok(largo.asunto.length <= 200);
});
await test("datos que faltan no rompen nada", () => {
  for (const kind of ["new_user", "new_business", "new_kyc"]) {
    const c = armarCorreo({ kind, payload: {} }, "https://x.com");
    assert.ok(c.asunto && c.html && c.texto, kind);
  }
  assert.ok(armarCorreo({ kind: "new_user", payload: { name: 42, email: null } }, "https://x.com").texto.includes("(sin correo)"));
});

console.log("\nEnvío con Resend y cola");
await test("enviarConResend: URL, cabeceras y cuerpo exactos; el error no filtra la clave", async () => {
  const llamadas = [];
  const cfg = { apiKey: "re_secreta", destino: "yo@correo.com", desde: "Conectari <onboarding@resend.dev>" };
  const correo = armarCorreo(USUARIO, SITIO);
  await enviarConResend(async (url, init) => (llamadas.push({ url, ...init }), { ok: true, status: 200, text: async () => "{}" }), cfg, correo);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, "https://api.resend.com/emails");
  assert.equal(llamadas[0].method, "POST");
  assert.equal(llamadas[0].headers.Authorization, "Bearer re_secreta");
  assert.deepEqual(JSON.parse(llamadas[0].body), { from: cfg.desde, to: ["yo@correo.com"], subject: correo.asunto, html: correo.html, text: correo.texto });
  await assert.rejects(enviarConResend(async () => ({ ok: false, status: 403, text: async () => "domain not verified re_secreta" }), cfg, correo), (e) => /Resend 403/.test(e.message));
  await assert.rejects(enviarConResend(async () => ({ ok: false, status: 500, text: async () => { throw new Error("x"); } }), cfg, correo), /Resend 500/);
});
await test("procesarAvisos: envía cada aviso y lo marca; si uno falla vuelve a la cola y no detiene a los demás", async () => {
  const filas = [1, 2, 3].map((n) => ({ id: `a${n}`, kind: "new_user", payload: { ...USUARIO.payload, email: `p${n}@correo.com` }, created_at: "2026-09-21T19:32:00Z", attempts: 1 }));
  const enviados = [];
  const marcas = [];
  const r = await procesarAvisos(
    {
      sitio: SITIO,
      reclamar: async (limite) => (assert.equal(limite, 10), filas),
      terminar: async (id, bien, error) => void marcas.push([id, bien, error]),
      enviar: async (c) => {
        if (c.asunto.includes("p2@")) throw new Error("Resend 500");
        enviados.push(c.asunto);
      },
    },
    10,
  );
  assert.deepEqual(r, { enviados: 2, fallidos: 1 });
  assert.deepEqual(enviados, ["Nuevo registro: p1@correo.com", "Nuevo registro: p3@correo.com"]);
  assert.deepEqual(marcas, [["a1", true, undefined], ["a2", false, "Resend 500"], ["a3", true, undefined]]);
  assert.deepEqual(await procesarAvisos({ sitio: SITIO, reclamar: async () => [], terminar: async () => {}, enviar: async () => assert.fail("no hay nada que enviar") }), { enviados: 0, fallidos: 0 });
});

console.log("\nCableado en la aplicación");
await test("sin configuración el servidor no reserva ningún aviso (esperan en la cola) y los enlaces no salen de la petición", () => {
  const srv = fuente("src/lib/avisos/servidor.ts");
  assert.match(srv, /import "server-only"/);
  assert.match(srv, /if \(!cfg \|\| !admin\) return \{ enviados: 0, fallidos: 0, motivo: "sin_configurar" \}/);
  assert.match(srv, /claim_admin_alerts/);
  assert.match(srv, /NEXT_PUBLIC_SITE_URL/);
  const ruta = fuente("src/app/api/avisos/procesar/route.ts");
  assert.ok(!/req\.url|request\.url|sitioPublico|new URL\(|x-forwarded|headers\.get/.test(ruta), "el enlace del correo no puede depender de la petición (encabezado Host falsificable)");
  assert.match(ruta, /export const POST/);
});
await test("el aviso sale al registrarse, al registrar un negocio, al enviar la verificación, al confirmar/entrar con Google y al abrir el panel", () => {
  assert.match(fuente("src/app/registro/page.tsx"), /avisarAlEquipo\(\)/);
  assert.match(fuente("src/features/directorio/alta/AsistenteAlta.tsx"), /avisarAlEquipo\(\)/);
  assert.match(fuente("src/context/SocialContext.tsx"), /submit_kyc[\s\S]{0,200}avisarAlEquipo\(\)/);
  const cb = fuente("src/app/auth/callback/route.ts");
  assert.match(cb, /after\(\(\) => procesarAvisosDelServidor\(\)/);
  assert.match(fuente("src/app/admin/page.tsx"), /avisarAlEquipo\(\)/);
  assert.match(fuente("src/lib/avisos/ping.ts"), /\/api\/avisos\/procesar/);
});
await test("panel de administración: acceso directo en la barra superior solo para administradores y cola de identidad con cédula, selfie y foto de perfil", () => {
  const nav = fuente("src/components/Navbar.tsx");
  assert.match(nav, /function EnlaceAdmin\(\)[\s\S]*if \(!esAdmin\) return null;[\s\S]*href="\/admin"/);
  assert.match(nav, /<EnlaceAdmin \/>/);
  const kyc = fuente("src/app/admin/kyc/page.tsx");
  assert.match(kyc, /admin_kyc_queue/);
  for (const t of ["Cédula", "Selfie", "Foto de perfil", "Aprobar", "Rechazar"]) assert.ok(kyc.includes(t), t);
  const hub = fuente("src/app/admin/page.tsx");
  assert.match(hub, /admin_overview/);
  assert.match(hub, /\/admin\/kyc/);
  assert.match(fuente("src/middleware.ts") + fuente("src/lib/supabase/middleware.ts"), /"\/admin"/, "/admin exige sesión");
});
await test("el esquema y la migración 014 coinciden, y la cola solo la usa el servidor", () => {
  const completo = fuente("supabase/schema.sql").replace(/\r\n/g, "\n");
  const ini = completo.indexOf("-- ACTUALIZACION-014-INICIO");
  const fin = completo.indexOf("-- ACTUALIZACION-014-FIN");
  assert.ok(ini > 0 && fin > ini);
  const sql = fuente("supabase/update_014_admin_alertas.sql").replace(/\r\n/g, "\n");
  assert.equal(completo.slice(completo.indexOf("\n", ini) + 1, fin).trim(), sql.trim());
  assert.match(sql, /grant execute on function public\.claim_admin_alerts\(int\), public\.finish_admin_alert\(uuid, boolean, text\) to service_role/);
  assert.match(sql, /revoke execute on function public\.claim_admin_alerts\(int\), public\.finish_admin_alert\(uuid, boolean, text\) from public, anon, authenticated/);
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
process.exit(fallos ? 1 : 0);
