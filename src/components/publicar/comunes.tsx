/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import { comprimirImagen } from "@/lib/imagen";
import Icono from "@/components/Icono";

export const campoCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function Campo({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function Chips({
  opciones,
  valor,
  onChange,
  multiple = false,
  color = "brand",
}: {
  opciones: { id: string; label: string }[];
  valor: string | string[];
  onChange: (v: string) => void;
  multiple?: boolean;
  color?: "brand" | "emerald";
}) {
  const activo = (id: string) => (multiple ? (valor as string[]).includes(id) : valor === id);
  const on = color === "brand" ? "border-brand-600 bg-brand-600 text-white" : "border-emerald-600 bg-emerald-600 text-white";
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={activo(o.id)}
          onClick={() => onChange(o.id)}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${activo(o.id) ? on : "border-slate-200 hover:border-brand-300"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SelectorFotos({
  fotos,
  onChange,
  max,
  error,
}: {
  fotos: string[];
  onChange: (f: string[]) => void;
  max: number;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  const agregar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? []).slice(0, max - fotos.length);
    e.target.value = "";
    if (archivos.length === 0) return;
    setSubiendo(true);
    setErrorFoto(null);
    const resultados = await Promise.allSettled(archivos.map((a) => comprimirImagen(a)));
    const ok = resultados.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (ok.length < archivos.length) setErrorFoto("Algunos archivos no se pudieron cargar (¿son imágenes?).");
    onChange([...fotos, ...ok].slice(0, max));
    setSubiendo(false);
  };

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">
        Fotos ({fotos.length}/{max}) — la primera es la portada
      </legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fotos.map((f, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
            <img src={f} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Portada</span>}
            <button
              type="button"
              onClick={() => onChange(fotos.filter((_, j) => j !== i))}
              aria-label={`Quitar foto ${i + 1}`}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <Icono nombre="x" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {fotos.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={subiendo}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-500 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-50"
          >
            <Icono nombre="foto" className="h-6 w-6" />
            {subiendo ? "Procesando…" : "Añadir foto"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple onChange={agregar} className="hidden" />
      {(error || errorFoto) && (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          {error ?? errorFoto}
        </p>
      )}
    </fieldset>
  );
}

export function CasillaRelampago({ activa, onChange }: { activa: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <input type="checkbox" checked={activa} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-amber-500" />
      <span className="text-sm">
        <strong>⚡ Activar Oferta Relámpago (−10 %)</strong>
        <span className="block text-slate-600">
          Tu anuncio mostrará el precio con descuento y una cuenta regresiva hasta el fin del día. Atrae más consultas.
        </span>
      </span>
    </label>
  );
}

export function BotonPublicar({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-xl bg-brand-600 px-6 py-4 text-lg font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Lleva el foco al primer error visible tras validar. */
export function irAlPrimerError() {
  document.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
}
