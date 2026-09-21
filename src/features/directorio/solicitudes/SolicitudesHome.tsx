"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VERTICAL_POR_ID, etiquetaSubtipo } from "@/data/directorio";
import { useAhora } from "@/features/directorio/pedidos/Piezas";
import { InsigniaEstadoOferta, InsigniaEstadoSolicitud, textoOferta } from "@/features/directorio/solicitudes/Piezas";
import { useMisPerfiles, useMisSolicitudes, useSolicitudesParaMi } from "@/features/directorio/solicitudes/useSolicitudes";
import { textoDinero } from "@/lib/directorio/mapeo";
import { estadoVisible, resumenDetalles, textoMomento, tiempoRestante, type Solicitud } from "@/lib/directorio/solicitudes";

type Vista = "mis" | "negocio";

function Vacio({ emoji, titulo, texto, accion }: { emoji: string; titulo: string; texto: string; accion?: { href: string; etiqueta: string } }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center">
      <p className="text-4xl" aria-hidden>
        {emoji}
      </p>
      <p className="mt-3 font-bold text-ink">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{texto}</p>
      {accion && (
        <Link href={accion.href} className="boton-marca mt-5 inline-block rounded-full px-7 py-3 text-sm font-bold text-white">
          {accion.etiqueta}
        </Link>
      )}
    </div>
  );
}

function Resumen({ s }: { s: Solicitud }) {
  const v = VERTICAL_POR_ID[s.vertical];
  const detalles = resumenDetalles(s.vertical, s.subtipo, s.detalles);
  return (
    <p className="text-xs text-slate-500">
      {v.emoji} {etiquetaSubtipo(s.vertical, s.subtipo)} · 📍 {s.zona || "—"}
      {s.destino && <> → {s.destino}</>} · {textoMomento(s)}
      {s.presupuesto !== undefined && <> · hasta {textoDinero(s.presupuesto)}</>}
      {detalles && <> · {detalles}</>}
    </p>
  );
}

/** «Solicitudes»: lo que pediste y las ofertas que recibiste, y —si tienes un negocio— lo que piden en tu categoría. */
export default function SolicitudesHome() {
  const ahora = useAhora();
  const propias = useMisSolicitudes();
  const mios = useMisPerfiles();
  const paraMi = useSolicitudesParaMi(mios?.perfiles ?? null);
  const tienePerfiles = (mios?.perfiles.some((p) => p.estado === "active") ?? false);
  const [vista, setVista] = useState<Vista | null>(null);

  // Al abrir: si no has pedido nada pero tienes un negocio, lo más útil es ver lo que piden a tu categoría.
  useEffect(() => {
    if (vista === null && propias.lista !== null && mios !== null) setVista(propias.lista.length === 0 && tienePerfiles ? "negocio" : "mis");
  }, [vista, propias.lista, mios, tienePerfiles]);

  const pendientes = (paraMi.lista ?? []).filter((s) => !s.miOferta && estadoVisible(s, ahora) === "open").length;
  const actual: Vista = vista ?? "mis";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-ink">Solicitudes</h1>
          <p className="text-slate-500">Pide ofertas de taxis, encomiendas, reparaciones y cuidado de mascotas.</p>
        </div>
        <Link href="/directorio/solicitudes/nueva" className="boton-marca rounded-full px-6 py-2.5 text-sm font-bold text-white">
          + Pedir ofertas
        </Link>
      </header>

      {(propias.error || paraMi.error) && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {propias.error ?? paraMi.error}
        </p>
      )}

      <div role="tablist" aria-label="Vista" className="mt-6 flex gap-1 rounded-full bg-slate-100 p-1">
        {(
          [
            ["mis", "Mis solicitudes"],
            ["negocio", "Para mi negocio"],
          ] as const
        ).map(([id, etiqueta]) => (
          <button key={id} type="button" role="tab" aria-selected={actual === id} onClick={() => setVista(id)} className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${actual === id ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`}>
            {etiqueta}
            {id === "negocio" && pendientes > 0 && <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-black text-white">{pendientes}</span>}
          </button>
        ))}
      </div>

      {actual === "mis" ? (
        <section role="tabpanel" aria-label="Mis solicitudes" className="mt-5">
          {propias.cargando ? (
            <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
          ) : (propias.lista ?? []).length === 0 ? (
            <Vacio emoji="🙋" titulo="Todavía no has pedido nada" texto="Cuéntanos qué necesitas —un plomero, un viaje al aeropuerto, un paseador— y los profesionales te responden con su precio." accion={{ href: "/directorio/solicitudes/nueva", etiqueta: "Pedir ofertas" }} />
          ) : (
            <ul className="space-y-3">
              {(propias.lista ?? []).map((s) => (
                <li key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/directorio/solicitudes/${s.id}`} className="min-w-0 truncate font-black text-ink hover:text-brand-700">
                      {s.titulo}
                    </Link>
                    <InsigniaEstadoSolicitud solicitud={s} ahora={ahora} />
                  </div>
                  <Resumen s={s} />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-600">
                      {s.ofertasNuevas > 0 ? <span className="text-brand-700">💬 {s.ofertasNuevas} {s.ofertasNuevas === 1 ? "oferta" : "ofertas"} para revisar</span> : estadoVisible(s, ahora) === "open" ? `Esperando ofertas · ${tiempoRestante(s.caduca, ahora)}` : ""}
                    </p>
                    <Link href={`/directorio/solicitudes/${s.id}`} className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-bold text-ink hover:border-brand-400">
                      {s.ofertasNuevas > 0 ? "Ver ofertas" : "Ver solicitud"}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section role="tabpanel" aria-label="Para mi negocio" className="mt-5">
          {mios === null || paraMi.lista === null ? (
            <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
          ) : !tienePerfiles ? (
            <Vacio emoji="🛠️" titulo="Recibe solicitudes de tu categoría" texto="Si eres plomero, taxista, paseador o ofreces otro servicio, registra tu perfil gratis: te avisamos cuando alguien pida lo que haces." accion={{ href: "/directorio/mi-negocio/nuevo", etiqueta: "Registrar mi perfil" }} />
          ) : paraMi.lista.length === 0 ? (
            <Vacio emoji="🔔" titulo="No hay solicitudes abiertas para tus categorías" texto="Te avisaremos por notificación en cuanto alguien pida lo que ofreces. Esta lista se actualiza sola." />
          ) : (
            <ul className="space-y-3">
              {paraMi.lista.map((s) => (
                <li key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/directorio/solicitudes/${s.id}`} className="min-w-0 truncate font-black text-ink hover:text-brand-700">
                      {s.titulo}
                    </Link>
                    {s.miOferta ? <InsigniaEstadoOferta estado={s.miOferta.estado} /> : <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Nueva</span>}
                  </div>
                  <Resumen s={s} />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-600">
                      {s.solicitante ?? "Alguien"} · {tiempoRestante(s.caduca, ahora)}
                      {s.miOferta && <> · tu oferta: <span className="font-bold">{textoOferta(s.miOferta)}</span></>}
                    </p>
                    <Link href={`/directorio/solicitudes/${s.id}`} className="boton-marca rounded-full px-5 py-1.5 text-xs font-bold text-white">
                      {s.miOferta ? "Ver mi oferta" : "Ofertar"}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
