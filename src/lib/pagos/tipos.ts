/** Tipos comunes de las pasarelas de pago. Los módulos de cada pasarela no dependen de Next ni de Supabase: reciben `fetch` y devuelven datos. */

export type Fetch = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

/** Un pago ya creado en nuestra base (importe fijado por el servidor). */
export interface PagoPorCobrar {
  /** Identificador nuestro: clientTransactionId en PayPhone y custom_id en PayPal. */
  clientRef: string;
  centavos: number;
  /** Texto que ve la persona en la pasarela, p. ej. «Recarga plus · 165 monedas». */
  descripcion: string;
}

export interface UrlsRetorno {
  /** A donde vuelve la persona tras pagar (el servidor verifica el pago ahí). */
  exito: string;
  /** A donde vuelve si cancela en la pasarela. */
  cancelado: string;
}

export interface InicioPago {
  /** Dirección de la pasarela a la que se envía a la persona. */
  urlPago: string;
  /** Identificador del pago en la pasarela (idPago de PayPhone, id de la orden de PayPal). */
  idProveedor: string;
}

export type EstadoConfirmacion = "aprobado" | "rechazado" | "pendiente";

/** Lo que la pasarela confirma sobre un pago. Es lo ÚNICO que se usa para acreditar monedas. */
export interface Confirmacion {
  estado: EstadoConfirmacion;
  clientRef: string;
  /** Identificador de la operación en la pasarela (transactionId / id de la captura). Único: no puede pagar dos veces. */
  refProveedor: string;
  centavos: number;
  moneda: string;
  crudo: unknown;
}

export class ErrorPasarela extends Error {
  constructor(
    mensaje: string,
    readonly codigo: "config" | "red" | "respuesta" | "rechazado",
    readonly estadoHttp?: number,
  ) {
    super(mensaje);
    this.name = "ErrorPasarela";
  }
}

/** Convierte centavos en el texto decimal que piden las pasarelas («1.50»). */
export const centavosATexto = (c: number) => (c / 100).toFixed(2);

/** «1.50» → 150. Redondea para no arrastrar errores de coma flotante. */
export const textoACentavos = (t: string | number) => Math.round(Number(t) * 100);
