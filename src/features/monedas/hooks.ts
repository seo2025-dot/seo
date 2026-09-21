"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocial } from "@/context/SocialContext";
import { PAQUETES_DEFECTO, PRECIOS_DEFECTO, estadoUso, type AccionUso, type EstadoUso, type PaqueteMonedas, type Pasarela, type PrecioUso, type UsoAccion } from "@/lib/monedas";
import { haySupabase, supabase } from "@/lib/supabaseClient";

const ETIQUETAS = new Map(PRECIOS_DEFECTO.map((p) => [p.accion, p]));

/** Las tarifas vigentes (las puede ajustar un administrador en la base). Se piden una vez por carga de página; mientras tanto, las de fábrica. */
let promesaPrecios: Promise<PrecioUso[]> | null = null;
function pedirPrecios(): Promise<PrecioUso[]> {
  if (!haySupabase) return Promise.resolve(PRECIOS_DEFECTO);
  promesaPrecios ??= Promise.resolve(supabase().from("coin_prices").select("action, label, free_uses, cost, active, sort").order("sort")).then(({ data, error }) => {
    if (error || !data?.length) return PRECIOS_DEFECTO;
    return (data as { action: AccionUso; label: string; free_uses: number; cost: number; active: boolean }[])
      .filter((f) => f.active)
      .map((f) => ({ accion: f.action, etiqueta: f.label, gratis: f.free_uses, coste: f.cost, quien: ETIQUETAS.get(f.action)?.quien ?? "" }));
  });
  return promesaPrecios;
}

export function usePrecios(): PrecioUso[] {
  const [precios, setPrecios] = useState(PRECIOS_DEFECTO);
  useEffect(() => {
    let vivo = true;
    void pedirPrecios().then((p) => vivo && setPrecios(p));
    return () => {
      vivo = false;
    };
  }, []);
  return precios;
}

/** Cuántos usos gratis y de pago lleva la persona por acción (`null` mientras carga o sin sesión). */
export function useUsos() {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [usos, setUsos] = useState<UsoAccion[] | null>(null);

  const recargar = useCallback(async () => {
    if (!uid || !haySupabase) return;
    const { data } = await supabase().from("coin_usage").select("action, free_used, paid_used, spent").eq("user_id", uid);
    setUsos(((data ?? []) as { action: string; free_used: number; paid_used: number; spent: number }[]).map((u) => ({ accion: u.action, gratisUsados: u.free_used, pagadosUsados: u.paid_used, gastadas: u.spent })));
  }, [uid]);

  useEffect(() => {
    if (hidratado) void recargar();
  }, [hidratado, recargar]);
  useEffect(() => {
    const alVolver = () => document.visibilityState === "visible" && void recargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [recargar]);

  return { usos, recargar };
}

/** Qué costará la próxima vez que la persona haga esta acción (y cuántos usos gratis le quedan). `null` mientras carga. */
export function useCosteAccion(accion: AccionUso): { estado: EstadoUso | null; precio: PrecioUso | undefined } {
  const precios = usePrecios();
  const { usos } = useUsos();
  const precio = precios.find((p) => p.accion === accion);
  if (!precio || usos === null) return { estado: null, precio };
  return { estado: estadoUso(precio, usos.find((u) => u.accion === accion)), precio };
}

export interface Movimiento {
  id: number;
  delta: number;
  motivo: string;
  creado: number;
}

export interface FilaPagoPropio {
  id: string;
  packageId: string;
  provider: Pasarela;
  cents: number;
  coins: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  creado: number;
}

/** Todo lo que necesita la pantalla «Monedas»: paquetes, pasarelas disponibles, historial y si es la primera compra. */
export function useTienda() {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [paquetes, setPaquetes] = useState<PaqueteMonedas[]>(PAQUETES_DEFECTO);
  const [pasarelas, setPasarelas] = useState<Record<Pasarela, boolean> | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [primeraCompra, setPrimeraCompra] = useState(true);

  const recargar = useCallback(async () => {
    if (!uid || !haySupabase) return;
    const sb = supabase();
    const [pk, led, pagados] = await Promise.all([
      sb.from("coin_packages").select("id, label, price_cents, coins, badge, sort, active").order("sort"),
      sb.from("wallet_ledger").select("id, delta, reason, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(25),
      sb.from("coin_payments").select("id").eq("user_id", uid).eq("status", "paid").limit(1),
    ]);
    if (!pk.error && pk.data?.length) {
      setPaquetes(
        (pk.data as { id: string; label: string; price_cents: number; coins: number; badge: string | null; active: boolean }[])
          .filter((p) => p.active)
          .map((p) => ({ id: p.id, etiqueta: p.label, centavos: p.price_cents, monedas: p.coins, insignia: p.badge ?? undefined })),
      );
    }
    setMovimientos(((led.data ?? []) as { id: number; delta: number; reason: string; created_at: string }[]).map((m) => ({ id: m.id, delta: m.delta, motivo: m.reason, creado: new Date(m.created_at).getTime() })));
    setPrimeraCompra((pagados.data ?? []).length === 0);
  }, [uid]);

  useEffect(() => {
    if (hidratado) void recargar();
  }, [hidratado, recargar]);

  useEffect(() => {
    let vivo = true;
    void fetch("/api/pagos/pasarelas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && setPasarelas(d as Record<Pasarela, boolean> | null))
      .catch(() => vivo && setPasarelas(null));
    return () => {
      vivo = false;
    };
  }, []);

  return { paquetes, pasarelas, movimientos, primeraCompra, recargar };
}

/** Un reto de comunidad (semanal o único) con el progreso de la persona. */
export interface RetoComunidad {
  id: string;
  period: "weekly" | "once";
  target: number;
  prize: number;
  emoji: string;
  title: string;
  description: string;
  href: string | null;
  progress: number;
  claimed: boolean;
  ends_at: string | null;
}

export function useRetosComunidad() {
  const { sesion, hidratado } = useSocial();
  const uid = sesion.uid;
  const [retos, setRetos] = useState<RetoComunidad[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!uid || !haySupabase) return;
    const { data, error: err } = await supabase().rpc("community_challenges_status");
    if (err) {
      setError(/schema cache|does not exist|Could not find/i.test(err.message) ? "Aplica la actualización 010 de la base de datos." : err.message);
      setRetos([]);
      return;
    }
    setError(null);
    setRetos((data ?? []) as RetoComunidad[]);
  }, [uid]);

  useEffect(() => {
    if (hidratado) void recargar();
  }, [hidratado, recargar]);
  useEffect(() => {
    const alVolver = () => document.visibilityState === "visible" && void recargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [recargar]);

  /** Cobra un reto cumplido. Devuelve las monedas ganadas o el mensaje de error. */
  const cobrar = useCallback(
    async (id: string): Promise<{ monedas: number } | { error: string }> => {
      const { data, error: err } = await supabase().rpc("claim_community_challenge", { p_id: id });
      await recargar();
      return err ? { error: err.message } : { monedas: Number(data) };
    },
    [recargar],
  );

  return { retos, error, recargar, cobrar };
}
