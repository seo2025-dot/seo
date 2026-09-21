import { DIAS } from "@/data/directorio";
import type { ContactoProveedor, ItemCatalogo, Proveedor } from "@/types/directorio";

export interface ItemCompletitudNegocio {
  id: "logo" | "descripcion" | "horario" | "contacto" | "catalogo" | "portada";
  etiqueta: string;
  ayuda: string;
  peso: number;
  avance: number;
  hecho: boolean;
}

export interface CompletitudNegocio {
  porcentaje: number;
  items: ItemCompletitudNegocio[];
  faltantes: ItemCompletitudNegocio[];
}

/** Mínimos para dar cada apartado por completo. */
export const MINIMOS_NEGOCIO = { descripcion: 60, catalogo: 5 } as const;

const acotar = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Qué tan completo está un negocio (100 puntos): contacto 20 · catálogo 25 (5 elementos = completo) · horario 15 ·
 * descripción 15 (60 caracteres) · logo 15 · foto de portada 10 (sin catálogo, los demás se reescalan). Un negocio completo inspira confianza y sube en las búsquedas.
 */
export function completitudNegocio(p: Proveedor, contacto: ContactoProveedor | null, items: Pick<ItemCatalogo, "id">[], conCatalogo = true): CompletitudNegocio {
  const conHorario = p.abierto24h || DIAS.some((d) => (p.horario[d] ?? []).length > 0);
  const apartados: Omit<ItemCompletitudNegocio, "hecho">[] = [
    { id: "contacto", etiqueta: "Contacto", ayuda: "Añade tu WhatsApp o teléfono", peso: 20, avance: contacto?.whatsapp || contacto?.telefono ? 1 : 0 },
    { id: "catalogo", etiqueta: "Catálogo", ayuda: `Sube al menos ${MINIMOS_NEGOCIO.catalogo} elementos (tienes ${items.length})`, peso: 25, avance: acotar(items.length / MINIMOS_NEGOCIO.catalogo) },
    { id: "horario", etiqueta: "Horario", ayuda: "Indica cuándo atiendes", peso: 15, avance: conHorario ? 1 : 0 },
    { id: "descripcion", etiqueta: "Descripción", ayuda: `Cuéntale a la gente qué te hace especial (${MINIMOS_NEGOCIO.descripcion}+ caracteres)`, peso: 15, avance: acotar(p.descripcion.trim().length / MINIMOS_NEGOCIO.descripcion) },
    { id: "logo", etiqueta: "Logo", ayuda: "Sube tu logo o una foto del local", peso: 15, avance: p.logoUrl ? 1 : 0 },
    { id: "portada", etiqueta: "Foto de portada", ayuda: "Una buena portada atrae más visitas", peso: 10, avance: p.portadaUrl ? 1 : 0 },
  ];
  // Sin catálogo (organizadores de eventos) ese apartado no cuenta y los demás se reescalan a 100.
  const lista = apartados.filter((a) => conCatalogo || a.id !== "catalogo").map((a) => ({ ...a, hecho: a.avance >= 1 }));
  const total = lista.reduce((t, i) => t + i.peso, 0);
  return {
    porcentaje: Math.round((lista.reduce((t, i) => t + i.peso * i.avance, 0) / total) * 100),
    items: lista,
    faltantes: lista.filter((i) => !i.hecho).sort((a, b) => b.peso * (1 - b.avance) - a.peso * (1 - a.avance)),
  };
}
