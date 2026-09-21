"use client";

import { useState } from "react";
import { useSocial } from "@/context/SocialContext";
import { guardarEnPerfil, pedirGps, useUbicacion } from "@/features/geo/ubicacion";
import { CIUDADES, PAISES, etiquetaUbicacion, ubicacionManual } from "@/lib/geo";

const MOTIVOS: Record<string, string> = {
  sin_soporte: "Este dispositivo no permite ubicarte. Elige tu país abajo.",
  denegado: "No diste permiso de ubicación. No pasa nada: elige tu país y ciudad abajo.",
  no_disponible: "No pudimos ubicarte ahora. Elige tu país abajo.",
  tiempo: "Tardó demasiado en ubicarte. Inténtalo otra vez o elige tu país abajo.",
};

/**
 * «📍 Cuenca, Ecuador · Cambiar»: muestra dónde crees que estás (según GPS, lo que elegiste o tu zona horaria) y permite cambiarlo.
 * El GPS solo se usa si lo pides. Lo que se guarda es una ubicación aproximada (~1 km).
 */
export default function SelectorUbicacion({ className = "" }: { className?: string }) {
  const { ubicacion, cambiar } = useUbicacion();
  const { sesion } = useSocial();
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardarPerfil, setGuardarPerfil] = useState(false);
  const [pais, setPais] = useState(ubicacion.pais);

  const aplicar = async (u: NonNullable<ReturnType<typeof ubicacionManual>>) => {
    cambiar(u);
    if (guardarPerfil && sesion.uid) {
      const e = await guardarEnPerfil(u);
      setAviso(e ?? "Listo: guardamos tu ubicación aproximada en tu perfil.");
      if (e) return;
    } else setAviso("Ubicación actualizada.");
  };

  const usarGps = async () => {
    setBuscando(true);
    setAviso(null);
    const r = await pedirGps();
    setBuscando(false);
    if (!r.ok) return setAviso(MOTIVOS[r.motivo]);
    setPais(r.ubicacion.pais);
    await aplicar(r.ubicacion);
  };

  const ciudades = CIUDADES.filter((c) => c.pais === pais);

  return (
    <div className={`relative inline-block ${className}`}>
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} aria-haspopup="dialog" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand-300">
        <span aria-hidden>📍</span>
        {etiquetaUbicacion(ubicacion)}
        <span className="text-brand-700 underline">Cambiar</span>
      </button>
      {abierto && (
        <div role="dialog" aria-label="Elegir ubicación" className="absolute left-0 z-50 mt-2 w-[min(22rem,90vw)] rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-2xl">
          <p className="font-black text-ink">¿Dónde estás?</p>
          <p className="mt-0.5 text-xs text-slate-500">Lo usamos para mostrarte la hora, el clima del día y los negocios de tu zona. Nunca compartimos tu ubicación exacta.</p>
          <button type="button" onClick={() => void usarGps()} disabled={buscando} className="boton-marca mt-3 w-full rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {buscando ? "Buscando…" : "📍 Usar mi ubicación"}
          </button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-500">
              País
              <select value={pais} onChange={(e) => { setPais(e.target.value); const u = ubicacionManual(e.target.value); if (u) void aplicar(u); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                {PAISES.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Ciudad
              <select value={ubicacion.pais === pais ? (ubicacion.ciudad ?? "") : ""} onChange={(e) => { const u = ubicacionManual(pais, e.target.value); if (u) void aplicar(u); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                <option value="">Capital</option>
                {ciudades.map((c) => (
                  <option key={c.nombre} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {sesion.uid && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={guardarPerfil} onChange={(e) => setGuardarPerfil(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
              <span>Guardar en mi perfil (solo yo veo mi ubicación aproximada; los demás ven únicamente mi país).</span>
            </label>
          )}
          {aviso && (
            <p role="status" className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
              {aviso}
            </p>
          )}
          <button type="button" onClick={() => setAbierto(false)} className="mt-3 w-full rounded-full px-4 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
