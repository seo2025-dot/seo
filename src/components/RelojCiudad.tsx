"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useReloj, useUbicacion } from "@/features/geo/ubicacion";
import { fechaLocal, horaTexto, nombreDia } from "@/lib/dia";
import { etiquetaUbicacion } from "@/lib/geo";

/** Hora del lugar donde está la persona, siempre visible en la barra superior (solo en pantallas medianas y grandes). */
export default function RelojCiudad() {
  const ms = useReloj();
  const { ubicacion } = useUbicacion();
  const f = useMemo(() => (ms === null ? null : fechaLocal(ms, ubicacion.zona)), [ms, ubicacion.zona]);
  if (!f) return <span className="hidden h-8 w-24 md:block" aria-hidden />;
  return (
    <Link href="/#hoy" title={`Hora en ${etiquetaUbicacion(ubicacion)}`} className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 md:flex">
      <span aria-hidden>🕐</span>
      <span className="tabular-nums">{horaTexto(f)}</span>
      <span className="hidden text-slate-400 lg:inline">{nombreDia(f).slice(0, 3)}</span>
    </Link>
  );
}
