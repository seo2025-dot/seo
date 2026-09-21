import { capturaDeEvento, capturarOrdenPayPal, cabecerasWebhook, crearOrdenPayPal, verificarWebhookPayPal, type ConfigPayPal } from "@/lib/pagos/paypal";
import { confirmarPayPhone, prepararPayPhone, type ConfigPayPhone } from "@/lib/pagos/payphone";
import { ErrorPasarela, type Confirmacion, type Fetch, type InicioPago, type PagoPorCobrar, type UrlsRetorno } from "@/lib/pagos/tipos";
import type { Pasarela } from "@/lib/monedas";

/**
 * Orquestación de los pagos, sin Next ni Supabase: recibe sus dependencias (`Deps`). Las rutas de `src/app/api/pagos/*` solo
 * traducen la petición HTTP y llaman aquí; así todo el flujo se prueba con pasarelas simuladas.
 */
export interface ResultadoCredito {
  ok: boolean;
  already?: boolean;
  reason?: string;
  coins?: number;
}

export interface Deps {
  /** Llama a `credit_coin_payment` con la clave de servicio. */
  acreditar(a: { clientRef: string; pasarela: Pasarela; refProveedor: string; centavos: number; crudo: unknown }): Promise<ResultadoCredito>;
  /** Llama a `fail_coin_payment` con la clave de servicio. */
  cerrar(clientRef: string, estado: "failed" | "cancelled", crudo?: unknown): Promise<void>;
  fetch: Fetch;
}

export type EstadoRetorno = "ok" | "cancelado" | "error" | "pendiente";
export interface Retorno {
  estado: EstadoRetorno;
  clientRef?: string;
}

/** Acredita lo que la pasarela confirmó. Devuelve el estado que se muestra a la persona. */
async function aplicar(deps: Deps, pasarela: Pasarela, c: Confirmacion): Promise<Retorno> {
  if (!c.clientRef) return { estado: "error" };
  if (c.estado === "pendiente") return { estado: "pendiente", clientRef: c.clientRef };
  if (c.estado === "rechazado") {
    await deps.cerrar(c.clientRef, "cancelled", c.crudo);
    return { estado: "cancelado", clientRef: c.clientRef };
  }
  if (c.moneda !== "USD") {
    await deps.cerrar(c.clientRef, "failed", { motivo: "moneda_distinta", moneda: c.moneda });
    return { estado: "error", clientRef: c.clientRef };
  }
  const r = await deps.acreditar({ clientRef: c.clientRef, pasarela, refProveedor: c.refProveedor, centavos: c.centavos, crudo: c.crudo });
  return { estado: r.ok ? "ok" : "error", clientRef: c.clientRef };
}

/** Inicia el pago en la pasarela elegida y devuelve a dónde enviar a la persona. */
export async function iniciarPago(pasarela: Exclude<Pasarela, "prueba">, cfg: { payphone?: ConfigPayPhone; paypal?: ConfigPayPal }, pago: PagoPorCobrar, urls: UrlsRetorno, f: Fetch): Promise<InicioPago> {
  if (pasarela === "payphone") {
    if (!cfg.payphone) throw new ErrorPasarela("PayPhone no está configurado", "config");
    return prepararPayPhone(cfg.payphone, pago, urls, f);
  }
  if (!cfg.paypal) throw new ErrorPasarela("PayPal no está configurado", "config");
  return crearOrdenPayPal(cfg.paypal, pago, urls, f);
}

/**
 * Retorno de PayPhone: `?id=<idPayPhone>&clientTransactionId=<nuestra referencia>`. Se confirma con PayPhone y se comprueba que la
 * referencia que responde es la de la URL (así nadie puede acreditar el pago de otra persona cambiando un parámetro).
 */
export async function completarPayPhone(deps: Deps, cfg: ConfigPayPhone, q: { id?: string | null; clientTransactionId?: string | null }): Promise<Retorno> {
  const id = Number(q.id);
  if (!Number.isInteger(id) || id <= 0 || !q.clientTransactionId) return { estado: "error" };
  try {
    const c = await confirmarPayPhone(cfg, { id, clientTxId: q.clientTransactionId }, deps.fetch);
    if (c.clientRef !== q.clientTransactionId) return { estado: "error" };
    return await aplicar(deps, "payphone", c);
  } catch (e) {
    return e instanceof ErrorPasarela && e.codigo === "red" ? { estado: "pendiente", clientRef: q.clientTransactionId } : { estado: "error", clientRef: q.clientTransactionId };
  }
}

/** Retorno de PayPal: `?token=<idOrden>&ref=<nuestra referencia>`. La orden se captura desde el servidor. */
export async function completarPayPal(deps: Deps, cfg: ConfigPayPal, q: { token?: string | null; ref?: string | null }): Promise<Retorno> {
  if (!q.token) return { estado: "error", clientRef: q.ref ?? undefined };
  try {
    const c = await capturarOrdenPayPal(cfg, q.token, deps.fetch);
    if (q.ref && c.clientRef && c.clientRef !== q.ref) return { estado: "error" };
    return await aplicar(deps, "paypal", c);
  } catch (e) {
    return e instanceof ErrorPasarela && e.codigo === "red" ? { estado: "pendiente", clientRef: q.ref ?? undefined } : { estado: "error", clientRef: q.ref ?? undefined };
  }
}

export type ResultadoWebhook = { http: 200 | 400 | 401 | 500; motivo: string };

/** Aviso de PayPal (`PAYMENT.CAPTURE.COMPLETED`). Sin firma válida no se hace nada. Responde 200 también a eventos que no nos interesan. */
export async function procesarWebhookPayPal(deps: Deps, cfg: ConfigPayPal, cabeceras: { get(n: string): string | null }, cuerpo: string): Promise<ResultadoWebhook> {
  const cab = cabecerasWebhook(cabeceras);
  if (!cab) return { http: 400, motivo: "faltan_cabeceras" };
  let evento: unknown;
  try {
    evento = JSON.parse(cuerpo);
  } catch {
    return { http: 400, motivo: "json_invalido" };
  }
  let valido = false;
  try {
    valido = await verificarWebhookPayPal(cfg, cab, evento, deps.fetch);
  } catch {
    return { http: 500, motivo: "no_se_pudo_verificar" }; // PayPal reintenta
  }
  if (!valido) return { http: 401, motivo: "firma_invalida" };
  const c = capturaDeEvento(evento);
  if (!c) return { http: 200, motivo: "evento_ignorado" };
  const r = await aplicar(deps, "paypal", c);
  return r.estado === "ok" || r.estado === "cancelado" ? { http: 200, motivo: r.estado } : r.estado === "pendiente" ? { http: 500, motivo: "pendiente" } : { http: 200, motivo: "no_acreditado" };
}
