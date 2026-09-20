"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSocial } from "@/context/SocialContext";
import { useComunidad } from "@/features/conexion/hooks";
import { useMiembrosRecientes } from "@/features/comunidad/hooks";
import { textoUnion, ventanaRotativa } from "@/lib/comunidad";
import Avatar from "@/components/Avatar";

const CADA_MS = 4000;
const EN_TIRA = 7;

/**
 * Muro de miembros recientes: las últimas personas REALES que se unieron (nunca perfiles demo), con una rotación suave cada
 * pocos segundos. Solo se muestra nombre de pila, ciudad y foto. Se pausa al pasar el ratón o enfocar, y no se mueve si la
 * persona prefiere menos animación.
 */
export default function MiembrosRecientes() {
  const { sesion } = useSocial();
  const { miembros, cargando } = useMiembrosRecientes(14);
  const stats = useComunidad();
  const reducirMovimiento = useReducedMotion();
  const [inicio, setInicio] = useState(0);
  const [pausado, setPausado] = useState(false);

  const n = miembros.length;
  useEffect(() => {
    if (n < 2 || pausado || reducirMovimiento) return;
    const t = setInterval(() => {
      if (!document.hidden) setInicio((i) => (i + 1) % n);
    }, CADA_MS);
    return () => clearInterval(t);
  }, [n, pausado, reducirMovimiento]);

  if (!cargando && n === 0) {
    if (sesion.uid) return null;
    return (
      <section aria-labelledby="miembros-titulo" className="mx-auto mt-8 max-w-6xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-dashed border-brand-300 bg-brand-50/50 p-5">
          <div>
            <h2 id="miembros-titulo" className="text-lg font-black text-ink">Sé de las primeras personas en unirte</h2>
            <p className="text-sm text-slate-600">La comunidad está empezando: tu perfil aparecerá aquí para quien llegue después.</p>
          </div>
          <Link href="/registro" className="boton-marca rounded-full px-6 py-2.5 text-sm font-bold text-white">
            Crear mi cuenta
          </Link>
        </div>
      </section>
    );
  }

  const foco = n > 0 ? miembros[inicio % n] : null;
  const tira = ventanaRotativa(miembros, inicio, EN_TIRA);

  return (
    <section aria-labelledby="miembros-titulo" className="mx-auto mt-8 max-w-6xl px-4">
      <div
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onFocus={() => setPausado(true)}
        onBlur={() => setPausado(false)}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="miembros-titulo" className="flex items-center gap-2 text-lg font-black text-ink">
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Miembros recientes
          </h2>
          {stats && stats.new_7d > 0 && (
            <p className="text-xs font-semibold text-slate-500">
              {stats.new_7d} {stats.new_7d === 1 ? "persona se unió" : "personas se unieron"} esta semana
            </p>
          )}
        </div>

        {cargando ? (
          <div className="mt-4 flex gap-3" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-16 w-16 animate-pulse rounded-full bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[minmax(0,17rem)_1fr]">
            {foco && (
              <div className="min-h-[5.5rem] rounded-2xl bg-gradient-to-br from-brand-50 to-white p-3 ring-1 ring-brand-100">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={foco.id}
                    initial={reducirMovimiento ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducirMovimiento ? undefined : { opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3"
                  >
                    <Link href={`/usuarios/${foco.id}`} aria-label={`Ver el perfil de ${foco.nombre}`}>
                      <Avatar nombre={foco.nombre} foto={foco.foto} tamano="lg" className="ring-2 ring-white" />
                    </Link>
                    <div className="min-w-0">
                      <p className="truncate font-black text-ink">
                        {foco.nombre}
                        {foco.ciudad && <span className="font-semibold text-slate-500"> · {foco.ciudad}</span>}
                      </p>
                      <p className="text-xs text-emerald-700">{textoUnion(foco.unidoEn)}</p>
                      <Link href={`/usuarios/${foco.id}`} className="text-xs font-bold text-brand-700 hover:underline">
                        Darle la bienvenida →
                      </Link>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            <ul className="flex min-w-0 items-center gap-2 overflow-hidden" aria-label="Personas que se unieron hace poco">
              <AnimatePresence mode="popLayout" initial={false}>
                {tira.map((m) => (
                  <motion.li
                    key={m.id}
                    layout={!reducirMovimiento}
                    initial={reducirMovimiento ? false : { opacity: 0, x: 24, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={reducirMovimiento ? undefined : { opacity: 0, x: -24, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    className="shrink-0"
                  >
                    <Link href={`/usuarios/${m.id}`} title={`${m.nombre}${m.ciudad ? ` · ${m.ciudad}` : ""} — ${textoUnion(m.unidoEn)}`} className="block text-center">
                      <Avatar nombre={m.nombre} foto={m.foto} tamano="md" className={m.id === foco?.id ? "ring-2 ring-brand-500 ring-offset-2" : ""} />
                      <span className="mt-1 block max-w-[3.5rem] truncate text-[10px] font-semibold text-slate-500">{m.nombre}</span>
                    </Link>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
