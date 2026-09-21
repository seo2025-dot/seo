import { NextResponse } from "next/server";
import { procesarWebhookPayPal } from "@/lib/pagos/flujo";
import { configPasarelas, depsPagos } from "@/lib/pagos/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de PayPal (`PAYMENT.CAPTURE.COMPLETED`). Registra esta dirección en el panel de PayPal y copia el «Webhook ID» a PAYPAL_WEBHOOK_ID.
 * La firma se verifica con PayPal antes de tocar nada. Acredita igual que el retorno del navegador y es idempotente: si llegan los dos,
 * las monedas se acreditan una sola vez.
 */
export async function POST(req: Request) {
  const cfg = configPasarelas().paypal;
  const deps = depsPagos();
  if (!cfg || !deps) return NextResponse.json({ ok: false, motivo: "no_configurado" }, { status: 503 });
  const r = await procesarWebhookPayPal(deps, cfg, req.headers, await req.text());
  return NextResponse.json({ ok: r.http === 200, motivo: r.motivo }, { status: r.http });
}
