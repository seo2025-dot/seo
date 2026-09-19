/**
 * Retos diarios (monedas virtuales sin valor monetario). Fuente de verdad: las funciones SQL
 * daily_challenges_status() / claim_daily_challenge(); este catálogo solo aporta textos y enlaces.
 * Los premios deben coincidir con `_challenge_catalog()` en supabase/schema.sql (hay un test de paridad).
 */

export interface DefReto {
  id: string;
  titulo: string;
  descripcion: string;
  emoji: string;
  premio: number;
  /** Dónde se cumple el reto. Sin enlace = se cumple en la propia pantalla de retos. */
  href?: string;
}

export const RETOS: DefReto[] = [
  { id: "checkin", emoji: "🎁", titulo: "Bono diario", descripcion: "Reclama tu bono y mantén viva tu racha.", premio: 5, href: "/recompensas" },
  { id: "conectar", emoji: "💘", titulo: "Conecta con 3 personas", descripcion: "Da like o super like a 3 perfiles distintos.", premio: 10, href: "/explorar" },
  { id: "publicar", emoji: "✍️", titulo: "Comparte con la comunidad", descripcion: "Publica una historia, una consulta o un anuncio.", premio: 15, href: "/comunidad" },
  { id: "mensaje", emoji: "💬", titulo: "Inicia una conversación", descripcion: "Envía 2 mensajes a alguien de tu círculo.", premio: 10, href: "/mensajes" },
  { id: "reflexion", emoji: "🕊️", titulo: "Reflexión del día", descripcion: "Lee la reflexión de hoy y llévala contigo.", premio: 5 },
  { id: "invitar", emoji: "🌱", titulo: "Trae a alguien a la comunidad", descripcion: "Que una persona invitada por ti complete su perfil hoy.", premio: 30, href: "/invitar" },
  { id: "completo", emoji: "🏆", titulo: "Día completo", descripcion: "Cobra los 5 primeros retos del día y llévate el bono.", premio: 25 },
];

export interface EstadoReto {
  id: string;
  prize: number;
  done: boolean;
  claimed: boolean;
}

export const MS_DIA = 86_400_000;

/** Milisegundos hasta el reinicio de los retos: medianoche UTC, la fecha que usa el servidor. */
export function msHastaReinicio(ahora = Date.now()): number {
  return MS_DIA - (ahora % MS_DIA);
}

export function resumenRetos(estados: EstadoReto[]) {
  const porCobrar = estados.filter((e) => e.done && !e.claimed);
  return {
    hechos: estados.filter((e) => e.claimed).length,
    total: estados.length,
    porCobrar,
    monedasPorCobrar: porCobrar.reduce((a, e) => a + e.prize, 0),
    monedasEnJuego: estados.filter((e) => !e.claimed).reduce((a, e) => a + e.prize, 0),
  };
}
