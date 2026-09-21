import { ErrorPasarela, centavosATexto, textoACentavos, type Confirmacion, type Fetch, type InicioPago, type PagoPorCobrar, type UrlsRetorno } from "@/lib/pagos/tipos";

/**
 * PayPal (internacional) — API REST v2 «Orders».
 *   1) Se crea la orden (importe fijado por nosotros) y PayPal devuelve el enlace de aprobación.
 *   2) La persona aprueba y PayPal la devuelve a `return_url?token=<idOrden>`.
 *   3) Se captura la orden desde el servidor: el dinero solo se mueve ahí y la respuesta trae el importe real.
 *   4) El webhook `PAYMENT.CAPTURE.COMPLETED` es la red de seguridad si la persona cierra el navegador antes de volver.
 * Documentación: https://developer.paypal.com/docs/api/orders/v2/ (probar siempre primero en sandbox).
 */
export interface ConfigPayPal {
  clientId: string;
  secret: string;
  env: "sandbox" | "live";
  /** Id del webhook registrado en el panel de PayPal (para verificar la firma). */
  webhookId?: string;
}

export const baseUrlPayPal = (env: ConfigPayPal["env"]) => (env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

async function llamar(f: Fetch, url: string, init: Parameters<Fetch>[1]) {
  try {
    return await f(url, init);
  } catch {
    throw new ErrorPasarela("No se pudo contactar con PayPal", "red");
  }
}

/** Token de acceso (OAuth2 client credentials). */
export async function tokenPayPal(cfg: ConfigPayPal, f: Fetch): Promise<string> {
  if (!cfg.clientId || !cfg.secret) throw new ErrorPasarela("PayPal no está configurado", "config");
  const basico = Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString("base64");
  const r = await llamar(f, `${baseUrlPayPal(cfg.env)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basico}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new ErrorPasarela(`PayPal rechazó las credenciales (${r.status})`, "config", r.status);
  const d = (await r.json()) as { access_token?: string };
  if (!d.access_token) throw new ErrorPasarela("PayPal no devolvió el token", "respuesta");
  return d.access_token;
}

/** Cuerpo de «crear orden». `custom_id` lleva nuestra referencia y PayPal la repite en la captura y en el webhook. */
export function cuerpoOrden(pago: PagoPorCobrar, urls: UrlsRetorno) {
  return {
    intent: "CAPTURE",
    purchase_units: [{ custom_id: pago.clientRef, description: pago.descripcion.slice(0, 127), amount: { currency_code: "USD", value: centavosATexto(pago.centavos) } }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "conectari.com",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          landing_page: "LOGIN",
          return_url: urls.exito,
          cancel_url: urls.cancelado,
        },
      },
    },
  };
}

export async function crearOrdenPayPal(cfg: ConfigPayPal, pago: PagoPorCobrar, urls: UrlsRetorno, f: Fetch): Promise<InicioPago> {
  const token = await tokenPayPal(cfg, f);
  const r = await llamar(f, `${baseUrlPayPal(cfg.env)}/v2/checkout/orders`, {
    method: "POST",
    // PayPal-Request-Id hace la creación idempotente: reintentar no duplica la orden.
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": pago.clientRef },
    body: JSON.stringify(cuerpoOrden(pago, urls)),
  });
  if (!r.ok) throw new ErrorPasarela(`PayPal no pudo crear la orden (${r.status})`, "respuesta", r.status);
  const d = (await r.json()) as { id?: string; links?: { rel: string; href: string }[] };
  const enlace = d.links?.find((l) => l.rel === "payer-action") ?? d.links?.find((l) => l.rel === "approve");
  if (!d.id || !enlace) throw new ErrorPasarela("PayPal no devolvió el enlace de aprobación", "respuesta");
  return { urlPago: enlace.href, idProveedor: d.id };
}

interface RespuestaOrden {
  id?: string;
  status?: string;
  purchase_units?: { custom_id?: string; payments?: { captures?: { id: string; status: string; custom_id?: string; amount?: { value: string; currency_code: string } }[] } }[];
  name?: string;
  details?: { issue?: string }[];
}

/** Traduce la respuesta de captura (o de «consultar orden») a una confirmación. */
export function confirmacionDeOrden(d: RespuestaOrden): Confirmacion {
  const unidad = d.purchase_units?.[0];
  const captura = unidad?.payments?.captures?.[0];
  const estado = captura?.status === "COMPLETED" ? "aprobado" : captura?.status === "DECLINED" || captura?.status === "FAILED" ? "rechazado" : "pendiente";
  return {
    estado,
    clientRef: captura?.custom_id ?? unidad?.custom_id ?? "",
    refProveedor: captura?.id ?? d.id ?? "",
    centavos: captura?.amount ? textoACentavos(captura.amount.value) : 0,
    moneda: captura?.amount?.currency_code ?? "USD",
    crudo: d,
  };
}

/** Captura la orden aprobada. Si ya estaba capturada (retorno + webhook) consulta la orden y devuelve lo mismo. */
export async function capturarOrdenPayPal(cfg: ConfigPayPal, idOrden: string, f: Fetch): Promise<Confirmacion> {
  if (!/^[A-Z0-9-]{8,40}$/i.test(idOrden)) throw new ErrorPasarela("Identificador de orden no válido", "respuesta");
  const token = await tokenPayPal(cfg, f);
  const cab = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const r = await llamar(f, `${baseUrlPayPal(cfg.env)}/v2/checkout/orders/${idOrden}/capture`, { method: "POST", headers: cab, body: "{}" });
  const d = (await r.json().catch(() => ({}))) as RespuestaOrden;
  if (r.ok) return confirmacionDeOrden(d);
  if (r.status === 422 && d.details?.some((x) => x.issue === "ORDER_ALREADY_CAPTURED")) {
    const g = await llamar(f, `${baseUrlPayPal(cfg.env)}/v2/checkout/orders/${idOrden}`, { method: "GET", headers: cab });
    if (g.ok) return confirmacionDeOrden((await g.json()) as RespuestaOrden);
  }
  throw new ErrorPasarela(`PayPal no pudo capturar la orden (${r.status})`, "respuesta", r.status);
}

// ── Webhook ─────────────────────────────────────────────────────────────────
export interface CabecerasWebhook {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
}

/** Lee las cabeceras que PayPal firma. Devuelve null si falta alguna (petición falsa). */
export function cabecerasWebhook(h: { get(nombre: string): string | null }): CabecerasWebhook | null {
  const v = {
    authAlgo: h.get("paypal-auth-algo"),
    certUrl: h.get("paypal-cert-url"),
    transmissionId: h.get("paypal-transmission-id"),
    transmissionSig: h.get("paypal-transmission-sig"),
    transmissionTime: h.get("paypal-transmission-time"),
  };
  return Object.values(v).every(Boolean) ? (v as CabecerasWebhook) : null;
}

/** Verifica la firma con el servicio de PayPal. Sin `webhookId` configurado nunca se da por válido. */
export async function verificarWebhookPayPal(cfg: ConfigPayPal, cab: CabecerasWebhook, evento: unknown, f: Fetch): Promise<boolean> {
  if (!cfg.webhookId) return false;
  const token = await tokenPayPal(cfg, f);
  const r = await llamar(f, `${baseUrlPayPal(cfg.env)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: cab.authAlgo,
      cert_url: cab.certUrl,
      transmission_id: cab.transmissionId,
      transmission_sig: cab.transmissionSig,
      transmission_time: cab.transmissionTime,
      webhook_id: cfg.webhookId,
      webhook_event: evento,
    }),
  });
  if (!r.ok) return false;
  return ((await r.json()) as { verification_status?: string }).verification_status === "SUCCESS";
}

/** De un evento `PAYMENT.CAPTURE.COMPLETED` saca lo necesario para acreditar (o null si es otro tipo de evento). */
export function capturaDeEvento(evento: unknown): Confirmacion | null {
  const e = evento as { event_type?: string; resource?: { id?: string; status?: string; custom_id?: string; amount?: { value: string; currency_code: string } } };
  if (e?.event_type !== "PAYMENT.CAPTURE.COMPLETED" || !e.resource?.id || !e.resource.amount) return null;
  return {
    estado: e.resource.status === "COMPLETED" ? "aprobado" : "pendiente",
    clientRef: e.resource.custom_id ?? "",
    refProveedor: e.resource.id,
    centavos: textoACentavos(e.resource.amount.value),
    moneda: e.resource.amount.currency_code,
    crudo: { event_type: e.event_type, id: e.resource.id },
  };
}
