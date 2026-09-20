"use client";

import { DIAS, ETIQUETA_DIA, type DiaId, type Horario } from "@/data/directorio";
import { claseCampo } from "@/features/directorio/alta/Campos";
import { PRESETS_HORARIO, copiarTramos, ponerTramos, presetHorario, resumenHorario } from "@/lib/directorio/horarios";

export interface EstadoHorario {
  horario: Horario;
  abierto24h: boolean;
}

/**
 * Editor de horario: un preajuste para empezar rápido y, si hace falta, ajuste día por día (hasta 2 tramos por día, p. ej. almuerzo y cena).
 * Los cambios se envían completos a `onChange`; nunca muta el estado recibido.
 */
export default function EditorHorario({ valor, onChange, error }: { valor: EstadoHorario; onChange: (v: EstadoHorario) => void; error?: string }) {
  const { horario, abierto24h } = valor;
  const cambiarDia = (dia: DiaId, tramos: [string, string][]) => onChange({ horario: ponerTramos(horario, dia, tramos), abierto24h });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="horario-preset" className="mb-1 block text-sm font-bold text-ink">
            Empieza con un horario típico
          </label>
          <select
            id="horario-preset"
            className={claseCampo}
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const p = presetHorario(e.target.value);
              onChange({ horario: p.horario, abierto24h: p.abierto24h });
            }}
          >
            <option value="">Elegir un preajuste…</option>
            {PRESETS_HORARIO.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold">
          <input type="checkbox" checked={abierto24h} onChange={(e) => onChange({ horario, abierto24h: e.target.checked })} className="h-4 w-4 accent-brand-600" />
          Abierto 24 horas
        </label>
      </div>

      {!abierto24h && (
        <div className="space-y-2" role="group" aria-label="Horario por día">
          {DIAS.map((dia) => {
            const tramos = horario[dia] ?? [];
            const abierto = tramos.length > 0;
            return (
              <div key={dia} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <label className="flex w-32 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={abierto}
                    onChange={(e) => cambiarDia(dia, e.target.checked ? [["08:00", "18:00"]] : [])}
                    className="h-4 w-4 accent-brand-600"
                    aria-label={`${ETIQUETA_DIA[dia]}: abierto`}
                  />
                  {ETIQUETA_DIA[dia]}
                </label>
                {!abierto && <span className="text-sm text-slate-400">Cerrado</span>}
                {tramos.map(([desde, hasta], i) => (
                  <span key={i} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="time"
                      value={desde}
                      onChange={(e) => cambiarDia(dia, tramos.map((t, j) => (j === i ? [e.target.value, t[1]] : t)) as [string, string][])}
                      className="rounded-lg border border-slate-300 px-2 py-1"
                      aria-label={`${ETIQUETA_DIA[dia]}, tramo ${i + 1}: abre`}
                    />
                    <span aria-hidden>–</span>
                    <input
                      type="time"
                      value={hasta}
                      onChange={(e) => cambiarDia(dia, tramos.map((t, j) => (j === i ? [t[0], e.target.value] : t)) as [string, string][])}
                      className="rounded-lg border border-slate-300 px-2 py-1"
                      aria-label={`${ETIQUETA_DIA[dia]}, tramo ${i + 1}: cierra`}
                    />
                    {i > 0 && (
                      <button type="button" onClick={() => cambiarDia(dia, tramos.filter((_, j) => j !== i))} aria-label="Quitar este tramo" className="text-slate-400 hover:text-rose-600">
                        ✕
                      </button>
                    )}
                  </span>
                ))}
                {abierto && tramos.length < 2 && (
                  <button type="button" onClick={() => cambiarDia(dia, [...tramos, ["15:00", "19:00"]])} className="text-xs font-semibold text-brand-700 underline">
                    + Otro tramo
                  </button>
                )}
                {abierto && (
                  <button type="button" onClick={() => onChange({ horario: copiarTramos(horario, dia, DIAS), abierto24h })} className="ml-auto text-xs font-semibold text-slate-500 underline hover:text-ink">
                    Copiar a todos los días
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-sm text-slate-600" aria-live="polite">
        <span className="font-bold text-ink">Así se verá:</span> {resumenHorario(horario, abierto24h)}
      </p>
      {error && (
        <p role="alert" className="text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
