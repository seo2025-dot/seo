import type { DesgloseAfinidad } from "@/features/conexion/hooks";

const FILAS: { clave: keyof DesgloseAfinidad; etiqueta: string; corta: string }[] = [
  { clave: "valores", etiqueta: "Valores", corta: "Valores" },
  { clave: "estilo", etiqueta: "Estilo de vida", corta: "Estilo" },
  { clave: "relacion", etiqueta: "Tipo de relación", corta: "Relación" },
];

const colorDe = (v: number) => (v >= 60 ? "bg-emerald-500" : v >= 30 ? "bg-amber-400" : "bg-slate-400");

/**
 * Porcentaje de afinidad por dimensión (valores, estilo de vida, tipo de relación).
 * `sobreColor`: para tarjetas con fondo de color (texto blanco); usa tres columnas compactas para ocupar poco alto.
 * Un «—» significa que falta información de alguna de las dos personas: no se muestra un 0 % engañoso.
 */
export default function BarrasAfinidad({ desglose, sobreColor = false }: { desglose: DesgloseAfinidad; sobreColor?: boolean }) {
  const medidor = (etiqueta: string, v: number | null) => ({
    role: "meter" as const,
    "aria-label": `${etiqueta}: ${v === null ? "sin datos" : `${v}%`}`,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": v ?? undefined,
  });
  const ayuda = "Aún no hay datos suficientes para comparar";

  if (sobreColor) {
    return (
      <ul className="grid grid-cols-3 gap-3" aria-label="Afinidad por categoría">
        {FILAS.map(({ clave, etiqueta, corta }) => {
          const v = desglose[clave];
          return (
            <li key={clave} title={v === null ? ayuda : undefined}>
              <p className="flex items-baseline justify-between text-[11px]">
                <span className="font-medium text-white/85">{corta}</span>
                <span className={`font-bold tabular-nums ${v === null ? "text-white/60" : "text-white"}`}>{v === null ? "—" : `${v}%`}</span>
              </p>
              <div {...medidor(etiqueta, v)} className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/25">
                {v !== null && <div className="h-full rounded-full bg-white" style={{ width: `${v}%` }} />}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-1.5" aria-label="Afinidad por categoría">
      {FILAS.map(({ clave, etiqueta }) => {
        const v = desglose[clave];
        return (
          <li key={clave} title={v === null ? ayuda : undefined} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-[11px]">
            <span className="font-medium text-slate-600">{etiqueta}</span>
            <div {...medidor(etiqueta, v)} className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              {v !== null && <div className={`h-full rounded-full ${colorDe(v)}`} style={{ width: `${v}%` }} />}
            </div>
            <span className={`text-right font-bold tabular-nums ${v === null ? "text-slate-400" : "text-ink"}`}>{v === null ? "—" : `${v}%`}</span>
          </li>
        );
      })}
    </ul>
  );
}
