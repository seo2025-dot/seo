"use client";

/** Selector de opciones múltiples con botones tipo píldora. `max` limita cuántas se pueden marcar a la vez. */
export default function Chips<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
  color,
  max,
}: {
  opciones: readonly T[];
  valor: T[];
  onChange: (v: T[]) => void;
  etiqueta: (o: T) => string;
  color: string;
  max?: number;
}) {
  const lleno = max !== undefined && valor.length >= max;
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const activo = valor.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={activo}
            disabled={!activo && lleno}
            onClick={() => onChange(activo ? valor.filter((x) => x !== o) : [...valor, o])}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${activo ? color : "border-slate-200 hover:border-brand-300"}`}
          >
            {etiqueta(o)}
          </button>
        );
      })}
    </div>
  );
}
