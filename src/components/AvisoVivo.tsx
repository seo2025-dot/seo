"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useSocial } from "@/context/SocialContext";
import type { Notificacion } from "@/types/mercado";
import { TextoConMonedas } from "@/components/IconoMoneda";

/**
 * Aviso emergente en tiempo real: cuando llega una notificación nueva mientras estás en la página (una reacción, un comentario,
 * una solicitud de amistad, un match…) aparece unos segundos. Las que ya existían al cargar no se repiten.
 */
export default function AvisoVivo() {
  const { estado, sesion, privadoListo } = useSocial();
  const conocidas = useRef<Set<string> | null>(null);
  const [aviso, setAviso] = useState<Notificacion | null>(null);

  useEffect(() => {
    if (!privadoListo || !sesion.uid) return;
    if (conocidas.current === null) {
      conocidas.current = new Set(estado.notificaciones.map((n) => n.id)); // lo anterior no cuenta como novedad
      return;
    }
    const vistas = conocidas.current;
    const nueva = estado.notificaciones.find((n) => !vistas.has(n.id) && !n.leida);
    for (const n of estado.notificaciones) vistas.add(n.id);
    if (nueva) setAviso(nueva);
  }, [estado.notificaciones, privadoListo, sesion.uid]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 7000);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <AnimatePresence>
      {aviso && (
        <motion.div
          key={aviso.id}
          role="status"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed bottom-24 right-4 z-[150] flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl lg:bottom-6"
        >
          <span aria-hidden className="mt-0.5 text-xl">🔔</span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="line-clamp-3 font-medium text-ink">
              <TextoConMonedas texto={aviso.texto} />
            </p>
            {aviso.href && (
              <Link href={aviso.href} onClick={() => setAviso(null)} className="mt-1 inline-block text-xs font-bold text-brand-700 hover:underline">
                Ver ahora →
              </Link>
            )}
          </div>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
