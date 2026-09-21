"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSocial } from "@/context/SocialContext";
import { formatearCuentaAtras, useCuentaAtras } from "@/components/FomoBadges";
import ReflexionDelDia from "@/components/ReflexionDelDia";
import { useRetos } from "@/features/conexion/hooks";
import { RetosComunidad } from "@/features/monedas/Piezas";
import { primerNombre } from "@/lib/mensajes";
import { msHastaReinicio, RETOS, resumenRetos } from "@/lib/retos";
import IconoMoneda from "@/components/IconoMoneda";

export default function RetosPage() {
  const { estado, sesion, hidratado, refrescarMonedero } = useSocial();
  const { retos, cargando, cobrar } = useRetos();
  const reinicio = useMemo(() => Date.now() + msHastaReinicio(), []);
  const restante = useCuentaAtras(reinicio);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState<string | null>(null);

  const r = resumenRetos(retos);
  const estadoDe = (id: string) => retos.find((x) => x.id === id);

  const alCobrar = async (id: string, titulo: string) => {
    setCobrando(id);
    const monedas = await cobrar(id);
    setCobrando(null);
    setAviso(monedas ? `🎉 ${titulo}: +${monedas} monedas` : "Aún no se cumple ese reto.");
    await refrescarMonedero();
  };

  if (!hidratado) return <div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-8" />;
  if (!sesion.uid) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-5xl">🎯</p>
        <h1 className="mt-4 text-2xl font-black">Retos diarios</h1>
        <p className="mt-2 text-slate-500">Inicia sesión para completar retos, ganar monedas y desbloquear beneficios.</p>
        <Link href="/login?next=/retos" className="boton-marca mt-6 inline-block rounded-full px-8 py-3 font-bold text-white">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="rounded-3xl bg-ink p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/70">{primerNombre(estado.yo.nombre)}, hoy sumas si te presentas</p>
            <h1 className="text-3xl font-black">Retos diarios</h1>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black tabular-nums text-sun"><IconoMoneda /> {estado.monedas}</p>
            <p className="text-xs text-white/60">🔥 Racha: {estado.racha} {estado.racha === 1 ? "día" : "días"}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>
              {r.hechos}/{r.total} completados · quedan {r.monedasEnJuego} monedas por ganar
            </span>
            {restante !== null && <span className="tabular-nums">Reinicio en {formatearCuentaAtras(restante)}</span>}
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={r.hechos} aria-valuemin={0} aria-valuemax={r.total || 1}>
            <motion.div className="h-full rounded-full bg-gradient-to-r from-sun to-flame" initial={false} animate={{ width: `${r.total ? (r.hechos / r.total) * 100 : 0}%` }} />
          </div>
        </div>
        <p className="mt-3 text-xs text-white/50">Las monedas son virtuales, sin valor monetario: sirven para canjear beneficios como boosts, super likes y tiradas premium.</p>
      </header>

      {aviso && (
        <p role="status" className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-900">
          {aviso}
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {RETOS.map((reto) => {
          const e = estadoDe(reto.id);
          const hecho = e?.claimed ?? false;
          const listo = (e?.done ?? false) && !hecho;
          return (
            <li key={reto.id} className={`flex items-center gap-4 rounded-2xl border p-4 transition ${hecho ? "border-emerald-200 bg-emerald-50/60" : listo ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"}`}>
              <span className="text-3xl" aria-hidden>
                {hecho ? "✅" : reto.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{reto.titulo}</p>
                <p className="text-sm text-slate-600">{reto.descripcion}</p>
              </div>
              {hecho ? (
                <span className="text-xs font-bold text-emerald-700">Cobrado</span>
              ) : listo ? (
                <button
                  type="button"
                  onClick={() => void alCobrar(reto.id, reto.titulo)}
                  disabled={cobrando === reto.id}
                  className="boton-marca shrink-0 rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  Cobrar +{e?.prize ?? reto.premio} <IconoMoneda />
                </button>
              ) : reto.href ? (
                <Link href={reto.href} className="shrink-0 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-ink hover:border-brand-400">
                  Ir · +{e?.prize ?? reto.premio} <IconoMoneda />
                </Link>
              ) : (
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">+{e?.prize ?? reto.premio} <IconoMoneda /></span>
              )}
            </li>
          );
        })}
        {cargando && retos.length === 0 && <li className="h-20 animate-pulse rounded-2xl bg-slate-100" />}
      </ul>

      <div className="mt-10">
        <RetosComunidad titulo="Retos de la semana" />
        <p className="mt-4 text-center text-sm text-slate-600">
          ¿Necesitas monedas ya?{" "}
          <Link href="/monedas" className="font-bold text-brand-700 hover:underline">
            Recarga desde $0.50
          </Link>
        </p>
      </div>

      <ReflexionDelDia
        className="mt-6"
        accion={
          estadoDe("reflexion")?.claimed ? (
            <p className="text-sm font-semibold text-emerald-700">✓ Reflexión de hoy leída</p>
          ) : (
            <button type="button" onClick={() => void alCobrar("reflexion", "Reflexión del día")} className="rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700">
              La leí · +{estadoDe("reflexion")?.prize ?? 5} <IconoMoneda />
            </button>
          )
        }
      />
    </div>
  );
}
