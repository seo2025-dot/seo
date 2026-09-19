/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ItemFoto } from "@/features/fotos/tipos";
import { EXTENSIONES_PERMITIDAS, MAX_BYTES, MAX_FOTOS, MIN_LADO, TIPOS_PERMITIDOS, validarArchivoCliente } from "@/lib/media/config";

const firma = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

/** Lee las dimensiones para avisar al momento (el servidor las vuelve a comprobar). */
function medir(preview: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = preview;
  });
}

/**
 * Selector de hasta 10 fotos: elegir varias o arrastrarlas, previsualizar, reordenar (arrastrando o con botones,
 * accesible por teclado) y eliminar. La primera es la foto principal. No sube nada: eso lo hace `sincronizarFotos`.
 */
export default function GaleriaFotos({
  items,
  onChange,
  max = MAX_FOTOS,
  deshabilitado = false,
}: {
  items: ItemFoto[];
  onChange: (items: ItemFoto[]) => void;
  max?: number;
  deshabilitado?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [zonaActiva, setZonaActiva] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Libera las URLs de previsualización al desmontar.
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => i.tipo === "nueva" && URL.revokeObjectURL(i.preview));
    },
    [],
  );

  const agregar = useCallback(
    async (archivos: File[]) => {
      const nuevosErrores: string[] = [];
      const actuales = itemsRef.current;
      const existentes = new Set(actuales.flatMap((i) => (i.tipo === "nueva" ? [firma(i.file)] : [])));
      const aceptados: ItemFoto[] = [];
      for (const f of archivos) {
        if (actuales.length + aceptados.length >= max) {
          nuevosErrores.push(`«${f.name}»: ya tienes el máximo de ${max} fotos.`);
          continue;
        }
        const problema = validarArchivoCliente(f);
        if (problema) {
          nuevosErrores.push(`«${f.name}»: ${problema}`);
          continue;
        }
        if (existentes.has(firma(f))) {
          nuevosErrores.push(`«${f.name}»: ya la has añadido.`);
          continue;
        }
        const preview = URL.createObjectURL(f);
        const medida = await medir(preview);
        if (!medida) {
          URL.revokeObjectURL(preview);
          nuevosErrores.push(`«${f.name}»: no se pudo leer la imagen.`);
          continue;
        }
        if (Math.min(medida.w, medida.h) < MIN_LADO) {
          URL.revokeObjectURL(preview);
          nuevosErrores.push(`«${f.name}»: es demasiado pequeña (${medida.w}×${medida.h}); mínimo ${MIN_LADO} px en el lado corto.`);
          continue;
        }
        existentes.add(firma(f));
        aceptados.push({ key: crypto.randomUUID(), tipo: "nueva", file: f, preview });
      }
      setErrores(nuevosErrores);
      if (aceptados.length > 0) {
        onChange([...itemsRef.current, ...aceptados]);
        setAnuncio(`${aceptados.length} ${aceptados.length === 1 ? "foto añadida" : "fotos añadidas"}.`);
      }
    },
    [max, onChange],
  );

  const mover = (desde: number, hasta: number) => {
    if (hasta < 0 || hasta >= items.length || desde === hasta) return;
    const copia = [...items];
    const [x] = copia.splice(desde, 1);
    copia.splice(hasta, 0, x);
    onChange(copia);
    setAnuncio(`Foto movida a la posición ${hasta + 1} de ${copia.length}.`);
  };

  const quitar = (i: number) => {
    const item = items[i];
    if (item.tipo === "nueva") URL.revokeObjectURL(item.preview);
    onChange(items.filter((_, j) => j !== i));
    setErrores([]);
    setAnuncio("Foto eliminada.");
  };

  const alSoltarArchivos = (e: React.DragEvent) => {
    e.preventDefault();
    setZonaActiva(false);
    if (deshabilitado) return;
    const archivos = Array.from(e.dataTransfer.files);
    if (archivos.length) void agregar(archivos);
  };

  const lleno = items.length >= max;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700" id="titulo-galeria">
          Tus fotos
        </span>
        <span className={`tabular-nums ${lleno ? "font-semibold text-emerald-600" : "text-slate-500"}`} aria-live="polite">
          {items.length}/{max}
        </span>
      </div>

      {!lleno && (
        <div
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setZonaActiva(true);
            }
          }}
          onDragLeave={() => setZonaActiva(false)}
          onDrop={alSoltarArchivos}
          className={`mb-4 rounded-2xl border-2 border-dashed p-6 text-center transition ${zonaActiva ? "border-brand-500 bg-brand-50" : "border-slate-300"}`}
        >
          <p className="text-3xl" aria-hidden>
            📸
          </p>
          <p className="mt-1 text-sm text-slate-600">Arrastra tus fotos aquí o</p>
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => input.current?.click()}
            className="mt-2 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Elegir fotos
          </button>
          <p className="mt-2 text-xs text-slate-400">
            {EXTENSIONES_PERMITIDAS} · máx. {MAX_BYTES / 1024 / 1024} MB cada una · mínimo {MIN_LADO} px
          </p>
          <input
            ref={input}
            type="file"
            multiple
            accept={TIPOS_PERMITIDOS.join(",")}
            aria-labelledby="titulo-galeria"
            className="hidden"
            onChange={(e) => {
              const archivos = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (archivos.length) void agregar(archivos);
            }}
          />
        </div>
      )}

      {errores.length > 0 && (
        <ul role="alert" className="mb-3 space-y-1 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5" aria-label="Fotos, en orden de aparición">
            {items.map((item, i) => (
              <li
                key={item.key}
                draggable={!deshabilitado}
                onDragStart={(e) => {
                  setArrastrando(item.key);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", item.key);
                }}
                onDragOver={(e) => {
                  if (arrastrando && !e.dataTransfer.types.includes("Files")) {
                    e.preventDefault();
                    setSobre(item.key);
                  }
                }}
                onDragLeave={() => setSobre((s) => (s === item.key ? null : s))}
                onDrop={(e) => {
                  if (!arrastrando) return;
                  e.preventDefault();
                  const desde = items.findIndex((x) => x.key === arrastrando);
                  setArrastrando(null);
                  setSobre(null);
                  mover(desde, i);
                }}
                onDragEnd={() => {
                  setArrastrando(null);
                  setSobre(null);
                }}
                className={`group relative aspect-[4/5] cursor-grab overflow-hidden rounded-xl bg-slate-100 ring-2 transition ${
                  sobre === item.key ? "ring-brand-500" : "ring-transparent"
                } ${arrastrando === item.key ? "opacity-40" : ""}`}
              >
                <img
                  src={item.tipo === "nueva" ? item.preview : item.thumbUrl}
                  alt={`Foto ${i + 1}${i === 0 ? " (principal)" : ""}`}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-black/60 px-1.5 text-xs font-bold text-white">
                  {i + 1}
                </span>
                {i === 0 && (
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">Principal</span>
                )}
                {item.tipo === "nueva" && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">Nueva</span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-6">
                  <button
                    type="button"
                    onClick={() => mover(i, i - 1)}
                    disabled={deshabilitado || i === 0}
                    aria-label={`Mover la foto ${i + 1} a la izquierda`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm font-bold disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, i + 1)}
                    disabled={deshabilitado || i === items.length - 1}
                    aria-label={`Mover la foto ${i + 1} a la derecha`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm font-bold disabled:opacity-30"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => quitar(i)}
                    disabled={deshabilitado}
                    aria-label={`Eliminar la foto ${i + 1}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-sm font-bold text-white disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-slate-400">Arrastra una foto sobre otra (o usa las flechas) para cambiar el orden. La primera es tu foto principal.</p>
        </>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>
    </div>
  );
}
