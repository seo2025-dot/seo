"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocial } from "@/context/SocialContext";
import type { EstadoConector } from "@/lib/comunidad";
import { haySupabase, supabase } from "@/lib/supabaseClient";

// ── Miembros recientes ──────────────────────────────────────────────────────
export interface MiembroReciente {
  id: string;
  nombre: string; // solo el nombre de pila
  foto?: string;
  ciudad?: string;
  unidoEn: number; // ms
}

interface FilaMiembro {
  member_id: string;
  first_name: string;
  avatar_url: string | null;
  city: string | null;
  joined_at: string;
}

/** Las personas reales que se han unido más recientemente (sin perfiles demo). Se refresca cada minuto. */
export function useMiembrosRecientes(limite = 12) {
  const [miembros, setMiembros] = useState<MiembroReciente[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!haySupabase) {
      setCargando(false);
      return;
    }
    let vivo = true;
    const pedir = async () => {
      const { data, error } = await supabase().rpc("recent_members", { p_limit: limite });
      if (!vivo) return;
      if (!error) {
        setMiembros(
          ((data ?? []) as FilaMiembro[]).map((m) => ({
            id: m.member_id,
            nombre: m.first_name,
            foto: m.avatar_url ?? undefined,
            ciudad: m.city ?? undefined,
            unidoEn: new Date(m.joined_at).getTime(),
          })),
        );
      }
      setCargando(false);
    };
    void pedir();
    const t = setInterval(() => void pedir(), 60_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [limite]);

  return { miembros, cargando };
}

// ── Top Conectores ──────────────────────────────────────────────────────────
export interface TopConector {
  id: string;
  nombre: string;
  foto?: string;
  ciudad?: string;
  puntos: number;
  puesto: number;
}

interface FilaTop {
  person_id: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  score: number;
  rank: number;
}

/** El ranking se pide una vez por carga de página y se comparte entre todos los componentes (tarjetas del muro incluidas). */
let topPromesa: Promise<TopConector[]> | null = null;
function pedirTop(): Promise<TopConector[]> {
  if (!haySupabase) return Promise.resolve([]);
  topPromesa ??= Promise.resolve(supabase().rpc("top_connectors", { p_limit: 10 })).then(({ data, error }) =>
    error
      ? []
      : ((data ?? []) as FilaTop[]).map((f) => ({ id: f.person_id, nombre: f.display_name, foto: f.avatar_url ?? undefined, ciudad: f.city ?? undefined, puntos: f.score, puesto: f.rank })),
  );
  return topPromesa;
}

export function useTopConectores() {
  const [lista, setLista] = useState<TopConector[]>([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let vivo = true;
    void pedirTop().then((l) => {
      if (!vivo) return;
      setLista(l);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return { lista, cargando };
}

/** Devuelve el puesto (1–10) si esa persona es Top Conector, o null. Acepta el id de la interfaz («yo» = tú). */
export function usePuestoTop(): (idApp: string) => number | null {
  const { sesion } = useSocial();
  const { lista } = useTopConectores();
  return useCallback(
    (idApp: string) => {
      const real = idApp === "yo" ? sesion.uid : idApp;
      return lista.find((c) => c.id === real)?.puesto ?? null;
    },
    [lista, sesion.uid],
  );
}

/** Tu posición: puntos, puesto y lo que te falta para el Top 10. */
export function useMiEstatusConector() {
  const { sesion, hidratado } = useSocial();
  const [estado, setEstado] = useState<EstadoConector | null>(null);
  useEffect(() => {
    if (!hidratado || !sesion.uid || !haySupabase) return;
    let vivo = true;
    void Promise.resolve(supabase().rpc("my_connector_status")).then(({ data, error }) => {
      if (vivo && !error && data) setEstado(data as EstadoConector);
    });
    return () => {
      vivo = false;
    };
  }, [hidratado, sesion.uid]);
  return estado;
}

/** true en pantallas de escritorio (≥ 1024 px). Devuelve null hasta montar: así no se monta primero la variante equivocada. */
export function useEscritorio(): boolean | null {
  const [escritorio, setEscritorio] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const actualizar = () => setEscritorio(mq.matches);
    actualizar();
    mq.addEventListener("change", actualizar);
    return () => mq.removeEventListener("change", actualizar);
  }, []);
  return escritorio;
}
