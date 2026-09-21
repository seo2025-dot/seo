"use client";

import { useState } from "react";
import Link from "next/link";
import ControlAcceso from "@/features/directorio/eventos/ControlAcceso";
import { useMisEventos, useMisOrganizadores, type EventoDelPanel } from "@/features/directorio/eventos/useEventosPanel";
import { categoriaEvento, faseEvento, mensajeErrorEventos, ocupacion, resumenAsistentes, textoFechaCorta, textoPrecioEvento } from "@/lib/directorio/eventos";
import { supabase } from "@/lib/supabaseClient";

const FASE = {
  proximo: { texto: "Próximo", clase: "bg-emerald-50 text-emerald-700" },
  en_curso: { texto: "En curso", clase: "bg-rose-50 text-rose-700" },
  finalizado: { texto: "Finalizado", clase: "bg-slate-100 text-slate-600" },
  cancelado: { texto: "Cancelado", clase: "bg-rose-50 text-rose-700" },
} as const;

function TarjetaMiEvento({ e, onCancelar, ocupado }: { e: EventoDelPanel; onCancelar: (e: EventoDelPanel) => void; ocupado: boolean }) {
  const fase = faseEvento(e.evento);
  const r = resumenAsistentes(e.reservas);
  const cupo = e.tipos.reduce((n, t) => n + t.cupo, 0);
  const vendidas = e.tipos.reduce((n, t) => n + t.vendidas, 0);
  const cat = categoriaEvento(e.evento.categoria);
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{textoFechaCorta(e.evento.inicia)}</p>
          <h3 className="truncate text-lg font-black text-ink">{e.evento.titulo}</h3>
          <p className="text-xs text-slate-500">
            {cat.emoji} {cat.etiqueta} · 📍 {e.evento.lugar || "Sin lugar"} · {textoPrecioEvento(e.evento, e.tipos)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${FASE[fase].clase}`}>{FASE[fase].texto}</span>
      </div>

      {e.tipos.length > 0 ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              <strong className="text-ink">{r.reservadas}</strong> reservadas · <strong className="text-ink">{r.ingresaron}</strong> ya ingresaron
            </span>
            <span>{cupo > 0 ? `${vendidas}/${cupo} del cupo` : ""}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ocupacion({ cupo, vendidas })} aria-label="Cupo reservado">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${ocupacion({ cupo, vendidas })}%` }} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">{e.evento.gratis ? "Entrada libre" : e.evento.enlaceEntradas ? "Entradas en el sitio del organizador" : "Aún sin tipos de entrada"}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/directorio/mi-negocio/eventos/${e.evento.id}`} className="boton-marca rounded-full px-5 py-2 text-sm font-bold text-white">
          {fase === "cancelado" || fase === "finalizado" ? "Ver" : "Editar y asistentes"}
        </Link>
        {e.evento.estado === "published" && (
          <Link href={`/directorio/evento/${e.evento.id}`} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-ink hover:border-brand-400">
            Ver página pública
          </Link>
        )}
        {e.evento.estado === "published" && fase !== "finalizado" && (
          <button type="button" disabled={ocupado} onClick={() => onCancelar(e)} className="rounded-full px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
            Cancelar evento
          </button>
        )}
      </div>
    </li>
  );
}

/** «Mis eventos»: los eventos que publicas, sus reservas, el control de acceso y la creación de nuevos. */
export default function PanelEventos() {
  const { organizadores, error: errorOrg } = useMisOrganizadores();
  const { eventos, error, recargar, cargando } = useMisEventos();
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  if (cargando || organizadores === null) return <div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-10" />;

  const cancelar = async (e: EventoDelPanel) => {
    const n = e.reservas.filter((r) => r.estado === "reserved").length;
    const aviso = n > 0 ? `Se cancelarán ${n} ${n === 1 ? "reserva" : "reservas"} y se avisará a ${n === 1 ? "esa persona" : "esas personas"}.` : "Nadie tiene reservas todavía.";
    if (!window.confirm(`¿Cancelar «${e.evento.titulo}»? ${aviso} Esta acción no se puede deshacer.`)) return;
    setOcupado(true);
    setFallo(null);
    const { error: err } = await supabase().rpc("cancel_event", { p_event: e.evento.id });
    setOcupado(false);
    if (err) setFallo(mensajeErrorEventos(err.message));
    void recargar();
  };

  const lista = eventos ?? [];
  const proximos = lista.filter((e) => e.evento.estado === "published" && faseEvento(e.evento) !== "finalizado").sort((a, b) => a.evento.inicia - b.evento.inicia);
  const pasados = lista.filter((e) => !proximos.includes(e));
  const sinPerfil = organizadores.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm">
        <Link href="/directorio/mi-negocio" className="font-semibold text-brand-700 hover:underline">
          ← Mi negocio
        </Link>
      </p>
      <header className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-ink">Mis eventos</h1>
          <p className="text-slate-500">Publica eventos, gestiona el cupo y controla el acceso.</p>
        </div>
        {!sinPerfil && (
          <Link href="/directorio/mi-negocio/eventos/nuevo" className="boton-marca rounded-full px-6 py-2.5 text-sm font-bold text-white">
            + Publicar un evento
          </Link>
        )}
      </header>

      {(error || errorOrg || fallo) && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error ?? errorOrg ?? fallo}
        </p>
      )}

      {sinPerfil ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-4xl" aria-hidden>
            🎤
          </p>
          <p className="mt-3 font-bold text-ink">Primero crea tu perfil de organizador</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Es gratis y toma un par de minutos: nombre, zona y contacto. Después publicas todos los eventos que quieras. Ganas +30 🪙 con tu primer perfil.</p>
          <Link href="/directorio/mi-negocio/nuevo?seccion=eventos" className="boton-marca mt-5 inline-block rounded-full px-7 py-3 text-sm font-bold text-white">
            Crear mi perfil de organizador
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {proximos.length > 0 && <ControlAcceso />}

          <section aria-labelledby="ev-proximos">
            <h2 id="ev-proximos" className="mb-2 text-lg font-black text-ink">
              Próximos y en curso
            </h2>
            {proximos.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No tienes eventos próximos.{" "}
                <Link href="/directorio/mi-negocio/eventos/nuevo" className="font-bold text-brand-700 hover:underline">
                  Publica el primero →
                </Link>
              </p>
            ) : (
              <ul className="space-y-3">
                {proximos.map((e) => (
                  <TarjetaMiEvento key={e.evento.id} e={e} onCancelar={(x) => void cancelar(x)} ocupado={ocupado} />
                ))}
              </ul>
            )}
          </section>

          {pasados.length > 0 && (
            <section aria-labelledby="ev-pasados">
              <h2 id="ev-pasados" className="mb-2 text-lg font-black text-ink">
                Anteriores y cancelados
              </h2>
              <ul className="space-y-3">
                {pasados.map((e) => (
                  <TarjetaMiEvento key={e.evento.id} e={e} onCancelar={(x) => void cancelar(x)} ocupado={ocupado} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
