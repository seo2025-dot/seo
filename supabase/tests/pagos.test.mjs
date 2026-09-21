/**
 * Pruebas de las pasarelas de pago (PayPhone y PayPal) sin red ni credenciales: `fetch` y la base de datos son simulados.
 *   npx tsx supabase/tests/pagos.test.mjs
 *
 * Comprueba la forma exacta de cada llamada a las pasarelas, que las monedas se acreditan SOLO con lo que la pasarela confirma
 * (importe y referencia de la respuesta, nunca de la URL), la firma del webhook de PayPal, la idempotencia y la configuración.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BONO_PRIMERA_COMPRA_PCT, PAQUETES_DEFECTO, PRECIOS_DEFECTO, ahorroFrente, bonoPrimeraCompra, costeMensaje, detalleSaldo, dolares, esMensajeDeMonedas, esSaldoInsuficiente, estadoUso, mensajeSaldoInsuficiente,
  mensajesHastaCobro, textoCoste, textoMonedas, textoMovimiento,
} from "@/lib/monedas";
import { ORIGEN_MONEDAS, alturasBarras, dolaresACentavos, mensajeErrorAdmin, resumenEconomia, textoLog, validarAjuste, validarPaquete } from "@/lib/adminMonedas";
import { mensajeErrorPedido } from "@/lib/directorio/pedidos";
import { mensajeErrorSolicitud } from "@/lib/directorio/solicitudes";
import { mensajeErrorEventos } from "@/lib/directorio/eventos";
import { leerConfigPasarelas, pasarelasDisponibles, urlResultado, urlsDePago } from "@/lib/pagos/config";
import { completarPayPal, completarPayPhone, iniciarPago, procesarWebhookPayPal } from "@/lib/pagos/flujo";
import { baseUrlPayPal, capturaDeEvento, capturarOrdenPayPal, confirmacionDeOrden, crearOrdenPayPal, cuerpoOrden, tokenPayPal, verificarWebhookPayPal } from "@/lib/pagos/paypal";
import { confirmarPayPhone, cuerpoPrepare, desgloseIva, estadoPayPhone, prepararPayPhone } from "@/lib/pagos/payphone";
import { ErrorPasarela, centavosATexto, textoACentavos } from "@/lib/pagos/tipos";

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

/** fetch simulado: registra las llamadas y responde según una función. */
function fetchFalso(responder) {
  const llamadas = [];
  const f = async (url, init = {}) => {
    llamadas.push({ url, metodo: init.method ?? "GET", cab: init.headers ?? {}, cuerpo: init.body ? (init.body.startsWith("{") ? JSON.parse(init.body) : init.body) : undefined });
    const r = await responder(url, init, llamadas.length);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.cuerpo, text: async () => JSON.stringify(r.cuerpo) };
  };
  f.llamadas = llamadas;
  return f;
}
const json = (cuerpo, status = 200) => ({ status, cuerpo });

/** Base de datos simulada: guarda lo que se intentó acreditar o cerrar. */
function depsFalsas(f, resultado = { ok: true, already: false, coins: 100 }) {
  const acreditados = [];
  const cerrados = [];
  return { fetch: f, acreditados, cerrados, acreditar: async (a) => (acreditados.push(a), resultado), cerrar: async (ref, estado, crudo) => void cerrados.push({ ref, estado, crudo }) };
}

const REF = "a".repeat(32);
const PAGO = { clientRef: REF, centavos: 150, descripcion: "Recarga plus · 165 monedas ($1.50)" };
const URLS = { exito: "https://conectari.com/api/pagos/payphone/retorno", cancelado: "https://conectari.com/api/pagos/cancelado?ref=" + REF };
const CFG_PP = { token: "tok-payphone", storeId: "store-1" };
const CFG_PAYPAL = { clientId: "cid", secret: "sec", env: "sandbox", webhookId: "WH-123" };

// ── Utilidades y paquetes ───────────────────────────────────────────────────
console.log("Utilidades");
await test("centavos ↔ texto decimal sin errores de coma flotante", () => {
  assert.equal(centavosATexto(50), "0.50");
  assert.equal(centavosATexto(150), "1.50");
  assert.equal(centavosATexto(350), "3.50");
  assert.equal(centavosATexto(1999), "19.99");
  for (const c of [1, 10, 29, 57, 110, 199, 1999, 100_000]) assert.equal(textoACentavos(centavosATexto(c)), c, String(c));
  assert.equal(textoACentavos("0.1") + textoACentavos("0.2"), 30);
});
await test("los paquetes son $0.50, $1.50 y $3.50 y cada moneda sale más barata cuanto mayor es la recarga", () => {
  assert.deepEqual(PAQUETES_DEFECTO.map((p) => p.centavos), [50, 150, 350]);
  assert.deepEqual(PAQUETES_DEFECTO.map((p) => p.monedas), [50, 165, 420]);
  assert.deepEqual([ahorroFrente(PAQUETES_DEFECTO[0], PAQUETES_DEFECTO[0]), ahorroFrente(PAQUETES_DEFECTO[1], PAQUETES_DEFECTO[0]), ahorroFrente(PAQUETES_DEFECTO[2], PAQUETES_DEFECTO[0])], [0, 9, 17]);
});

// ── PayPhone ────────────────────────────────────────────────────────────────
console.log("\nPayPhone");
await test("desgloseIva reparte el total en centavos exactos (0 %, 15 %)", () => {
  assert.deepEqual(desgloseIva(150, 0), { sinIva: 150, conIva: 0, iva: 0 });
  for (const total of [50, 150, 350, 1, 199]) {
    const d = desgloseIva(total, 15);
    assert.equal(d.sinIva + d.conIva + d.iva, total, `total ${total}`);
    assert.equal(d.sinIva, 0);
  }
  assert.deepEqual(desgloseIva(115, 15), { sinIva: 0, conIva: 100, iva: 15 });
});
await test("cuerpo de Prepare: enteros en centavos, amount = suma de componentes y la referencia nuestra como clientTransactionId", () => {
  const b = cuerpoPrepare({ ...CFG_PP, ivaPct: 15 }, PAGO, URLS);
  assert.equal(b.amount, b.amountWithoutTax + b.amountWithTax + b.tax + b.service + b.tip);
  assert.deepEqual([b.amount, b.clientTransactionId, b.storeId, b.currency, b.responseUrl, b.cancellationUrl], [150, REF, "store-1", "USD", URLS.exito, URLS.cancelado]);
  assert.ok(Object.values(b).every((v) => typeof v !== "number" || Number.isInteger(v)));
  assert.equal(cuerpoPrepare(CFG_PP, PAGO, URLS).amountWithoutTax, 150, "sin IVA configurado se envía el total como base");
  assert.ok(cuerpoPrepare(CFG_PP, { ...PAGO, descripcion: "x".repeat(300) }, URLS).reference.length <= 100);
});
await test("prepararPayPhone: POST autenticado a /api/button/Prepare y devuelve la dirección de pago", async () => {
  const f = fetchFalso(() => json({ paymentId: 4711, payWithPayPhone: "https://pay.payphone/app/4711", payWithCard: "https://pay.payphone/card/4711" }));
  const r = await prepararPayPhone(CFG_PP, PAGO, URLS, f);
  assert.deepEqual(r, { urlPago: "https://pay.payphone/card/4711", idProveedor: "4711" });
  const [l] = f.llamadas;
  assert.deepEqual([l.metodo, l.url, l.cab.Authorization, l.cab["Content-Type"]], ["POST", "https://pay.payphonetodoesposible.com/api/button/Prepare", "Bearer tok-payphone", "application/json"]);
  assert.equal(l.cuerpo.clientTransactionId, REF);
});
await test("prepararPayPhone: sin configuración, con error de red o respuesta rara lanza un ErrorPasarela claro", async () => {
  await assert.rejects(prepararPayPhone({ token: "", storeId: "" }, PAGO, URLS, fetchFalso(() => json({}))), (e) => e instanceof ErrorPasarela && e.codigo === "config");
  await assert.rejects(prepararPayPhone(CFG_PP, PAGO, URLS, async () => { throw new Error("ECONNRESET"); }), (e) => e.codigo === "red");
  await assert.rejects(prepararPayPhone(CFG_PP, PAGO, URLS, fetchFalso(() => json({ message: "Unauthorized" }, 401))), (e) => e.codigo === "respuesta" && e.estadoHttp === 401);
  await assert.rejects(prepararPayPhone(CFG_PP, PAGO, URLS, fetchFalso(() => json({ paymentId: 1 }))), (e) => e.codigo === "respuesta");
});
await test("estadoPayPhone: 3 aprobada, 2 cancelada, cualquier otra cosa pendiente", () => {
  assert.equal(estadoPayPhone(3), "aprobado");
  assert.equal(estadoPayPhone(undefined, "Approved"), "aprobado");
  assert.equal(estadoPayPhone(2), "rechazado");
  assert.equal(estadoPayPhone(undefined, "Canceled"), "rechazado");
  assert.equal(estadoPayPhone(1), "pendiente");
  assert.equal(estadoPayPhone(undefined), "pendiente");
});
const respPP = (extra = {}) => ({ transactionStatus: "Approved", statusCode: 3, amount: 150, currency: "USD", clientTransactionId: REF, transactionId: 9001, ...extra });
await test("confirmarPayPhone: POST a /V2/Confirm con id y clientTxId; usa el importe y la referencia de la RESPUESTA", async () => {
  const f = fetchFalso(() => json(respPP()));
  const c = await confirmarPayPhone(CFG_PP, { id: 4711, clientTxId: REF }, f);
  assert.deepEqual([c.estado, c.clientRef, c.refProveedor, c.centavos, c.moneda], ["aprobado", REF, "9001", 150, "USD"]);
  assert.equal(f.llamadas[0].url, "https://pay.payphonetodoesposible.com/api/button/V2/Confirm");
  assert.deepEqual(f.llamadas[0].cuerpo, { id: 4711, clientTxId: REF });
});
await test("completarPayPhone: aprobado → acredita con el importe de PayPhone y responde «ok»", async () => {
  const deps = depsFalsas(fetchFalso(() => json(respPP())));
  const r = await completarPayPhone(deps, CFG_PP, { id: "4711", clientTransactionId: REF });
  assert.deepEqual(r, { estado: "ok", clientRef: REF });
  assert.deepEqual(deps.acreditados, [{ clientRef: REF, pasarela: "payphone", refProveedor: "9001", centavos: 150, crudo: respPP() }]);
  assert.equal(deps.cerrados.length, 0);
});
await test("completarPayPhone: la URL no manda — si PayPhone responde otra referencia o un importe distinto, no se acredita lo de la URL", async () => {
  const otra = depsFalsas(fetchFalso(() => json(respPP({ clientTransactionId: "b".repeat(32) }))));
  assert.deepEqual(await completarPayPhone(otra, CFG_PP, { id: "4711", clientTransactionId: REF }), { estado: "error" });
  assert.equal(otra.acreditados.length, 0, "referencia distinta: nada");
  const barato = depsFalsas(fetchFalso(() => json(respPP({ amount: 1 }))), { ok: false, reason: "amount_mismatch" });
  const r = await completarPayPhone(barato, CFG_PP, { id: "4711", clientTransactionId: REF });
  assert.equal(r.estado, "error");
  assert.equal(barato.acreditados[0].centavos, 1, "se envía a la base el importe REAL de PayPhone y la base lo rechaza");
});
await test("completarPayPhone: cancelado cierra el pago; pendiente o caída de red no lo cierran; parámetros inválidos ni llaman a la pasarela", async () => {
  const canc = depsFalsas(fetchFalso(() => json(respPP({ statusCode: 2, transactionStatus: "Canceled" }))));
  assert.deepEqual(await completarPayPhone(canc, CFG_PP, { id: "4711", clientTransactionId: REF }), { estado: "cancelado", clientRef: REF });
  assert.deepEqual([canc.cerrados[0].ref, canc.cerrados[0].estado, canc.acreditados.length], [REF, "cancelled", 0]);
  const pend = depsFalsas(fetchFalso(() => json(respPP({ statusCode: 1, transactionStatus: "Pending" }))));
  assert.equal((await completarPayPhone(pend, CFG_PP, { id: "4711", clientTransactionId: REF })).estado, "pendiente");
  assert.equal(pend.cerrados.length + pend.acreditados.length, 0);
  const caida = depsFalsas(async () => { throw new Error("timeout"); });
  assert.equal((await completarPayPhone(caida, CFG_PP, { id: "4711", clientTransactionId: REF })).estado, "pendiente", "una caída de red no cancela el pago");
  for (const q of [{ id: "abc", clientTransactionId: REF }, { id: "-5", clientTransactionId: REF }, { id: "1", clientTransactionId: "" }, { id: null, clientTransactionId: null }]) {
    const d = depsFalsas(fetchFalso(() => json(respPP())));
    assert.equal((await completarPayPhone(d, CFG_PP, q)).estado, "error");
    assert.equal(d.fetch.llamadas.length, 0);
  }
});
await test("una moneda distinta de USD nunca se acredita", async () => {
  const d = depsFalsas(fetchFalso(() => json(respPP({ currency: "EUR" }))));
  assert.equal((await completarPayPhone(d, CFG_PP, { id: "4711", clientTransactionId: REF })).estado, "error");
  assert.deepEqual([d.acreditados.length, d.cerrados[0].estado, d.cerrados[0].crudo.moneda], [0, "failed", "EUR"]);
});

// ── PayPal ──────────────────────────────────────────────────────────────────
console.log("\nPayPal");
const TOKEN = { access_token: "A21-token", token_type: "Bearer" };
const capturaOk = (extra = {}) => ({
  id: "5O190127TN364715T", status: "COMPLETED",
  purchase_units: [{ custom_id: REF, payments: { captures: [{ id: "3C679366HH908993F", status: "COMPLETED", custom_id: REF, amount: { value: "1.50", currency_code: "USD" }, ...extra }] } }],
});
await test("token: Basic con id:secreto contra el host de sandbox (o live)", async () => {
  const f = fetchFalso(() => json(TOKEN));
  assert.equal(await tokenPayPal(CFG_PAYPAL, f), "A21-token");
  const l = f.llamadas[0];
  assert.deepEqual([l.metodo, l.url, l.cab.Authorization, l.cuerpo], ["POST", "https://api-m.sandbox.paypal.com/v1/oauth2/token", `Basic ${Buffer.from("cid:sec").toString("base64")}`, "grant_type=client_credentials"]);
  assert.equal(baseUrlPayPal("live"), "https://api-m.paypal.com");
  await assert.rejects(tokenPayPal({ ...CFG_PAYPAL, clientId: "" }, f), (e) => e.codigo === "config");
  await assert.rejects(tokenPayPal(CFG_PAYPAL, fetchFalso(() => json({ error: "invalid_client" }, 401))), (e) => e.codigo === "config");
});
await test("cuerpo de la orden: CAPTURE, importe como texto con 2 decimales, custom_id nuestro y URLs de retorno", () => {
  const b = cuerpoOrden(PAGO, { exito: "https://x/ok", cancelado: "https://x/no" });
  const u = b.purchase_units[0];
  assert.deepEqual([b.intent, u.custom_id, u.amount], ["CAPTURE", REF, { currency_code: "USD", value: "1.50" }]);
  assert.deepEqual([b.payment_source.paypal.experience_context.return_url, b.payment_source.paypal.experience_context.cancel_url, b.payment_source.paypal.experience_context.user_action], ["https://x/ok", "https://x/no", "PAY_NOW"]);
  assert.ok(cuerpoOrden({ ...PAGO, descripcion: "x".repeat(300) }, URLS).purchase_units[0].description.length <= 127);
});
await test("crearOrdenPayPal: pide token, crea la orden idempotente y devuelve el enlace de aprobación", async () => {
  const f = fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : json({ id: "ORD-1234567890", status: "PAYER_ACTION_REQUIRED", links: [{ rel: "self", href: "https://api/self" }, { rel: "payer-action", href: "https://paypal.com/checkoutnow?token=ORD-1234567890" }] })));
  const r = await crearOrdenPayPal(CFG_PAYPAL, PAGO, URLS, f);
  assert.deepEqual(r, { urlPago: "https://paypal.com/checkoutnow?token=ORD-1234567890", idProveedor: "ORD-1234567890" });
  const orden = f.llamadas[1];
  assert.deepEqual([orden.metodo, orden.url, orden.cab.Authorization, orden.cab["PayPal-Request-Id"]], ["POST", "https://api-m.sandbox.paypal.com/v2/checkout/orders", "Bearer A21-token", REF]);
  const aprobar = fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : json({ id: "ORD-1234567890", links: [{ rel: "approve", href: "https://paypal.com/approve" }] })));
  assert.equal((await crearOrdenPayPal(CFG_PAYPAL, PAGO, URLS, aprobar)).urlPago, "https://paypal.com/approve", "también acepta el enlace «approve»");
  await assert.rejects(crearOrdenPayPal(CFG_PAYPAL, PAGO, URLS, fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : json({ id: "X" })))), (e) => e.codigo === "respuesta");
  await assert.rejects(crearOrdenPayPal(CFG_PAYPAL, PAGO, URLS, fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : json({}, 400)))), (e) => e.estadoHttp === 400);
});
await test("confirmacionDeOrden lee estado, referencia, importe y captura de la respuesta", () => {
  const c = confirmacionDeOrden(capturaOk());
  assert.deepEqual([c.estado, c.clientRef, c.refProveedor, c.centavos, c.moneda], ["aprobado", REF, "3C679366HH908993F", 150, "USD"]);
  assert.equal(confirmacionDeOrden(capturaOk({ status: "DECLINED" })).estado, "rechazado");
  assert.equal(confirmacionDeOrden(capturaOk({ status: "PENDING" })).estado, "pendiente");
  assert.equal(confirmacionDeOrden({ id: "X", status: "APPROVED" }).estado, "pendiente");
  assert.equal(confirmacionDeOrden(capturaOk({ amount: { value: "0.10", currency_code: "USD" } })).centavos, 10);
});
await test("capturarOrdenPayPal: POST /capture; si ya estaba capturada consulta la orden (retorno + webhook)", async () => {
  const f = fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : json(capturaOk())));
  const c = await capturarOrdenPayPal(CFG_PAYPAL, "5O190127TN364715T", f);
  assert.equal(c.estado, "aprobado");
  assert.deepEqual([f.llamadas[1].metodo, f.llamadas[1].url], ["POST", "https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T/capture"]);
  const yaCapturada = fetchFalso((url, init) => (url.endsWith("/oauth2/token") ? json(TOKEN) : init.method === "POST" ? json({ name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] }, 422) : json(capturaOk())));
  assert.equal((await capturarOrdenPayPal(CFG_PAYPAL, "5O190127TN364715T", yaCapturada)).centavos, 150);
  assert.equal(yaCapturada.llamadas.at(-1).metodo, "GET");
  await assert.rejects(capturarOrdenPayPal(CFG_PAYPAL, "../../otra", fetchFalso(() => json(TOKEN))), (e) => e.codigo === "respuesta");
  await assert.rejects(capturarOrdenPayPal(CFG_PAYPAL, "5O190127TN364715T", fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : json({ name: "INSTRUMENT_DECLINED" }, 422)))), (e) => e.estadoHttp === 422);
});
await test("completarPayPal: captura y acredita con el importe capturado; una referencia que no es la de la URL se rechaza", async () => {
  const f = fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : json(capturaOk())));
  const deps = depsFalsas(f);
  assert.deepEqual(await completarPayPal(deps, CFG_PAYPAL, { token: "5O190127TN364715T", ref: REF }), { estado: "ok", clientRef: REF });
  assert.deepEqual([deps.acreditados[0].pasarela, deps.acreditados[0].refProveedor, deps.acreditados[0].centavos], ["paypal", "3C679366HH908993F", 150]);
  const ajena = depsFalsas(fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : json(capturaOk()))));
  assert.equal((await completarPayPal(ajena, CFG_PAYPAL, { token: "5O190127TN364715T", ref: "c".repeat(32) })).estado, "error");
  assert.equal(ajena.acreditados.length, 0);
  const sinToken = depsFalsas(fetchFalso(() => json(TOKEN)));
  assert.equal((await completarPayPal(sinToken, CFG_PAYPAL, { token: null, ref: REF })).estado, "error");
  const rechazada = depsFalsas(fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : json(capturaOk({ status: "DECLINED" })))));
  assert.equal((await completarPayPal(rechazada, CFG_PAYPAL, { token: "5O190127TN364715T", ref: REF })).estado, "cancelado");
  assert.equal(rechazada.cerrados[0].estado, "cancelled");
});

// ── Webhook de PayPal ───────────────────────────────────────────────────────
console.log("\nWebhook de PayPal");
const cabWebhook = (extra = {}) => {
  const h = { "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.paypal.com/cert.pem", "paypal-transmission-id": "tx-1", "paypal-transmission-sig": "firma", "paypal-transmission-time": "2026-09-20T10:00:00Z", ...extra };
  return { get: (n) => h[n] ?? null };
};
const EVENTO = { id: "WH-EVT-1", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "3C679366HH908993F", status: "COMPLETED", custom_id: REF, amount: { value: "1.50", currency_code: "USD" } } };
const fetchWebhook = (verificacion = "SUCCESS") => fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : json({ verification_status: verificacion })));
await test("capturaDeEvento: solo PAYMENT.CAPTURE.COMPLETED con importe; el resto se ignora", () => {
  const c = capturaDeEvento(EVENTO);
  assert.deepEqual([c.estado, c.clientRef, c.refProveedor, c.centavos], ["aprobado", REF, "3C679366HH908993F", 150]);
  assert.equal(capturaDeEvento({ ...EVENTO, event_type: "CHECKOUT.ORDER.APPROVED" }), null);
  assert.equal(capturaDeEvento({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: {} }), null);
  assert.equal(capturaDeEvento(null), null);
});
await test("verificarWebhookPayPal: llama a verify-webhook-signature con el webhook_id propio; sin webhookId nunca es válido", async () => {
  const f = fetchWebhook();
  const cab = { authAlgo: "SHA256withRSA", certUrl: "https://api.paypal.com/cert.pem", transmissionId: "tx-1", transmissionSig: "firma", transmissionTime: "t" };
  assert.equal(await verificarWebhookPayPal(CFG_PAYPAL, cab, EVENTO, f), true);
  const l = f.llamadas[1];
  assert.equal(l.url, "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature");
  assert.deepEqual([l.cuerpo.webhook_id, l.cuerpo.transmission_id, l.cuerpo.webhook_event.id], ["WH-123", "tx-1", "WH-EVT-1"]);
  assert.equal(await verificarWebhookPayPal(CFG_PAYPAL, cab, EVENTO, fetchWebhook("FAILURE")), false);
  const sin = fetchWebhook();
  assert.equal(await verificarWebhookPayPal({ ...CFG_PAYPAL, webhookId: undefined }, cab, EVENTO, sin), false);
  assert.equal(sin.llamadas.length, 0, "sin webhookId ni siquiera se consulta a PayPal");
});
await test("procesarWebhookPayPal: firma válida acredita; firma falsa, cabeceras o JSON incorrectos no tocan nada", async () => {
  const bueno = depsFalsas(fetchWebhook());
  assert.deepEqual(await procesarWebhookPayPal(bueno, CFG_PAYPAL, cabWebhook(), JSON.stringify(EVENTO)), { http: 200, motivo: "ok" });
  assert.deepEqual([bueno.acreditados[0].clientRef, bueno.acreditados[0].centavos, bueno.acreditados[0].pasarela], [REF, 150, "paypal"]);
  const falso = depsFalsas(fetchWebhook("FAILURE"));
  assert.deepEqual(await procesarWebhookPayPal(falso, CFG_PAYPAL, cabWebhook(), JSON.stringify(EVENTO)), { http: 401, motivo: "firma_invalida" });
  assert.equal(falso.acreditados.length, 0);
  const sinCab = depsFalsas(fetchWebhook());
  assert.equal((await procesarWebhookPayPal(sinCab, CFG_PAYPAL, cabWebhook({ "paypal-transmission-sig": undefined }), JSON.stringify(EVENTO))).http, 400);
  assert.equal(sinCab.fetch.llamadas.length, 0);
  assert.equal((await procesarWebhookPayPal(depsFalsas(fetchWebhook()), CFG_PAYPAL, cabWebhook(), "no es json")).http, 400);
  const otro = depsFalsas(fetchWebhook());
  assert.deepEqual(await procesarWebhookPayPal(otro, CFG_PAYPAL, cabWebhook(), JSON.stringify({ ...EVENTO, event_type: "CHECKOUT.ORDER.APPROVED" })), { http: 200, motivo: "evento_ignorado" });
  assert.equal(otro.acreditados.length, 0);
  const caido = depsFalsas(async () => { throw new Error("red"); });
  assert.equal((await procesarWebhookPayPal(caido, CFG_PAYPAL, cabWebhook(), JSON.stringify(EVENTO))).http, 500, "si no se puede verificar, PayPal reintentará");
});
await test("el retorno y el webhook del mismo pago acreditan una sola vez (la base es idempotente)", async () => {
  // La base responde «already» la segunda vez: el flujo lo trata como éxito y no reintenta.
  let n = 0;
  const f = fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : url.includes("verify-webhook") ? json({ verification_status: "SUCCESS" }) : json(capturaOk())));
  const deps = { ...depsFalsas(f), acreditar: async () => (n++ === 0 ? { ok: true, already: false, coins: 206 } : { ok: true, already: true, coins: 206 }) };
  assert.equal((await completarPayPal(deps, CFG_PAYPAL, { token: "5O190127TN364715T", ref: REF })).estado, "ok");
  assert.deepEqual(await procesarWebhookPayPal(deps, CFG_PAYPAL, cabWebhook(), JSON.stringify(EVENTO)), { http: 200, motivo: "ok" });
  assert.equal(n, 2);
});

// ── Iniciar pago y configuración ────────────────────────────────────────────
console.log("\nIniciar el pago y configuración");
await test("iniciarPago elige la pasarela y falla si no está configurada", async () => {
  const pp = fetchFalso(() => json({ paymentId: 1, payWithCard: "https://pp/1" }));
  assert.equal((await iniciarPago("payphone", { payphone: CFG_PP }, PAGO, URLS, pp)).urlPago, "https://pp/1");
  const paypal = fetchFalso((url) => (url.endsWith("/oauth2/token") ? json(TOKEN) : json({ id: "ORD-1234567890", links: [{ rel: "payer-action", href: "https://pay/pal" }] })));
  assert.equal((await iniciarPago("paypal", { paypal: CFG_PAYPAL }, PAGO, URLS, paypal)).urlPago, "https://pay/pal");
  await assert.rejects(iniciarPago("payphone", {}, PAGO, URLS, pp), (e) => e.codigo === "config");
  await assert.rejects(iniciarPago("paypal", { payphone: CFG_PP }, PAGO, URLS, paypal), (e) => e.codigo === "config");
});
await test("leerConfigPasarelas: una pasarela aparece solo con todas sus credenciales y siempre exige poder acreditar", () => {
  const nada = leerConfigPasarelas({});
  assert.deepEqual([nada.payphone, nada.paypal, nada.puedeAcreditar], [undefined, undefined, false]);
  assert.deepEqual(pasarelasDisponibles(nada), { payphone: false, paypal: false, prueba: false });
  const medias = leerConfigPasarelas({ PAYPHONE_TOKEN: "t", PAYPAL_CLIENT_ID: "c" });
  assert.deepEqual([medias.payphone, medias.paypal], [undefined, undefined], "faltan Store ID y secreto");
  const env = { PAYPHONE_TOKEN: "t", PAYPHONE_STORE_ID: "s", PAYPHONE_IVA_PCT: "15", PAYPAL_CLIENT_ID: "c", PAYPAL_CLIENT_SECRET: "x", PAYPAL_ENV: "live", PAYPAL_WEBHOOK_ID: "W", SUPABASE_SERVICE_ROLE_KEY: "k", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NODE_ENV: "production" };
  const c = leerConfigPasarelas(env);
  assert.deepEqual([c.payphone, c.paypal.env, c.paypal.webhookId, c.puedeAcreditar], [{ token: "t", storeId: "s", ivaPct: 15 }, "live", "W", true]);
  assert.deepEqual(pasarelasDisponibles(c), { payphone: true, paypal: true, prueba: false });
  assert.deepEqual(pasarelasDisponibles(leerConfigPasarelas({ ...env, SUPABASE_SERVICE_ROLE_KEY: "" })), { payphone: false, paypal: false, prueba: false }, "sin clave de servicio no se puede completar ningún pago");
  assert.equal(leerConfigPasarelas({ ...env, PAYPAL_ENV: "otra" }).paypal.env, "sandbox");
  assert.equal(leerConfigPasarelas({ ...env, PAYPHONE_IVA_PCT: "abc" }).payphone.ivaPct, 0);
  assert.equal(leerConfigPasarelas({ ...env, PAYPHONE_IVA_PCT: "150" }).payphone.ivaPct, 0);
});
await test("el pago de prueba solo existe fuera de producción (no lo activa ninguna variable)", () => {
  const base = { SUPABASE_SERVICE_ROLE_KEY: "k", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" };
  assert.equal(pasarelasDisponibles(leerConfigPasarelas({ ...base, NODE_ENV: "development" })).prueba, true);
  assert.equal(pasarelasDisponibles(leerConfigPasarelas({ ...base, NODE_ENV: "production" })).prueba, false);
  assert.equal(pasarelasDisponibles(leerConfigPasarelas({ ...base, NODE_ENV: "production", PAGOS_MODO_PRUEBA: "1", PAGOS_PRUEBA: "true" })).prueba, false);
});
await test("urlsDePago y urlResultado: rutas de retorno por pasarela sin doble barra y con la referencia codificada", () => {
  assert.deepEqual(urlsDePago("https://conectari.com/", "payphone", REF), { exito: "https://conectari.com/api/pagos/payphone/retorno", cancelado: `https://conectari.com/api/pagos/cancelado?ref=${REF}` });
  assert.equal(urlsDePago("https://conectari.com", "paypal", REF).exito, `https://conectari.com/api/pagos/paypal/retorno?ref=${REF}`);
  assert.equal(urlResultado("ok", REF), `/monedas/resultado?estado=ok&ref=${REF}`);
  assert.equal(urlResultado("error"), "/monedas/resultado?estado=error");
});

// ── Lógica de monedas ───────────────────────────────────────────────────────
console.log("\nMonedas: usos gratis, costes y textos");
await test("estadoUso: 3 usos gratis y después el coste; usos gastados y acciones sin coste", () => {
  const pedido = PRECIOS_DEFECTO.find((p) => p.accion === "order_place");
  assert.deepEqual(estadoUso(pedido, null), { gratisRestantes: 3, cuesta: 0, gratis: true });
  assert.deepEqual(estadoUso(pedido, { gratisUsados: 2 }), { gratisRestantes: 1, cuesta: 0, gratis: true });
  assert.deepEqual(estadoUso(pedido, { gratisUsados: 3 }), { gratisRestantes: 0, cuesta: 1, gratis: false });
  assert.deepEqual(estadoUso(pedido, { gratisUsados: 99 }), { gratisRestantes: 0, cuesta: 1, gratis: false });
  assert.equal(estadoUso({ gratis: 0, coste: 0 }, null).gratis, true, "sin coste siempre es gratis");
  assert.equal(estadoUso({ gratis: 0, coste: 30 }, null).cuesta, 30, "destacar no tiene usos gratis");
});
await test("las tarifas de fábrica: 3 gratis por acción (salvo destacar) y el negocio paga más que quien pide", () => {
  const por = Object.fromEntries(PRECIOS_DEFECTO.map((p) => [p.accion, p]));
  for (const p of PRECIOS_DEFECTO) if (p.accion !== "provider_boost") assert.equal(p.gratis, 3, p.accion);
  assert.ok(por.order_accept.coste > por.order_place.coste, "el negocio paga por conseguir un cliente; el cliente paga poco por pedir");
  assert.ok(por.order_place.coste <= 1 && por.event_reserve.coste <= 1, "pedir y reservar cuestan como mucho 1 moneda");
  const barato = PAQUETES_DEFECTO[0].centavos / PAQUETES_DEFECTO[0].monedas;
  assert.ok(por.order_accept.coste * barato <= 5, "aceptar un pedido cuesta como mucho 5 centavos con el paquete más pequeño");
});
await test("costeMensaje y mensajesHastaCobro: 3 gratis por conversación y 1 moneda cada 5", () => {
  const p = PRECIOS_DEFECTO.find((x) => x.accion === "chat_message");
  const cobrados = [];
  for (let n = 0; n < 25; n++) if (costeMensaje(p, n) > 0) cobrados.push(n + 1);
  assert.deepEqual(cobrados, [4, 9, 14, 19, 24], "se cobra el mensaje 4, 9, 14, 19 y 24");
  assert.deepEqual([0, 1, 2, 3, 4, 8, 9].map((n) => mensajesHastaCobro(p, n)), [3, 2, 1, 0, 4, 0, 4]);
  assert.equal(costeMensaje({ gratis: 3, coste: 0 }, 50), 0);
  assert.equal(mensajesHastaCobro({ gratis: 3, coste: 0 }, 5), Infinity);
});
await test("textos: monedas en singular/plural y coste junto a los botones", () => {
  assert.deepEqual([textoMonedas(1), textoMonedas(0), textoMonedas(5)], ["1 moneda", "0 monedas", "5 monedas"]);
  assert.equal(textoCoste({ gratisRestantes: 2, cuesta: 0, gratis: true }), "Gratis · te quedan 2");
  assert.equal(textoCoste({ gratisRestantes: 1, cuesta: 0, gratis: true }), "Gratis · te queda 1");
  assert.equal(textoCoste({ gratisRestantes: 0, cuesta: 5, gratis: false }), "5 monedas");
  assert.equal(textoCoste({ gratisRestantes: 0, cuesta: 1, gratis: false }), "1 moneda");
  assert.equal(textoCoste({ gratisRestantes: 0, cuesta: 0, gratis: true }), "Gratis");
  assert.deepEqual([dolares(50), dolares(150), dolares(350)], ["$0.50", "$1.50", "$3.50"]);
});
await test("saldo insuficiente: se reconoce el error de la base, con acción y coste, o el genérico de los canjes", () => {
  assert.deepEqual(detalleSaldo("insufficient_coins:order_accept:5"), { accion: "order_accept", coste: 5 });
  assert.deepEqual(detalleSaldo("insufficient_coins"), {});
  assert.equal(detalleSaldo("otro error"), null);
  assert.equal(esSaldoInsuficiente("insufficient_coins:chat_message:1"), true);
  assert.equal(esSaldoInsuficiente("permission denied"), false);
  assert.equal(mensajeSaldoInsuficiente("insufficient_coins:order_accept:5"), "🪙 Necesitas 5 monedas para aceptar este pedido. Recarga o gánalas con retos.");
  assert.equal(mensajeSaldoInsuficiente("insufficient_coins:chat_message:1"), "🪙 Necesitas 1 moneda para seguir escribiendo en esta cita. Recarga o gánalas con retos.");
  assert.equal(mensajeSaldoInsuficiente("insufficient_coins"), "🪙 No tienes suficientes monedas.");
  assert.equal(mensajeSaldoInsuficiente("nada que ver"), null);
  assert.equal(esMensajeDeMonedas("🪙 Necesitas 1 moneda…"), true);
  assert.equal(esMensajeDeMonedas("Algo falló"), false);
});
await test("los mensajes de error de pedidos, solicitudes y eventos avisan de las monedas antes que cualquier otro texto", () => {
  for (const f of [mensajeErrorPedido, mensajeErrorSolicitud, mensajeErrorEventos]) {
    assert.equal(f("insufficient_coins:order_place:1"), "🪙 Necesitas 1 moneda para hacer este pedido. Recarga o gánalas con retos.");
    assert.ok(esMensajeDeMonedas(f("insufficient_coins:event_publish:10")));
    assert.equal(f("algo raro"), "algo raro", "el resto de errores siguen igual");
  }
  assert.match(mensajeErrorSolicitud("insufficient_coins:offer_send:3"), /enviar tu oferta/);
  assert.match(mensajeErrorEventos("insufficient_coins:event_reserve:1"), /reservar estas entradas/);
});
await test("bono de la primera compra: 25 % hacia abajo; ahorro por moneda frente al paquete pequeño", () => {
  assert.equal(BONO_PRIMERA_COMPRA_PCT, 25);
  assert.deepEqual(PAQUETES_DEFECTO.map((p) => bonoPrimeraCompra(p.monedas)), [12, 41, 105]);
  assert.equal(bonoPrimeraCompra(50, 0), 0);
});
await test("textoMovimiento: cada motivo del historial se lee en español", () => {
  assert.equal(textoMovimiento("purchase:plus"), "Recarga de monedas");
  assert.equal(textoMovimiento("use:order_accept:abc"), "Aceptar un pedido (negocio)");
  assert.equal(textoMovimiento("refund:order_place:abc"), "Devolución: hacer un pedido");
  assert.equal(textoMovimiento("challenge:resenas_semana:2026-W23"), "Reto completado");
  assert.equal(textoMovimiento("admin:beta tester"), "Regalo: beta tester");
  for (const m of ["daily_checkin", "wheel", "referral", "referred_welcome", "mission:perfil", "daily:checkin", "boost", "directory_first_provider", "referral_milestone:5"]) assert.notEqual(textoMovimiento(m), "Movimiento", m);
  assert.equal(textoMovimiento("cosa_rara"), "Movimiento");
});

// ── Panel de administración (lógica) ────────────────────────────────────────
console.log("\nPanel de administración: resumen y textos");
const statsBase = () => ({
  dias: 30, ventas: { pagos: 4, centavos: 1000, monedas: 800, bonificadas: 100, pendientes: 1, fallidos: 0, cancelados: 2 }, por_pasarela: [], por_paquete: [], ajustes: { first_purchase_bonus_pct: 25 },
  compradores: { periodo: 3, total: 4, repetidores: 1 }, usuarios: 100, circulacion: 5000, emitidas: { compras: 800, retos: 600, bonos: 400, invitaciones: 200 },
  gastadas: [{ accion: "order_accept", monedas: 300, usos: 60 }, { accion: "order_place", monedas: 100, usos: 100 }], diario: [{ dia: "2026-06-01", centavos: 0, pagos: 0 }, { dia: "2026-06-02", centavos: 500, pagos: 2 }, { dia: "2026-06-03", centavos: 250, pagos: 1 }],
});
await test("resumenEconomia: ingresos, ticket medio, conversión, repetición, % gratis y rotación", () => {
  const r = resumenEconomia(statsBase());
  assert.deepEqual([r.ingresos, r.ticketMedio, r.conversionPct, r.repeticionPct], ["$10.00", "$2.50", 3, 25]);
  assert.deepEqual([r.emitidasTotal, r.gratisPct, r.gastadasTotal, r.rotacionPct], [2000, 60, 400, 20]);
  assert.equal(r.ingresoPorUsuario, "$0.100");
  const vacio = resumenEconomia({ ...statsBase(), ventas: { ...statsBase().ventas, pagos: 0, centavos: 0 }, usuarios: 0, emitidas: {}, gastadas: [], compradores: { periodo: 0, total: 0, repetidores: 0 } });
  assert.deepEqual([vacio.ticketMedio, vacio.ingresoPorUsuario, vacio.conversionPct, vacio.repeticionPct, vacio.rotacionPct, vacio.gratisPct], ["—", "—", 0, 0, 0, 0], "sin datos no hay divisiones por cero");
  assert.deepEqual(ORIGEN_MONEDAS.filter((o) => !o.gratis).map((o) => o.id), ["compras", "devoluciones"]);
});
await test("alturasBarras: el día más alto llena el gráfico y un día con ventas siempre se ve", () => {
  assert.deepEqual(alturasBarras([{ centavos: 0 }, { centavos: 500 }, { centavos: 250 }]), [0, 100, 50]);
  assert.deepEqual(alturasBarras([{ centavos: 1 }, { centavos: 1000 }]), [4, 100], "un céntimo no desaparece");
  assert.deepEqual(alturasBarras([{ centavos: 0 }, { centavos: 0 }]), [0, 0]);
  assert.deepEqual(alturasBarras([]), []);
});
await test("textoLog describe cada tipo de cambio con el antes y el después", () => {
  assert.equal(textoLog({ accion: "price", detalle: { action: "order_accept", antes: { free: 3, cost: 5, active: true }, despues: { free: 3, cost: 7, active: true } } }), "Tarifa «Aceptar un pedido (negocio)»: cost: 5 → 7");
  assert.equal(textoLog({ accion: "package", detalle: { id: "mini", antes: { price_cents: 50, coins: 50 }, despues: { price_cents: 60, coins: 55 } } }), "Paquete «mini»: price_cents: 50 → 60, coins: 50 → 55");
  assert.equal(textoLog({ accion: "package_new", detalle: { id: "mega", antes: null, despues: { price_cents: 500, coins: 600 } } }), "Paquete nuevo «mega»: $5.00 → 600 monedas");
  assert.equal(textoLog({ accion: "setting", detalle: { key: "first_purchase_bonus_pct", antes: 25, despues: 40 } }), "Ajuste «first_purchase_bonus_pct»: 25 → 40");
  assert.equal(textoLog({ accion: "adjust", detalle: { delta: -15, motivo: "error" } }), "Ajuste de -15 monedas: error");
  assert.equal(textoLog({ accion: "adjust", detalle: { delta: 20, motivo: "regalo" } }), "Ajuste de +20 monedas: regalo");
  assert.equal(textoLog({ accion: "grant", detalle: { delta: 1, motivo: "hola" } }), "Regalo de 1 moneda: hola");
  assert.equal(textoLog({ accion: "price", detalle: { action: "x", antes: { cost: 1 }, despues: { cost: 1 } } }), "Tarifa «x»: sin cambios");
  assert.equal(textoLog({ accion: "otra", detalle: {} }), "otra");
});
await test("dolaresACentavos, validarPaquete, validarAjuste y mensajeErrorAdmin", () => {
  assert.deepEqual(["0.50", "1,5", "$3.50", "1000", "0.1"].map(dolaresACentavos), [50, 150, 350, 100000, 10]);
  for (const malo of ["", "abc", "1.234", "-1", "12345"]) assert.equal(dolaresACentavos(malo), null, malo);
  assert.deepEqual(validarPaquete({ id: "mega", etiqueta: "Recarga mega", precio: "5", monedas: "600", insignia: "" }), {});
  assert.deepEqual(Object.keys(validarPaquete({ id: "X", etiqueta: "", precio: "0.05", monedas: "0", insignia: "a".repeat(31) })).sort(), ["etiqueta", "id", "insignia", "monedas", "precio"]);
  assert.deepEqual(validarAjuste({ cantidad: "+50", motivo: "regalo" }), {});
  assert.deepEqual(validarAjuste({ cantidad: "-20", motivo: "error" }), {});
  assert.deepEqual(Object.keys(validarAjuste({ cantidad: "0", motivo: "" })).sort(), ["cantidad", "motivo"]);
  assert.match(mensajeErrorAdmin("Solo administradores"), /solo para administradores/);
  assert.equal(mensajeErrorAdmin("La persona solo tiene 35 monedas"), "La persona solo tiene 35 monedas");
  assert.match(mensajeErrorAdmin("Could not find the function public.admin_coin_stats"), /actualización 011/);
  assert.equal(mensajeErrorAdmin("otra cosa"), "otra cosa");
});

// ── Icono de moneda ─────────────────────────────────────────────────────────
console.log("\nIcono de moneda");
await test("el emoji 🪙 (Unicode 13) no se pinta directamente en ninguna pantalla: Windows 10 lo muestra como un cuadrado vacío", () => {
  const raiz = path.resolve("src");
  const permitidos = new Set(["components/IconoMoneda.tsx", "app/invitar/page.tsx", "context/SocialContext.tsx", "features/monedas/Piezas.tsx"]);
  const infractores = [];
  const recorrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (p.endsWith(".tsx")) {
        const rel = path.relative(raiz, p).replace(/\\/g, "/");
        if (fs.readFileSync(p, "utf8").includes("🪙") && !permitidos.has(rel)) infractores.push(rel);
      }
    }
  };
  recorrer(raiz);
  assert.deepEqual(infractores, [], "usa <IconoMoneda /> en vez del emoji");
  // Los pocos archivos permitidos lo usan solo en cadenas que pasan por <TextoConMonedas> (o en comentarios)
  for (const rel of ["app/invitar/page.tsx", "context/SocialContext.tsx", "features/monedas/Piezas.tsx"]) {
    const t = fs.readFileSync(path.join(raiz, rel), "utf8");
    assert.ok(t.includes("TextoConMonedas"), `${rel} debe mostrar esas cadenas con TextoConMonedas`);
  }
  for (const rel of ["components/Navbar.tsx", "components/AvisoVivo.tsx"]) assert.ok(fs.readFileSync(path.join(raiz, rel), "utf8").includes("TextoConMonedas"), `${rel}: las notificaciones de la base de datos pueden traer 🪙`);
});
await test("IconoMoneda es un SVG accesible que hereda el tamaño del texto, y TextoConMonedas sustituye cada 🪙 de un texto", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const React = (await import("react")).default;
  globalThis.React = React; // tsx compila el JSX con React.createElement (tsconfig usa «preserve» para Next)
  const { default: IconoMoneda, TextoConMonedas } = await import("@/components/IconoMoneda");
  const decorativo = renderToStaticMarkup(React.createElement(IconoMoneda));
  assert.match(decorativo, /^<svg [^>]*viewBox="0 0 24 24"[^>]*width="1em"[^>]*height="1em"[^>]*aria-hidden="true"/);
  assert.ok(!decorativo.includes("🪙") && !/<script|onload|href=/i.test(decorativo));
  assert.match(renderToStaticMarkup(React.createElement(IconoMoneda, { titulo: "Monedas" })), /role="img"[^>]*aria-label="Monedas"|aria-label="Monedas"[^>]*role="img"/);
  const html = renderToStaticMarkup(React.createElement(TextoConMonedas, { texto: "🪙 Necesitas 5 monedas. Ganas +30 🪙." }));
  assert.equal((html.match(/<svg/g) ?? []).length, 2, "un icono por cada 🪙");
  assert.ok(!html.includes("🪙") && html.includes("Necesitas 5 monedas") && html.includes("+30"));
  assert.equal(renderToStaticMarkup(React.createElement(TextoConMonedas, { texto: "Sin monedas" })), "Sin monedas");
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
process.exit(fallos ? 1 : 0);
