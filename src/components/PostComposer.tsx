/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import type { TipoPost } from "@/types/social";
import { ZONAS } from "@/data/catalogos";
import { useSocial } from "@/context/SocialContext";
import { comprimirImagen } from "@/lib/imagen";
import { ETIQUETA_POST } from "@/lib/social";
import Avatar from "@/components/Avatar";
import Icono from "@/components/Icono";

const TIPOS = Object.keys(ETIQUETA_POST) as TipoPost[];

export default function PostComposer() {
  const { estado, publicarPost } = useSocial();
  const [tipo, setTipo] = useState<TipoPost>("historia");
  const [texto, setTexto] = useState("");
  const [zona, setZona] = useState("");
  const [imagen, setImagen] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const elegirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setImagen(await comprimirImagen(f));
      setError(null);
    } catch {
      setError("No se pudo cargar esa imagen. Prueba con otra.");
    }
  };

  const publicar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    await publicarPost({ tipo, texto: texto.trim(), zona: zona.trim() || undefined, imagen });
    setTexto("");
    setZona("");
    setImagen(undefined);
  };

  return (
    <form onSubmit={publicar} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <Avatar nombre={estado.yo.nombre} foto={estado.yo.foto} />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          maxLength={600}
          placeholder="Comparte una historia, pregunta por una zona o muestra una propiedad…"
          aria-label="Contenido de la publicación"
          className="flex-1 resize-none rounded-xl bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {imagen && (
        <div className="relative mt-3">
          <img src={imagen} alt="Vista previa" className="max-h-64 w-full rounded-xl object-cover" />
          <button
            type="button"
            onClick={() => setImagen(undefined)}
            aria-label="Quitar foto"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <Icono nombre="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Tipo de publicación">
        {TIPOS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tipo === t}
            onClick={() => setTipo(t)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              tipo === t ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:border-brand-300"
            }`}
          >
            {ETIQUETA_POST[t].emoji} {ETIQUETA_POST[t].label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          list="zonas-composer"
          placeholder="📍 Zona (opcional)"
          aria-label="Zona"
          className="w-44 rounded-full border border-slate-200 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
        />
        <datalist id="zonas-composer">
          {ZONAS.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>

        <input ref={archivo} type="file" accept="image/*" onChange={elegirFoto} className="hidden" />
        <button
          type="button"
          onClick={() => archivo.current?.click()}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-brand-300"
        >
          <Icono nombre="foto" className="h-3.5 w-3.5" /> Foto
        </button>

        <button
          type="submit"
          disabled={!texto.trim()}
          className="ml-auto rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
        >
          Publicar
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          {error}
        </p>
      )}
    </form>
  );
}
