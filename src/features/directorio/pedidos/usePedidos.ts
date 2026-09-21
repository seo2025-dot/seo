"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocial } from "@/context/SocialContext";
import type { EstadoPedido } from "@/data/directorio";
import { primerNombre } from "@/lib/mensajes";
import { mapearPedido, mensajeErrorPedido, type FilaLineaPedido, type FilaPedido, type Pedido } from "@/lib/directorio/pedidos";
import { haySupabase, supabase } from "@/lib/supabaseClient";

export type RolPedidos = "cliente" | "negocio";

/** Un pedido con el nombre de pila de quien lo hizo (solo lo ve el negocio; nunca el apellido). */
export type PedidoConCliente = Pedido & { clienteNombre?: string };

const sinTablas = (m: string) => /schema cache|does not exist/i.test(m);

async function traerPedidos(filtro: { col: "customer_id" | "provider_owner_id"; uid: string } | { id: string }, conNombres: boolean): Promise<{ pedidos: PedidoConCliente[]; error: string | null }> {
  const sb = supabase();
  const base = sb.from("orders").select("*");
  const { data, error } = await ("id" in filtro
    ? base.eq("id", filtro.id)
    : filtro.col === "customer_id"
      ? base.eq("customer_id", filtro.uid).order("created_at", { ascending: false }).limit(100)
      : base.eq("provider_owner_id", filtro.uid).order("created_at", { ascending: false }).limit(100));
  if (error) return { pedidos: [], error: sinTablas(error.message) ? "Aplica la actualización 008 de la base de datos." : error.message };
  const filas = (data ?? []) as FilaPedido[];
  if (filas.length === 0) return { pedidos: [], error: null };
  const ids = filas.map((f) => f.id);
  const [lineas, perfiles] = await Promise.all([
    sb.from("order_lines").select("order_id, line_no, item_id, name, unit_price, qty").in("order_id", ids),
    conNombres ? sb.from("profiles").select("id, display_name").in("id", [...new Set(filas.map((f) => f.customer_id))]) : Promise.resolve({ data: [] }),
  ]);
  const nombres = new Map(((perfiles.data ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, primerNombre(p.display_name)]));
  const pedidos = filas.flatMap((f) => {
    const p = mapearPedido(f, (lineas.data ?? []) as FilaLineaPedido[]);
    return p ? [{ ...p, clienteNombre: nombres.get(f.customer_id) }] : [];
  });
  return { pedidos, error: null };
}

/** Cambia el estado de un pedido con la máquina de estados del servidor y devuelve el mensaje de error legible (o null). */
export async function cambiarEstadoPedido(id: string, estado: EstadoPedido): Promise<string | null> {
  const { error } = await supabase().rpc("set_order_status", { p_order: id, p_status: estado });
  return error ? mensajeErrorPedido(error.message) : null;
}

/**
 * Lista de pedidos de la persona (`cliente`) o de sus negocios (`negocio`), actualizada en tiempo real.
 * En la bandeja del negocio primero se cancelan los pedidos que llevan más de 3 h sin respuesta.
 */
export function usePedidos(rol: RolPedidos) {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [pedidos, setPedidos] = useState<PedidoConCliente[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!uid || !haySupabase) return;
    if (rol === "negocio") await supabase().rpc("expire_stale_orders");
    const r = await traerPedidos({ col: rol === "cliente" ? "customer_id" : "provider_owner_id", uid }, rol === "negocio");
    setPedidos(r.pedidos);
    setError(r.error);
  }, [uid, rol]);

  useEffect(() => {
    if (hidratado) void recargar();
  }, [hidratado, recargar]);

  useEffect(() => {
    if (!uid || !haySupabase) return;
    const sb = supabase();
    const filtro = rol === "cliente" ? `customer_id=eq.${uid}` : `provider_owner_id=eq.${uid}`;
    const canal = sb
      .channel(`pedidos-${rol}-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: filtro }, () => void recargar())
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [uid, rol, recargar]);

  return { pedidos, error, recargar, cargando: !hidratado || (pedidos === null && !error) };
}

/** Un pedido concreto (RLS: solo lo ve quien lo hizo o el dueño del negocio), en tiempo real. */
export function usePedido(id: string) {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [pedido, setPedido] = useState<PedidoConCliente | null | undefined>(undefined); // undefined = cargando, null = no existe / no es tuyo
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!uid || !haySupabase) return;
    // Un pedido sin respuesta puede haber caducado: el servidor lo cancela al consultar la bandeja del negocio o aquí mismo.
    await supabase().rpc("expire_stale_orders");
    const inicial = await traerPedidos({ id }, true);
    setError(inicial.error);
    setPedido(inicial.pedidos[0] ?? null);
  }, [uid, id]);

  useEffect(() => {
    if (hidratado) void recargar();
  }, [hidratado, recargar]);

  useEffect(() => {
    if (!uid || !haySupabase) return;
    const sb = supabase();
    const canal = sb
      .channel(`pedido-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => void recargar())
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [uid, id, recargar]);

  return { pedido, error, recargar };
}
