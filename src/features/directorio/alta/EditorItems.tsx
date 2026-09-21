"use client";

import { VERTICAL_POR_ID, type VerticalId } from "@/data/directorio";
import { claseCampo } from "@/features/directorio/alta/Campos";
import { LIMITES, itemVacio, type BorradorItem, type Errores } from "@/lib/directorio/validacion";

/**
 * Editor rápido del catálogo del asistente de alta: una fila por plato o producto (nombre, precio y, si quieres, sección).
 * Las filas vacías se ignoran al publicar. Más elementos se pueden añadir después desde «Mi negocio».
 */
export default function EditorItems({ vertical, items, onChange, errores }: { vertical: VerticalId; items: BorradorItem[]; onChange: (i: BorradorItem[]) => void; errores: Errores }) {
  const plantilla = VERTICAL_POR_ID[vertical].plantilla;
  const esSalud = vertical === "salud";
  const cambiar = (idx: number, parche: Partial<BorradorItem>) => onChange(items.map((it, i) => (i === idx ? { ...it, ...parche } : it)));
  const yaEsta = (nombre: string) => items.some((i) => i.nombre.trim().toLowerCase() === nombre.toLowerCase());

  return (
    <div className="space-y-3">
      {plantilla.ejemplos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Añade un ejemplo para empezar:</span>
          {plantilla.ejemplos.map((e) => (
            <button
              key={e.nombre}
              type="button"
              disabled={yaEsta(e.nombre)}
              onClick={() => {
                const vacio = items.findIndex((i) => !i.nombre.trim() && !i.precio.trim());
                const nuevo: BorradorItem = { ...itemVacio(plantilla.secciones[0] ?? ""), nombre: e.nombre, precio: e.precio };
                onChange(vacio >= 0 ? items.map((it, i) => (i === vacio ? nuevo : it)) : [...items, nuevo]);
              }}
              className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-700 hover:border-brand-300 disabled:opacity-40"
            >
              + {e.nombre} (${e.precio})
            </button>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {items.map((it, idx) => {
          const err = (campo: string) => errores[`items.${idx}.${campo}`];
          return (
            <li key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_7rem_10rem_auto] sm:items-start">
                <div>
                  <label className="sr-only" htmlFor={`item-nombre-${idx}`}>
                    Nombre del {plantilla.item.singular} {idx + 1}
                  </label>
                  <input
                    id={`item-nombre-${idx}`}
                    value={it.nombre}
                    onChange={(e) => cambiar(idx, { nombre: e.target.value })}
                    maxLength={LIMITES.itemNombreMax}
                    placeholder={plantilla.ejemplos[idx % Math.max(1, plantilla.ejemplos.length)]?.nombre ?? `Nombre del ${plantilla.item.singular}`}
                    aria-invalid={!!err("nombre")}
                    className={claseCampo}
                  />
                  {err("nombre") && <p className="mt-1 text-xs font-semibold text-rose-600">{err("nombre")}</p>}
                </div>
                <div>
                  <label className="sr-only" htmlFor={`item-precio-${idx}`}>
                    Precio en dólares
                  </label>
                  <input id={`item-precio-${idx}`} value={it.precio} onChange={(e) => cambiar(idx, { precio: e.target.value })} inputMode="decimal" placeholder="$ 0.00" aria-invalid={!!err("precio")} className={claseCampo} />
                  {err("precio") && <p className="mt-1 text-xs font-semibold text-rose-600">{err("precio")}</p>}
                </div>
                <div>
                  <label className="sr-only" htmlFor={`item-seccion-${idx}`}>
                    Sección
                  </label>
                  <input id={`item-seccion-${idx}`} value={it.seccion} onChange={(e) => cambiar(idx, { seccion: e.target.value })} list={`secciones-${vertical}`} maxLength={LIMITES.seccionMax} placeholder="Sección (opcional)" className={claseCampo} />
                </div>
                <button type="button" onClick={() => onChange(items.filter((_, i) => i !== idx))} aria-label={`Quitar el ${plantilla.item.singular} ${idx + 1}`} className="rounded-lg px-2 py-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  ✕
                </button>
              </div>
              {esSalud && (
                <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input type="checkbox" checked={it.receta} onChange={(e) => cambiar(idx, { receta: e.target.checked })} className="h-4 w-4 accent-brand-600" />
                  ℞ Se vende solo con receta médica (se muestra como información; no se puede pedir por la app)
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <datalist id={`secciones-${vertical}`}>
        {plantilla.secciones.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {errores.items && (
        <p role="alert" className="text-xs font-semibold text-rose-600">
          {errores.items}
        </p>
      )}
      <button
        type="button"
        onClick={() => onChange([...items, itemVacio(items.at(-1)?.seccion ?? "")])}
        disabled={items.length >= LIMITES.itemsAlta}
        className="rounded-full border border-dashed border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:border-brand-400 disabled:opacity-40"
      >
        + Añadir otro {plantilla.item.singular}
      </button>
    </div>
  );
}
