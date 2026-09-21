"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocial } from "@/context/SocialContext";
import { primerNombre } from "@/lib/mensajes";
import { mapearProveedor, type FilaProveedor } from "@/lib/directorio/mapeo";
import { VERTICALES_SOLICITUD, mapearOferta, mapearSolicitud, mensajeErrorSolicitud, perfilesQueEncajan, type FilaOferta, type FilaSolicitud, type Oferta, type Solicitud } from "@/lib/directorio/solicitudes";
import { haySupabase, supabase } from "@/lib/supabaseClient";
import type { Proveedor } from "@/types/directorio";

const sinTablas = (m: string) => /schema cache|does not exist/i.test(m);
const MENSAJE_TABLAS = "Aplica las actualizaciones 006, 007 y 008 de la base de datos.";

/** Un negocio con lo mínimo que hace falta para mostrar una oferta. */
export type Oferente = Pick<Proveedor, "id" | "nombre" | "slug" | "vertical" | "rating" | "resenas" | "verificado" | "zona">;
const aOferente = (p: Proveedor): Oferente => ({ id: p.id, nombre: p.nombre, slug: p.slug, vertical: p.vertical, rating: p.rating, resenas: p.resenas, verificado: p.verificado, zona: p.zona });

async function nombresDe(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase().from("profiles").select("id, display_name").in("id", [...new Set(ids)]);
  return new Map(((data ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, primerNombre(p.display_name)]));
}

/** Mis perfiles de negocio (los que pueden ofertar) y si mi identidad está verificada (obligatorio para ofertar en Movilidad). */
export function useMisPerfiles() {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [estado, setEstado] = useState<{ perfiles: Proveedor[]; identidadVerificada: boolean } | null>(null);

  useEffect(() => {
    if (!hidratado || !uid || !haySupabase) return;
    let vivo = true;
    void (async () => {
      const sb = supabase();
      const [prov, yo] = await Promise.all([sb.from("providers").select("*").eq("owner_id", uid), sb.from("profiles").select("identity_verified").eq("id", uid).maybeSingle()]);
      if (!vivo) return;
      const perfiles = ((prov.data ?? []) as FilaProveedor[]).flatMap((f) => mapearProveedor(f) ?? []).filter((p) => VERTICALES_SOLICITUD.includes(p.vertical));
      setEstado({ perfiles, identidadVerificada: Boolean((yo.data as { identity_verified?: boolean } | null)?.identity_verified) });
    })();
    return () => {
      vivo = false;
    };
  }, [hidratado, uid]);

  return estado;
}

export interface SolicitudConOfertas extends Solicitud {
  /** Ofertas vigentes que esperan tu respuesta. */
  ofertasNuevas: number;
}

/** Las solicitudes que publiqué, con cuántas ofertas vigentes tienen. En tiempo real. */
export function useMisSolicitudes() {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [lista, setLista] = useState<SolicitudConOfertas[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!uid || !haySupabase) return;
    const sb = supabase();
    const { data, error: err } = await sb.from("service_requests").select("*").eq("requester_id", uid).order("created_at", { ascending: false }).limit(50);
    if (err) {
      setError(sinTablas(err.message) ? MENSAJE_TABLAS : err.message);
      setLista([]);
      return;
    }
    const solicitudes = ((data ?? []) as FilaSolicitud[]).flatMap((f) => mapearSolicitud(f) ?? []);
    const ofertas = solicitudes.length ? await sb.from("service_offers").select("request_id, status").in("request_id", solicitudes.map((s) => s.id)) : { data: [] };
    const nuevas = new Map<string, number>();
    for (const o of (ofertas.data ?? []) as { request_id: string; status: string }[]) if (o.status === "sent") nuevas.set(o.request_id, (nuevas.get(o.request_id) ?? 0) + 1);
    setError(null);
    setLista(solicitudes.map((s) => ({ ...s, ofertasNuevas: nuevas.get(s.id) ?? 0 })));
  }, [uid]);

  useEffect(() => {
    if (hidratado) void recargar();
  }, [hidratado, recargar]);

  useEffect(() => {
    if (!uid || !haySupabase) return;
    const sb = supabase();
    // La base solo entrega los cambios que la persona puede ver (RLS): sus solicitudes y las ofertas recibidas.
    const canal = sb
      .channel(`mis-solicitudes-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_offers" }, () => void recargar())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "service_requests", filter: `requester_id=eq.${uid}` }, () => void recargar())
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [uid, recargar]);

  return { lista, error, cargando: !hidratado || (lista === null && !error), recargar };
}

export interface SolicitudParaMi extends Solicitud {
  solicitante?: string;
  /** Mi oferta en esa solicitud, si ya ofrecí. */
  miOferta?: Oferta;
}

/** Solicitudes abiertas que encajan con mis perfiles activos (misma sección y categoría), más las que ya respondí. En tiempo real. */
export function useSolicitudesParaMi(perfiles: Proveedor[] | null) {
  const { sesion } = useSocial();
  const uid = sesion.uid;
  const [lista, setLista] = useState<SolicitudParaMi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clave = perfiles?.map((p) => `${p.id}:${p.vertical}:${p.subtipo}:${p.estado}`).join("|") ?? null;

  const recargar = useCallback(async () => {
    if (!uid || !haySupabase || !perfiles) return;
    const activos = perfiles.filter((p) => p.estado === "active");
    if (activos.length === 0) {
      setLista([]);
      return;
    }
    const sb = supabase();
    const [abiertas, mias] = await Promise.all([
      sb
        .from("service_requests")
        .select("*")
        .eq("status", "open")
        .gt("expires_at", new Date().toISOString())
        .in("vertical", [...new Set(activos.map((p) => p.vertical))])
        .order("created_at", { ascending: false })
        .limit(60),
      sb.from("service_offers").select("*").in("provider_id", activos.map((p) => p.id)),
    ]);
    if (abiertas.error) {
      setError(sinTablas(abiertas.error.message) ? MENSAJE_TABLAS : abiertas.error.message);
      setLista([]);
      return;
    }
    const ofertas = ((mias.data ?? []) as FilaOferta[]).flatMap((f) => mapearOferta(f) ?? []);
    const solicitudes = ((abiertas.data ?? []) as FilaSolicitud[])
      .flatMap((f) => mapearSolicitud(f) ?? [])
      .filter((s) => s.solicitanteId !== uid && perfilesQueEncajan(s, activos).length > 0);
    const nombres = await nombresDe(solicitudes.map((s) => s.solicitanteId));
    setError(null);
    setLista(solicitudes.map((s) => ({ ...s, solicitante: nombres.get(s.solicitanteId), miOferta: ofertas.find((o) => o.solicitudId === s.id) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `clave` resume los perfiles: evita recargar por un array nuevo con el mismo contenido
  }, [uid, clave]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  useEffect(() => {
    if (!uid || !haySupabase || !clave) return;
    const sb = supabase();
    let espera: ReturnType<typeof setTimeout> | undefined;
    const pronto = () => {
      clearTimeout(espera);
      espera = setTimeout(() => void recargar(), 800); // agrupa ráfagas de cambios
    };
    const canal = sb
      .channel(`solicitudes-para-mi-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, pronto)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_offers" }, pronto)
      .subscribe();
    return () => {
      clearTimeout(espera);
      void sb.removeChannel(canal);
    };
  }, [uid, clave, recargar]);

  return { lista, error, recargar };
}

export interface OfertaConOferente extends Oferta {
  oferente?: Oferente;
}

/** Una solicitud con sus ofertas (RLS: quien la publicó ve todas; cada profesional solo la suya). En tiempo real. */
export function useSolicitud(id: string) {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [estado, setEstado] = useState<{ solicitud: Solicitud | null; ofertas: OfertaConOferente[]; solicitante?: string } | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!uid || !haySupabase) return;
    const sb = supabase();
    const { data, error: err } = await sb.from("service_requests").select("*").eq("id", id).maybeSingle();
    if (err) {
      setError(sinTablas(err.message) ? MENSAJE_TABLAS : err.message);
      setEstado({ solicitud: null, ofertas: [] });
      return;
    }
    const solicitud = data ? mapearSolicitud(data as FilaSolicitud) : null;
    if (!solicitud) return setEstado({ solicitud: null, ofertas: [] });
    const { data: filas } = await sb.from("service_offers").select("*").eq("request_id", id);
    const ofertas = ((filas ?? []) as FilaOferta[]).flatMap((f) => mapearOferta(f) ?? []);
    const [perfiles, nombres] = await Promise.all([
      ofertas.length ? sb.from("providers").select("*").in("id", ofertas.map((o) => o.proveedorId)) : Promise.resolve({ data: [] }),
      nombresDe([solicitud.solicitanteId]),
    ]);
    const porId = new Map(((perfiles.data ?? []) as FilaProveedor[]).flatMap((f) => mapearProveedor(f) ?? []).map((p) => [p.id, aOferente(p)]));
    setError(null);
    setEstado({ solicitud, ofertas: ofertas.map((o) => ({ ...o, oferente: porId.get(o.proveedorId) })), solicitante: nombres.get(solicitud.solicitanteId) });
  }, [uid, id]);

  useEffect(() => {
    if (hidratado) void recargar();
  }, [hidratado, recargar]);

  useEffect(() => {
    if (!uid || !haySupabase) return;
    const sb = supabase();
    const canal = sb
      .channel(`solicitud-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_offers", filter: `request_id=eq.${id}` }, () => void recargar())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "service_requests", filter: `id=eq.${id}` }, () => void recargar())
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [uid, id, recargar]);

  return { estado, error, recargar };
}

/** Acciones sobre solicitudes y ofertas; cada una devuelve el mensaje de error legible (o null si salió bien). */
async function ejecutar(promesa: PromiseLike<{ error: { message: string } | null }>): Promise<string | null> {
  const { error } = await promesa;
  return error ? mensajeErrorSolicitud(error.message) : null;
}
export const aceptarOferta = (ofertaId: string) => ejecutar(supabase().rpc("accept_offer", { p_offer: ofertaId }));
export const retirarOferta = (ofertaId: string) => ejecutar(supabase().rpc("withdraw_offer", { p_offer: ofertaId }));
export const cerrarSolicitud = (solicitudId: string) => ejecutar(supabase().rpc("close_service_request", { p_request: solicitudId }));
