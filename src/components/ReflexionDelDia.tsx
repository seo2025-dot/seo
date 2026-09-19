"use client";

import { useMemo } from "react";
import { reflexionDelDia } from "@/lib/reflexiones";

/** Reflexión diaria de autoconocimiento y progreso, inspirada en la filosofía espiritista de Allan Kardec. */
export default function ReflexionDelDia({ className = "", accion }: { className?: string; accion?: React.ReactNode }) {
  const r = useMemo(() => reflexionDelDia(), []);
  return (
    <figure className={`rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 ${className}`}>
      <figcaption className="text-[11px] font-bold uppercase tracking-wider text-violet-700">🕊️ Reflexión del día · inspirada en Allan Kardec</figcaption>
      <blockquote className="mt-2 text-[15px] leading-relaxed text-slate-800">“{r.texto}”</blockquote>
      {r.fuente && <p className="mt-1 text-xs text-slate-500">{r.fuente}</p>}
      {accion && <div className="mt-3">{accion}</div>}
    </figure>
  );
}
