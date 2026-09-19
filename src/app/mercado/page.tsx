"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import AnuncioCard from "@/components/AnuncioCard";
import HistoriasBar from "@/components/HistoriasBar";

const campo =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

function Mercado() {
  const params = useSearchParams();
  const { anuncios, hidratado } = useSocial();
  const [cat, setCat] = useState<"vehiculos" | "negocios">(params.get("cat") === "negocios" ? "negocios" : "vehiculos");
  const [operacion, setOperacion] = useState("");
  const [subtipo, setSubtipo] = useState("");
  const [texto, setTexto] = useState("");

  const resultados = useMemo(
    () =>
      anuncios.filter((a) => {
        if (cat === "vehiculos" ? a.tipo !== "vehiculo" : a.tipo !== "negocio") return false;
        if (operacion && a.operacion !== operacion) return false;
        if (subtipo && a.subtipo !== subtipo) return false;
        if (texto && !`${a.titulo} ${a.ubicacion} ${a.chips.join(" ")}`.toLowerCase().includes(texto.toLowerCase())) return false;
        return true;
      }),
    [anuncios, cat, operacion, subtipo, texto],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <HistoriasBar />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mercado P2P</h1>
          <p className="mt-1 text-slate-500">Vehículos y oportunidades de negocio publicados por la comunidad.</p>
        </div>
        <Link href="/publicar" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          + Publicar
        </Link>
      </div>

      <div role="tablist" className="mt-6 flex gap-1 border-b border-slate-200">
        {(
          [
            ["vehiculos", "🚗 Vehículos"],
            ["negocios", "💼 Oportunidades de negocio"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={cat === id}
            onClick={() => {
              setCat(id);
              setSubtipo("");
              setOperacion("");
            }}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
              cat === id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {cat === "vehiculos" && (
          <>
            <select aria-label="Operación" value={operacion} onChange={(e) => setOperacion(e.target.value)} className={campo}>
              <option value="">Venta y alquiler</option>
              <option value="venta">Venta</option>
              <option value="alquiler">Alquiler</option>
            </select>
            <select aria-label="Categoría" value={subtipo} onChange={(e) => setSubtipo(e.target.value)} className={campo}>
              <option value="">Autos, motos y transporte</option>
              <option value="auto">Autos</option>
              <option value="moto">Motos</option>
              <option value="transporte">Transporte</option>
            </select>
          </>
        )}
        <input aria-label="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar marca, zona…" className={`${campo} ${cat === "negocios" ? "sm:col-span-3" : ""}`} />
      </div>

      <p className="mb-6 mt-6 text-sm text-slate-500" aria-live="polite">
        {hidratado ? `${resultados.length} resultado(s)` : "Cargando…"}
      </p>
      {hidratado && resultados.length === 0 ? (
        <p className="py-12 text-center text-slate-500">No hay resultados con esos criterios.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {resultados.map((a) => (
            <AnuncioCard key={a.id} anuncio={a} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MercadoPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse px-4 py-8" />}>
      <Mercado />
    </Suspense>
  );
}
