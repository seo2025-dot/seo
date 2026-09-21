"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import SelectorUbicacion from "@/features/geo/SelectorUbicacion";
import { useReloj, useUbicacion, useVisitaDelDia } from "@/features/geo/ubicacion";
import { claveDiaLocal, fraseDeEntrada, pulsoDelDia } from "@/lib/dia";
import { primerNombre } from "@/lib/mensajes";

const TEXTO_EFEMERIDE = { feriado: "Feriado", local: "Hoy en tu ciudad", mundial: "Hoy se conmemora", popular: "Hoy" } as const;

/**
 * «Pulso del día»: la hora del lugar donde estás, un saludo y una frase que cambian cada día y en cada visita, la luna, el amanecer y
 * el ocaso, el signo solar, la efeméride de hoy o la próxima y una sugerencia para el día de la semana. Da vida a la portada.
 * Todo se calcula en el dispositivo con la zona horaria de la persona, sin llamadas a servicios externos.
 */
export default function PulsoDelDia() {
  const ms = useReloj();
  const { ubicacion } = useUbicacion();
  const { estado, sesion } = useSocial();
  const pulso = useMemo(() => (ms === null ? null : pulsoDelDia(ms, ubicacion)), [ms, ubicacion]);
  const visita = useVisitaDelDia(pulso ? claveDiaLocal(pulso.fecha) : "");

  if (!pulso) return <div className="mb-5 h-32 animate-pulse rounded-2xl bg-white/60 sm:h-24" aria-hidden />;

  const nombre = sesion.uid ? primerNombre(estado.yo.nombre) : "amiga o amigo";
  const frase = fraseDeEntrada(nombre, pulso.fecha, visita, sesion.uid ? estado.yo.genero : null);
  const hoy = pulso.hoy[0];

  return (
    <section aria-label="El día de hoy" className="mb-5 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
            <SelectorUbicacion />
            <span className="capitalize">{pulso.fechaLarga}</span>
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-black tabular-nums leading-none text-ink" aria-label={`Son las ${pulso.hora}`}>
              {pulso.hora}
            </span>
            <span className="text-sm font-bold text-slate-600">
              <span aria-hidden>{pulso.saludo.emoji}</span> {pulso.saludo.texto}
            </span>
          </p>
          <p className="mt-1.5 max-w-xl text-[15px] font-medium text-slate-800">{frase}</p>
        </div>

        <ul className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700" aria-label="Datos del día">
          <li className="rounded-full bg-slate-100 px-3 py-1.5" title={`${pulso.luna.iluminacion} % iluminada (aproximado)`}>
            <span aria-hidden>{pulso.luna.emoji}</span> {pulso.luna.nombre}
          </li>
          {pulso.sol.amanece && pulso.sol.anochece && (
            <li className="rounded-full bg-amber-50 px-3 py-1.5" title={`${pulso.sol.horasDeLuz} horas de luz`}>
              <span aria-hidden>🌅</span> {pulso.sol.amanece} · <span aria-hidden>🌇</span> {pulso.sol.anochece}
            </li>
          )}
          {pulso.signo && (
            <li className="rounded-full bg-violet-50 px-3 py-1.5">
              <span aria-hidden>{pulso.signo.simbolo}</span> Sol en {pulso.signo.nombre}
            </li>
          )}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
        <p className="min-w-0 text-slate-600">
          {hoy ? (
            <>
              <strong className="text-ink">{TEXTO_EFEMERIDE[hoy.tipo]}:</strong> {hoy.titulo}
              {hoy.detalle && <span className="text-slate-500"> — {hoy.detalle}</span>}
            </>
          ) : pulso.proxima ? (
            <>
              <strong className="text-ink">{pulso.proxima.dias === 1 ? "Mañana" : `En ${pulso.proxima.dias} días`}:</strong> {pulso.proxima.efemeride.titulo}
            </>
          ) : (
            pulso.tema.texto
          )}
        </p>
        <Link href={pulso.tema.accion.href} className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-white transition hover:bg-ink-soft">
          {pulso.tema.accion.texto} →
        </Link>
      </div>
      {(hoy || pulso.proxima) && <p className="mt-2 text-xs text-slate-500">{pulso.tema.texto}</p>}
    </section>
  );
}
