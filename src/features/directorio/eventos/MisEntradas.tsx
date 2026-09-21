"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import CodigoQR from "@/features/directorio/eventos/CodigoQR";
import {
  ETIQUETA_RESERVA, categoriaEvento, codigoLegible, faseEvento, mapearEvento, mapearReserva, mapearTipoEntrada, mensajeErrorEventos, puedeCancelarReserva, textoFechaCorta, textoPrecioEntrada,
  type Evento, type FilaEvento, type FilaReserva, type FilaTipoEntrada, type Reserva, type TipoEntrada,
} from "@/lib/directorio/eventos";
import { haySupabase, supabase } from "@/lib/supabaseClient";

interface Entrada {
  reserva: Reserva;
  evento?: Evento;
  tipo?: TipoEntrada;
}

/** «Mis entradas»: tus reservas con su código QR (para mostrar en la puerta) y los eventos que guardaste. */
export default function MisEntradas() {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [guardados, setGuardados] = useState<Evento[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    if (!uid || !haySupabase) return;
    const sb = supabase();
    // reservations_select también deja ver las reservas de tus propios eventos: se filtra por persona.
    const { data, error: err } = await sb.from("event_reservations").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(100);
    if (err) {
      setError(/schema cache|does not exist/i.test(err.message) ? "Aplica las actualizaciones 006 a 009 de la base de datos." : err.message);
      setEntradas([]);
      return;
    }
    const reservas = ((data ?? []) as FilaReserva[]).flatMap((f) => mapearReserva(f) ?? []);
    const interes = await sb.from("event_interest").select("event_id");
    const idsGuardados = ((interes.data ?? []) as { event_id: string }[]).map((r) => r.event_id);
    const idsEventos = [...new Set([...reservas.map((r) => r.eventoId), ...idsGuardados])];
    const [ev, ti] = await Promise.all([
      idsEventos.length ? sb.from("events").select("*").in("id", idsEventos) : Promise.resolve({ data: [] }),
      reservas.length ? sb.from("event_ticket_types").select("*").in("id", reservas.map((r) => r.tipoId)) : Promise.resolve({ data: [] }),
    ]);
    const eventos = new Map(((ev.data ?? []) as FilaEvento[]).flatMap((f) => mapearEvento(f) ?? []).map((e) => [e.id, e]));
    const tipos = new Map(((ti.data ?? []) as FilaTipoEntrada[]).map(mapearTipoEntrada).map((t) => [t.id, t]));
    setError(null);
    setEntradas(reservas.map((r) => ({ reserva: r, evento: eventos.get(r.eventoId), tipo: tipos.get(r.tipoId) })));
    setGuardados(idsGuardados.flatMap((id) => eventos.get(id) ?? []).filter((e) => e.estado === "published" && faseEvento(e) !== "finalizado"));
    setAhora(Date.now());
  }, [uid]);

  useEffect(() => {
    if (hidratado) void cargar();
  }, [hidratado, cargar]);

  useEffect(() => {
    const alVolver = () => document.visibilityState === "visible" && void cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [cargar]);

  if (!hidratado || (entradas === null && !error)) return <div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />;
  if (!uid) return null; // el middleware ya redirige al inicio de sesión

  const cancelar = async (e: Entrada) => {
    if (!window.confirm(`¿Cancelar tu reserva de ${e.reserva.cantidad} ${e.reserva.cantidad === 1 ? "entrada" : "entradas"}? Se libera el cupo para otras personas.`)) return;
    setOcupado(e.reserva.id);
    setFallo(null);
    const { error: err } = await supabase().rpc("cancel_reservation", { p_reservation: e.reserva.id });
    setOcupado(null);
    if (err) setFallo(mensajeErrorEventos(err.message));
    void cargar();
  };

  const todas = entradas ?? [];
  const vigentes = todas.filter((e) => e.reserva.estado === "reserved" && e.evento && faseEvento(e.evento, ahora) === "proximo");
  const otras = todas.filter((e) => !vigentes.includes(e));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-black text-ink">Mis entradas</h1>
      <p className="text-slate-500">Muestra el código en la puerta del evento. Pagas allí, directamente al organizador.</p>

      {(error || fallo) && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error ?? fallo}
        </p>
      )}

      {todas.length === 0 && !error ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-4xl" aria-hidden>
            🎫
          </p>
          <p className="mt-3 font-bold text-ink">Todavía no has reservado entradas</p>
          <Link href="/directorio/eventos" className="boton-marca mt-5 inline-block rounded-full px-7 py-3 text-sm font-bold text-white">
            Ver la cartelera
          </Link>
        </div>
      ) : (
        <>
          {vigentes.length > 0 && (
            <section aria-labelledby="ent-proximas" className="mt-6">
              <h2 id="ent-proximas" className="mb-2 text-lg font-black text-ink">
                Próximas
              </h2>
              <ul className="space-y-4">
                {vigentes.map((e) => (
                  <li key={e.reserva.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{e.evento && textoFechaCorta(e.evento.inicia)}</p>
                      <Link href={`/directorio/evento/${e.reserva.eventoId}`} className="text-lg font-black text-ink hover:text-brand-700">
                        {e.evento?.titulo}
                      </Link>
                      <p className="text-sm text-slate-600">
                        📍 {e.evento?.lugar || "Lugar por confirmar"}
                        {e.evento?.zona && <span className="text-slate-400"> · {e.evento.zona}</span>}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {e.reserva.cantidad} × {e.tipo?.nombre ?? "Entrada"} ·{" "}
                        <span className="font-bold text-ink">{e.reserva.total === 0 ? "Gratis" : `$${e.reserva.total.toFixed(2)} en la puerta`}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 border-t border-dashed border-slate-200 bg-slate-50 p-4">
                      <CodigoQR codigo={e.reserva.codigo} etiqueta={`Código QR de la entrada ${e.reserva.codigo}`} ancho={120} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Código de entrada</p>
                        <p className="font-mono text-2xl font-black tracking-widest text-ink">{codigoLegible(e.reserva.codigo)}</p>
                        {e.evento && puedeCancelarReserva(e.reserva, e.evento, ahora) && (
                          <button type="button" disabled={ocupado === e.reserva.id} onClick={() => void cancelar(e)} className="mt-2 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60">
                            Cancelar reserva
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {otras.length > 0 && (
            <section aria-labelledby="ent-otras" className="mt-8">
              <h2 id="ent-otras" className="mb-2 text-lg font-black text-ink">
                Anteriores y canceladas
              </h2>
              <ul className="space-y-3">
                {otras.map((e) => {
                  const est = ETIQUETA_RESERVA[e.reserva.estado];
                  const cancelado = e.evento?.estado === "cancelled";
                  return (
                    <li key={e.reserva.id} className="rounded-2xl border border-slate-200 bg-white p-4 opacity-90">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Link href={`/directorio/evento/${e.reserva.eventoId}`} className="min-w-0 font-black text-ink hover:text-brand-700">
                          {e.evento?.titulo ?? "Evento"}
                        </Link>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cancelado ? "bg-rose-50 text-rose-700" : est.clase}`}>{cancelado ? "Evento cancelado" : est.etiqueta}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {e.evento ? textoFechaCorta(e.evento.inicia) : ""} · {e.reserva.cantidad} × {e.tipo?.nombre ?? "entrada"}
                        {e.tipo && ` (${textoPrecioEntrada(e.tipo.precio)})`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {guardados.length > 0 && (
        <section aria-labelledby="ent-guardados" className="mt-10">
          <h2 id="ent-guardados" className="mb-2 text-lg font-black text-ink">
            ★ Eventos que te interesan
          </h2>
          <ul className="space-y-2">
            {guardados.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="min-w-0">
                  <Link href={`/directorio/evento/${g.id}`} className="block truncate font-bold text-ink hover:text-brand-700">
                    {categoriaEvento(g.categoria).emoji} {g.titulo}
                  </Link>
                  <p className="text-xs text-slate-500">{textoFechaCorta(g.inicia)}</p>
                </div>
                <Link href={`/directorio/evento/${g.id}`} className="shrink-0 rounded-full border border-slate-300 px-4 py-1.5 text-xs font-bold text-ink hover:border-brand-400">
                  Ver
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
