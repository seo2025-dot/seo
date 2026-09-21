import "server-only";
import { leerConfigAvisos } from "@/lib/avisos/correo";
import { enviarConResend, procesarAvisos, type Fetch, type ResultadoAvisos } from "@/lib/avisos/enviar";
import type { AvisoFila } from "@/lib/avisos/correo";
import { clienteAdmin } from "@/lib/supabase/admin";

export type ResultadoProceso = (ResultadoAvisos & { motivo?: undefined }) | { enviados: 0; fallidos: 0; motivo: "sin_configurar" };

/** Dirección para los enlaces del correo: solo la configurada (el encabezado Host de una petición se puede falsificar). */
export const sitioParaCorreos = () => process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://conectari.com";

/**
 * Envía por correo los avisos pendientes. Si falta la configuración (correo, clave de Resend o clave de servicio) NO toca la cola: los avisos
 * esperan y se envían en cuanto se configure. Es seguro llamarla muchas veces: cada aviso se reserva una sola vez.
 */
export async function procesarAvisosDelServidor(sitio: string = sitioParaCorreos()): Promise<ResultadoProceso> {
  const cfg = leerConfigAvisos(process.env as Record<string, string | undefined>);
  const admin = clienteAdmin();
  if (!cfg || !admin) return { enviados: 0, fallidos: 0, motivo: "sin_configurar" };
  return procesarAvisos({
    sitio,
    async reclamar(limite) {
      const { data, error } = await admin.rpc("claim_admin_alerts", { p_limit: limite });
      if (error) throw new Error(error.message);
      return (data ?? []) as AvisoFila[];
    },
    async terminar(id, ok, error) {
      await admin.rpc("finish_admin_alert", { p_id: id, p_ok: ok, p_error: error ?? null });
    },
    enviar: (correo) => enviarConResend(fetch as unknown as Fetch, cfg, correo),
  });
}
