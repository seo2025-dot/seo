import { NextResponse } from "next/server";
import { dolares, type Pasarela } from "@/lib/monedas";
import { pasarelasDisponibles, urlsDePago } from "@/lib/pagos/config";
import { iniciarPago } from "@/lib/pagos/flujo";
import { configPasarelas, depsPagos, sitioPublico } from "@/lib/pagos/servidor";
import { ErrorPasarela } from "@/lib/pagos/tipos";
import { supabaseServidor } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PASARELAS: Pasarela[] = ["payphone", "paypal", "prueba"];
const error = (estado: number, codigo: string, mensaje: string) => NextResponse.json({ error: codigo, mensaje }, { status: estado, headers: { "Cache-Control": "no-store" } });

/**
 * Inicia la compra de un paquete de monedas. Body: { paquete: "mini" | "plus" | "pro", pasarela: "payphone" | "paypal" | "prueba" }.
 * El importe y las monedas los fija la base de datos (`create_coin_payment`): el navegador solo elige el paquete.
 * Devuelve { url }: la dirección de la pasarela a la que hay que llevar a la persona.
 */
export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as { paquete?: unknown; pasarela?: unknown } | null;
  const paquete = typeof cuerpo?.paquete === "string" ? cuerpo.paquete : "";
  const pasarela = PASARELAS.find((p) => p === cuerpo?.pasarela);
  if (!/^[a-z_]{1,20}$/.test(paquete) || !pasarela) return error(400, "peticion_invalida", "Elige un paquete y una forma de pago.");

  const sb = await supabaseServidor();
  const { data: sesion } = await sb.auth.getUser();
  if (!sesion.user) return error(401, "sin_sesion", "Inicia sesión para recargar monedas.");

  const cfg = configPasarelas();
  if (!pasarelasDisponibles(cfg)[pasarela]) return error(503, "pasarela_no_disponible", "Esta forma de pago todavía no está disponible.");
  const deps = depsPagos();
  if (!deps) return error(503, "pasarela_no_disponible", "Los pagos todavía no están disponibles.");

  const { data, error: e } = await sb.rpc("create_coin_payment", { p_package: paquete, p_provider: pasarela });
  if (e) {
    if (/Demasiados pagos pendientes/.test(e.message)) return error(429, "demasiados_pendientes", "Tienes varios pagos sin completar. Espera unos minutos.");
    if (/Paquete no disponible/.test(e.message)) return error(400, "paquete_invalido", "Ese paquete no está disponible.");
    return error(400, "no_se_pudo_crear", "No se pudo iniciar el pago.");
  }
  const pago = data as { client_ref: string; amount_cents: number; coins: number; label: string };
  const sitio = sitioPublico(req);

  // Pago de prueba (solo fuera de producción): se acredita en el retorno, sin pasarela.
  if (pasarela === "prueba") return NextResponse.json({ url: `${sitio}/api/pagos/prueba/retorno?ref=${encodeURIComponent(pago.client_ref)}` });

  try {
    const inicio = await iniciarPago(pasarela, cfg, { clientRef: pago.client_ref, centavos: pago.amount_cents, descripcion: `${pago.label} · ${pago.coins} monedas (${dolares(pago.amount_cents)})` }, urlsDePago(sitio, pasarela, pago.client_ref), deps.fetch);
    return NextResponse.json({ url: inicio.urlPago }, { headers: { "Cache-Control": "no-store" } });
  } catch (ex) {
    // No se llegó a cobrar nada: se cierra el pago pendiente para no acumular intentos.
    await deps.cerrar(pago.client_ref, "failed", { motivo: "no_se_pudo_iniciar", detalle: ex instanceof ErrorPasarela ? ex.codigo : "desconocido" });
    return error(502, "pasarela_error", "No se pudo conectar con la pasarela de pago. Inténtalo de nuevo en un momento.");
  }
}
