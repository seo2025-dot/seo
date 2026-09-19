/** Secciones de la plataforma con su color de categoría (tomados de la paleta del logotipo de conectari.com). */
export interface Seccion {
  id: string;
  href: string;
  etiqueta: string;
  emoji: string;
  /** Degradado Tailwind (from-… to-…) */
  degradado: string;
  /** Texto oscuro cuando el degradado es claro (contraste) */
  oscuro?: boolean;
}

/** Las cinco secciones principales de la plataforma. */
export const PRINCIPALES: Seccion[] = [
  { id: "inmuebles", href: "/propiedades", etiqueta: "Inmuebles", emoji: "🏡", degradado: "from-brand-500 to-flame" },
  { id: "vehiculos", href: "/mercado?cat=vehiculos", etiqueta: "Vehículos", emoji: "🚗", degradado: "from-flame to-[#a80f00]" },
  { id: "negocios", href: "/mercado?cat=negocios", etiqueta: "Negocios", emoji: "🛍️", degradado: "from-sun to-mango", oscuro: true },
  { id: "empleos", href: "/empleos", etiqueta: "Empleos", emoji: "🛠️", degradado: "from-ink-soft to-ink" },
  { id: "comunidad", href: "/comunidad", etiqueta: "Comunidad", emoji: "👥", degradado: "from-aqua to-cyan-700" },
];

/** Resto de módulos (se muestran como accesos secundarios y en las «historias»). */
export const SECUNDARIAS: Seccion[] = [
  { id: "busco", href: "/publicar?modo=busco", etiqueta: "Busco", emoji: "🔎", degradado: "from-mango to-brand-600" },
  { id: "citas", href: "/citas", etiqueta: "Citas", emoji: "💘", degradado: "from-[#ff5a7a] to-flame" },
  { id: "astrologia", href: "/astrologia", etiqueta: "Tarot", emoji: "🔮", degradado: "from-[#7a3cff] to-[#ff4d9d]" },
  { id: "mensajes", href: "/mensajes", etiqueta: "Mensajes", emoji: "💬", degradado: "from-aqua to-sun" },
  { id: "recompensas", href: "/recompensas", etiqueta: "Ruleta", emoji: "🎡", degradado: "from-sun to-flame" },
];

export const POR_ID: Record<string, Seccion> = Object.fromEntries([...PRINCIPALES, ...SECUNDARIAS].map((s) => [s.id, s]));

export const LEMA = "Todo lo que necesitas en tu ciudad, en una sola app.";

/** Texto institucional (versión breve, para el bloque discreto de la portada). */
export const QUE_ES_BREVE =
  "conectari.com es la plataforma digital definitiva que reúne en un solo lugar todo lo que las personas necesitan para su día a día. Conectamos directamente a quienes ofrecen algo con quienes lo buscan en su propia ciudad, de forma rápida, segura y sin intermediarios molestos. A través de secciones especializadas en inmuebles, vehículos, negocios, empleos freelance y comunidad, facilitamos un trato directo, con perfiles y valoraciones verificadas para garantizar confianza y cercanía en cada interacción local.";
