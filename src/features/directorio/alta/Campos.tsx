"use client";

import type { ReactNode } from "react";

export const claseCampo =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 aria-[invalid=true]:border-rose-400";

/** Etiqueta + control + ayuda + error, con los atributos de accesibilidad enlazados. */
export function Campo({ id, etiqueta, ayuda, error, children }: { id: string; etiqueta: ReactNode; ayuda?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold text-ink">
        {etiqueta}
      </label>
      {children}
      {ayuda && !error && (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-slate-500">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Resumen de errores de un paso (se enfoca al fallar la validación para que lo lean los lectores de pantalla). */
export function ResumenErrores({ errores }: { errores: Record<string, string> }) {
  const lista = Object.values(errores);
  if (lista.length === 0) return null;
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      <p className="font-bold">Revisa estos puntos:</p>
      <ul className="mt-1 list-disc pl-5">
        {lista.slice(0, 5).map((m) => (
          <li key={m}>{m}</li>
        ))}
        {lista.length > 5 && <li>…y {lista.length - 5} más</li>}
      </ul>
    </div>
  );
}
