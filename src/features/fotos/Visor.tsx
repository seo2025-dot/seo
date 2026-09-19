/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import type { FotoGuardada } from "@/features/fotos/tipos";

/** Visor a pantalla completa con navegación por teclado (← → Esc) y foco atrapado en el diálogo. */
export default function Visor({ fotos, inicio = 0, onCerrar }: { fotos: FotoGuardada[]; inicio?: number; onCerrar: () => void }) {
  const [i, setI] = useState(Math.min(inicio, fotos.length - 1));
  const cerrar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cerrar.current?.focus();
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight") setI((x) => Math.min(fotos.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", alPulsar);
    return () => {
      window.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = previo;
    };
  }, [fotos.length, onCerrar]);

  if (fotos.length === 0) return null;
  const foto = fotos[i];

  return (
    <div role="dialog" aria-modal="true" aria-label={`Foto ${i + 1} de ${fotos.length}`} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4" onClick={onCerrar}>
      <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white hover:bg-white/25">
        ✕
      </button>
      <img src={foto.url} alt={`Foto ${i + 1} de ${fotos.length}`} className="max-h-[90vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      {i > 0 && (
        <button type="button" aria-label="Foto anterior" onClick={(e) => { e.stopPropagation(); setI(i - 1); }} className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25">
          ‹
        </button>
      )}
      {i < fotos.length - 1 && (
        <button type="button" aria-label="Foto siguiente" onClick={(e) => { e.stopPropagation(); setI(i + 1); }} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25">
          ›
        </button>
      )}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
        {i + 1} / {fotos.length}
      </p>
    </div>
  );
}
