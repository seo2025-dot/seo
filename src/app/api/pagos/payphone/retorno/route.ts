import { NextResponse } from "next/server";
import { urlResultado } from "@/lib/pagos/config";
import { completarPayPhone } from "@/lib/pagos/flujo";
import { configPasarelas, depsPagos } from "@/lib/pagos/servidor";
import { origenPublico } from "@/lib/origen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PayPhone devuelve aquí a la persona tras pagar: `?id=<idPayPhone>&clientTransactionId=<nuestra referencia>`.
 * Se confirma el pago con PayPhone desde el servidor y solo entonces se acreditan las monedas.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cfg = configPasarelas().payphone;
  const deps = depsPagos();
  const destino = (estado: Parameters<typeof urlResultado>[0], ref?: string) => NextResponse.redirect(new URL(urlResultado(estado, ref), origenPublico(req)), 303);
  if (!cfg || !deps) return destino("error");
  const r = await completarPayPhone(deps, cfg, { id: url.searchParams.get("id"), clientTransactionId: url.searchParams.get("clientTransactionId") });
  return destino(r.estado, r.clientRef);
}
