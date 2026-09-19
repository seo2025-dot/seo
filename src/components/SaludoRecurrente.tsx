"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSocial } from "@/context/SocialContext";
import { MARCA_BIENVENIDA } from "@/components/BienvenidaModal";
import { saludoRecurrente } from "@/lib/mensajes";

const clave = (uid: string) => `conectari:saludo:${uid}`;

/**
 * Saludo cálido con el nombre de la persona al iniciar sesión (una vez por sesión de navegador).
 * No aparece mientras se muestra la bienvenida de nuevos miembros ni antes de terminar el registro.
 */
export default function SaludoRecurrente() {
  const { estado, sesion, hidratado, privadoListo } = useSocial();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hidratado || !privadoListo || !sesion.uid || estado.yo.onboardingCompleto !== true) return;
    try {
      if (sessionStorage.getItem(clave(sesion.uid))) return;
      sessionStorage.setItem(clave(sesion.uid), "1");
      if (localStorage.getItem(MARCA_BIENVENIDA)) return; // recién registrada: ya recibe la bienvenida completa
    } catch {
      return;
    }
    setVisible(true);
  }, [hidratado, privadoListo, sesion.uid, estado.yo.onboardingCompleto]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 9000);
    return () => clearTimeout(t);
  }, [visible]);

  const s = saludoRecurrente(estado.yo.nombre);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-3 top-[4.5rem] z-[90] mx-auto max-w-md rounded-2xl border border-brand-200 bg-white/95 p-4 shadow-xl backdrop-blur"
        >
          <button type="button" onClick={() => setVisible(false)} aria-label="Cerrar saludo" className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            ✕
          </button>
          <p className="pr-6 font-black text-ink [font-family:var(--font-display)]">{s.titulo}</p>
          <p className="mt-1 text-sm text-slate-600">{s.texto}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
