"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { resumenDemanda } from "@/lib/anuncios";
import FormDemanda from "@/components/publicar/FormDemanda";
import FormInmueble from "@/components/publicar/FormInmueble";
import FormNegocio from "@/components/publicar/FormNegocio";
import FormVehiculo from "@/components/publicar/FormVehiculo";

type Modo = "vendo" | "busco";
type Categoria = "inmueble" | "vehiculo" | "negocio";

function Publicar() {
  const params = useSearchParams();
  const { estado, hidratado, eliminarDemanda } = useSocial();
  const [modo, setModo] = useState<Modo>(params.get("modo") === "busco" ? "busco" : "vendo");
  const [categoria, setCategoria] = useState<Categoria>("inmueble");

  const misBusquedas = estado.demandas.filter((d) => d.autorId === "yo");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">Publicar</h1>
      <p className="mt-1 text-slate-500">
        Ofrece lo que tienes o pide lo que necesitas. ¿Eres profesional?{" "}
        <Link href="/empleos/publicar" className="font-medium text-brand-600 hover:underline">
          Publica un servicio o una vacante
        </Link>
        .
      </p>

      <div role="tablist" aria-label="Modo de publicación" className="mt-6 grid grid-cols-2 gap-3">
        {(
          [
            ["vendo", "💰 Tengo para vender / alquilar", "Inmuebles, vehículos y negocios"],
            ["busco", "🔎 Busco comprar / alquilar", "Publica tu requerimiento y presupuesto"],
          ] as const
        ).map(([id, titulo, sub]) => (
          <button
            key={id}
            role="tab"
            aria-selected={modo === id}
            onClick={() => setModo(id)}
            className={`rounded-2xl border-2 p-4 text-left transition ${modo === id ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-brand-300"}`}
          >
            <span className="block font-bold">{titulo}</span>
            <span className="text-xs text-slate-500">{sub}</span>
          </button>
        ))}
      </div>

      <div className="mt-8">
        {modo === "vendo" ? (
          <>
            <div role="tablist" aria-label="Categoría" className="mb-8 flex gap-1 border-b border-slate-200">
              {(
                [
                  ["inmueble", "🏡 Inmueble"],
                  ["vehiculo", "🚗 Vehículo"],
                  ["negocio", "💼 Negocio"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={categoria === id}
                  onClick={() => setCategoria(id)}
                  className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${categoria === id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {categoria === "inmueble" && <FormInmueble />}
            {categoria === "vehiculo" && <FormVehiculo />}
            {categoria === "negocio" && <FormNegocio />}
          </>
        ) : (
          <>
            <FormDemanda />
            {hidratado && misBusquedas.length > 0 && (
              <section className="mt-10" aria-label="Mis búsquedas">
                <h2 className="mb-3 text-lg font-bold">Mis búsquedas activas</h2>
                <ul className="space-y-2">
                  {misBusquedas.map((d) => (
                    <li key={d.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                      <div>
                        <p className="font-medium capitalize">{resumenDemanda(d)}</p>
                        <p className="text-slate-500">{d.nota}</p>
                      </div>
                      <button type="button" onClick={() => eliminarDemanda(d.id)} className="shrink-0 text-xs text-slate-400 hover:text-rose-600">
                        Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PublicarPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-8" />}>
      <Publicar />
    </Suspense>
  );
}
