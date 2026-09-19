import type { Propiedad } from "@/types/propiedad";
import type { Anuncio, Demanda, Negocio, Vehiculo } from "@/types/mercado";

export const propiedadAAnuncio = (p: Propiedad): Anuncio => ({
  id: p.id,
  tipo: "propiedad",
  subtipo: p.tipo,
  titulo: p.titulo,
  descripcion: p.descripcion,
  imagen: p.imagen,
  precio: p.precio,
  moneda: p.moneda,
  operacion: p.operacion,
  ubicacion: p.ubicacion,
  duenoId: p.duenoId,
  chips: [
    ...(p.dormitorios > 0 ? [`${p.dormitorios} dorm.`] : []),
    ...(p.banos > 0 ? [`${p.banos} baños`] : []),
    `${p.superficie} m²`,
  ],
  publicadaHace: p.publicadaHace,
  guardados: p.guardados,
  relampago: p.relampago,
  relampagoHasta: p.relampagoHasta,
  superficie: p.superficie,
  href: `/propiedades/${p.id}`,
});

export const vehiculoAAnuncio = (v: Vehiculo): Anuncio => ({
  id: v.id,
  tipo: "vehiculo",
  subtipo: v.categoria,
  titulo: v.titulo,
  descripcion: v.descripcion,
  imagen: v.imagen,
  precio: v.precio,
  moneda: v.moneda,
  operacion: v.operacion,
  ubicacion: v.ubicacion,
  duenoId: v.duenoId,
  chips: [String(v.anio), `${v.km.toLocaleString("es-ES")} km`, `${v.marca} ${v.modelo}`],
  publicadaHace: v.publicadaHace,
  guardados: v.guardados,
  relampago: v.relampago,
  relampagoHasta: v.relampagoHasta,
  href: `/mercado/${v.id}`,
});

export const negocioAAnuncio = (n: Negocio): Anuncio => ({
  id: n.id,
  tipo: "negocio",
  subtipo: n.rubro,
  titulo: n.titulo,
  descripcion: n.descripcion,
  imagen: n.imagen,
  precio: n.inversion,
  moneda: n.moneda,
  ubicacion: n.ubicacion,
  duenoId: n.duenoId,
  chips: [n.rubro, `Retorno ${n.retorno}`],
  publicadaHace: n.publicadaHace,
  guardados: n.guardados,
  href: `/mercado/${n.id}`,
});

export const ETIQUETA_TIPO_ANUNCIO = {
  propiedad: { label: "Inmueble", emoji: "🏡", prefijo: "p" },
  vehiculo: { label: "Vehículo", emoji: "🚗", prefijo: "v" },
  negocio: { label: "Negocio", emoji: "💼", prefijo: "n" },
} as const;

export const cidAnuncio = (a: Pick<Anuncio, "tipo" | "id">) =>
  `${ETIQUETA_TIPO_ANUNCIO[a.tipo].prefijo}-${a.id}`;

/** Precio con descuento de oferta relámpago (si la hay). */
export const precioFinal = (a: Pick<Anuncio, "precio" | "relampago">) =>
  a.relampago ? Math.round(a.precio * (1 - a.relampago / 100)) : a.precio;

// ───────────── Motor de match Oferta ↔ Demanda ─────────────

const enMinusculas = (s: string) => s.trim().toLowerCase();

/** ¿Este anuncio cubre lo que busca esta demanda? */
export function coincideDemanda(d: Demanda, a: Anuncio): boolean {
  if (d.categoria === "inmueble" ? a.tipo !== "propiedad" : a.tipo !== "vehiculo") return false;
  if (a.operacion !== (d.operacion === "comprar" ? "venta" : "alquiler")) return false;
  if (d.tipo && a.subtipo !== d.tipo) return false;
  if (d.zona && !enMinusculas(a.ubicacion).includes(enMinusculas(d.zona))) return false;
  if (a.moneda !== d.moneda || precioFinal(a) > d.presupuestoMax) return false;
  if (d.superficieMin && a.superficie !== undefined && a.superficie < d.superficieMin) return false;
  return true;
}

export const resumenDemanda = (d: Demanda) =>
  `${d.operacion === "comprar" ? "Compra" : "Alquiler"} de ${d.tipo || (d.categoria === "inmueble" ? "inmueble" : "vehículo")}${d.zona ? ` en ${d.zona}` : ""} hasta ${d.presupuestoMax.toLocaleString("es-ES")} ${d.moneda}`;
