"use client";

import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import { useMiEstatusConector, useTopConectores } from "@/features/comunidad/hooks";
import { medallaDe, progresoHaciaTop, PUNTOS_ACTIVIDAD, TOP_N } from "@/lib/comunidad";
import Avatar from "@/components/Avatar";
import TopConectorBadge from "@/components/TopConectorBadge";

/**
 * Perfiles destacados: el ranking real de actividad de los últimos 30 días (publicar, recibir reacciones y comentarios,
 * comentar, invitar, matches). Las reglas son públicas y con tope por categoría, para que cualquiera pueda llegar aquí.
 */
export default function ConectoresDestacados({ className = "" }: { className?: string }) {
  const { sesion } = useSocial();
  const { lista, cargando } = useTopConectores();
  const yo = useMiEstatusConector();
  const progreso = yo ? progresoHaciaTop(yo) : null;

  return (
    <section aria-labelledby="top-titulo" className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 id="top-titulo" className="flex items-center gap-2 text-lg font-black text-ink">
        <span aria-hidden>🏆</span> Top Conectores del mes
      </h2>
      <p className="text-xs text-slate-500">Las personas más activas de la comunidad en los últimos 30 días.</p>

      {cargando ? (
        <div className="mt-3 space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Todavía nadie llega a los {TOP_N} puntos necesarios este mes. <strong>Puedes ser la primera persona en aparecer aquí.</strong>
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {lista.slice(0, 5).map((c) => (
            <li key={c.id}>
              <Link href={`/usuarios/${c.id}`} className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-slate-50">
                <span className="w-6 text-center text-base font-black text-slate-400" aria-label={`Puesto ${c.puesto}`}>
                  {medallaDe(c.puesto) ?? c.puesto}
                </span>
                <Avatar nombre={c.nombre} foto={c.foto} tamano="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{c.nombre}</span>
                  <span className="block truncate text-[11px] text-slate-500">{c.ciudad ? `📍 ${c.ciudad}` : "Comunidad conectari"}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-black tabular-nums text-brand-700">{c.puntos}</span>
                  <span className="block text-[10px] text-slate-400">puntos</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {sesion.uid && yo && progreso && (
        <div className="mt-3 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-100">
          {yo.is_top ? (
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-brand-900">
              <TopConectorBadge puesto={yo.rank ?? TOP_N} /> ¡Estás en el Top {TOP_N} con {yo.score} puntos!
            </p>
          ) : (
            <>
              <p className="text-sm font-bold text-brand-900">
                Tú: {yo.score} {yo.score === 1 ? "punto" : "puntos"}
                {yo.rank !== null && <span className="font-medium text-brand-800"> · puesto {yo.rank}</span>}
              </p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label="Avance hacia el Top 10" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso.porcentaje}>
                <div className="h-full rounded-full bg-marca transition-all duration-700" style={{ width: `${progreso.porcentaje}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-brand-900">
                Te {progreso.falta === 1 ? "falta 1 punto" : `faltan ${progreso.falta} puntos`} para ser <strong>Top Conector</strong>: publica, comenta o invita a alguien.
              </p>
            </>
          )}
        </div>
      )}

      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-bold text-brand-700">¿Cómo sumo puntos?</summary>
        <ul className="mt-2 space-y-1">
          {PUNTOS_ACTIVIDAD.map((p) => (
            <li key={p.id} className="flex justify-between gap-3">
              <span>{p.accion}</span>
              <span className="shrink-0 font-bold tabular-nums text-ink">+{p.puntos}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">Cada categoría tiene un tope mensual y tus propias publicaciones no cuentan para ti. Los perfiles de demostración no participan.</p>
      </details>
    </section>
  );
}
