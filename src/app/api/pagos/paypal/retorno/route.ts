import { NextResponse } from "next/server";
import { urlResultado } from "@/lib/pagos/config";
import { completarPayPal } from "@/lib/pagos/flujo";
import { configPasarelas, depsPagos } from "@/lib/pagos/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PayPal devuelve aquí a la persona tras aprobar: `?token=<idOrden>&ref=<nuestra referencia>`.
 * La orden se captura desde el servidor (ahí se mueve el dinero) y con el importe capturado se acreditan las monedas.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cfg = configPasarelas().paypal;
  const deps = depsPagos();
  const destino = (estado: Parameters<typeof urlResultado>[0], ref?: string) => NextResponse.redirect(new URL(urlResultado(estado, ref), url.origin), 303);
  if (!cfg || !deps) return destino("error");
  const r = await completarPayPal(deps, cfg, { token: url.searchParams.get("token"), ref: url.searchParams.get("ref") });
  return destino(r.estado, r.clientRef);
}
