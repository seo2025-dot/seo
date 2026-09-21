import { NextResponse } from "next/server";
import { pasarelasDisponibles, urlResultado } from "@/lib/pagos/config";
import { configPasarelas, depsPagos } from "@/lib/pagos/servidor";
import { supabaseServidor } from "@/lib/supabase/server";
import { origenPublico } from "@/lib/origen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SOLO DESARROLLO. «Pago de prueba»: acredita el pago sin cobrar nada, para poder probar la tienda sin credenciales de PayPhone ni PayPal.
 * Está desactivado en producción por código (NODE_ENV), no por una variable que alguien pueda dejar encendida; además exige la sesión
 * de la misma persona que creó el pago.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const destino = (estado: Parameters<typeof urlResultado>[0], ref?: string) => NextResponse.redirect(new URL(urlResultado(estado, ref), origenPublico(req)), 303);
  const ref = url.searchParams.get("ref") ?? "";
  const deps = depsPagos();
  if (!pasarelasDisponibles(configPasarelas()).prueba || !deps || !/^[0-9a-f]{32}$/.test(ref)) return destino("error");

  const sb = await supabaseServidor();
  const { data: sesion } = await sb.auth.getUser();
  if (!sesion.user) return destino("error", ref);
  // RLS: solo ve el pago quien lo creó.
  const { data: pago } = await sb.from("coin_payments").select("amount_cents, provider, status").eq("client_ref", ref).maybeSingle();
  if (!pago || pago.provider !== "prueba" || pago.status !== "pending") return destino("error", ref);

  const r = await deps.acreditar({ clientRef: ref, pasarela: "prueba", refProveedor: `prueba-${ref}`, centavos: pago.amount_cents as number, crudo: { modo: "prueba" } });
  return destino(r.ok ? "ok" : "error", ref);
}
