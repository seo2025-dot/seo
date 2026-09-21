import "server-only";
import { leerConfigPasarelas } from "@/lib/pagos/config";
import type { Deps, ResultadoCredito } from "@/lib/pagos/flujo";
import type { Fetch } from "@/lib/pagos/tipos";
import { origenPublico } from "@/lib/origen";
import { clienteAdmin } from "@/lib/supabase/admin";

/** Configuración de pasarelas leída del entorno del servidor. */
export const configPasarelas = () => leerConfigPasarelas(process.env as Record<string, string | undefined>);

/** Dependencias reales del flujo de pagos: `fetch` global y la base de datos con la clave de servicio. */
export function depsPagos(): Deps | null {
  const admin = clienteAdmin();
  if (!admin) return null;
  return {
    fetch: fetch as unknown as Fetch,
    async acreditar(a) {
      const { data, error } = await admin.rpc("credit_coin_payment", { p_client_ref: a.clientRef, p_provider: a.pasarela, p_provider_ref: a.refProveedor, p_amount_cents: a.centavos, p_raw: a.crudo ?? {} });
      if (error) return { ok: false, reason: error.message };
      return data as ResultadoCredito;
    },
    async cerrar(clientRef, estado, crudo) {
      await admin.rpc("fail_coin_payment", { p_client_ref: clientRef, p_status: estado, p_raw: crudo ?? {} });
    },
  };
}

/** Dirección pública de la app (las pasarelas devuelven aquí a la persona). */
export const sitioPublico = (req: Request) => origenPublico(req);
