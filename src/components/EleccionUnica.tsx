"use client";

interface Props<T extends string> {
  /** Pregunta (la lee el lector de pantalla como título del grupo). */
  leyenda: string;
  nombre: string;
  opciones: readonly { id: T; etiqueta: string }[];
  valor: T | "" | null | undefined;
  onChange: (v: T) => void;
  error?: string;
  ayuda?: string;
}

/** Elección de una sola opción (botones de radio con forma de píldora): género, a quién quiere conocer… */
export default function EleccionUnica<T extends string>({ leyenda, nombre, opciones, valor, onChange, error, ayuda }: Props<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">{leyenda}</legend>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <label key={o.id} className="cursor-pointer">
            <input type="radio" name={nombre} value={o.id} checked={valor === o.id} onChange={() => onChange(o.id)} className="peer sr-only" />
            <span className="inline-block rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 hover:border-brand-400">
              {o.etiqueta}
            </span>
          </label>
        ))}
      </div>
      {ayuda && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
