/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { VERTICAL_POR_ID, etiquetaSubtipo, rutaProveedor } from "@/data/directorio";
import { InsigniaAbierto, InsigniaTurno, InsigniaVerificado, Valoracion } from "@/features/directorio/Insignias";
import { textoDinero } from "@/lib/directorio/mapeo";
import type { ResultadoLista } from "@/types/directorio";

/** Tarjeta de un negocio en listados. Sin JavaScript: se renderiza en el servidor. */
export default function TarjetaProveedor({ p, prioridad = false }: { p: ResultadoLista; prioridad?: boolean }) {
  const v = VERTICAL_POR_ID[p.vertical];
  const emoji = v.subtipos.find((s) => s.id === p.subtipo)?.emoji ?? v.emoji;
  const entrega = p.canales.includes("entrega");
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={rutaProveedor(p.vertical, p.slug)} className="relative block h-32 bg-gradient-to-br from-slate-100 to-slate-200" aria-label={`Ver ${p.nombre}`}>
        {p.portadaUrl ? (
          <img src={p.portadaUrl} alt="" loading={prioridad ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <span aria-hidden className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${v.degradado} text-5xl opacity-90`}>
            {emoji}
          </span>
        )}
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {p.deTurno && <InsigniaTurno verificado={p.verificado} />}
          {p.impulsado && <span className="rounded-full bg-sun px-2 py-0.5 text-[11px] font-black text-ink">Destacado</span>}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-3">
          {p.logoUrl ? (
            <img src={p.logoUrl} alt="" loading="lazy" className="-mt-9 h-14 w-14 shrink-0 rounded-xl border-2 border-white bg-white object-cover shadow" />
          ) : (
            <span aria-hidden className="-mt-9 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-white bg-white text-2xl shadow">
              {emoji}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-black leading-tight text-ink">
              <Link href={rutaProveedor(p.vertical, p.slug)} className="hover:underline">
                {p.nombre}
              </Link>
            </h3>
            <p className="truncate text-xs text-slate-500">
              {etiquetaSubtipo(p.vertical, p.subtipo)}
              {p.zona && <> · 📍 {p.zona}</>}
              {p.distanciaKm !== undefined && <> · {p.distanciaKm < 1 ? `${Math.round(p.distanciaKm * 1000)} m` : `${p.distanciaKm.toFixed(1)} km`}</>}
            </p>
          </div>
        </div>

        {p.descripcion && <p className="line-clamp-2 text-sm text-slate-600">{p.descripcion}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <InsigniaAbierto abierto={p.abiertoAhora} />
          {p.verificado && <InsigniaVerificado />}
          <Valoracion rating={p.rating} resenas={p.resenas} className="ml-auto" />
        </div>

        {entrega && (
          <p className="text-[11px] font-medium text-slate-500">
            🛵 A domicilio · envío {p.costoEnvio > 0 ? textoDinero(p.costoEnvio) : "gratis"}
            {p.pedidoMinimo > 0 && <> · mínimo {textoDinero(p.pedidoMinimo)}</>}
          </p>
        )}
      </div>
    </article>
  );
}
