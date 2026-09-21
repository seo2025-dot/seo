import { NextResponse } from "next/server";
import { pasarelasDisponibles } from "@/lib/pagos/config";
import { configPasarelas } from "@/lib/pagos/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Qué pasarelas están configuradas (la tienda oculta o marca «Próximamente» las que no). No revela ninguna credencial. */
export async function GET() {
  return NextResponse.json(pasarelasDisponibles(configPasarelas()), { headers: { "Cache-Control": "no-store" } });
}
