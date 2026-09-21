import { NextResponse } from "next/server";
import { urlResultado } from "@/lib/pagos/config";
import { depsPagos } from "@/lib/pagos/servidor";
import { origenPublico } from "@/lib/origen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** La persona canceló en la pasarela: se cierra el pago pendiente (si sigue pendiente) y se vuelve a la tienda. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref") ?? "";
  if (/^[0-9a-f]{32}$/.test(ref)) await depsPagos()?.cerrar(ref, "cancelled", { motivo: "cancelado_por_la_persona" });
  return NextResponse.redirect(new URL(urlResultado("cancelado", /^[0-9a-f]{32}$/.test(ref) ? ref : undefined), origenPublico(req)), 303);
}
