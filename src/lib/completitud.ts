import type { Usuario } from "@/types/social";

/** Lo que hace falta saber de un perfil para medir cuánto está completo (sin depender de la interfaz). */
export interface DatosCompletitud {
  bio: string;
  fotos: number;
  ubicacion: string;
  zonas: string[];
  intereses: string[];
  estilo: string[];
  parejaIdeal: string;
  relaciones: string[];
  parejaIdealValores: string[];
  parejaIdealEstilo: string[];
}

export type IdItemCompletitud = "fotos" | "bio" | "zona" | "intereses" | "parejaTexto" | "parejaBusca";

export interface ItemCompletitud {
  id: IdItemCompletitud;
  etiqueta: string;
  /** Qué hacer para completarlo. */
  ayuda: string;
  /** Puntos que aporta al 100 %. */
  peso: number;
  /** Avance de este apartado, de 0 a 1. */
  avance: number;
  hecho: boolean;
}

export interface Completitud {
  /** Entero de 0 a 100. */
  porcentaje: number;
  items: ItemCompletitud[];
  /** Lo que falta, del apartado que más suma al que menos. */
  faltantes: ItemCompletitud[];
}

/** Mínimos que dan un apartado por completo. Deben coincidir con la validación del servidor cuando existe (pareja ideal: 20). */
export const MINIMOS = { fotos: 3, bio: 60, intereses: 3, parejaTexto: 20 } as const;

const acotar = (n: number) => Math.max(0, Math.min(1, n));
const largo = (s: string | undefined) => (s ?? "").trim().length;

/**
 * Porcentaje de perfil completado. Reparto (100 puntos):
 *   fotos 20 (3 fotos = completo) · biografía 15 (60 caracteres) · zona 15 (ciudad + zonas de interés) ·
 *   intereses y estilo de vida 15 (3 = completo) · descripción de la pareja ideal 15 (20 caracteres, como exige el servidor) ·
 *   qué buscas exactamente 20 (tipo de relación, valores y estilo de vida: un tercio cada uno).
 */
export function completitudPerfil(d: DatosCompletitud): Completitud {
  const apartados: Omit<ItemCompletitud, "hecho">[] = [
    { id: "fotos", etiqueta: "Fotos", ayuda: `Sube ${MINIMOS.fotos} fotos (tienes ${d.fotos})`, peso: 20, avance: acotar(d.fotos / MINIMOS.fotos) },
    { id: "bio", etiqueta: "Biografía", ayuda: "Cuenta quién eres en al menos 60 caracteres", peso: 15, avance: acotar(largo(d.bio) / MINIMOS.bio) },
    {
      id: "zona",
      etiqueta: "Zona",
      ayuda: "Indica tu ciudad o barrio y las zonas que te interesan",
      peso: 15,
      avance: (largo(d.ubicacion) > 0 ? 0.5 : 0) + (d.zonas.length > 0 ? 0.5 : 0),
    },
    {
      id: "intereses",
      etiqueta: "Intereses y estilo de vida",
      ayuda: "Elige al menos 3 entre intereses y estilo de vida",
      peso: 15,
      avance: acotar((d.intereses.length + d.estilo.length) / MINIMOS.intereses),
    },
    {
      id: "parejaTexto",
      etiqueta: "Descripción de tu pareja ideal",
      ayuda: `Descríbela con al menos ${MINIMOS.parejaTexto} caracteres`,
      peso: 15,
      avance: acotar(largo(d.parejaIdeal) / MINIMOS.parejaTexto),
    },
    {
      id: "parejaBusca",
      etiqueta: "Qué buscas exactamente",
      ayuda: "Marca tipo de relación, valores y estilo de vida que buscas",
      peso: 20,
      avance: ((d.relaciones.length > 0 ? 1 : 0) + (d.parejaIdealValores.length > 0 ? 1 : 0) + (d.parejaIdealEstilo.length > 0 ? 1 : 0)) / 3,
    },
  ];
  const items = apartados.map((a) => ({ ...a, hecho: a.avance >= 1 }));
  const porcentaje = Math.round(items.reduce((t, i) => t + i.peso * i.avance, 0));
  const faltantes = items.filter((i) => !i.hecho).sort((a, b) => b.peso * (1 - b.avance) - a.peso * (1 - a.avance));
  return { porcentaje, items, faltantes };
}

/** Datos de completitud de un usuario ya cargado (el perfil propio, que es el único que trae los campos privados). */
export function datosCompletitud(u: Usuario, fotos: number): DatosCompletitud {
  return {
    bio: u.bio,
    fotos,
    ubicacion: u.ubicacion,
    zonas: u.zonas,
    intereses: u.intereses,
    estilo: u.estilo ?? [],
    parejaIdeal: u.parejaIdeal ?? "",
    relaciones: u.relaciones ?? [],
    parejaIdealValores: u.parejaIdealValores ?? [],
    parejaIdealEstilo: u.parejaIdealEstilo ?? [],
  };
}
