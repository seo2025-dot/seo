"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocial } from "@/context/SocialContext";
import { haySupabase, supabase } from "@/lib/supabaseClient";
import type { StatsComunidad } from "@/lib/mensajes";
import type { EstadoReto } from "@/lib/retos";

/** Estadísticas reales de la comunidad (públicas). Se piden una vez por carga de página y se comparten entre componentes. */
let statsPromesa: Promise<StatsComunidad | null> | null = null;
function pedirStats(): Promise<StatsComunidad | null> {
  if (!haySupabase) return Promise.resolve(null);
  statsPromesa ??= Promise.resolve(supabase().rpc("community_stats")).then(({ data, error }) => (error ? null : (data as StatsComunidad)));
  return statsPromesa;
}

export function useComunidad() {
  const [stats, setStats] = useState<StatsComunidad | null>(null);
  useEffect(() => {
    let vivo = true;
    void pedirStats().then((s) => vivo && setStats(s));
    return () => {
      vivo = false;
    };
  }, []);
  return stats;
}

// ── Recomendaciones y galería ──────────────────────────────────────────────────────────────
export interface FiltrosGaleria {
  edadMin: number | null;
  edadMax: number | null;
  alturaMin: number | null;
  alturaMax: number | null;
}

export const FILTROS_VACIOS: FiltrosGaleria = { edadMin: null, edadMax: null, alturaMin: null, alturaMax: null };

/** Afinidad por dimensión (0–100). null = sin información suficiente de alguno de los dos lados (no es un 0 %). */
export interface DesgloseAfinidad {
  valores: number | null;
  estilo: number | null;
  relacion: number | null;
}

export interface Recomendacion {
  id: string;
  puntaje: number;
  motivos: string[];
  desglose: DesgloseAfinidad;
}

interface FilaRecomendacion {
  person_id: string;
  score: number;
  reasons: string[] | null;
  pct_values: number | null;
  pct_lifestyle: number | null;
  pct_relation: number | null;
}

const aRecomendacion = (r: FilaRecomendacion): Recomendacion => ({
  id: r.person_id,
  puntaje: r.score,
  motivos: r.reasons ?? [],
  desglose: { valores: r.pct_values, estilo: r.pct_lifestyle, relacion: r.pct_relation },
});

const TAM_PAGINA = 24;

/** Una página de recomendaciones ordenadas por afinidad (la única llamada al motor; la comparten /explorar y /citas). */
async function pedirRecomendaciones(f: FiltrosGaleria, limite: number, offset: number) {
  const { data, error } = await supabase().rpc("recommend_people", {
    p_min_age: f.edadMin,
    p_max_age: f.edadMax,
    p_min_height: f.alturaMin,
    p_max_height: f.alturaMax,
    p_limit: limite,
    p_offset: offset,
  });
  return { filas: ((data ?? []) as FilaRecomendacion[]).map(aRecomendacion), error: error?.message ?? null };
}

/** Pide al servidor las personas ordenadas por compatibilidad, aplicando los filtros (con antirrebote). */
export function useRecomendaciones(f: FiltrosGaleria) {
  const { sesion, hidratado } = useSocial();
  const [items, setItems] = useState<Recomendacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pedido = useRef(0);
  const clave = JSON.stringify(f);

  const pedir = useCallback(
    async (offset: number) => {
      const n = ++pedido.current;
      setCargando(true);
      const { filas, error: err } = await pedirRecomendaciones(f, TAM_PAGINA, offset);
      if (n !== pedido.current) return; // llegó una respuesta más nueva
      if (err) {
        setError(err);
        setCargando(false);
        return;
      }
      setError(null);
      setItems((prev) => (offset === 0 ? filas : [...prev, ...filas]));
      setHayMas(filas.length === TAM_PAGINA);
      setCargando(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clave],
  );

  useEffect(() => {
    if (!hidratado || !sesion.uid || !haySupabase) return;
    const t = setTimeout(() => void pedir(0), 250);
    return () => clearTimeout(t);
  }, [hidratado, sesion.uid, pedir]);

  return { items, cargando, hayMas, error, masResultados: () => pedir(items.length) };
}

/** Afinidad con las 60 personas que mejor encajan contigo (id → recomendación), para tarjetas que no paginan, como /citas. */
export function useAfinidades() {
  const { sesion, hidratado } = useSocial();
  const [mapa, setMapa] = useState<Map<string, Recomendacion>>(new Map());
  useEffect(() => {
    if (!hidratado || !sesion.uid || !haySupabase) return;
    let vivo = true;
    void pedirRecomendaciones(FILTROS_VACIOS, 60, 0).then(({ filas, error }) => {
      if (vivo && !error) setMapa(new Map(filas.map((r) => [r.id, r])));
    });
    return () => {
      vivo = false;
    };
  }, [hidratado, sesion.uid]);
  return mapa;
}

/** Lo que hay esperándote (likes sin responder, gente nueva). */
export function useOportunidad() {
  const { sesion, hidratado } = useSocial();
  const [datos, setDatos] = useState<{ likes_pending: number; new_people_7d: number } | null>(null);
  useEffect(() => {
    if (!hidratado || !sesion.uid || !haySupabase) return;
    let vivo = true;
    void Promise.resolve(supabase().rpc("opportunity_snapshot")).then(({ data }) => vivo && data && setDatos(data as { likes_pending: number; new_people_7d: number }));
    return () => {
      vivo = false;
    };
  }, [hidratado, sesion.uid]);
  return datos;
}

// ── Retos diarios ─────────────────────────────────────────────────────────────────────────
export function useRetos() {
  const { sesion, hidratado } = useSocial();
  const [retos, setRetos] = useState<EstadoReto[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const { data } = await supabase().rpc("daily_challenges_status");
    setRetos(((data ?? []) as { id: string; prize: number; done: boolean; claimed: boolean }[]).map((r) => ({ id: r.id, prize: r.prize, done: r.done, claimed: r.claimed })));
    setCargando(false);
  }, []);

  useEffect(() => {
    if (!hidratado || !sesion.uid || !haySupabase) return;
    void recargar();
  }, [hidratado, sesion.uid, recargar]);

  /** Cobra un reto (el servidor comprueba que esté cumplido). Devuelve las monedas ganadas o null. */
  const cobrar = useCallback(
    async (id: string): Promise<number | null> => {
      const { data, error } = await supabase().rpc("claim_daily_challenge", { p_id: id });
      await recargar();
      return error ? null : (data as number);
    },
    [recargar],
  );

  return { retos, cargando, cobrar, recargar };
}

// ── Referidos ─────────────────────────────────────────────────────────────────────────────
export interface StatsReferidos {
  code: string;
  invited: number;
  confirmed: number;
  coins_earned: number;
}
export interface FilaRanking {
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  confirmed: number;
}

export function useReferidos() {
  const { sesion, hidratado } = useSocial();
  const [stats, setStats] = useState<StatsReferidos | null>(null);
  const [ranking, setRanking] = useState<FilaRanking[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!hidratado || !sesion.uid || !haySupabase) return;
    let vivo = true;
    void Promise.all([supabase().rpc("referral_stats"), supabase().rpc("referral_leaderboard", { p_limit: 10 })]).then(([s, r]) => {
      if (!vivo) return;
      if (s.data) setStats(s.data as StatsReferidos);
      setRanking((r.data ?? []) as FilaRanking[]);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [hidratado, sesion.uid]);

  return { stats, ranking, cargando };
}
