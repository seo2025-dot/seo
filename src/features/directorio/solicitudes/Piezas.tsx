"use client";

import Link from "next/link";
import { VERTICAL_POR_ID, etiquetaSubtipo } from "@/data/directorio";
import { InsigniaVerificado, Valoracion } from "@/features/directorio/Insignias";
import type { Oferente } from "@/features/directorio/solicitudes/useSolicitudes";
import { textoDinero } from "@/lib/directorio/mapeo";
import {
  ETIQUETA_ESTADO_OFERTA, ETIQUETA_ESTADO_SOLICITUD, estadoVisible, resumenDetalles, textoMomento, textoTiempoOferta, tiempoRestante, type Oferta, type Solicitud,
} from "@/lib/directorio/solicitudes";

export function InsigniaEstadoSolicitud({ solicitud, ahora }: { solicitud: Pick<Solicitud, "estado" | "caduca">; ahora: number }) {
  const e = ETIQUETA_ESTADO_SOLICITUD[estadoVisible(solicitud, ahora)];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${e.clase}`}>{e.etiqueta}</span>;
}

export function InsigniaEstadoOferta({ estado }: { estado: Oferta["estado"] }) {
  const e = ETIQUETA_ESTADO_OFERTA[estado];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${e.clase}`}>{e.etiqueta}</span>;
}

/** Los datos de la solicitud en una lista de descripción: qué, dónde, cuándo, presupuesto y detalles. */
export function DatosSolicitud({ s, ahora }: { s: Solicitud; ahora: number }) {
  const v = VERTICAL_POR_ID[s.vertical];
  const detalles = resumenDetalles(s.vertical, s.subtipo, s.detalles);
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Categoría</dt>
        <dd className="text-ink">
          {v.emoji} {etiquetaSubtipo(s.vertical, s.subtipo)}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.destino ? "Ruta" : "Zona"}</dt>
        <dd className="text-ink">
          📍 {s.zona || "—"}
          {s.destino && <> → {s.destino}</>}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cuándo</dt>
        <dd className="text-ink">{textoMomento(s)}</dd>
      </div>
      {s.presupuesto !== undefined && (
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Presupuesto</dt>
          <dd className="text-ink">hasta {textoDinero(s.presupuesto)}</dd>
        </div>
      )}
      {detalles && (
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Detalles</dt>
          <dd className="text-ink">{detalles}</dd>
        </div>
      )}
      {s.estado === "open" && (
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ofertas</dt>
          <dd className="text-ink">{tiempoRestante(s.caduca, ahora)}</dd>
        </div>
      )}
    </dl>
  );
}

/** Quién ofrece: nombre (con enlace a su ficha si es público), valoración e insignia de verificado. */
export function Oferente_({ o }: { o?: Oferente }) {
  if (!o) return <span className="font-bold text-ink">Profesional</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Link href={`/directorio/${o.vertical}/${o.slug}`} className="font-bold text-ink hover:text-brand-700 hover:underline">
        {o.nombre}
      </Link>
      {o.verificado && <InsigniaVerificado />}
      {o.resenas > 0 && <Valoracion rating={o.rating} resenas={o.resenas} />}
    </span>
  );
}

export const textoOferta = (o: Pick<Oferta, "precio" | "minutos">) => `${textoDinero(o.precio)} · ${textoTiempoOferta(o.minutos)}`;
