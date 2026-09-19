import type { Signo, TipoRelacion } from "@/types/social";
import { hash } from "@/lib/social";

export type Elemento = "fuego" | "tierra" | "aire" | "agua";
type Modalidad = "cardinal" | "fijo" | "mutable";

export interface InfoSigno {
  id: Signo;
  nombre: string;
  simbolo: string;
  elemento: Elemento;
  modalidad: Modalidad;
  fechas: string;
}

// Solo con fines de entretenimiento: la astrología no tiene validez científica.
export const SIGNOS: InfoSigno[] = [
  { id: "aries", nombre: "Aries", simbolo: "♈", elemento: "fuego", modalidad: "cardinal", fechas: "21 mar – 19 abr" },
  { id: "tauro", nombre: "Tauro", simbolo: "♉", elemento: "tierra", modalidad: "fijo", fechas: "20 abr – 20 may" },
  { id: "geminis", nombre: "Géminis", simbolo: "♊", elemento: "aire", modalidad: "mutable", fechas: "21 may – 20 jun" },
  { id: "cancer", nombre: "Cáncer", simbolo: "♋", elemento: "agua", modalidad: "cardinal", fechas: "21 jun – 22 jul" },
  { id: "leo", nombre: "Leo", simbolo: "♌", elemento: "fuego", modalidad: "fijo", fechas: "23 jul – 22 ago" },
  { id: "virgo", nombre: "Virgo", simbolo: "♍", elemento: "tierra", modalidad: "mutable", fechas: "23 ago – 22 sep" },
  { id: "libra", nombre: "Libra", simbolo: "♎", elemento: "aire", modalidad: "cardinal", fechas: "23 sep – 22 oct" },
  { id: "escorpio", nombre: "Escorpio", simbolo: "♏", elemento: "agua", modalidad: "fijo", fechas: "23 oct – 21 nov" },
  { id: "sagitario", nombre: "Sagitario", simbolo: "♐", elemento: "fuego", modalidad: "mutable", fechas: "22 nov – 21 dic" },
  { id: "capricornio", nombre: "Capricornio", simbolo: "♑", elemento: "tierra", modalidad: "cardinal", fechas: "22 dic – 19 ene" },
  { id: "acuario", nombre: "Acuario", simbolo: "♒", elemento: "aire", modalidad: "fijo", fechas: "20 ene – 18 feb" },
  { id: "piscis", nombre: "Piscis", simbolo: "♓", elemento: "agua", modalidad: "mutable", fechas: "19 feb – 20 mar" },
];

export const infoSigno = (id: Signo) => SIGNOS.find((s) => s.id === id)!;

export const ETIQUETA_ELEMENTO: Record<Elemento, string> = {
  fuego: "Fuego 🔥",
  tierra: "Tierra 🌿",
  aire: "Aire 🌬️",
  agua: "Agua 💧",
};

// [mes, día de inicio, signo]
const CORTES: [number, number, Signo][] = [
  [1, 20, "acuario"],
  [2, 19, "piscis"],
  [3, 21, "aries"],
  [4, 20, "tauro"],
  [5, 21, "geminis"],
  [6, 21, "cancer"],
  [7, 23, "leo"],
  [8, 23, "virgo"],
  [9, 23, "libra"],
  [10, 23, "escorpio"],
  [11, 22, "sagitario"],
  [12, 22, "capricornio"],
];

/** Signo solar a partir de una fecha YYYY-MM-DD. */
export function signoDeFecha(iso: string): Signo | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return undefined;
  let signo: Signo = "capricornio";
  for (const [cm, cd, s] of CORTES) if (mes > cm || (mes === cm && dia >= cd)) signo = s;
  return signo;
}

/** Clave de día local (YYYY-MM-DD). */
export function claveDia(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ───────────── Sinastría ─────────────

const AFINIDAD: Record<Elemento, Record<Elemento, number>> = {
  fuego: { fuego: 84, aire: 90, tierra: 58, agua: 50 },
  aire: { fuego: 90, aire: 82, tierra: 56, agua: 62 },
  tierra: { fuego: 58, aire: 56, tierra: 86, agua: 91 },
  agua: { fuego: 50, aire: 62, tierra: 91, agua: 85 },
};

export interface Sinastria {
  puntaje: number;
  titulo: string;
  resumen: string; // "Fuego + Tierra"
  detalle: string;
}

const TITULOS: Record<TipoRelacion, [number, string][]> = {
  pareja: [[95, "Almas Gemelas"], [85, "Chispa Cósmica"], [70, "Buena Química"], [55, "Relación de Aprendizaje"], [0, "Opuestos Desafiantes"]],
  amistad: [[90, "Almas Cómplices"], [75, "Amigos Naturales"], [60, "Amistad Posible"], [0, "Amistad Desafiante"]],
  roomie: [[90, "Convivencia Armónica"], [75, "Roomies Compatibles"], [60, "Convivencia con Acuerdos"], [0, "Convivencia Retadora"]],
  socios: [[90, "Socios Ideales"], [75, "Equipo Sólido"], [60, "Socios con Estrategia"], [0, "Alianza Arriesgada"]],
};

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Compatibilidad astral (sinastría simplificada) según elementos, modalidades y contexto. */
export function sinastria(a: Signo, b: Signo, contexto: TipoRelacion = "pareja"): Sinastria {
  const A = infoSigno(a);
  const B = infoSigno(b);
  let base = AFINIDAD[A.elemento][B.elemento];

  const par = [A.elemento, B.elemento].sort().join("+");
  if (contexto === "socios") {
    // La energía (fuego) necesita estructura (tierra); agua + tierra también construyen.
    if (par === "fuego+tierra") base = 92;
    else if (par === "agua+tierra") base = 90;
    else if (par === "fuego+fuego") base = 80;
  } else if (contexto === "roomie") {
    if (par === "tierra+tierra") base += 4;
    if (par === "fuego+fuego") base -= 8;
  } else if (contexto === "amistad" && (A.elemento === "aire" || B.elemento === "aire")) {
    base += 4;
  }

  const idxA = SIGNOS.findIndex((s) => s.id === a);
  const idxB = SIGNOS.findIndex((s) => s.id === b);
  const distancia = Math.abs(idxA - idxB);
  if (contexto === "pareja" && distancia === 6) base += 7; // polaridad: atracción entre opuestos
  if (A.modalidad === B.modalidad && a !== b) base -= 3;

  // Variación estable por pareja de signos, para que no todas den lo mismo.
  const jitter = (hash([a, b].sort().join("-")) % 11) - 5;
  const puntaje = Math.max(35, Math.min(99, Math.round(base + jitter)));

  const titulo = TITULOS[contexto].find(([min]) => puntaje >= min)![1];
  const resumen = `${cap(A.elemento)} + ${cap(B.elemento)}`;
  const detalle =
    contexto === "socios"
      ? `${A.nombre} y ${B.nombre}: ${resumen.toLowerCase()} — ${puntaje >= 75 ? "buen equilibrio entre visión y ejecución" : "necesitan acuerdos claros sobre roles y riesgos"}.`
      : `${A.nombre} y ${B.nombre}: ${resumen.toLowerCase()} — ${puntaje >= 75 ? "energías que fluyen con naturalidad" : "energías distintas que piden paciencia y comunicación"}.`;

  return { puntaje, titulo, resumen, detalle };
}

// ───────────── Tránsito diario ─────────────

const PLANETAS = ["Venus", "Júpiter", "Mercurio", "Sol", "Luna", "Marte", "Saturno"];
const ASPECTOS_BUENOS = ["en trígono", "en sextil", "en conjunción luminosa"];

export interface Transito {
  favorable: boolean;
  titulo: string;
  texto: string;
}

/** Tránsito simulado del día para un signo (determinista por día + signo). Solo entretenimiento. */
export function transitoDelDia(signo: Signo, fecha = new Date()): Transito {
  const h = hash(`${claveDia(fecha)}-${signo}`);
  const planeta = PLANETAS[h % PLANETAS.length];
  const favorable = h % 100 < 55;
  return favorable
    ? {
        favorable,
        titulo: "Tránsito planetario favorable",
        texto: `${planeta} ${ASPECTOS_BUENOS[h % ASPECTOS_BUENOS.length]} con tu signo: buen día para cerrar tratos y conocer gente.`,
      }
    : {
        favorable,
        titulo: "Tránsito de cautela",
        texto: `${planeta} pide calma: revisa los detalles antes de firmar o comprometerte.`,
      };
}
