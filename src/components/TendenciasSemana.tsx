"use client";

import { useMemo } from "react";
import { useSocial } from "@/context/SocialContext";
import { tendenciasSemana } from "@/lib/comunidad";

/** Zonas de las que más se habló en los últimos 7 días (recuento real de las publicaciones cargadas). */
export default function TendenciasSemana({ className = "" }: { className?: string }) {
  const { estado } = useSocial();
  const zonas = useMemo(() => tendenciasSemana(estado.posts), [estado.posts]);
  if (zonas.length === 0) return null;
  return (
    <section aria-labelledby="tendencias-titulo" className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 id="tendencias-titulo" className="text-lg font-black text-ink">📈 Tendencias de la semana</h2>
      <ol className="mt-2 space-y-1.5">
        {zonas.map(([zona, n], i) => (
          <li key={zona} className="flex items-center justify-between text-sm">
            <span>
              <span className="mr-2 text-slate-400">{i + 1}</span>📍 {zona}
            </span>
            <span className="text-xs text-slate-500">
              {n} {n === 1 ? "publicación" : "publicaciones"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
