/**
 * Red de invitaciones. Las cifras deben coincidir con _reward_referral() en supabase/schema.sql:
 * +50 monedas por cada invitado que completa su perfil (y +25 para el invitado) y bonos por hito.
 * Las monedas son virtuales y no tienen valor monetario.
 */

export const META_CIRCULO = 20;
export const PREMIO_POR_INVITADO = 50;
export const BIENVENIDA_INVITADO = 25;

export const HITOS = [
  { n: 3, bonus: 50 },
  { n: 5, bonus: 100 },
  { n: 10, bonus: 250 },
  { n: 20, bonus: 600 },
] as const;

export interface Nivel {
  min: number;
  nombre: string;
  emoji: string;
  lema: string;
}

/** Rangos de estatus por invitados confirmados (que completaron su perfil). */
export const NIVELES: Nivel[] = [
  { min: 0, nombre: "Semilla", emoji: "🌱", lema: "Todo círculo empieza con una persona." },
  { min: 1, nombre: "Puente", emoji: "🌉", lema: "Ya conectaste a alguien con la comunidad." },
  { min: 3, nombre: "Conector", emoji: "🔗", lema: "Tu red empieza a sostenerse sola." },
  { min: 5, nombre: "Embajador", emoji: "🏅", lema: "Tu palabra ya trae gente a la comunidad." },
  { min: 10, nombre: "Mentor", emoji: "🧭", lema: "Otras personas encontraron su camino gracias a ti." },
  { min: 20, nombre: "Faro", emoji: "🔦", lema: "Un círculo completo: iluminas el camino de otras personas." },
];

export const nivelDe = (confirmados: number): Nivel => [...NIVELES].reverse().find((n) => confirmados >= n.min) ?? NIVELES[0];
export const siguienteNivel = (confirmados: number): Nivel | null => NIVELES.find((n) => n.min > confirmados) ?? null;
export const progresoCirculo = (confirmados: number) => Math.min(100, Math.round((confirmados / META_CIRCULO) * 100));

export function siguienteHito(confirmados: number) {
  return HITOS.find((h) => h.n > confirmados) ?? null;
}

export function urlInvitacion(origen: string, codigo: string): string {
  return `${origen.replace(/\/$/, "")}/registro?ref=${encodeURIComponent(codigo)}`;
}

export function mensajeInvitacion(nombre: string, url: string): string {
  const yo = nombre.trim().split(/\s+/)[0] || "Un amigo";
  return `Hola, soy ${yo}. Estoy usando conectari.com para conocer gente afín en mi ciudad y me pareció que encajarías. Entra con mi enlace y empiezas con monedas de bienvenida: ${url}`;
}

/** Código de invitación válido (lo genera el servidor: 10 hex; se aceptan mayúsculas). */
export const codigoValido = (c: string | null | undefined): c is string => !!c && /^[0-9a-f]{6,16}$/i.test(c.trim());
