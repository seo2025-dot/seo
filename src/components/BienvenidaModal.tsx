"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useSocial } from "@/context/SocialContext";
import { useComunidad } from "@/features/conexion/hooks";
import { bienvenidaNueva } from "@/lib/mensajes";
import { REFLEXIONES } from "@/lib/reflexiones";
import Avatar from "@/components/Avatar";

/** Clave de localStorage que deja el onboarding al terminar: la bienvenida se muestra una sola vez. */
export const MARCA_BIENVENIDA = "conectari:bienvenida";

const leerMarca = () => {
  try {
    return localStorage.getItem(MARCA_BIENVENIDA);
  } catch {
    return null;
  }
};

/**
 * Bienvenida al terminar el registro: reconoce a la persona por su nombre, le da su lugar en la comunidad
 * y le propone tres primeros pasos concretos. Usa solo el número real de miembros para el rango.
 */
export default function BienvenidaModal() {
  const { estado, sesion, hidratado, privadoListo } = useSocial();
  const stats = useComunidad();
  const [abierta, setAbierta] = useState(false);
  const boton = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!hidratado || !privadoListo || !sesion.uid || estado.yo.onboardingCompleto !== true) return;
    if (leerMarca()) setAbierta(true);
  }, [hidratado, privadoListo, sesion.uid, estado.yo.onboardingCompleto]);

  const cerrar = () => {
    try {
      localStorage.removeItem(MARCA_BIENVENIDA);
    } catch {}
    setAbierta(false);
  };

  useEffect(() => {
    if (!abierta) return;
    boton.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [abierta]);

  const b = bienvenidaNueva(estado.yo.nombre, stats?.members ?? 0);
  const lema = REFLEXIONES[0];

  return (
    <AnimatePresence>
      {abierta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-end justify-center bg-ink/60 p-3 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && cerrar()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bienvenida-titulo"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <div className="hero-suave px-6 pb-5 pt-8 text-center">
              <div className="mx-auto w-fit rounded-full p-1 ring-4 ring-brand-200">
                <Avatar nombre={estado.yo.nombre} foto={estado.yo.foto} tamano="xl" />
              </div>
              <p className="mx-auto mt-4 w-fit rounded-full bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sun">{b.rango}</p>
              <h2 id="bienvenida-titulo" className="mt-3 text-2xl font-black leading-tight text-ink sm:text-3xl">
                {b.titulo}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{b.subtitulo}</p>
            </div>

            <div className="space-y-3 px-6 pt-4 text-[15px] leading-relaxed text-slate-700">
              {b.parrafos.map((p) => (
                <p key={p}>{p}</p>
              ))}
              <blockquote className="rounded-2xl border-l-4 border-brand-400 bg-brand-50 px-4 py-3 text-sm italic text-brand-900">
                “{lema.texto}”
                <footer className="mt-1 text-xs not-italic text-brand-800/70">{lema.fuente}</footer>
              </blockquote>
            </div>

            <div className="grid gap-2 px-6 py-5">
              <Link ref={boton} href="/explorar" onClick={cerrar} className="boton-marca rounded-2xl px-5 py-3 text-center font-bold text-white">
                Descubrir mis afinidades
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/retos" onClick={cerrar} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-ink hover:border-brand-300">
                  🎯 Mis retos de hoy
                </Link>
                <Link href="/invitar" onClick={cerrar} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-ink hover:border-brand-300">
                  🌱 Invitar a mi círculo
                </Link>
              </div>
              <button type="button" onClick={cerrar} className="mt-1 text-xs font-medium text-slate-500 hover:text-slate-700">
                Ahora no
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
