import { medallaDe } from "@/lib/comunidad";

/** Insignia de fama: las personas más activas de los últimos 30 días (ranking real, sin perfiles demo). */
export default function TopConectorBadge({ puesto, compacto = false }: { puesto: number; compacto?: boolean }) {
  const medalla = medallaDe(puesto);
  return (
    <span
      title={`Top Conector: puesto ${puesto} en actividad de la comunidad este mes`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-sun to-mango px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-ink"
    >
      <span aria-hidden>{medalla ?? "🏆"}</span>
      {compacto ? <span className="sr-only">Top Conector</span> : "Top Conector"}
    </span>
  );
}
