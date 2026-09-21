import { ErrorPasarela, type Confirmacion, type Fetch, type InicioPago, type PagoPorCobrar, type UrlsRetorno } from "@/lib/pagos/tipos";

/**
 * PayPhone (Ecuador) — «Botón de pagos».
 *   1) Prepare: creamos la transacción y PayPhone devuelve la dirección de pago.
 *   2) La persona paga y PayPhone la devuelve a `responseUrl` con `?id=<idPayPhone>&clientTransactionId=<nuestra referencia>`.
 *   3) Confirm: preguntamos a PayPhone el estado real. Nunca se acredita por lo que llegue en la URL.
 * Documentación: https://www.docs.payphone.app/ (verificar los campos con tu tienda de pruebas antes de pasar a producción).
 */
export interface ConfigPayPhone {
  /** Token de la aplicación (Bearer). */
  token: string;
  storeId: string;
  /** Solo para pruebas o si PayPhone cambia el dominio. */
  baseUrl?: string;
  /** IVA que se desglosa del total (0 = el precio se envía sin desglose de impuestos). Decisión contable de la empresa. */
  ivaPct?: number;
}

const BASE = "https://pay.payphonetodoesposible.com";
const cabeceras = (cfg: ConfigPayPhone) => ({ Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" });

/** Reparte un total en «base» e IVA, todo en centavos y de modo que la suma sea exactamente el total. */
export function desgloseIva(totalCentavos: number, ivaPct: number): { sinIva: number; conIva: number; iva: number } {
  if (!ivaPct) return { sinIva: totalCentavos, conIva: 0, iva: 0 };
  const conIva = Math.round(totalCentavos / (1 + ivaPct / 100));
  return { sinIva: 0, conIva, iva: totalCentavos - conIva };
}

/** Cuerpo de `Prepare`. Los importes son enteros en centavos y `amount` = suma de todos los componentes (lo exige PayPhone). */
export function cuerpoPrepare(cfg: ConfigPayPhone, pago: PagoPorCobrar, urls: UrlsRetorno) {
  const d = desgloseIva(pago.centavos, cfg.ivaPct ?? 0);
  return {
    amount: pago.centavos,
    amountWithoutTax: d.sinIva,
    amountWithTax: d.conIva,
    tax: d.iva,
    service: 0,
    tip: 0,
    storeId: cfg.storeId,
    reference: pago.descripcion.slice(0, 100),
    clientTransactionId: pago.clientRef,
    currency: "USD",
    responseUrl: urls.exito,
    cancellationUrl: urls.cancelado,
  };
}

export async function prepararPayPhone(cfg: ConfigPayPhone, pago: PagoPorCobrar, urls: UrlsRetorno, f: Fetch): Promise<InicioPago> {
  if (!cfg.token || !cfg.storeId) throw new ErrorPasarela("PayPhone no está configurado", "config");
  let r;
  try {
    r = await f(`${cfg.baseUrl ?? BASE}/api/button/Prepare`, { method: "POST", headers: cabeceras(cfg), body: JSON.stringify(cuerpoPrepare(cfg, pago, urls)) });
  } catch {
    throw new ErrorPasarela("No se pudo contactar con PayPhone", "red");
  }
  if (!r.ok) throw new ErrorPasarela(`PayPhone rechazó la solicitud (${r.status})`, "respuesta", r.status);
  const d = (await r.json()) as { paymentId?: number | string; payWithPayPhone?: string; payWithCard?: string };
  const url = d.payWithCard ?? d.payWithPayPhone;
  if (!url || d.paymentId === undefined) throw new ErrorPasarela("PayPhone no devolvió la dirección de pago", "respuesta");
  return { urlPago: url, idProveedor: String(d.paymentId) };
}

interface RespuestaConfirm {
  transactionStatus?: string;
  statusCode?: number;
  amount?: number;
  currency?: string;
  clientTransactionId?: string;
  transactionId?: number | string;
}

/** 3 = aprobada, 2 = cancelada; cualquier otro código sigue pendiente. */
export function estadoPayPhone(statusCode: number | undefined, transactionStatus?: string): "aprobado" | "rechazado" | "pendiente" {
  if (statusCode === 3 || transactionStatus === "Approved") return "aprobado";
  if (statusCode === 2 || transactionStatus === "Canceled") return "rechazado";
  return "pendiente";
}

export async function confirmarPayPhone(cfg: ConfigPayPhone, datos: { id: number; clientTxId: string }, f: Fetch): Promise<Confirmacion> {
  if (!cfg.token) throw new ErrorPasarela("PayPhone no está configurado", "config");
  let r;
  try {
    r = await f(`${cfg.baseUrl ?? BASE}/api/button/V2/Confirm`, { method: "POST", headers: cabeceras(cfg), body: JSON.stringify({ id: datos.id, clientTxId: datos.clientTxId }) });
  } catch {
    throw new ErrorPasarela("No se pudo contactar con PayPhone", "red");
  }
  if (!r.ok) throw new ErrorPasarela(`PayPhone no confirmó la transacción (${r.status})`, "respuesta", r.status);
  const d = (await r.json()) as RespuestaConfirm;
  return {
    estado: estadoPayPhone(d.statusCode, d.transactionStatus),
    clientRef: d.clientTransactionId ?? "",
    refProveedor: String(d.transactionId ?? datos.id),
    centavos: Math.round(Number(d.amount ?? 0)),
    moneda: d.currency ?? "USD",
    crudo: d,
  };
}
