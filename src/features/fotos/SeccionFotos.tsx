/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { useSocial } from "@/context/SocialContext";
import GaleriaFotos from "@/features/fotos/GaleriaFotos";
import { sincronizarFotos } from "@/features/fotos/sincronizar";
import type { ItemFoto } from "@/features/fotos/tipos";
import { useFotosPerfil } from "@/features/fotos/useFotosPerfil";
import Visor from "@/features/fotos/Visor";

/** Galería pública de un perfil (miniaturas + visor). Si es el tuyo, permite editarla (añadir, reordenar, eliminar). */
export default function SeccionFotos({ uid, esPropio }: { uid: string | null | undefined; esPropio: boolean }) {
  const { refrescarPerfil } = useSocial();
  const { fotos, cargando, recargar } = useFotosPerfil(uid);
  const [visor, setVisor] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [items, setItems] = useState<ItemFoto[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);
  const [errores, setErrores] = useState<string[]>([]);

  const empezar = () => {
    setItems(fotos.map((f) => ({ key: f.id, tipo: "guardada", id: f.id, url: f.url, thumbUrl: f.thumbUrl })));
    setErrores([]);
    setEditando(true);
  };

  const cancelar = () => {
    items.forEach((i) => i.tipo === "nueva" && URL.revokeObjectURL(i.preview));
    setEditando(false);
  };

  const guardar = async () => {
    setGuardando(true);
    setErrores([]);
    const r = await sincronizarFotos(items, fotos.map((f) => f.id), (hecho, total) => setProgreso({ hecho, total }));
    setProgreso(null);
    await Promise.all([recargar(), refrescarPerfil()]);
    setGuardando(false);
    if (r.errores.length > 0) {
      setErrores(r.errores);
      // Se conservan en pantalla solo las fotos que fallaron (las demás ya están guardadas).
      setItems((prev) =>
        prev.map<ItemFoto>((i) => {
          const s = r.subidas[i.key];
          if (i.tipo === "nueva" && s) {
            URL.revokeObjectURL(i.preview);
            return { key: i.key, tipo: "guardada", id: s.id, url: s.url, thumbUrl: s.thumbUrl };
          }
          return i;
        }),
      );
      return;
    }
    items.forEach((i) => i.tipo === "nueva" && URL.revokeObjectURL(i.preview));
    setEditando(false);
  };

  if (!esPropio && !cargando && fotos.length === 0) return null;

  return (
    <section aria-label="Fotos" className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">
          Fotos {fotos.length > 0 && <span className="font-normal text-slate-400">({fotos.length}/10)</span>}
        </h2>
        {esPropio && !editando && (
          <button type="button" onClick={empezar} className="rounded-full border border-slate-300 px-4 py-1 text-xs font-semibold hover:bg-slate-50">
            {fotos.length ? "Editar fotos" : "Añadir fotos"}
          </button>
        )}
      </div>

      {editando ? (
        <div className="rounded-2xl border border-brand-200 p-4">
          <GaleriaFotos items={items} onChange={setItems} deshabilitado={guardando} />
          {errores.length > 0 && (
            <ul role="alert" className="mt-3 list-disc space-y-1 rounded-xl bg-amber-50 p-3 pl-7 text-sm text-amber-900">
              {errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {progreso && (
            <p role="status" className="mt-3 text-sm text-slate-600">
              Guardando… {progreso.hecho} de {progreso.total}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={guardar} disabled={guardando} className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {guardando ? "Guardando…" : "Guardar fotos"}
            </button>
            <button type="button" onClick={cancelar} disabled={guardando} className="rounded-xl px-6 py-2.5 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
              Cancelar
            </button>
          </div>
        </div>
      ) : cargando ? (
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : fotos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">Aún no has añadido fotos.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {fotos.map((f, i) => (
            <li key={f.id}>
              <button type="button" onClick={() => setVisor(i)} aria-label={`Ver foto ${i + 1} de ${fotos.length}`} className="relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-slate-100 ring-brand-400 transition hover:ring-2">
                <img src={f.thumbUrl} alt={`Foto ${i + 1}`} loading="lazy" decoding="async" width={320} height={400} className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute bottom-1 left-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">Principal</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {visor !== null && <Visor fotos={fotos} inicio={visor} onCerrar={() => setVisor(null)} />}
    </section>
  );
}
