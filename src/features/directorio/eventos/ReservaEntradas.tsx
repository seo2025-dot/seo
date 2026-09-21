"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import CodigoQR from "@/features/directorio/eventos/CodigoQR";
import {
  bloqueoReserva, codigoLegible, disponibles, estadoVenta, faseEvento, mapearReserva, mapearTipoEntrada, maxReservable, mensajeErrorEventos, textoPrecioEntrada, totalReserva,
  type Evento, type FilaReserva, type FilaTipoEntrada, type Reserva, type TipoEntrada,
} from "@/lib/directorio/eventos";
import { haySupabase, supabase } from "@/lib/supabaseClient";

type Listo = { id: string; code: string; total: number; type: string; qty: number; payment: "free" | "pay_at_door" };

/**
 * Reserva de entradas de un evento. El servidor calcula el precio y descuenta el cupo de forma atómica; aquí solo se elige tipo y cantidad.
 * La página se sirve en caché (60 s): el cupo se vuelve a consultar al abrir para mostrar lo que queda de verdad.
 */
export default function ReservaEntradas({ evento, tiposIniciales, duenoId }: { evento: Pick<Evento, "id" | "titulo" | "inicia" | "termina" | "estado" | "gratis" | "enlaceEntradas">; tiposIniciales: TipoEntrada[]; duenoId: string }) {
  const { sesion, hidratado } = useSocial();
  const [tipos, setTipos] = useState(tiposIniciales);
  const [misReservas, setMisReservas] = useState<Reserva[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState<Listo | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const uid = sesion.uid;

  const refrescar = useCallback(async () => {
    if (!haySupabase) return;
    const sb = supabase();
    const t = await sb.from("event_ticket_types").select("*").eq("event_id", evento.id);
    if (!t.error) setTipos(((t.data ?? []) as FilaTipoEntrada[]).map(mapearTipoEntrada).sort((a, b) => a.precio - b.precio));
    if (uid) {
      const r = await sb.from("event_reservations").select("*").eq("event_id", evento.id).in("status", ["reserved", "checked_in"]);
      if (!r.error) setMisReservas(((r.data ?? []) as FilaReserva[]).flatMap((f) => mapearReserva(f) ?? []));
    }
    setAhora(Date.now());
  }, [evento.id, uid]);

  useEffect(() => {
    if (hidratado) void refrescar();
  }, [hidratado, refrescar]);

  useEffect(() => {
    const alVolver = () => document.visibilityState === "visible" && void refrescar();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [refrescar]);

  const fase = faseEvento(evento, ahora);
  const esMio = uid !== null && uid === duenoId;

  const reservar = async (t: TipoEntrada) => {
    const cantidad = cantidades[t.id] ?? 1;
    const bloqueo = bloqueoReserva(t, evento, cantidad);
    if (bloqueo) return setFallo(bloqueo);
    setFallo(null);
    setOcupado(t.id);
    const { data, error } = await supabase().rpc("reserve_tickets", { p_type: t.id, p_qty: cantidad });
    setOcupado(null);
    if (error) {
      setFallo(mensajeErrorEventos(error.message));
      void refrescar();
      return;
    }
    setListo(data as Listo);
    void refrescar();
  };

  return (
    <section aria-labelledby="entradas-titulo" className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 id="entradas-titulo" className="text-xl font-black text-ink">
        Entradas
      </h2>

      {fase === "cancelado" && (
        <p role="status" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">
          Este evento se canceló.
        </p>
      )}
      {fase === "en_curso" && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">El evento ya empezó: la reserva de entradas está cerrada.</p>}
      {fase === "finalizado" && <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">Este evento ya terminó.</p>}

      {listo && (
        <div role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-black text-emerald-900">🎉 ¡Reserva confirmada!</p>
          <p className="mt-1 text-sm text-emerald-900">
            {listo.qty} × {listo.type} · {listo.total === 0 ? "Gratis" : `$${listo.total.toFixed(2)} (se paga en la puerta)`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <CodigoQR codigo={listo.code} etiqueta={`Código QR de tu entrada ${listo.code}`} ancho={132} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Tu código</p>
              <p className="font-mono text-xl font-black tracking-widest text-ink">{codigoLegible(listo.code)}</p>
              <Link href="/directorio/entradas" className="mt-2 inline-block text-sm font-bold text-brand-700 hover:underline">
                Ver en Mis entradas →
              </Link>
            </div>
          </div>
        </div>
      )}

      {!listo && misReservas.length > 0 && (
        <p role="status" className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
          🎫 Ya tienes {misReservas.reduce((n, r) => n + r.cantidad, 0)} {misReservas.reduce((n, r) => n + r.cantidad, 0) === 1 ? "entrada" : "entradas"} para este evento.{" "}
          <Link href="/directorio/entradas" className="font-bold underline">
            Ver mis entradas
          </Link>
        </p>
      )}

      {tipos.length === 0 ? (
        <div className="mt-3 text-sm text-slate-600">
          {evento.gratis ? <p className="font-semibold text-emerald-700">🆓 Entrada libre: no necesitas reservar.</p> : !evento.enlaceEntradas && <p>El organizador aún no publicó las entradas.</p>}
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {tipos.map((t) => {
            const v = estadoVenta(t, evento, ahora);
            const max = maxReservable(t, evento, ahora);
            const yaTiene = misReservas.some((r) => r.tipoId === t.id);
            const cantidad = Math.min(cantidades[t.id] ?? 1, Math.max(1, max));
            return (
              <li key={t.id} className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black text-ink">{t.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {t.ventaHasta && t.ventaHasta > ahora ? "Venta hasta el " + new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" }).format(t.ventaHasta) + " · " : ""}
                      hasta {t.maxPorPedido} por persona
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black tabular-nums text-ink">{textoPrecioEntrada(t.precio)}</p>
                    <p className={`text-xs font-bold ${v.estado === "agotada" ? "text-rose-600" : v.estado === "pocas" ? "text-amber-700" : "text-slate-500"}`}>{v.estado === "disponible" ? `${disponibles(t)} disponibles` : v.texto}</p>
                  </div>
                </div>
                {max > 0 && !esMio && !yaTiene && uid && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div role="group" aria-label={`Cantidad de entradas ${t.nombre}`} className="inline-flex items-center overflow-hidden rounded-full border border-slate-300">
                      <button type="button" onClick={() => setCantidades({ ...cantidades, [t.id]: Math.max(1, cantidad - 1) })} disabled={cantidad <= 1} aria-label="Una entrada menos" className="h-9 w-9 text-lg font-bold hover:bg-slate-100 disabled:opacity-40">
                        −
                      </button>
                      <output aria-live="polite" className="w-8 text-center text-sm font-black tabular-nums">
                        {cantidad}
                      </output>
                      <button type="button" onClick={() => setCantidades({ ...cantidades, [t.id]: Math.min(max, cantidad + 1) })} disabled={cantidad >= max} aria-label="Una entrada más" className="h-9 w-9 text-lg font-bold hover:bg-slate-100 disabled:opacity-40">
                        +
                      </button>
                    </div>
                    <button type="button" disabled={ocupado !== null} onClick={() => void reservar(t)} className="boton-marca rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                      {ocupado === t.id ? "Reservando…" : t.precio === 0 ? "Reservar gratis" : `Reservar · $${totalReserva(t, cantidad).toFixed(2)}`}
                    </button>
                  </div>
                )}
                {yaTiene && <p className="mt-2 text-xs font-semibold text-sky-800">Ya reservaste esta entrada.</p>}
                {max > 0 && !uid && hidratado && (
                  <p className="mt-2 text-sm">
                    <Link href={`/login?next=/directorio/evento/${evento.id}`} className="font-bold text-brand-700 hover:underline">
                      Inicia sesión para reservar
                    </Link>{" "}
                    <span className="text-slate-500">· o </span>
                    <Link href={`/registro?next=/directorio/evento/${evento.id}`} className="font-bold text-brand-700 hover:underline">
                      crea tu cuenta
                    </Link>
                  </p>
                )}
                {max > 0 && esMio && <p className="mt-2 text-xs text-slate-500">Es tu evento: no puedes reservar tus propias entradas.</p>}
              </li>
            );
          })}
        </ul>
      )}

      {fallo && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
          {fallo}
        </p>
      )}

      {evento.enlaceEntradas && fase === "proximo" && (
        <a href={evento.enlaceEntradas} target="_blank" rel="noopener noreferrer nofollow" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-ink hover:border-brand-400">
          Comprar entradas en el sitio del organizador <span aria-hidden>↗</span>
        </a>
      )}
      {tipos.some((t) => t.precio > 0) && <p className="mt-3 text-xs text-slate-500">La reserva es gratuita y guarda tu lugar. El pago se hace en la puerta, directamente al organizador.</p>}
    </section>
  );
}
