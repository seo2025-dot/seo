"use client";

import { useState } from "react";
import { claseCampo } from "@/features/directorio/alta/Campos";
import { instanteEcuador, valorLocalEcuador } from "@/lib/directorio/horarios";
import { mapearTurno, type FilaTurno } from "@/lib/directorio/mapeo";
import { supabase } from "@/lib/supabaseClient";
import type { TurnoGuardia } from "@/types/directorio";

const FORMATO = new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Turnos de guardia («farmacia de turno»). Las fechas se escriben y se muestran en hora de Ecuador, sin depender de la zona del dispositivo. */
export default function GestorTurnos({ proveedorId, verificado, turnos, onChange }: { proveedorId: string; verificado: boolean; turnos: TurnoGuardia[]; onChange: (t: TurnoGuardia[]) => void }) {
  const inicioPorDefecto = valorLocalEcuador(Date.now() + 3_600_000).slice(0, 13) + ":00";
  const [desde, setDesde] = useState(inicioPorDefecto);
  const [hasta, setHasta] = useState(valorLocalEcuador(Date.now() + 13 * 3_600_000).slice(0, 13) + ":00");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const anadir = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = instanteEcuador(desde);
    const b = instanteEcuador(hasta);
    if (!a || !b) return setError("Indica cuándo empieza y cuándo termina el turno.");
    if (new Date(b) <= new Date(a)) return setError("El turno debe terminar después de empezar.");
    if (new Date(b).getTime() - new Date(a).getTime() > 48 * 3_600_000) return setError("Un turno puede durar como máximo 48 horas.");
    setOcupado(true);
    setError(null);
    const { data, error: fallo } = await supabase().from("provider_duty_shifts").insert({ provider_id: proveedorId, starts_at: a, ends_at: b, note: nota.trim() }).select("*").single();
    setOcupado(false);
    if (fallo || !data) return setError(fallo?.message ?? "No se pudo guardar el turno.");
    onChange([...turnos, mapearTurno(data as FilaTurno)].sort((x, y) => x.desde - y.desde));
    setNota("");
  };

  const quitar = async (t: TurnoGuardia) => {
    const { error: fallo } = await supabase().from("provider_duty_shifts").delete().eq("id", t.id);
    if (fallo) return setError(fallo.message);
    onChange(turnos.filter((x) => x.id !== t.id));
  };

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        Las farmacias de turno aparecen primero en las búsquedas de la gente que necesita algo urgente.{" "}
        {verificado ? "Tu perfil está verificado: tu turno se muestra como confirmado." : "Mientras tu perfil no esté verificado, tu turno se muestra como «declarado por el establecimiento»."}
      </p>
      <form onSubmit={anadir} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2" noValidate>
        <div>
          <label htmlFor="turno-desde" className="mb-1 block text-sm font-bold text-ink">
            Empieza
          </label>
          <input id="turno-desde" type="datetime-local" value={desde} onChange={(e) => setDesde(e.target.value)} className={claseCampo} />
        </div>
        <div>
          <label htmlFor="turno-hasta" className="mb-1 block text-sm font-bold text-ink">
            Termina
          </label>
          <input id="turno-hasta" type="datetime-local" value={hasta} onChange={(e) => setHasta(e.target.value)} className={claseCampo} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="turno-nota" className="mb-1 block text-sm font-bold text-ink">
            Nota <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <input id="turno-nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Ej.: Turno nocturno, entrada por la puerta lateral" className={claseCampo} />
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-rose-600 sm:col-span-2">
            {error}
          </p>
        )}
        <div className="sm:col-span-2">
          <button type="submit" disabled={ocupado} className="boton-marca rounded-full px-6 py-2 text-sm font-bold text-white disabled:opacity-50">
            {ocupado ? "Guardando…" : "Añadir turno"}
          </button>
        </div>
      </form>

      {turnos.length === 0 ? (
        <p className="text-sm text-slate-500">No tienes turnos programados.</p>
      ) : (
        <ul className="space-y-2">
          {turnos.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="capitalize">{FORMATO.format(t.desde)}</span>
              <span aria-hidden>→</span>
              <span className="capitalize">{FORMATO.format(t.hasta)}</span>
              {t.nota && <span className="text-xs text-slate-500">· {t.nota}</span>}
              <button type="button" onClick={() => void quitar(t)} aria-label="Quitar este turno" className="ml-auto text-slate-400 hover:text-rose-600">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
