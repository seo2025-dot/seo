"use client";

import { useEffect, useState } from "react";
import type { TipoPedido } from "@/lib/directorio/carrito";
import { textoDinero } from "@/lib/directorio/mapeo";
import { etiquetaEstado, seguimiento, tiempoParaCaducar, type Pedido } from "@/lib/directorio/pedidos";
import type { EstadoPedido } from "@/data/directorio";

const CLASE_ESTADO: Record<EstadoPedido, string> = {
  placed: "bg-amber-50 text-amber-800",
  accepted: "bg-sky-50 text-sky-800",
  preparing: "bg-sky-50 text-sky-800",
  on_the_way: "bg-indigo-50 text-indigo-800",
  delivered: "bg-emerald-50 text-emerald-800",
  rejected: "bg-rose-50 text-rose-700",
  cancelled: "bg-slate-100 text-slate-600",
};

export function InsigniaEstado({ tipo, estado }: { tipo: TipoPedido; estado: EstadoPedido }) {
  const e = etiquetaEstado(tipo, estado);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${CLASE_ESTADO[estado]}`}>
      <span aria-hidden>{e.emoji}</span>
      {e.etiqueta}
    </span>
  );
}

/** Reloj que se actualiza cada 30 s (para cuenta atrás y «hace X min»). */
export function useAhora(intervaloMs = 30_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
  return ahora;
}

/** «Si nadie responde en 2 h 15 min se cancela solo». Solo para pedidos aún sin respuesta. */
export function AvisoCaducidad({ pedido, ahora, comoNegocio }: { pedido: Pedido; ahora: number; comoNegocio: boolean }) {
  const resto = tiempoParaCaducar(pedido, ahora);
  if (resto === null) return null;
  const min = Math.ceil(resto / 60_000);
  const texto = min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
  return (
    <p role="status" className="text-xs font-medium text-amber-700">
      ⏳ {comoNegocio ? `Respóndelo en ${texto} o se cancelará solo.` : `Si el negocio no responde en ${texto}, se cancela solo.`}
    </p>
  );
}

/** Línea de tiempo del pedido (Enviado → Aceptado → Preparando → En camino/Listo → Entregado/Retirado). */
export function LineaTiempo({ pedido }: { pedido: Pick<Pedido, "tipo" | "estado"> }) {
  const { pasos, terminal } = seguimiento(pedido.tipo, pedido.estado);
  if (terminal) {
    const e = etiquetaEstado(pedido.tipo, terminal);
    return (
      <p role="status" className={`rounded-2xl p-4 text-sm font-bold ${CLASE_ESTADO[terminal]}`}>
        {e.emoji} {terminal === "rejected" ? "El negocio no pudo atender este pedido." : "Este pedido se canceló."}
      </p>
    );
  }
  return (
    <ol aria-label="Progreso del pedido" className="flex items-start justify-between gap-1">
      {pasos.map((p, i) => (
        <li key={p.estado} aria-current={p.actual ? "step" : undefined} className="flex min-w-0 flex-1 flex-col items-center text-center">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition ${p.hecho ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"} ${p.actual ? "ring-4 ring-brand-200" : ""}`} aria-hidden>
            {p.emoji}
          </span>
          <span className={`mt-1 text-[11px] leading-tight ${p.hecho ? "font-bold text-ink" : "text-slate-400"}`}>{p.etiqueta}</span>
          <span className="sr-only">{p.hecho ? (p.actual ? " (paso actual)" : " (hecho)") : " (pendiente)"}</span>
          {i < pasos.length - 1 && <span className="hidden" />}
        </li>
      ))}
    </ol>
  );
}

export function ResumenTotales({ pedido }: { pedido: Pick<Pedido, "subtotal" | "envio" | "total" | "tipo"> }) {
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between">
        <dt className="text-slate-600">Subtotal</dt>
        <dd className="tabular-nums">{textoDinero(pedido.subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-slate-600">{pedido.tipo === "delivery" ? "Envío" : "Retiro en el local"}</dt>
        <dd className="tabular-nums">{pedido.envio > 0 ? textoDinero(pedido.envio) : "Gratis"}</dd>
      </div>
      <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-black text-ink">
        <dt>Total</dt>
        <dd className="tabular-nums">{textoDinero(pedido.total)}</dd>
      </div>
    </dl>
  );
}
