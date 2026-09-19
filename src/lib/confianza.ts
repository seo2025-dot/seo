import type { Usuario } from "@/types/social";

/** Puntaje de confianza P2P (0–100) a partir de verificaciones, reputación y actividad. */
export function puntajeConfianza(u: Usuario, anioActual = new Date().getFullYear()): number {
  let p = 30;
  if (u.verificaciones.identidad) p += 25;
  if (u.verificaciones.telefono) p += 8;
  if (u.verificaciones.email) p += 7;
  if (u.resenas > 0) p += Math.round((u.rating / 5) * 20);
  p += Math.round(u.respuesta * 0.06);
  p += Math.max(0, Math.min(4, anioActual - u.miembroDesde));
  return Math.max(0, Math.min(100, p));
}

export function nivelConfianza(p: number) {
  if (p >= 85) return { label: "Confianza alta", clases: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (p >= 65) return { label: "Confianza media", clases: "bg-sky-50 text-sky-700 ring-sky-200" };
  if (p >= 45) return { label: "Confianza básica", clases: "bg-amber-50 text-amber-700 ring-amber-200" };
  return { label: "Sin verificar", clases: "bg-slate-50 text-slate-500 ring-slate-200" };
}
