import { armarCorreo, type AvisoFila, type ConfigAvisos, type Correo } from "@/lib/avisos/correo";

/** Lo mínimo de `fetch` que se usa (para poder simularlo en las pruebas). */
export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Envía un correo con la API de Resend. Lanza un Error corto (sin datos sensibles) si no se pudo. */
export async function enviarConResend(fetchFn: Fetch, cfg: ConfigAvisos, correo: Correo): Promise<void> {
  const r = await fetchFn("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: cfg.desde, to: [cfg.destino], subject: correo.asunto, html: correo.html, text: correo.texto }),
  });
  if (!r.ok) {
    const cuerpo = (await r.text().catch(() => "")).slice(0, 160).replace(/\s+/g, " ");
    throw new Error(`Resend ${r.status}${cuerpo ? `: ${cuerpo}` : ""}`);
  }
}

export interface DepsAvisos {
  reclamar(limite: number): Promise<AvisoFila[]>;
  terminar(id: string, ok: boolean, error?: string): Promise<void>;
  enviar(correo: Correo): Promise<void>;
  sitio: string;
}

export interface ResultadoAvisos {
  enviados: number;
  fallidos: number;
}

/**
 * Reserva los avisos pendientes, manda un correo por cada uno y los marca. Si un correo falla, el aviso vuelve a la cola (se reintenta hasta
 * 5 veces) y no se pierde. Un fallo de uno no detiene a los demás.
 */
export async function procesarAvisos(deps: DepsAvisos, limite = 10): Promise<ResultadoAvisos> {
  const avisos = await deps.reclamar(limite);
  let enviados = 0;
  let fallidos = 0;
  for (const a of avisos) {
    try {
      await deps.enviar(armarCorreo(a, deps.sitio));
      await deps.terminar(a.id, true);
      enviados++;
    } catch (e) {
      fallidos++;
      await deps.terminar(a.id, false, e instanceof Error ? e.message : "error").catch(() => {});
    }
  }
  return { enviados, fallidos };
}
