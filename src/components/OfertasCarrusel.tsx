"use client";

import Link from "next/link";
import type { Anuncio } from "@/types/mercado";
import AnuncioCard from "@/components/AnuncioCard";
import { formatearCuentaAtras, useCuentaAtras } from "@/components/FomoBadges";

/** Ofertas de la comunidad (las relámpago primero) como carrusel horizontal dentro del muro. */
export default function OfertasCarrusel({ anuncios }: { anuncios: Anuncio[] }) {
  const restante = useCuentaAtras();
  const hayRelampago = anuncios.some((a) => a.relampago);
  if (anuncios.length === 0) return null;
  return (
    <section aria-labelledby="ofertas-titulo" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ofertas-titulo" className="flex flex-wrap items-center gap-2 text-lg font-black text-ink">
          {hayRelampago ? <span className="text-flame">⚡ Ofertas Relámpago</span> : "Destacados de la comunidad"}
          {hayRelampago && restante !== null && (
            <span className="animate-pulse rounded-full bg-flame px-2.5 py-0.5 text-xs font-bold tabular-nums text-white">Termina en {formatearCuentaAtras(restante)}</span>
          )}
        </h2>
        <Link href="/match" className="text-sm font-bold text-brand-700 hover:underline">
          Hacer match →
        </Link>
      </div>
      <ul className="-mx-1 mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
        {anuncios.map((a) => (
          <li key={a.id} className="w-72 shrink-0 snap-start">
            <AnuncioCard anuncio={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}
