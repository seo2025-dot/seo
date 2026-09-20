/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { comprimirImagen } from "@/lib/imagen";

/**
 * Selector de imagen con vista previa. Comprime en el navegador (se sube al guardar, no aquí) y admite quitarla.
 * `valor` es una URL ya publicada o una imagen recién elegida (data URL).
 */
export default function SubidaImagen({
  etiqueta,
  ayuda,
  valor,
  onChange,
  maxLado = 1000,
  forma = "rectangulo",
}: {
  etiqueta: string;
  ayuda?: string;
  valor?: string;
  onChange: (v: string | undefined) => void;
  maxLado?: number;
  forma?: "rectangulo" | "cuadrado";
}) {
  const archivo = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Elige una imagen (JPG, PNG o WebP).");
      return;
    }
    try {
      onChange(await comprimirImagen(f, maxLado, 0.78));
      setError(null);
    } catch {
      setError("No se pudo leer esa imagen. Prueba con otra.");
    }
  };

  return (
    <div>
      <p className="mb-1 text-sm font-bold text-ink">{etiqueta}</p>
      <div className="flex items-center gap-4">
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-3xl text-slate-300 ${forma === "cuadrado" ? "h-24 w-24" : "h-24 w-40"}`}>
          {valor ? <img src={valor} alt={`Vista previa: ${etiqueta}`} className="h-full w-full object-cover" /> : <span aria-hidden>📷</span>}
        </div>
        <div className="space-y-1.5">
          <input ref={archivo} type="file" accept="image/*" onChange={elegir} className="hidden" aria-label={etiqueta} />
          <button type="button" onClick={() => archivo.current?.click()} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-ink hover:border-brand-400">
            {valor ? "Cambiar" : "Subir imagen"}
          </button>
          {valor && (
            <button type="button" onClick={() => onChange(undefined)} className="ml-2 text-sm text-slate-500 underline hover:text-rose-600">
              Quitar
            </button>
          )}
          {ayuda && <p className="text-xs text-slate-500">{ayuda}</p>}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
