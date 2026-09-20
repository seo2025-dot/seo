"use client";

import { useState } from "react";
import { VERTICAL_POR_ID, type VerticalId } from "@/data/directorio";
import { claseCampo } from "@/features/directorio/alta/Campos";
import { mapearItem, type FilaItem } from "@/lib/directorio/mapeo";
import { LIMITES, numeroDecimal, validarItem, type BorradorItem } from "@/lib/directorio/validacion";
import { supabase } from "@/lib/supabaseClient";
import type { ItemCatalogo } from "@/types/directorio";

const sinClave = <T,>(o: Record<string, T>, clave: string): Record<string, T> => Object.fromEntries(Object.entries(o).filter(([k]) => k !== clave));

/** Gestión del catálogo de un negocio ya publicado: añadir, editar precio y nombre, marcar agotado y eliminar. Cada cambio se guarda al momento. */
export default function GestorCatalogo({ proveedorId, vertical, items, onChange }: { proveedorId: string; vertical: VerticalId; items: ItemCatalogo[]; onChange: (i: ItemCatalogo[]) => void }) {
  const v = VERTICAL_POR_ID[vertical];
  const tipo = v.plantilla.tipoItem;
  const [nuevo, setNuevo] = useState<BorradorItem>({ seccion: "", nombre: "", descripcion: "", precio: "", receta: false });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Record<string, { nombre: string; precio: string; seccion: string }>>({});

  const guardarError = (e: { message: string } | null) => {
    setError(e ? e.message : null);
    return !!e;
  };

  const anadir = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validarItem(nuevo, vertical);
    setErrores(err);
    if (Object.keys(err).length > 0) return;
    setOcupado("nuevo");
    const { data, error: fallo } = await supabase()
      .from("provider_items")
      .insert({
        provider_id: proveedorId,
        kind: tipo,
        section: nuevo.seccion.trim(),
        name: nuevo.nombre.trim(),
        description: nuevo.descripcion.trim(),
        price: numeroDecimal(nuevo.precio),
        unit: "unidad",
        available: true,
        requires_prescription: nuevo.receta,
        sort_order: items.length,
      })
      .select("*")
      .single();
    setOcupado(null);
    if (guardarError(fallo) || !data) return;
    onChange([...items, mapearItem(data as FilaItem)]);
    setNuevo({ seccion: nuevo.seccion, nombre: "", descripcion: "", precio: "", receta: false });
  };

  const actualizar = async (id: string, cambios: Record<string, unknown>) => {
    setOcupado(id);
    const { error: fallo } = await supabase().from("provider_items").update(cambios).eq("id", id);
    setOcupado(null);
    return !guardarError(fallo);
  };

  const alternarDisponible = async (i: ItemCatalogo) => {
    if (await actualizar(i.id, { available: !i.disponible })) onChange(items.map((x) => (x.id === i.id ? { ...x, disponible: !i.disponible } : x)));
  };

  const guardarEdicion = async (i: ItemCatalogo) => {
    const e = edicion[i.id];
    if (!e) return;
    const err = validarItem({ seccion: e.seccion, nombre: e.nombre, descripcion: "", precio: e.precio, receta: i.receta }, vertical);
    if (Object.keys(err).length > 0) {
      setError(Object.values(err)[0]);
      return;
    }
    if (await actualizar(i.id, { name: e.nombre.trim(), price: numeroDecimal(e.precio), section: e.seccion.trim() })) {
      onChange(items.map((x) => (x.id === i.id ? { ...x, nombre: e.nombre.trim(), precio: numeroDecimal(e.precio), seccion: e.seccion.trim() } : x)));
      setEdicion((prev) => sinClave(prev, i.id));
    }
  };

  const eliminar = async (i: ItemCatalogo) => {
    if (!window.confirm(`¿Eliminar «${i.nombre}»?`)) return;
    setOcupado(i.id);
    const { error: fallo } = await supabase().from("provider_items").delete().eq("id", i.id);
    setOcupado(null);
    if (!guardarError(fallo)) onChange(items.filter((x) => x.id !== i.id));
  };

  return (
    <div className="space-y-5">
      {v.plantilla.aviso && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">ℹ️ {v.plantilla.aviso}</p>}
      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <form onSubmit={anadir} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" noValidate>
        <h3 className="text-sm font-black text-ink">Añadir {v.plantilla.item.singular}</h3>
        <div className="grid gap-2 sm:grid-cols-[1fr_7rem_10rem]">
          <div>
            <label htmlFor="gc-nombre" className="sr-only">
              Nombre
            </label>
            <input id="gc-nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} maxLength={LIMITES.itemNombreMax} placeholder={v.plantilla.ejemplos[0]?.nombre ?? "Nombre"} aria-invalid={!!errores.nombre} className={claseCampo} />
            {errores.nombre && <p className="mt-1 text-xs font-semibold text-rose-600">{errores.nombre}</p>}
          </div>
          <div>
            <label htmlFor="gc-precio" className="sr-only">
              Precio
            </label>
            <input id="gc-precio" value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} inputMode="decimal" placeholder="$ 0.00" aria-invalid={!!errores.precio} className={claseCampo} />
            {errores.precio && <p className="mt-1 text-xs font-semibold text-rose-600">{errores.precio}</p>}
          </div>
          <div>
            <label htmlFor="gc-seccion" className="sr-only">
              Sección
            </label>
            <input id="gc-seccion" value={nuevo.seccion} onChange={(e) => setNuevo({ ...nuevo, seccion: e.target.value })} list="gc-secciones" placeholder="Sección" className={claseCampo} />
            <datalist id="gc-secciones">
              {[...new Set([...v.plantilla.secciones, ...items.map((i) => i.seccion).filter(Boolean)])].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>
        {vertical === "salud" && (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={nuevo.receta} onChange={(e) => setNuevo({ ...nuevo, receta: e.target.checked })} className="h-4 w-4 accent-brand-600" />℞ Solo con receta médica
          </label>
        )}
        <button type="submit" disabled={ocupado === "nuevo" || items.length >= LIMITES.itemsMax} className="boton-marca rounded-full px-6 py-2 text-sm font-bold text-white disabled:opacity-50">
          {ocupado === "nuevo" ? "Guardando…" : "Añadir"}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Todavía no has añadido nada. Empieza con lo que más vendes.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {items.map((i) => {
            const e = edicion[i.id];
            return (
              <li key={i.id} className={`flex flex-wrap items-center gap-2 p-3 ${i.disponible ? "" : "bg-slate-50"}`}>
                {e ? (
                  <>
                    <input aria-label="Nombre" value={e.nombre} onChange={(ev) => setEdicion({ ...edicion, [i.id]: { ...e, nombre: ev.target.value } })} className={`${claseCampo} min-w-40 flex-1`} />
                    <input aria-label="Precio" value={e.precio} onChange={(ev) => setEdicion({ ...edicion, [i.id]: { ...e, precio: ev.target.value } })} inputMode="decimal" className={`${claseCampo} w-24`} />
                    <input aria-label="Sección" value={e.seccion} onChange={(ev) => setEdicion({ ...edicion, [i.id]: { ...e, seccion: ev.target.value } })} className={`${claseCampo} w-36`} />
                    <button type="button" onClick={() => void guardarEdicion(i)} disabled={ocupado === i.id} className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                      Guardar
                    </button>
                    <button type="button" onClick={() => setEdicion((prev) => sinClave(prev, i.id))} className="text-xs text-slate-500 underline">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-40 flex-1">
                      <span className="block text-sm font-bold text-ink">{i.nombre}</span>
                      <span className="block text-xs text-slate-500">
                        {i.seccion || "Sin sección"}
                        {i.receta && " · ℞ con receta"}
                        {!i.disponible && " · agotado"}
                      </span>
                    </span>
                    <span className="w-20 text-right text-sm font-black tabular-nums">{i.precio === null ? "—" : `$${i.precio.toFixed(2)}`}</span>
                    <button type="button" onClick={() => setEdicion({ ...edicion, [i.id]: { nombre: i.nombre, precio: i.precio === null ? "" : String(i.precio), seccion: i.seccion } })} className="text-xs font-semibold text-brand-700 underline">
                      Editar
                    </button>
                    <button type="button" onClick={() => void alternarDisponible(i)} disabled={ocupado === i.id} className="text-xs font-semibold text-slate-600 underline">
                      {i.disponible ? "Marcar agotado" : "Marcar disponible"}
                    </button>
                    <button type="button" onClick={() => void eliminar(i)} disabled={ocupado === i.id} aria-label={`Eliminar ${i.nombre}`} className="text-xs text-slate-400 hover:text-rose-600">
                      ✕
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
