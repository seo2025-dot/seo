"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Operacion, TipoPropiedad } from "@/types/propiedad";
import { useSocial } from "@/context/SocialContext";
import PropertyCard from "@/components/PropertyCard";

const campo =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

function Explorador() {
  const params = useSearchParams();
  const { todasPropiedades, estado, hidratado, enBoost } = useSocial();

  const [operacion, setOperacion] = useState(params.get("operacion") ?? "");
  const [tipo, setTipo] = useState(params.get("tipo") ?? "");
  const [ubicacion, setUbicacion] = useState(params.get("ubicacion") ?? "");
  const [soloGuardadas, setSoloGuardadas] = useState(false);

  const resultados = useMemo(
    () =>
      todasPropiedades.filter(
        (p) =>
          (!operacion || p.operacion === (operacion as Operacion)) &&
          (!tipo || p.tipo === (tipo as TipoPropiedad)) &&
          (!ubicacion || p.ubicacion.toLowerCase().includes(ubicacion.toLowerCase())) &&
          (!soloGuardadas || estado.guardadas.includes(p.id)),
      ).sort((a, b) => Number(enBoost(b.id)) - Number(enBoost(a.id))),
    [todasPropiedades, operacion, tipo, ubicacion, soloGuardadas, estado.guardadas, enBoost],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Explorar propiedades</h1>
          <p className="mt-1 text-slate-500">Publicadas por la comunidad. Guarda las que te gusten y habla con sus dueños.</p>
        </div>
        <Link href="/publicar" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          + Publicar la mía
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto]">
        <select aria-label="Operación" value={operacion} onChange={(e) => setOperacion(e.target.value)} className={campo}>
          <option value="">Venta y alquiler</option>
          <option value="venta">Venta</option>
          <option value="alquiler">Alquiler</option>
        </select>
        <select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
          <option value="">Todos los tipos</option>
          <option value="casa">Casa</option>
          <option value="villa">Villa</option>
          <option value="departamento">Departamento</option>
          <option value="terreno">Terreno</option>
          <option value="local">Local</option>
        </select>
        <input
          aria-label="Ubicación"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          placeholder="Buscar por zona…"
          className={campo}
        />
        <button
          type="button"
          aria-pressed={soloGuardadas}
          onClick={() => setSoloGuardadas((v) => !v)}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
            soloGuardadas ? "border-rose-500 bg-rose-500 text-white" : "border-slate-300 text-slate-600 hover:border-rose-300"
          }`}
        >
          ♥ Guardadas
        </button>
      </div>

      <p className="mb-6 mt-6 text-sm text-slate-500" aria-live="polite">
        {hidratado ? `${resultados.length} resultado(s)` : "Cargando…"}
      </p>
      {hidratado && resultados.length === 0 ? (
        <p className="py-12 text-center text-slate-500">No se encontraron propiedades con esos criterios.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {resultados.map((p) => (
            <PropertyCard key={p.id} propiedad={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PropiedadesPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse px-4 py-8" />}>
      <Explorador />
    </Suspense>
  );
}
