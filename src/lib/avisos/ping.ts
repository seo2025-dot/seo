/**
 * Pide al servidor que envíe ya los avisos pendientes al administrador (registro, negocio nuevo, verificación enviada). Es "lo mejor posible":
 * si falla o no hay correo configurado, el aviso sigue en la cola y se envía después (al abrir el panel /admin o desde un cron).
 * No lleva datos: el servidor solo procesa su propia cola.
 */
export function avisarAlEquipo(): void {
  try {
    void fetch("/api/avisos/procesar", { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    /* sin red o sin fetch: no pasa nada */
  }
}
