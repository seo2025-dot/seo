import type { ConfigPayPal } from "@/lib/pagos/paypal";
import type { ConfigPayPhone } from "@/lib/pagos/payphone";
import type { Pasarela } from "@/lib/monedas";

/**
 * Qué pasarelas están listas según las variables de entorno. Sin credenciales una pasarela simplemente no aparece: la tienda muestra
 * «Próximamente» en vez de fallar. Es una función pura (recibe el entorno) para poder probarla.
 *
 *   PAYPHONE_TOKEN, PAYPHONE_STORE_ID        Botón de pagos de PayPhone (token de la aplicación y Store ID)
 *   PAYPHONE_IVA_PCT                         IVA a desglosar del total (0 por defecto)
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET   Credenciales REST de PayPal
 *   PAYPAL_ENV                               «sandbox» (por defecto) o «live»
 *   PAYPAL_WEBHOOK_ID                        Id del webhook (obligatorio para aceptar avisos de PayPal)
 *   SUPABASE_SERVICE_ROLE_KEY                Para acreditar las monedas desde el servidor
 *   NEXT_PUBLIC_SITE_URL                     Dirección pública (las pasarelas devuelven a la persona aquí)
 */
export interface PasarelasConfiguradas {
  payphone?: ConfigPayPhone;
  paypal?: ConfigPayPal;
  /** Pago de prueba: solo fuera de producción. Nunca se puede activar con una variable. */
  prueba: boolean;
  /** ¿Se puede acreditar desde el servidor? Sin esto ninguna pasarela real puede completar un pago. */
  puedeAcreditar: boolean;
}

type Entorno = Record<string, string | undefined>;

export function leerConfigPasarelas(env: Entorno): PasarelasConfiguradas {
  const t = (k: string) => env[k]?.trim() || undefined;
  const puedeAcreditar = Boolean(t("SUPABASE_SERVICE_ROLE_KEY") && t("NEXT_PUBLIC_SUPABASE_URL"));
  const iva = Number(t("PAYPHONE_IVA_PCT") ?? "0");
  return {
    payphone: t("PAYPHONE_TOKEN") && t("PAYPHONE_STORE_ID") ? { token: t("PAYPHONE_TOKEN")!, storeId: t("PAYPHONE_STORE_ID")!, ivaPct: Number.isFinite(iva) && iva >= 0 && iva < 100 ? iva : 0 } : undefined,
    paypal:
      t("PAYPAL_CLIENT_ID") && t("PAYPAL_CLIENT_SECRET")
        ? { clientId: t("PAYPAL_CLIENT_ID")!, secret: t("PAYPAL_CLIENT_SECRET")!, env: t("PAYPAL_ENV") === "live" ? "live" : "sandbox", webhookId: t("PAYPAL_WEBHOOK_ID") }
        : undefined,
    prueba: env.NODE_ENV !== "production",
    puedeAcreditar,
  };
}

/** Qué pasarelas puede ofrecer la tienda ahora mismo. Una pasarela real exige además poder acreditar desde el servidor. */
export function pasarelasDisponibles(c: PasarelasConfiguradas): Record<Pasarela, boolean> {
  return { payphone: Boolean(c.payphone) && c.puedeAcreditar, paypal: Boolean(c.paypal) && c.puedeAcreditar, prueba: c.prueba && c.puedeAcreditar };
}

/** Direcciones a las que las pasarelas devuelven a la persona. */
export function urlsDePago(sitio: string, pasarela: Pasarela, clientRef: string) {
  const base = sitio.replace(/\/+$/, "");
  const ref = encodeURIComponent(clientRef);
  return {
    exito: `${base}/api/pagos/${pasarela}/retorno${pasarela === "paypal" ? `?ref=${ref}` : ""}`,
    cancelado: `${base}/api/pagos/cancelado?ref=${ref}`,
  };
}

/** Dirección de resultado dentro de la tienda. */
export const urlResultado = (estado: "ok" | "cancelado" | "error" | "pendiente", clientRef?: string) => `/monedas/resultado?estado=${estado}${clientRef ? `&ref=${encodeURIComponent(clientRef)}` : ""}`;
