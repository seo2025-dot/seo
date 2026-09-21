"use client";

import { useCallback, useEffect, useState } from "react";
import { Tarjeta, llamarAdmin } from "@/features/monedas/admin/util";
import { ORIGEN_MONEDAS, alturasBarras, etiquetaAccionUso, resumenEconomia, type EstadisticasMonedas } from "@/lib/adminMonedas";
import { PASARELAS, dolares, textoMonedas, type Pasarela } from "@/lib/monedas";

const PERIODOS = [7, 30, 90] as const;
const FMT_DIA = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", timeZone: "UTC" });

/** Resumen de la economía: ventas, compradores, monedas en circulación, de dónde salen y en qué se gastan. */
export default function TabResumen() {
  const [dias, setDias] = useState<number>(30);
  const [s, setS] = useState<EstadisticasMonedas | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await llamarAdmin<EstadisticasMonedas>("admin_coin_stats", { p_days: dias });
    if ("error" in r) return setError(r.error);
    setError(null);
    setS(r.datos);
  }, [dias]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
        {error}
      </p>
    );
  }
  if (!s) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;

  const r = resumenEconomia(s);
  const alturas = alturasBarras(s.diario);
  const pasarela = (p: string) => PASARELAS[p as Pasarela]?.etiqueta ?? p;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-ink">Últimos {s.dias} días</h2>
        <div role="group" aria-label="Periodo" className="inline-flex overflow-hidden rounded-full border border-slate-300">
          {PERIODOS.map((p) => (
            <button key={p} type="button" aria-pressed={dias === p} onClick={() => setDias(p)} className={`px-4 py-1.5 text-sm font-bold ${dias === p ? "bg-ink text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              {p} días
            </button>
          ))}
        </div>
      </div>

      <section aria-label="Ventas" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta titulo="Ingresos" valor={r.ingresos} ayuda={`${s.ventas.pagos} ${s.ventas.pagos === 1 ? "pago" : "pagos"} · ticket medio ${r.ticketMedio}`} tono={s.ventas.centavos > 0 ? "bien" : "normal"} />
        <Tarjeta titulo="Compradores" valor={String(s.compradores.periodo)} ayuda={`${r.conversionPct} % de ${s.usuarios} personas registradas`} />
        <Tarjeta titulo="Repiten compra" valor={`${r.repeticionPct} %`} ayuda={`${s.compradores.repetidores} de ${s.compradores.total} compradores`} />
        <Tarjeta titulo="Ingreso por persona" valor={r.ingresoPorUsuario} ayuda="Sobre todas las personas registradas" />
        <Tarjeta titulo="Monedas en circulación" valor={String(s.circulacion)} ayuda="Saldo total de todas las cuentas" />
        <Tarjeta titulo="Monedas emitidas" valor={String(r.emitidasTotal)} ayuda={`${r.gratisPct} % son gratis (retos, bonos, invitaciones)`} />
        <Tarjeta titulo="Monedas gastadas" valor={String(r.gastadasTotal)} ayuda={`Rotación ${r.rotacionPct} %: cuanto más alta, más se usa lo que se gana`} tono={r.rotacionPct < 20 && r.emitidasTotal > 0 ? "atencion" : "normal"} />
        <Tarjeta titulo="Pagos sin completar" valor={`${s.ventas.pendientes} · ${s.ventas.fallidos + s.ventas.cancelados}`} ayuda="Pendientes · fallidos y cancelados" tono={s.ventas.fallidos > 0 ? "atencion" : "normal"} />
      </section>

      <section aria-labelledby="ing-diarios">
        <h3 id="ing-diarios" className="mb-2 text-lg font-black text-ink">
          Ingresos por día
        </h3>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex h-40 items-end gap-[3px]" role="img" aria-label={`Ingresos diarios de los últimos ${s.dias} días, total ${r.ingresos}`}>
            {s.diario.map((d, i) => (
              <div key={d.dia} title={`${FMT_DIA.format(new Date(`${d.dia}T00:00:00Z`))}: ${dolares(d.centavos)} (${d.pagos} ${d.pagos === 1 ? "pago" : "pagos"})`} className="flex h-full min-w-0 flex-1 items-end">
                <div className={`w-full rounded-t ${d.centavos > 0 ? "bg-brand-500" : "bg-slate-100"}`} style={{ height: `${Math.max(alturas[i], 2)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>{FMT_DIA.format(new Date(`${s.diario[0]?.dia}T00:00:00Z`))}</span>
            <span>Hoy</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="origen">
          <h3 id="origen" className="mb-2 text-lg font-black text-ink">
            De dónde salen las monedas
          </h3>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
            {ORIGEN_MONEDAS.map((o) => {
              const n = s.emitidas[o.id] ?? 0;
              return (
                <li key={o.id} className="flex items-center justify-between gap-3 p-3">
                  <span className="text-slate-700">{o.etiqueta}</span>
                  <span className="font-black tabular-nums text-ink">{n}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Las compradas incluyen la bonificación de la primera compra ({textoMonedas(s.ventas.bonificadas)} este periodo).
          </p>
        </section>

        <section aria-labelledby="gasto">
          <h3 id="gasto" className="mb-2 text-lg font-black text-ink">
            En qué se gastan
          </h3>
          {s.gastadas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Todavía nadie ha pagado con monedas: los usos gratis aún cubren todo.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
              {s.gastadas.map((g) => (
                <li key={g.accion} className="flex items-center justify-between gap-3 p-3">
                  <span className="text-slate-700">{etiquetaAccionUso(g.accion)}</span>
                  <span className="text-right">
                    <span className="font-black tabular-nums text-ink">{g.monedas}</span>
                    <span className="block text-xs text-slate-400">{g.usos} {g.usos === 1 ? "uso" : "usos"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="pasarelas">
          <h3 id="pasarelas" className="mb-2 text-lg font-black text-ink">
            Por pasarela
          </h3>
          {s.por_pasarela.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Sin ventas en el periodo.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
              {s.por_pasarela.map((p) => (
                <li key={p.pasarela} className="flex items-center justify-between gap-3 p-3">
                  <span className="text-slate-700">{pasarela(p.pasarela)}</span>
                  <span className="font-black tabular-nums text-ink">
                    {dolares(p.centavos)} <span className="text-xs font-normal text-slate-400">· {p.pagos}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="paquetes">
          <h3 id="paquetes" className="mb-2 text-lg font-black text-ink">
            Por paquete
          </h3>
          {s.por_paquete.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Sin ventas en el periodo.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
              {s.por_paquete.map((p) => (
                <li key={p.paquete} className="flex items-center justify-between gap-3 p-3">
                  <span className="text-slate-700">{p.paquete}</span>
                  <span className="font-black tabular-nums text-ink">
                    {dolares(p.centavos)} <span className="text-xs font-normal text-slate-400">· {p.pagos}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
