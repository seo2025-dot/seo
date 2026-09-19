"use client";

import { useEffect, useState } from "react";
import type { Anuncio } from "@/types/mercado";
import { useSocial } from "@/context/SocialContext";
import { transitoDelDia } from "@/lib/astrologia";
import { haySupabase, supabase } from "@/lib/supabaseClient";

/**
 * Personas que están viendo ESTE anuncio ahora mismo (sin contarte a ti), medido con Supabase Realtime Presence:
 * cada visitante se registra en el canal `viendo:<id>` mientras la tarjeta/ficha está visible.
 */
export function useViewers(id: string) {
  const [otros, setOtros] = useState(0);

  useEffect(() => {
    if (!haySupabase) return;
    const sb = supabase();
    const canal = sb.channel(`viendo:${id}`, { config: { presence: { key: crypto.randomUUID() } } });
    canal
      .on("presence", { event: "sync" }, () => setOtros(Math.max(0, Object.keys(canal.presenceState()).length - 1)))
      .subscribe(async (estado) => {
        if (estado === "SUBSCRIBED") await canal.track({ en: Date.now() });
      });
    return () => {
      void sb.removeChannel(canal);
      setOtros(0);
    };
  }, [id]);

  return otros;
}

/** Milisegundos hasta `hasta` (por defecto, la medianoche local). null hasta montar. */
export function useCuentaAtras(hasta?: number) {
  const [restante, setRestante] = useState<number | null>(null);
  useEffect(() => {
    const calcular = () => {
      const fin = hasta ?? (() => {
        const d = new Date();
        d.setHours(24, 0, 0, 0);
        return d.getTime();
      })();
      setRestante(Math.max(0, fin - Date.now()));
    };
    calcular();
    const t = setInterval(calcular, 1000);
    return () => clearInterval(t);
  }, [hasta]);
  return restante;
}

export function formatearCuentaAtras(ms: number) {
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

type Tono = "rojo" | "ambar" | "verde" | "violeta" | "azul";

const TONOS: Record<Tono, string> = {
  rojo: "bg-rose-600/90",
  ambar: "bg-amber-500/90",
  verde: "bg-emerald-600/90",
  violeta: "bg-violet-600/90",
  azul: "bg-sky-600/90",
};

function Badge({ tono, children }: { tono: Tono; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}

/**
 * Badges de urgencia/escasez. Todas las cifras son reales: "compradores buscando" sale del motor de coincidencias
 * (búsquedas activas que encajan), "personas viendo" de Realtime Presence y la cuenta atrás de `flash_until`.
 */
export default function FomoBadges({ anuncio, max = 3 }: { anuncio: Anuncio; max?: number }) {
  const { estado, compradoresBuscando, enBoost } = useSocial();
  const viewers = useViewers(anuncio.id);
  const restante = useCuentaAtras(anuncio.relampagoHasta);
  const buscando = compradoresBuscando(anuncio);
  const transito = estado.yo.signo ? transitoDelDia(estado.yo.signo) : null;

  const badges: React.ReactNode[] = [];

  if (anuncio.relampago && restante !== null) {
    badges.push(
      <Badge key="rel" tono="ambar">
        ⚡ Oferta Relámpago −{anuncio.relampago}% ·{" "}
        <span className="tabular-nums">{formatearCuentaAtras(restante)}</span>
      </Badge>,
    );
  }
  if (buscando > 0) {
    badges.push(
      <Badge key="bus" tono="rojo">
        🔥 {buscando} {buscando === 1 ? "comprador buscando" : "compradores buscando"} esto hoy
      </Badge>,
    );
  }
  if (viewers > 0) {
    badges.push(
      <Badge key="ver" tono="rojo">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <span className="tabular-nums" aria-live="polite">
          {viewers} {viewers === 1 ? "persona más viendo" : "personas más viendo"} esto ahora
        </span>
      </Badge>,
    );
  }
  if (transito?.favorable) {
    badges.push(
      <Badge key="tra" tono="violeta">
        🔮 Tránsito planetario favorable
      </Badge>,
    );
  }
  if (enBoost(anuncio.id)) {
    badges.push(
      <Badge key="boost" tono="azul">
        🚀 Destacado
      </Badge>,
    );
  } else if (anuncio.publicadaHace <= 1) {
    badges.push(
      <Badge key="nuevo" tono="verde">
        ✨ {anuncio.publicadaHace === 0 ? "Nueva: publicada hoy" : "Publicada ayer"}
      </Badge>,
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5" aria-label="Actividad de la oferta">
      {badges.slice(0, max)}
    </div>
  );
}
