"use client";

import { useComunidad } from "@/features/conexion/hooks";
import { frasesPruebaSocial } from "@/lib/mensajes";

/** Prueba social con cifras reales de la comunidad (no se muestra nada hasta tenerlas; las cifras pequeñas se omiten). */
export default function PruebaSocial({ className = "" }: { className?: string }) {
  const stats = useComunidad();
  const frases = frasesPruebaSocial(stats);
  if (frases.length === 0) return null;
  return (
    <ul className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm font-medium text-slate-600 ${className}`} aria-label="Actividad de la comunidad">
      {frases.map((f) => (
        <li key={f} className="flex items-center gap-2">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}
