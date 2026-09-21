"use client";

import Link from "next/link";
import type { VerticalId } from "@/data/directorio";
import { useUbicacion } from "@/features/geo/ubicacion";
import { hrefLista, type FiltrosLista } from "@/lib/directorio/filtros";
import { etiquetaUbicacion } from "@/lib/geo";

/**
 * «📍 Cerca de mí»: ordena el listado por distancia y deja solo los negocios de tu país. Usa la ubicación aproximada (~1 km) que la persona ya
 * eligió o que se dedujo de su zona horaria; solo entra en la dirección cuando ella pulsa el botón. Volver a pulsarlo lo quita.
 */
export default function BotonCerca({ vertical, filtros }: { vertical: VerticalId; filtros: FiltrosLista }) {
  const { ubicacion } = useUbicacion();
  const activo = filtros.lat !== undefined;
  const href = activo ? hrefLista(vertical, filtros, { lat: undefined, lng: undefined, pais: undefined }) : hrefLista(vertical, filtros, { lat: ubicacion.lat, lng: ubicacion.lng, pais: ubicacion.pais });
  return (
    <Link
      href={href}
      scroll={false}
      aria-pressed={activo}
      title={activo ? "Quitar el orden por cercanía" : `Ordenar por cercanía desde ${etiquetaUbicacion(ubicacion)} (ubicación aproximada)`}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${activo ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"}`}
    >
      📍 Cerca de mí{activo && <span aria-hidden> ✕</span>}
    </Link>
  );
}
