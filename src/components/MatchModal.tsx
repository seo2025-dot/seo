"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { Usuario } from "@/types/social";
import Avatar from "@/components/Avatar";

const COLORES = ["#2563eb", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

function Confeti() {
  const piezas = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duracion: 1.6 + Math.random() * 1.2,
        giro: (Math.random() - 0.5) * 720,
        color: COLORES[i % COLORES.length],
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {piezas.map((p) => (
        <motion.span
          key={p.id}
          className="absolute -top-3 h-3 w-2 rounded-sm"
          style={{ left: `${p.left}%`, backgroundColor: p.color }}
          initial={{ y: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 520, opacity: 0, rotate: p.giro }}
          transition={{ duration: p.duracion, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

export default function MatchModal({
  titulo = "¡Es un Match!",
  descripcion,
  otro,
  imagen,
  yo,
  opciones,
  etiquetaEnviar = "Enviar y abrir chat",
  onCerrar,
  onEnviar,
}: {
  titulo?: string;
  descripcion: React.ReactNode;
  otro: Usuario;
  /** Foto de la propiedad; si no hay, se muestra el avatar del usuario actual. */
  imagen?: string;
  yo?: Usuario;
  opciones: string[];
  etiquetaEnviar?: string;
  onCerrar: () => void;
  onEnviar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(opciones[0] ?? "");
  const botonEnviar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    botonEnviar.current?.focus();
    const alPulsar = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCerrar}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-match"
        className="relative max-h-[95dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-center shadow-2xl"
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Confeti />

        <div className="relative mx-auto mb-4 flex items-center justify-center">
          {imagen ? (
            <div className="relative h-24 w-24 overflow-hidden rounded-full shadow-lg ring-4 ring-white">
              <Image src={imagen} alt="" fill sizes="96px" className="object-cover" />
            </div>
          ) : (
            yo && <Avatar nombre={yo.nombre} foto={yo.foto} tamano="lg" className="ring-4 ring-white" />
          )}
          <Avatar nombre={otro.nombre} foto={otro.foto} tamano="lg" className="-ml-5 shadow-lg ring-4 ring-white" />
        </div>

        <h2
          id="titulo-match"
          className="bg-gradient-to-r from-brand-600 to-emerald-500 bg-clip-text text-4xl font-extrabold text-transparent"
        >
          {titulo}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{descripcion}</p>

        <div className="mt-4 flex flex-col gap-2 text-left" role="group" aria-label="Rompehielos sugeridos">
          {opciones.map((op) => (
            <button
              key={op}
              type="button"
              aria-pressed={texto === op}
              onClick={() => setTexto(op)}
              className={`rounded-xl border px-3 py-2 text-sm transition ${
                texto === op
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600 hover:border-brand-300"
              }`}
            >
              {op}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-left text-xs font-medium text-slate-500" htmlFor="mensaje-match">
          Tu mensaje (puedes editarlo)
        </label>
        <textarea
          id="mensaje-match"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            ref={botonEnviar}
            type="button"
            disabled={!texto.trim()}
            onClick={() => onEnviar(texto)}
            className="flex-1 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {etiquetaEnviar}
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="flex-1 rounded-xl px-4 py-3 font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Seguir explorando
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
