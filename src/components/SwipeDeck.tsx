"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import Icono from "@/components/Icono";

export type Direccion = "like" | "pass";

const UMBRAL = 110;

const variantesSalida = {
  salir: (dir: Direccion) => ({
    x: dir === "like" ? 700 : -700,
    rotate: dir === "like" ? 22 : -22,
    opacity: 0,
    transition: { duration: 0.35, ease: "easeIn" as const },
  }),
};

function SwipeCard({
  indice,
  etiqueta,
  onDecidir,
  children,
}: {
  indice: number;
  etiqueta: string;
  onDecidir: (dir: Direccion) => void;
  children: React.ReactNode;
}) {
  const esTop = indice === 0;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-14, 0, 14]);
  const opacidadLike = useTransform(x, [30, 140], [0, 1]);
  const opacidadPass = useTransform(x, [-140, -30], [1, 0]);

  const alSoltar = (_: unknown, { offset, velocity }: PanInfo) => {
    const fuerza = offset.x + velocity.x * 0.2;
    if (fuerza > UMBRAL) onDecidir("like");
    else if (fuerza < -UMBRAL) onDecidir("pass");
  };

  return (
    <motion.article
      className={`absolute inset-0 select-none overflow-hidden rounded-3xl bg-slate-200 shadow-xl ${
        esTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
      }`}
      style={{ x, rotate, zIndex: 10 - indice, touchAction: "pan-y" }}
      drag={esTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      dragSnapToOrigin
      onDragEnd={alSoltar}
      initial={{ scale: 0.92, y: 24, opacity: 0 }}
      animate={{ scale: 1 - indice * 0.05, y: indice * 14, opacity: 1 }}
      variants={variantesSalida}
      exit="salir"
      aria-label={etiqueta}
    >
      {children}
      {esTop && (
        <>
          <motion.span
            style={{ opacity: opacidadLike }}
            className="pointer-events-none absolute left-5 top-28 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-extrabold tracking-wider text-emerald-400"
          >
            ME GUSTA
          </motion.span>
          <motion.span
            style={{ opacity: opacidadPass }}
            className="pointer-events-none absolute right-5 top-28 rotate-12 rounded-lg border-4 border-rose-400 px-3 py-1 text-2xl font-extrabold tracking-wider text-rose-400"
          >
            PASO
          </motion.span>
        </>
      )}
    </motion.article>
  );
}

export default function SwipeDeck<T extends { id: string }>({
  mazo,
  onSwipe,
  renderCard,
  etiquetaCard,
  pie,
  deshabilitado = false,
}: {
  mazo: T[];
  onSwipe: (item: T, dir: Direccion) => void;
  /** Contenido de la tarjeta; `esTop` es true solo para la tarjeta superior. */
  renderCard: (item: T, esTop: boolean) => React.ReactNode;
  etiquetaCard: (item: T) => string;
  /** Contenido opcional bajo los botones, para la tarjeta superior. */
  pie?: (item: T) => React.ReactNode;
  deshabilitado?: boolean;
}) {
  const [salida, setSalida] = useState<Direccion>("like");
  const top = mazo[0];

  const decidir = useCallback(
    (dir: Direccion) => {
      if (!top || deshabilitado) return;
      setSalida(dir);
      onSwipe(top, dir);
    },
    [top, deshabilitado, onSwipe],
  );

  // Atajos de teclado: ← descartar, → me gusta (sin interferir con campos de texto).
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowRight") decidir("like");
      if (e.key === "ArrowLeft") decidir("pass");
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [decidir]);

  const visibles = mazo.slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="relative aspect-[3/4] w-full">
        <AnimatePresence custom={salida}>
          {[...visibles].reverse().map((item) => {
            const indice = visibles.indexOf(item);
            return (
              <SwipeCard
                key={item.id}
                indice={indice}
                etiqueta={etiquetaCard(item)}
                onDecidir={decidir}
              >
                {renderCard(item, indice === 0)}
              </SwipeCard>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={() => decidir("pass")}
          disabled={!top || deshabilitado}
          aria-label="Descartar"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-rose-500 shadow-lg ring-1 ring-slate-200 transition hover:scale-110 hover:bg-rose-50 disabled:opacity-40"
        >
          <Icono nombre="x" className="h-7 w-7" />
        </button>
        <button
          type="button"
          onClick={() => decidir("like")}
          disabled={!top || deshabilitado}
          aria-label="Me gusta"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-xl transition hover:scale-110 disabled:opacity-40"
        >
          <Icono nombre="match" className="h-9 w-9" relleno />
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">Arrastra la tarjeta o usa las flechas ← →</p>
      {top && pie && <div className="mt-1 text-center text-sm">{pie(top)}</div>}
    </div>
  );
}
