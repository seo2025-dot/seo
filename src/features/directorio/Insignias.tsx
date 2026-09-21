import { VerificadoCheck } from "@/components/PerfilBadges";

/** Sello de identidad/negocio verificado por la moderación. */
export function InsigniaVerificado({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 ${className}`} title="Verificado por conectari.com">
      <VerificadoCheck className="h-3.5 w-3.5" /> Verificado
    </span>
  );
}

export function InsigniaAbierto({ abierto, texto }: { abierto: boolean; texto?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${abierto ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${abierto ? "bg-emerald-500" : "bg-slate-400"}`} />
      {texto ?? (abierto ? "Abierto ahora" : "Cerrado")}
    </span>
  );
}

/** «De turno»: solo las verificadas se presentan como turno confirmado; las demás, como declarado por el propio establecimiento. */
export function InsigniaTurno({ verificado }: { verificado: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${verificado ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}
      title={verificado ? "Farmacia de turno verificada" : "Turno declarado por el establecimiento (aún sin verificar)"}
    >
      <span aria-hidden>🚨</span> {verificado ? "De turno" : "Turno declarado"}
    </span>
  );
}

/** Estrellas con la nota y el número de reseñas. Sin reseñas se dice «Nuevo» en vez de mostrar 0 estrellas. */
export function Valoracion({ rating, resenas, className = "" }: { rating: number; resenas: number; className?: string }) {
  if (resenas === 0) return <span className={`text-[11px] font-semibold text-slate-400 ${className}`}>Nuevo</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold text-ink ${className}`} aria-label={`Valoración ${rating.toFixed(1)} de 5 con ${resenas} ${resenas === 1 ? "reseña" : "reseñas"}`}>
      <span aria-hidden className="text-amber-400">★</span>
      <span className="tabular-nums">{rating.toFixed(1)}</span>
      <span className="font-normal text-slate-400">({resenas})</span>
    </span>
  );
}
