"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import { formatearCuentaAtras, useCuentaAtras } from "@/components/FomoBadges";
import ReflexionDelDia from "@/components/ReflexionDelDia";
import { useOportunidad, useRetos } from "@/features/conexion/hooks";
import { itemsOportunidad } from "@/lib/mensajes";
import { META_CIRCULO } from "@/lib/referidos";
import { msHastaReinicio, resumenRetos } from "@/lib/retos";

/**
 * Panel de la portada para quien ya tiene sesión: lo que de verdad está pendiente hoy (datos reales), el avance de los retos
 * y una reflexión. Enfoque estoico: se centra en lo que depende de la persona y en el tiempo real que queda hoy.
 */
export default function PanelHoy() {
  const { estado, sesion, hidratado, noLeidosTotal } = useSocial();
  const oportunidad = useOportunidad();
  const { retos } = useRetos();
  const reinicio = useMemo(() => Date.now() + msHastaReinicio(), []);
  const restante = useCuentaAtras(reinicio);

  if (!hidratado || !sesion.uid || estado.yo.onboardingCompleto !== true) return null;

  const r = resumenRetos(retos);
  const items = itemsOportunidad({
    likesPendientes: oportunidad?.likes_pending ?? 0,
    personasNuevas7d: oportunidad?.new_people_7d ?? 0,
    mensajesSinLeer: noLeidosTotal,
    monedasPorCobrar: r.monedasPorCobrar,
    monedasEnJuego: r.monedasEnJuego,
    racha: estado.racha,
    bonoDiarioHecho: estado.ultimoCheckin === new Date().toISOString().slice(0, 10),
    horasParaReinicio: (restante ?? msHastaReinicio()) / 3_600_000,
  });

  return (
    <section aria-labelledby="hoy-titulo" className="mx-auto mt-8 grid max-w-6xl gap-4 px-4 lg:grid-cols-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="hoy-titulo" className="text-xl font-black text-ink">
              Hoy depende de ti
            </h2>
            <p className="text-sm text-slate-500">No controlas los resultados, sí lo que haces hoy. Empieza por lo pequeño.</p>
          </div>
          {restante !== null && retos.length > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tabular-nums text-slate-700" title="Los retos se reinician a medianoche UTC">
              Retos se reinician en {formatearCuentaAtras(restante)}
            </span>
          )}
        </div>

        <ul className="mt-4 space-y-2">
          {items.length === 0 && (
            <li className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">Estás al día. La constancia vale más que la intensidad: vuelve mañana y sigue sumando.</li>
          )}
          {items.slice(0, 4).map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <span className="text-2xl" aria-hidden>
                {i.emoji}
              </span>
              <p className="flex-1 text-sm text-slate-700">{i.texto}</p>
              <Link href={i.href} className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-ink-soft">
                {i.accion}
              </Link>
            </li>
          ))}
        </ul>

        {r.total > 0 && (
          <Link href="/retos" className="mt-4 block rounded-2xl border border-slate-200 p-3 transition hover:border-brand-300">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-ink">🎯 Retos de hoy</span>
              <span className="tabular-nums text-slate-500">
                {r.hechos}/{r.total} · quedan {r.monedasEnJuego} 🪙
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={r.hechos} aria-valuemin={0} aria-valuemax={r.total}>
              <div className="h-full rounded-full bg-gradient-to-r from-mango to-flame transition-all" style={{ width: `${(r.hechos / r.total) * 100}%` }} />
            </div>
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <ReflexionDelDia className="flex-1" />
        <Link href="/invitar" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm transition hover:border-brand-300">
          <span className="font-bold text-ink">🌱 Tu círculo de {META_CIRCULO}</span>
          <span className="mt-0.5 block text-slate-500">Invita a quienes quieres cerca: ganan ambas partes y tu estatus crece.</span>
        </Link>
      </div>
    </section>
  );
}
