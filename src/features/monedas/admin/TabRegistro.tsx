"use client";

import { useEffect, useState } from "react";
import { fechaHora, llamarAdmin } from "@/features/monedas/admin/util";
import { textoLog, type EntradaLog } from "@/lib/adminMonedas";

const ICONO: Record<string, string> = { price: "🏷️", package: "📦", package_new: "🆕", setting: "⚙️", challenge: "🎯", grant: "🎁", adjust: "✏️" };

/** Registro de auditoría: quién cambió qué en la economía de monedas, con el antes y el después. */
export default function TabRegistro() {
  const [log, setLog] = useState<EntradaLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void llamarAdmin<EntradaLog[]>("admin_coin_log", { p_limit: 100 }).then((r) => ("error" in r ? setError(r.error) : setLog(r.datos)));
  }, []);

  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
        {error}
      </p>
    );
  }
  if (!log) return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />;
  if (log.length === 0) return <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Todavía no se ha cambiado nada desde el panel.</p>;
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {log.map((e) => (
        <li key={e.id} className="flex items-start gap-3 p-3.5 text-sm">
          <span aria-hidden className="text-xl">
            {ICONO[e.accion] ?? "📝"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-ink">{textoLog(e)}</p>
            <p className="text-xs text-slate-400">
              {e.admin ?? "Administrador eliminado"} · {fechaHora(e.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
