"use client";

import { useCallback, useEffect, useState } from "react";
import { fechaHora, llamarAdmin } from "@/features/monedas/admin/util";
import { ETIQUETA_ESTADO_PAGO, MOTIVO_PAGO, type EstadoPago, type PagoAdmin } from "@/lib/adminMonedas";
import { PASARELAS, dolares, type Pasarela } from "@/lib/monedas";

const POR_PAGINA = 25;
const FILTROS: { id: EstadoPago | ""; etiqueta: string }[] = [
  { id: "", etiqueta: "Todos" },
  { id: "paid", etiqueta: "Pagados" },
  { id: "pending", etiqueta: "Pendientes" },
  { id: "failed", etiqueta: "Fallidos" },
  { id: "cancelled", etiqueta: "Cancelados" },
];

/** Listado de pagos de monedas con filtro por estado, para revisar ventas y resolver reclamos. */
export default function TabVentas() {
  const [estado, setEstado] = useState<EstadoPago | "">("");
  const [pagina, setPagina] = useState(0);
  const [datos, setDatos] = useState<{ total: number; items: PagoAdmin[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await llamarAdmin<{ total: number; items: PagoAdmin[] }>("admin_coin_payments", { p_status: estado || null, p_limit: POR_PAGINA, p_offset: pagina * POR_PAGINA });
    if ("error" in r) return setError(r.error);
    setError(null);
    setDatos(r.datos);
  }, [estado, pagina]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / POR_PAGINA)) : 1;

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Estado del pago">
        {FILTROS.map((f) => (
          <button key={f.id || "todos"} type="button" aria-pressed={estado === f.id} onClick={() => { setEstado(f.id); setPagina(0); }} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${estado === f.id ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"}`}>
            {f.etiqueta}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {!datos ? (
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-slate-100" />
      ) : datos.items.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No hay pagos con este filtro.</p>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-500" aria-live="polite">
            {datos.total} {datos.total === 1 ? "pago" : "pagos"} · página {pagina + 1} de {paginas}
          </p>
          <ul className="mt-2 space-y-2">
            {datos.items.map((p) => {
              const e = ETIQUETA_ESTADO_PAGO[p.estado];
              return (
                <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-ink">
                        {p.persona} {p.handle && <span className="text-xs font-normal text-slate-400">{p.handle}</span>}
                      </p>
                      <p className="text-xs text-slate-500">{fechaHora(p.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black tabular-nums text-ink">{dolares(p.centavos)}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${e.clase}`}>{e.etiqueta}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {p.paquete} · {p.coins} monedas{p.bonificadas > 0 && <span className="text-emerald-700"> (+{p.bonificadas} de regalo)</span>} · {PASARELAS[p.pasarela as Pasarela]?.etiqueta ?? p.pasarela}
                  </p>
                  {p.motivo && <p className="mt-1 text-xs font-semibold text-rose-700">⚠ {MOTIVO_PAGO[p.motivo] ?? p.motivo}</p>}
                  <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                    ref. nuestra {p.client_ref}
                    {p.ref_pasarela && <> · ref. pasarela {p.ref_pasarela}</>}
                    {p.paid_at && <> · pagado {fechaHora(p.paid_at)}</>}
                  </p>
                </li>
              );
            })}
          </ul>
          {paginas > 1 && (
            <nav aria-label="Paginación" className="mt-4 flex items-center justify-center gap-3">
              <button type="button" disabled={pagina === 0} onClick={() => setPagina((n) => n - 1)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-ink hover:border-brand-400 disabled:opacity-40">
                ← Anterior
              </button>
              <button type="button" disabled={pagina + 1 >= paginas} onClick={() => setPagina((n) => n + 1)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-ink hover:border-brand-400 disabled:opacity-40">
                Siguiente →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
