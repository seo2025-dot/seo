/**
 * Mensajes de la app: bienvenida, saludo al volver, panel «lo que hay hoy» y prueba social.
 * Principio: tono cálido y motivador (con un toque estoico: te ocupas de lo que depende de ti) y SOLO cifras reales
 * (las calcula el servidor). Si una cifra es pequeña, no se muestra en lugar de inventarla o redondearla hacia arriba.
 */

export const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] || "amigo";

/** Índice del día del año (0–365) para rotar mensajes de forma estable durante la jornada. */
export const diaDelAno = (f = new Date()) => Math.floor((Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()) - Date.UTC(f.getFullYear(), 0, 0)) / 86_400_000);

// ── Bienvenida de nuevos miembros (se muestra una vez, al terminar el registro) ──────────────
export interface Bienvenida {
  titulo: string;
  subtitulo: string;
  parrafos: string[];
  rango: string;
}

export function bienvenidaNueva(nombre: string, miembros: number): Bienvenida {
  const n = primerNombre(nombre);
  const fundador = miembros > 0 && miembros <= 500;
  return {
    titulo: `${n}, tu lugar en la comunidad ya está listo`,
    subtitulo: "Gracias por sumar tu historia. Aquí, cada perfil cuenta.",
    parrafos: [
      `${n}, no llegaste por casualidad. Hiciste algo que muchas personas postergan: abrirte a conocer gente nueva con honestidad. Eso habla de valentía y de ganas de crecer.`,
      "Tu perfil ya forma parte de una comunidad que se construye persona a persona. Desde hoy tu presencia le da más valor a todas las demás, y la de ellas a la tuya.",
      "Lo que viene depende de ti, y eso es una buena noticia: da el primer paso, sé auténtico y deja que la afinidad haga el resto.",
    ],
    rango: fundador ? `Miembro fundador · #${miembros}` : "Miembro de la comunidad",
  };
}

// ── Saludo al volver (una vez por sesión) ───────────────────────────────────────────────────
export interface Saludo {
  titulo: string;
  texto: string;
}

const SALUDOS: ((n: string) => Saludo)[] = [
  (n) => ({ titulo: `Qué alegría verte, ${n}`, texto: "Personas como tú son las que hacen que esta comunidad valga la pena." }),
  (n) => ({ titulo: `${n}, hoy el destino juega a tu favor`, texto: "La buena suerte suele encontrar a quien sigue caminando. Tú sigues aquí: ya vas por delante." }),
  (n) => ({ titulo: `Te esperábamos, ${n}`, texto: "Haz hoy tu parte —conocer, escribir, agradecer— y deja el resto en manos de la vida." }),
  (n) => ({ titulo: `${n}, tu constancia se nota`, texto: "Quien vuelve cada día construye algo que dura. Gracias por ser parte de esto." }),
  (n) => ({ titulo: `Tu presencia importa, ${n}`, texto: "Cada conversación tuya puede ser el mejor momento del día de otra persona." }),
  (n) => ({ titulo: `${n}, el momento es hoy`, texto: "Los mejores encuentros llegan cuando estamos abiertos a ellos. Tú lo estás." }),
  (n) => ({ titulo: `Hola, ${n}: qué bueno que estés`, texto: "Todo encuentro es una oportunidad de aprender algo de ti y de la otra persona." }),
];

export function saludoRecurrente(nombre: string, fecha = new Date()): Saludo {
  return SALUDOS[diaDelAno(fecha) % SALUDOS.length](primerNombre(nombre));
}

// ── «Lo que hay hoy»: costo de oportunidad con datos reales ─────────────────────────────────
export interface DatosOportunidad {
  likesPendientes: number;
  personasNuevas7d: number;
  mensajesSinLeer: number;
  monedasPorCobrar: number;
  monedasEnJuego: number;
  racha: number;
  bonoDiarioHecho: boolean;
  horasParaReinicio: number;
}

export interface ItemOportunidad {
  id: string;
  emoji: string;
  texto: string;
  href: string;
  accion: string;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Devuelve lo que de verdad está pendiente, ordenado por importancia. Vacío si no hay nada (entonces no se muestra nada). */
export function itemsOportunidad(d: DatosOportunidad): ItemOportunidad[] {
  const items: ItemOportunidad[] = [];
  if (d.likesPendientes > 0)
    items.push({ id: "likes", emoji: "💌", texto: `${plural(d.likesPendientes, "persona mostró", "personas mostraron")} interés en ti y aún no respondes. Un gesto se agradece mejor cuando se responde a tiempo.`, href: "/citas", accion: "Ver quién es" });
  if (d.mensajesSinLeer > 0)
    items.push({ id: "mensajes", emoji: "💬", texto: `${plural(d.mensajesSinLeer, "mensaje espera", "mensajes esperan")} tu respuesta.`, href: "/mensajes", accion: "Responder" });
  if (d.racha >= 2 && !d.bonoDiarioHecho)
    items.push({ id: "racha", emoji: "🔥", texto: `Llevas ${d.racha} días de racha. Reclama tu bono hoy para no volver a empezar.`, href: "/recompensas", accion: "Reclamar bono" });
  if (d.personasNuevas7d > 0)
    items.push({ id: "nuevas", emoji: "✨", texto: `${plural(d.personasNuevas7d, "persona nueva se unió", "personas nuevas se unieron")} esta semana y aún no las has visto.`, href: "/explorar", accion: "Descubrirlas" });
  if (d.monedasPorCobrar > 0)
    items.push({ id: "cobrar", emoji: "💰", texto: `Tienes ${d.monedasPorCobrar} monedas listas para cobrar de tus retos.`, href: "/retos", accion: "Cobrar" });
  else if (d.monedasEnJuego > 0 && d.horasParaReinicio <= 6)
    items.push({ id: "reinicio", emoji: "⏳", texto: `Los retos se reinician en ${Math.max(1, Math.ceil(d.horasParaReinicio))} h: quedan ${d.monedasEnJuego} monedas por ganar hoy.`, href: "/retos", accion: "Ver retos" });
  return items;
}

// ── Prueba social honesta ───────────────────────────────────────────────────────────────────
export interface StatsComunidad {
  members: number;
  new_7d: number;
  matches_7d: number;
  invites_ok: number;
}

/** Frases con cifras reales; se omiten las que serían pequeñas para no restar credibilidad. */
export function frasesPruebaSocial(s: StatsComunidad | null): string[] {
  if (!s) return [];
  const f: string[] = [];
  if (s.members >= 10) f.push(`${s.members.toLocaleString("es")} personas ya forman parte de la comunidad`);
  if (s.new_7d >= 3) f.push(`${s.new_7d.toLocaleString("es")} se unieron esta semana`);
  if (s.matches_7d >= 1) f.push(`${s.matches_7d.toLocaleString("es")} ${s.matches_7d === 1 ? "conexión nació" : "conexiones nacieron"} en los últimos 7 días`);
  if (s.invites_ok >= 1) f.push(`${s.invites_ok.toLocaleString("es")} ${s.invites_ok === 1 ? "persona llegó" : "personas llegaron"} por invitación de otra`);
  if (f.length === 0) f.push("Estás entre las primeras personas en formar esta comunidad");
  return f;
}
