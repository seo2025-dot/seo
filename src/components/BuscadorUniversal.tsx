"use client";

import { useState } from "react";
import { ZONAS } from "@/data/catalogos";
import SearchBar from "@/components/SearchBar";

type Modo = "inmuebles" | "delivery" | "farmacias" | "todo";

const MODOS: { id: Modo; etiqueta: string; emoji: string }[] = [
  { id: "inmuebles", etiqueta: "Inmuebles", emoji: "🏡" },
  { id: "delivery", etiqueta: "Comida", emoji: "🍔" },
  { id: "farmacias", etiqueta: "Farmacias", emoji: "💊" },
  { id: "todo", etiqueta: "Todo", emoji: "🔎" },
];

/** Cómo funciona cada búsqueda que no es de inmuebles: a qué página va y qué dice el campo. */
const CONFIG = {
  delivery: { accion: "/directorio/delivery", placeholder: "Ceviche, pizza, café, almuerzo…", filtro: { nombre: "abierto", etiqueta: "Abierto ahora" } },
  farmacias: { accion: "/directorio/salud", placeholder: "Paracetamol, farmacia, laboratorio…", filtro: { nombre: "turno", etiqueta: "De turno ahora" } },
  todo: { accion: "/directorio/buscar", placeholder: "Un plato, un medicamento o un negocio…", filtro: null },
} as const;

const campo = "w-full cursor-pointer appearance-none bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-slate-400";

/**
 * Buscador universal de la portada: una sola caja con pestañas que llevan a cada sección.
 * «Inmuebles» conserva el buscador de siempre; Comida, Farmacias y Todo buscan en el directorio (los formularios son GET: funcionan
 * sin JavaScript y el resultado es un enlace que se puede compartir).
 */
export default function BuscadorUniversal() {
  const [modo, setModo] = useState<Modo>("inmuebles");
  const c = modo === "inmuebles" ? null : CONFIG[modo];

  return (
    <div>
      <div role="tablist" aria-label="Qué quieres buscar" className="mb-3 flex flex-wrap justify-center gap-2 sm:justify-start">
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            id={`buscador-tab-${m.id}`}
            aria-selected={modo === m.id}
            aria-controls="buscador-panel"
            onClick={() => setModo(m.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-bold transition ${modo === m.id ? "border-ink bg-ink text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"}`}
          >
            <span aria-hidden>{m.emoji}</span> {m.etiqueta}
          </button>
        ))}
      </div>

      <div id="buscador-panel" role="tabpanel" aria-labelledby={`buscador-tab-${modo}`}>
        {c === null ? (
          <SearchBar />
        ) : (
          <form
            key={modo}
            action={c.accion}
            method="get"
            role="search"
            aria-label={`Buscar en ${MODOS.find((m) => m.id === modo)?.etiqueta}`}
            className="grid gap-1 rounded-[1.75rem] bg-white p-2 shadow-[0_24px_60px_-24px_rgb(2_7_14/0.35)] ring-1 ring-slate-200/80 sm:grid-cols-[1fr_14rem_auto] sm:items-center sm:rounded-full"
          >
            <div className="rounded-2xl px-5 py-2.5 transition-colors focus-within:bg-brand-50/70 hover:bg-slate-50 sm:rounded-full">
              <label htmlFor="bu-q" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                ¿Qué buscas?
              </label>
              <input id="bu-q" name="q" type="search" required={modo === "todo"} minLength={modo === "todo" ? 2 : undefined} maxLength={60} autoComplete="off" placeholder={c.placeholder} className={campo} />
            </div>
            <div className="rounded-2xl px-5 py-2.5 transition-colors focus-within:bg-brand-50/70 hover:bg-slate-50 sm:rounded-full sm:border-l sm:border-slate-200">
              <label htmlFor="bu-zona" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Zona
              </label>
              <select id="bu-zona" name="zona" defaultValue="" className={campo}>
                <option value="">Toda la ciudad</option>
                {ZONAS.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="boton-marca flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-[15px] font-bold text-white sm:ml-1 sm:py-4">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              Buscar
            </button>
            {c.filtro && (
              <label className="flex items-center gap-2 px-5 pb-1.5 text-sm font-semibold text-slate-600 sm:col-span-3 sm:pb-2">
                <input type="checkbox" name={c.filtro.nombre} value="1" className="h-4 w-4 accent-brand-600" />
                {c.filtro.etiqueta}
              </label>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
