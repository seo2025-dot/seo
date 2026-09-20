"use client";

import type { Completitud } from "@/lib/completitud";

/**
 * Barra de progreso del perfil: «X % completado» y, si falta algo, los apartados que más suman.
 * `compacta` la reduce a una línea (para el encabezado del formulario o avisos).
 */
export default function BarraCompletitud({
  completitud,
  compacta = false,
  onCompletar,
  className = "",
}: {
  completitud: Completitud;
  compacta?: boolean;
  onCompletar?: () => void;
  className?: string;
}) {
  const { porcentaje, faltantes } = completitud;
  const completo = porcentaje >= 100;
  const barra = (
    <div
      role="progressbar"
      aria-label="Perfil completado"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={porcentaje}
      className="h-2.5 overflow-hidden rounded-full bg-slate-200"
    >
      <div className={`h-full rounded-full transition-[width] duration-500 ${completo ? "bg-emerald-500" : "bg-marca"}`} style={{ width: `${porcentaje}%` }} />
    </div>
  );

  if (compacta) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <span className="shrink-0 text-sm font-bold tabular-nums text-ink">{porcentaje}% completado</span>
        <div className="min-w-0 flex-1">{barra}</div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-ink">{completo ? "Perfil completo ✓" : "Tu perfil está completo al"}</p>
        <p className="text-2xl font-black tabular-nums text-ink">{porcentaje}%</p>
      </div>
      <div className="mt-2">{barra}</div>
      {!completo && (
        <>
          <p className="mt-3 text-xs font-semibold text-slate-600">Para mejorar tus recomendaciones te falta:</p>
          <ul className="mt-1 space-y-1 text-xs text-slate-600">
            {faltantes.slice(0, 3).map((f) => (
              <li key={f.id} className="flex gap-2">
                <span aria-hidden className="text-brand-600">+</span>
                <span>
                  <strong className="font-semibold text-ink">{f.etiqueta}:</strong> {f.ayuda}
                </span>
              </li>
            ))}
          </ul>
          {onCompletar && (
            <button type="button" onClick={onCompletar} className="boton-marca mt-3 rounded-full px-5 py-2 text-sm font-bold text-white">
              Completar mi perfil
            </button>
          )}
        </>
      )}
    </div>
  );
}
