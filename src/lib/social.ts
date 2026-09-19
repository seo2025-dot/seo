import type { BadgeId, Interes, TipoPost, TipoRelacion, Usuario } from "@/types/social";

export const idConvPropiedad = (propiedadId: string) => `p-${propiedadId}`;
export const idConvDirecta = (usuarioId: string) => `d-${usuarioId}`;

export function hash(texto: string) {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return h;
}

export const ETIQUETA_INTERES: Record<Interes, string> = {
  roomie: "Roomie",
  inversor: "Inversor",
  comprador: "Comprador",
  amigos: "Amigos",
  anfitrion: "Anfitrión",
  inquilino: "Inquilino",
};

export const ETIQUETA_RELACION: Record<TipoRelacion, string> = {
  pareja: "Pareja 💞",
  amistad: "Amistad 🤝",
  roomie: "Roomie 🛋️",
  socios: "Socios 💼",
};

export const INTERESES_EDITABLES: Interes[] = [
  "roomie",
  "inversor",
  "comprador",
  "amigos",
  "anfitrion",
  "inquilino",
];

export const BADGES: Record<BadgeId, { label: string; emoji: string; descripcion: string }> = {
  superhost: { label: "Superhost", emoji: "🏆", descripcion: "Anfitrión con excelente reputación" },
  "respuesta-rapida": { label: "Respuesta rápida", emoji: "⚡", descripcion: "Suele responder en menos de 1 hora" },
  "inversor-pro": { label: "Inversor", emoji: "📈", descripcion: "Participa activamente en inversiones" },
  "roomie-ideal": { label: "Roomie ideal", emoji: "🛋️", descripcion: "Muy bien valorado como compañero" },
  fundador: { label: "Miembro fundador", emoji: "🌱", descripcion: "Se unió en los primeros años" },
  "vecino-activo": { label: "Vecino activo", emoji: "🏘️", descripcion: "Colabora en la comunidad" },
  explorador: { label: "Explorador", emoji: "🧭", descripcion: "Nuevo en la comunidad" },
  "freelancer-top": { label: "Freelancer Top", emoji: "💎", descripcion: "Profesional con excelentes valoraciones" },
  "guia-astral": { label: "Guía astral", emoji: "🔮", descripcion: "Ofrece lecturas de tarot y astrología" },
};

export const ETIQUETA_POST: Record<TipoPost, { label: string; emoji: string; clases: string }> = {
  historia: { label: "Historia", emoji: "📖", clases: "bg-violet-100 text-violet-700" },
  consulta: { label: "Consulta de zona", emoji: "❓", clases: "bg-amber-100 text-amber-700" },
  propiedad: { label: "Propiedad", emoji: "🏡", clases: "bg-emerald-100 text-emerald-700" },
  experiencia: { label: "Experiencia", emoji: "✨", clases: "bg-sky-100 text-sky-700" },
};

const norm = (s: string) => s.trim().toLowerCase();

export interface Compatibilidad {
  puntaje: number; // 0–98
  zonasComunes: string[];
  interesesComunes: Interes[];
}

/** Afinidad entre dos personas según zonas e intereses en común. */
export function compatibilidad(a: Usuario, b: Usuario): Compatibilidad {
  const zonasB = new Set(b.zonas.map(norm));
  const zonasComunes = a.zonas.filter((z) => zonasB.has(norm(z)));
  const interesesComunes = a.intereses.filter((i) => b.intereses.includes(i));
  const puntaje = Math.min(
    98,
    8 + Math.min(50, zonasComunes.length * 25) + Math.min(40, interesesComunes.length * 20),
  );
  return { puntaje, zonasComunes, interesesComunes };
}

export function tiempoRelativo(ts: number, ahora = Date.now()) {
  const min = Math.floor((ahora - ts) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function primerNombre(nombre: string) {
  return nombre.split(" ")[0];
}
