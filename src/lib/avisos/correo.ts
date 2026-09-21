/**
 * Avisos por correo al administrador: cuando alguien se registra, registra un negocio o envía su verificación de identidad.
 * Todo lo de este archivo es puro (sin red ni base de datos) para poder probarlo: el envío real está en `enviar.ts`.
 *
 * Variables de entorno (solo servidor):
 *   RESEND_API_KEY     Clave de la API de Resend (https://resend.com). Sin ella no se envía nada y los avisos quedan en la cola.
 *   ADMIN_ALERT_EMAIL  Correo que recibe los avisos.
 *   ALERT_FROM         Remitente (por defecto «Conectari <onboarding@resend.dev>», que Resend solo entrega al correo de la cuenta de Resend;
 *                      para enviar desde tu dominio, verifícalo en Resend).
 *   NEXT_PUBLIC_SITE_URL  Dirección pública para el botón «Abrir el panel» (nunca se toma de la petición: el encabezado Host se puede falsificar).
 */

export type TipoAviso = "new_user" | "new_business" | "new_kyc";

export interface AvisoFila {
  id: string;
  kind: TipoAviso;
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
}

export interface Correo {
  asunto: string;
  html: string;
  texto: string;
}

export interface ConfigAvisos {
  apiKey: string;
  destino: string;
  desde: string;
}

type Entorno = Record<string, string | undefined>;

const CORREO = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Lee la configuración; null si falta algo (entonces no se envía ni se reserva ningún aviso). */
export function leerConfigAvisos(env: Entorno): ConfigAvisos | null {
  const t = (k: string) => env[k]?.trim() || undefined;
  const apiKey = t("RESEND_API_KEY");
  const destino = t("ADMIN_ALERT_EMAIL");
  if (!apiKey || !destino || !CORREO.test(destino)) return null;
  return { apiKey, destino, desde: t("ALERT_FROM") ?? "Conectari <onboarding@resend.dev>" };
}

/** Escapa lo que escribió una persona (nombre, negocio…) antes de ponerlo en el HTML del correo. */
export function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

const cadena = (v: unknown, max = 200): string => (typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, max) : "");

/** «21 sep 2026, 14:32» en hora de Ecuador (la del equipo). */
export function fechaParaCorreo(iso: unknown): string {
  const d = new Date(typeof iso === "string" ? iso : "");
  if (Number.isNaN(d.getTime())) return "fecha desconocida";
  const partes = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Guayaquil" })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
  return `${partes.day} ${partes.month.replace(".", "")} ${partes.year}, ${partes.hour}:${partes.minute} (hora de Ecuador)`;
}

const VERTICALES: Record<string, string> = { delivery: "Delivery", salud: "Salud", movilidad: "Movilidad", hogar: "Hogar", mascotas: "Mascotas", eventos: "Eventos" };

/** Arma el correo de un aviso. `sitio` es la dirección pública de la app (para el botón «Abrir el panel»). */
export function armarCorreo(aviso: Pick<AvisoFila, "kind" | "payload">, sitio: string): Correo {
  const p = aviso.payload;
  const base = sitio.replace(/\/+$/, "");
  let asunto: string;
  let titulo: string;
  let filas: [string, string][];
  let enlace: string;

  if (aviso.kind === "new_user") {
    const correo = cadena(p.email) || "(sin correo)";
    asunto = `Nuevo registro: ${correo}`;
    titulo = "Se registró una persona nueva";
    filas = [
      ["Correo", correo],
      ["Nombre", cadena(p.name) || "—"],
      ["Usuario", cadena(p.handle) || "—"],
      ["Fecha de registro", fechaParaCorreo(p.registered_at)],
      ["Rol inicial", cadena(p.role) || "usuario"],
      ["Correo confirmado", p.email_confirmed === true ? "Sí" : "Todavía no"],
    ];
    enlace = `${base}/admin`;
  } else if (aviso.kind === "new_business") {
    const nombre = cadena(p.name) || "(sin nombre)";
    asunto = `Nuevo negocio: ${nombre}`;
    titulo = "Se registró un negocio nuevo";
    const donde = [cadena(p.city), cadena(p.country)].filter(Boolean).join(", ");
    filas = [
      ["Negocio", nombre],
      ["Sección", `${VERTICALES[cadena(p.vertical)] ?? (cadena(p.vertical) || "—")} · ${cadena(p.subtype) || "—"}`],
      ["Ubicación", donde || "—"],
      ["Dueño o dueña", cadena(p.owner_name) || "—"],
      ["Correo del dueño", cadena(p.owner_email) || "—"],
      ["Fecha", fechaParaCorreo(p.created_at)],
    ];
    enlace = `${base}/admin`;
  } else {
    const nombre = cadena(p.name) || "una persona";
    asunto = `Verificación de identidad pendiente: ${nombre}`;
    titulo = "Alguien envió su cédula y su selfie para verificar";
    filas = [
      ["Nombre", nombre],
      ["Correo", cadena(p.email) || "—"],
      ["Enviada", fechaParaCorreo(p.created_at)],
    ];
    enlace = `${base}/admin/kyc`;
  }

  const texto = [titulo, "", ...filas.map(([k, v]) => `${k}: ${v}`), "", `Abrir el panel: ${enlace}`].join("\n");
  const tabla = filas
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#64748b;white-space:nowrap">${escaparHtml(k)}</td><td style="padding:6px 0;font-weight:600;color:#0f172a">${escaparHtml(v)}</td></tr>`)
    .join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:16px">
<h2 style="margin:0 0 12px;color:#0f172a;font-size:18px">${escaparHtml(titulo)}</h2>
<table style="border-collapse:collapse;font-size:14px">${tabla}</table>
<p style="margin:20px 0 0"><a href="${escaparHtml(enlace)}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:700;font-size:14px">Abrir el panel</a></p>
<p style="margin:16px 0 0;color:#94a3b8;font-size:12px">Aviso automático de conectari.com</p>
</div>`;
  return { asunto: asunto.slice(0, 200), html, texto };
}
