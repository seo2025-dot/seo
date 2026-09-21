"use client";

import { useMemo, useState } from "react";
import { useSocial } from "@/context/SocialContext";
import { useReloj, useUbicacion } from "@/features/geo/ubicacion";
import { fechaLocal } from "@/lib/dia";
import { TRADICIONES, reflexionDelDia } from "@/lib/reflexiones";

/**
 * Reflexión del día: cambia cada día, rota entre espiritismo (Allan Kardec), estoicismo y psicología, y cada persona ve una distinta el mismo
 * día. «Otra reflexión» da la siguiente sin esperar a mañana. Las frases textuales llevan su obra; las demás son propias, «inspiradas en».
 */
export default function ReflexionDelDia({ className = "", accion }: { className?: string; accion?: React.ReactNode }) {
  const { sesion } = useSocial();
  const { ubicacion } = useUbicacion();
  const ms = useReloj(60_000);
  const [otra, setOtra] = useState(0);

  const r = useMemo(() => {
    // La fecha es la del lugar de la persona (no la de un servidor lejano): a medianoche local cambia la reflexión.
    const f = fechaLocal(ms ?? Date.now(), ubicacion.zona);
    return reflexionDelDia(new Date(f.anio, f.mes - 1, f.dia), otra, sesion.uid ?? "");
  }, [ms, ubicacion.zona, otra, sesion.uid]);
  const t = TRADICIONES[r.tradicion];

  return (
    <figure className={`rounded-2xl border bg-gradient-to-br to-white p-5 ${t.clase.split(" ").slice(0, 2).join(" ")} ${className}`}>
      <figcaption className={`flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider ${t.clase.split(" ")[2]}`}>
        <span>
          <span aria-hidden>{t.emoji}</span> Reflexión del día · {t.nombre}
        </span>
        <button type="button" onClick={() => setOtra((n) => n + 1)} className="rounded-full px-2.5 py-1 text-[11px] font-bold normal-case tracking-normal underline decoration-dotted underline-offset-2 hover:bg-white/70">
          Otra reflexión ↻
        </button>
      </figcaption>
      <blockquote className="mt-2 text-[15px] leading-relaxed text-slate-800">{r.fuente ? `“${r.texto}”` : r.texto}</blockquote>
      <p className="mt-1 text-xs text-slate-500">{r.fuente ?? (r.idea ? `${r.idea} · ${t.inspirada}` : t.inspirada)}</p>
      {accion && <div className="mt-3">{accion}</div>}
    </figure>
  );
}
