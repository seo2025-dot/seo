import type { CompletitudNegocio } from "@/lib/directorio/completitud";

/** Barra «X % completo» del negocio con lo que más suma para completarlo. */
export default function MedidorNegocio({ c, compacto = false }: { c: CompletitudNegocio; compacto?: boolean }) {
  const completo = c.porcentaje >= 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-ink">{completo ? "Perfil completo ✓" : "Tu perfil está completo al"}</p>
        <p className="text-xl font-black tabular-nums text-ink">{c.porcentaje}%</p>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Perfil completado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.porcentaje}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${completo ? "bg-emerald-500" : "bg-marca"}`} style={{ width: `${c.porcentaje}%` }} />
      </div>
      {!compacto && !completo && (
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          {c.faltantes.slice(0, 3).map((f) => (
            <li key={f.id} className="flex gap-2">
              <span aria-hidden className="text-brand-600">
                +
              </span>
              <span>
                <strong className="font-semibold text-ink">{f.etiqueta}:</strong> {f.ayuda}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
