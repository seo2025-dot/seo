import type { ReaccionId } from "@/types/social";

// ── Reacciones rápidas ──────────────────────────────────────────────────────
export const REACCIONES: { id: ReaccionId; emoji: string; etiqueta: string }[] = [
  { id: "like", emoji: "👍", etiqueta: "Me gusta" },
  { id: "love", emoji: "❤️", etiqueta: "Me encanta" },
  { id: "haha", emoji: "😂", etiqueta: "Me divierte" },
  { id: "wow", emoji: "😮", etiqueta: "Me asombra" },
  { id: "clap", emoji: "👏", etiqueta: "Aplausos" },
];

export const REACCION_POR_ID = Object.fromEntries(REACCIONES.map((r) => [r.id, r])) as Record<ReaccionId, (typeof REACCIONES)[number]>;

/** Total de reacciones y las más usadas (de mayor a menor; a igualdad, en el orden del catálogo). */
export function resumenReacciones(reacciones: Record<string, ReaccionId>): { total: number; top: { id: ReaccionId; n: number }[] } {
  const cuenta = new Map<ReaccionId, number>();
  for (const r of Object.values(reacciones)) cuenta.set(r, (cuenta.get(r) ?? 0) + 1);
  const top = REACCIONES.filter((r) => cuenta.has(r.id))
    .map((r) => ({ id: r.id, n: cuenta.get(r.id) ?? 0 }))
    .sort((a, b) => b.n - a.n);
  return { total: Object.keys(reacciones).length, top };
}

// ── Fama: «Top Conector» ────────────────────────────────────────────────────
/** Reglas de puntos de los últimos 30 días. Deben coincidir con _connector_scores() en supabase/update_005_comunidad_viva.sql. */
export const PUNTOS_ACTIVIDAD = [
  { id: "publicar", accion: "Publicar en el muro", puntos: 3, tope: 30 },
  { id: "reacciones", accion: "Cada reacción que recibe tu publicación", puntos: 1, tope: 50 },
  { id: "comentarios", accion: "Cada comentario que recibe tu publicación", puntos: 2, tope: 40 },
  { id: "comentar", accion: "Comentar en publicaciones de otras personas", puntos: 1, tope: 20 },
  { id: "invitar", accion: "Cada amistad invitada que completa su perfil", puntos: 10, tope: 100 },
  { id: "match", accion: "Cada match", puntos: 2, tope: 20 },
] as const;

export const TOP_N = 10;
/** Puntos mínimos para figurar en el ranking (no basta una acción suelta). */
export const PUNTOS_MINIMOS_TOP = 10;

export interface EstadoConector {
  score: number;
  rank: number | null;
  is_top: boolean;
  threshold: number;
}

/** Lo que falta para entrar en el Top 10 y el avance hacia ello (0–100). */
export function progresoHaciaTop(e: EstadoConector): { falta: number; porcentaje: number } {
  const falta = e.is_top ? 0 : Math.max(0, e.threshold - e.score);
  const porcentaje = e.threshold <= 0 ? 100 : Math.min(100, Math.round((e.score / e.threshold) * 100));
  return { falta, porcentaje: e.is_top ? 100 : porcentaje };
}

export const medallaDe = (rank: number): string | null => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null);

// ── Miembros recientes ──────────────────────────────────────────────────────
/** Ventana circular de `n` elementos empezando en `inicio` (para el efecto rotativo del muro de miembros). */
export function ventanaRotativa<T>(lista: T[], inicio: number, n: number): T[] {
  if (lista.length === 0) return [];
  const k = Math.min(n, lista.length);
  return Array.from({ length: k }, (_, i) => lista[(((inicio + i) % lista.length) + lista.length) % lista.length]);
}

/** «se unió ahora / hace 5 min / hace 3 h / hace 2 d». */
export function textoUnion(unidoEn: number, ahora = Date.now()): string {
  const min = Math.floor((ahora - unidoEn) / 60_000);
  if (min < 1) return "se unió ahora";
  if (min < 60) return `se unió hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `se unió hace ${h} h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `se unió hace ${d} d` : "se unió este mes";
}

// ── Muro infinito ───────────────────────────────────────────────────────────
export const TAM_LOTE_VISIBLE = 8; // publicaciones que se revelan de una vez al llegar al final
/** Tras este número de lotes automáticos, el muro pide un toque («Ver más»): así el pie de página sigue siendo alcanzable. */
export const LOTES_AUTOMATICOS = 6;

export type BloqueMuro = "sugerencias" | "invitar" | "conectores" | "ofertas";

/** Tras cuántas publicaciones (1-based) se intercala cada bloque especial del muro. */
export const POSICION_BLOQUE: Record<BloqueMuro, number> = { sugerencias: 3, invitar: 6, conectores: 8, ofertas: 10 };

/**
 * Bloques que se intercalan justo después de la publicación número `indice` (0-based) cuando se muestran `mostradas`.
 * Si hay menos publicaciones que la posición de un bloque, este va tras la última: así nunca desaparece por tener un muro corto.
 */
export function bloquesTrasPublicacion(indice: number, mostradas: number): BloqueMuro[] {
  return (Object.keys(POSICION_BLOQUE) as BloqueMuro[]).filter((b) => Math.min(POSICION_BLOQUE[b], mostradas) - 1 === indice);
}

// ── Texto con enlaces ───────────────────────────────────────────────────────
export type TrozoTexto = { tipo: "texto"; valor: string } | { tipo: "enlace"; valor: string; href: string };

/**
 * Separa un texto en trozos de texto y enlaces. Solo se enlazan direcciones http(s) (o «www.») para que un texto ajeno nunca
 * pueda producir un esquema peligroso como javascript:. La puntuación final ( . , ; : ! ? ) ] ) queda fuera del enlace.
 */
export function partirEnlaces(texto: string): TrozoTexto[] {
  const trozos: TrozoTexto[] = [];
  const re = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  let desde = 0;
  for (const m of texto.matchAll(re)) {
    const inicio = m.index ?? 0;
    const visible = m[0].replace(/[.,;:!?)\]]+$/, "");
    if (visible.length < 5) continue;
    if (inicio > desde) trozos.push({ tipo: "texto", valor: texto.slice(desde, inicio) });
    trozos.push({ tipo: "enlace", valor: visible, href: /^https?:\/\//i.test(visible) ? visible : `https://${visible}` });
    desde = inicio + visible.length;
  }
  if (desde < texto.length) trozos.push({ tipo: "texto", valor: texto.slice(desde) });
  return trozos;
}

// ── Tendencias ──────────────────────────────────────────────────────────────
/** Zonas más mencionadas en publicaciones de los últimos 7 días: [zona, nº de publicaciones], de más a menos. */
export function tendenciasSemana(posts: { zona?: string; ts: number }[], ahora = Date.now(), max = 5): [string, number][] {
  const desde = ahora - 7 * 86_400_000;
  const cuenta = new Map<string, number>();
  for (const p of posts) {
    const zona = p.zona?.trim();
    if (zona && p.ts >= desde) cuenta.set(zona, (cuenta.get(zona) ?? 0) + 1);
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max);
}

// ── Puntos de actividad (misma fórmula que _connector_scores) ───────────────
export interface Actividad {
  publicaciones: number;
  reaccionesRecibidas: number;
  comentariosRecibidos: number;
  comentariosHechos: number;
  invitados: number;
  matches: number;
}

/** Puntos de un periodo de 30 días: cada categoría suma «puntos × cantidad» hasta su tope. Sirve para explicar el ranking y para el test de paridad con SQL. */
export function puntosDeActividad(a: Actividad): number {
  const cantidad: Record<(typeof PUNTOS_ACTIVIDAD)[number]["id"], number> = {
    publicar: a.publicaciones,
    reacciones: a.reaccionesRecibidas,
    comentarios: a.comentariosRecibidos,
    comentar: a.comentariosHechos,
    invitar: a.invitados,
    match: a.matches,
  };
  return PUNTOS_ACTIVIDAD.reduce((t, p) => t + Math.min(p.tope, p.puntos * Math.max(0, cantidad[p.id])), 0);
}
