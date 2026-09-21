import { NextResponse } from "next/server";
import { procesarAvisosDelServidor } from "@/lib/avisos/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Envía por correo al administrador los avisos pendientes (registros, negocios nuevos y verificaciones de identidad).
 * No recibe datos ni devuelve nada sensible: solo procesa lo que ya está en la cola y lo manda al correo configurado en el servidor
 * (ADMIN_ALERT_EMAIL), así que puede llamarse sin sesión —lo hace la app justo después de un registro— y también desde un cron externo.
 * Los enlaces del correo usan NEXT_PUBLIC_SITE_URL, nunca la dirección de la petición.
 */
async function procesar() {
  const resultado = await procesarAvisosDelServidor().catch(() => null);
  return NextResponse.json(resultado ?? { enviados: 0, fallidos: 0, motivo: "error" }, { headers: { "Cache-Control": "no-store" } });
}

export const POST = procesar;
export const GET = procesar;
