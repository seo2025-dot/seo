"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocial } from "@/context/SocialContext";
import {
  mapearEvento, mapearReserva, mapearTipoEntrada, type Evento, type FilaEvento, type FilaReserva, type FilaTipoEntrada, type Reserva, type TipoEntrada,
} from "@/lib/directorio/eventos";
import { mapearProveedor, type FilaProveedor } from "@/lib/directorio/mapeo";
import { primerNombre } from "@/lib/mensajes";
import { haySupabase, supabase } from "@/lib/supabaseClient";
import type { Proveedor } from "@/types/directorio";

const MENSAJE_TABLAS = "Aplica las actualizaciones 006 a 009 de la base de datos.";
const sinTablas = (m: string) => /schema cache|does not exist/i.test(m);

/** Mis perfiles de organizador (sección Eventos). `null` mientras carga. */
export function useMisOrganizadores() {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [lista, setLista] = useState<Proveedor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hidratado || !uid || !haySupabase) return;
    let vivo = true;
    void (async () => {
      const { data, error: err } = await supabase().from("providers").select("*").eq("owner_id", uid).eq("vertical", "eventos");
      if (!vivo) return;
      if (err) {
        setError(sinTablas(err.message) ? MENSAJE_TABLAS : err.message);
        setLista([]);
        return;
      }
      setLista(((data ?? []) as FilaProveedor[]).flatMap((f) => mapearProveedor(f) ?? []));
    })();
    return () => {
      vivo = false;
    };
  }, [hidratado, uid]);

  return { organizadores: lista, error };
}

export interface EventoDelPanel {
  evento: Evento;
  tipos: TipoEntrada[];
  reservas: Reserva[];
}

/** Mis eventos (de todos mis perfiles de organizador) con sus entradas y reservas. RLS: el organizador ve todo lo suyo. */
export function useMisEventos() {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [eventos, setEventos] = useState<EventoDelPanel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!uid || !haySupabase) return;
    const sb = supabase();
    const prov = await sb.from("providers").select("id").eq("owner_id", uid).eq("vertical", "eventos");
    if (prov.error) {
      setError(sinTablas(prov.error.message) ? MENSAJE_TABLAS : prov.error.message);
      setEventos([]);
      return;
    }
    const ids = ((prov.data ?? []) as { id: string }[]).map((p) => p.id);
    if (ids.length === 0) {
      setEventos([]);
      return;
    }
    const ev = await sb.from("events").select("*").in("provider_id", ids).order("starts_at", { ascending: false }).limit(100);
    if (ev.error) {
      setError(ev.error.message);
      setEventos([]);
      return;
    }
    const lista = ((ev.data ?? []) as FilaEvento[]).flatMap((f) => mapearEvento(f) ?? []);
    const evIds = lista.map((e) => e.id);
    const [ti, re] = evIds.length
      ? await Promise.all([sb.from("event_ticket_types").select("*").in("event_id", evIds), sb.from("event_reservations").select("*").in("event_id", evIds)])
      : [{ data: [] }, { data: [] }];
    const tipos = ((ti.data ?? []) as FilaTipoEntrada[]).map(mapearTipoEntrada);
    const reservas = ((re.data ?? []) as FilaReserva[]).flatMap((f) => mapearReserva(f) ?? []);
    setError(null);
    setEventos(lista.map((e) => ({ evento: e, tipos: tipos.filter((t) => t.eventoId === e.id).sort((a, b) => a.precio - b.precio), reservas: reservas.filter((r) => r.eventoId === e.id) })));
  }, [uid]);

  useEffect(() => {
    if (hidratado) void recargar();
  }, [hidratado, recargar]);

  return { eventos, error, recargar, cargando: !hidratado || (eventos === null && !error) };
}

/** Nombres de pila de quienes reservaron (el organizador necesita saber quién viene; nunca el apellido). */
export async function nombresDeAsistentes(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0 || !haySupabase) return new Map();
  const { data } = await supabase().from("profiles").select("id, display_name").in("id", [...new Set(ids)]);
  return new Map(((data ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, primerNombre(p.display_name)]));
}
