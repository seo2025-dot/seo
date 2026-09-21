"use client";

import { useCallback, useState } from "react";
import { AvisoAccion, claseInput, fechaHora, llamarAdmin, useAccion } from "@/features/monedas/admin/util";
import { ETIQUETA_ESTADO_PAGO, cantidadAjuste, etiquetaAccionUso, validarAjuste, type FichaMonedasPersona, type PersonaEncontrada } from "@/lib/adminMonedas";
import { PASARELAS, dolares, textoMovimiento, type Pasarela } from "@/lib/monedas";

/** Soporte: busca a una persona (nombre, @usuario, correo o id), mira su saldo, usos, pagos y movimientos, y ajusta su saldo con un motivo. */
export default function TabPersonas() {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<PersonaEncontrada[] | null>(null);
  const [ficha, setFicha] = useState<FichaMonedasPersona | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const { guardando, aviso, ejecutar, limpiar } = useAccion();

  const abrir = useCallback(async (id: string) => {
    const r = await llamarAdmin<FichaMonedasPersona>("admin_user_coins", { p_user: id });
    if ("error" in r) return setErrorBusqueda(r.error);
    setErrorBusqueda(null);
    setFicha(r.datos);
  }, []);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    setFicha(null);
    limpiar();
    const r = await llamarAdmin<PersonaEncontrada[]>("admin_find_user", { p_q: consulta });
    if ("error" in r) {
      setResultados(null);
      return setErrorBusqueda(r.error);
    }
    setErrorBusqueda(null);
    setResultados(r.datos);
    if (r.datos.length === 1) await abrir(r.datos[0].id);
  };

  const ajustar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ficha) return;
    const err = validarAjuste({ cantidad, motivo });
    setErrores(err);
    if (Object.keys(err).length > 0) return;
    const n = cantidadAjuste(cantidad);
    if (!window.confirm(`${n > 0 ? "Sumar" : "Restar"} ${Math.abs(n)} monedas ${n > 0 ? "a" : "de"} ${ficha.persona.nombre}? Quedará en el registro.`)) return;
    await ejecutar("ajuste", () => llamarAdmin("admin_adjust_coins", { p_user: ficha.persona.id, p_delta: n, p_reason: motivo.trim() }), "Ajuste aplicado.", async () => {
      setCantidad("");
      setMotivo("");
      await abrir(ficha.persona.id);
    });
  };

  return (
    <div>
      <form onSubmit={buscar} role="search" className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="adm-buscar">
          Buscar persona
        </label>
        <input id="adm-buscar" value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Nombre, @usuario, correo o id…" className={`${claseInput} flex-1 py-2.5`} />
        <button type="submit" disabled={consulta.trim().length < 2} className="boton-marca rounded-lg px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          Buscar
        </button>
      </form>
      {errorBusqueda && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {errorBusqueda}
        </p>
      )}

      {resultados && !ficha && (
        <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {resultados.length === 0 && <li className="p-6 text-center text-sm text-slate-500">No encontramos a nadie con eso.</li>}
          {resultados.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => void abrir(p.id)} className="flex w-full items-center justify-between gap-3 p-3.5 text-left hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block font-bold text-ink">{p.nombre}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {p.handle} · {p.email}
                  </span>
                </span>
                <span className="shrink-0 font-black tabular-nums text-brand-700">🪙 {p.monedas}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {ficha && (
        <div className="mt-5 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-ink p-5 text-white">
            <div className="min-w-0">
              <p className="text-xl font-black">
                {ficha.persona.nombre} {ficha.persona.verificada && <span title="Identidad verificada">✅</span>}
                {ficha.persona.demo && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">demo</span>}
              </p>
              <p className="text-sm text-white/70">
                {ficha.persona.handle} · {ficha.persona.email}
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-white/40">{ficha.persona.id}</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black tabular-nums text-sun">🪙 {ficha.monedas}</p>
              <button type="button" onClick={() => setFicha(null)} className="mt-1 text-xs font-semibold text-white/70 underline">
                Volver a los resultados
              </button>
            </div>
          </div>

          <form onSubmit={ajustar} noValidate className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-lg font-black text-ink">Ajustar saldo</h3>
            <p className="text-sm text-slate-600">Escribe la cantidad con signo: +50 para regalar, -20 para descontar. El motivo queda en su historial y en el registro.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-start">
              <div>
                <label className="text-xs font-semibold text-slate-500" htmlFor="adm-cant">
                  Cantidad
                </label>
                <input id="adm-cant" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="+50" inputMode="numeric" aria-invalid={!!errores.cantidad} className={`${claseInput} mt-1`} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500" htmlFor="adm-motivo">
                  Motivo
                </label>
                <input id="adm-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Compensación por un pedido que falló" maxLength={60} aria-invalid={!!errores.motivo} className={`${claseInput} mt-1`} />
              </div>
              <button type="submit" disabled={guardando !== null} className="boton-marca mt-5 rounded-full px-6 py-2 text-sm font-bold text-white disabled:opacity-40">
                Aplicar
              </button>
            </div>
            {(errores.cantidad || errores.motivo) && (
              <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">
                {errores.cantidad ?? errores.motivo}
              </p>
            )}
            <div className="mt-3" aria-live="polite">
              <AvisoAccion aviso={aviso} />
            </div>
          </form>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="ficha-usos">
              <h3 id="ficha-usos" className="mb-2 text-lg font-black text-ink">
                Usos
              </h3>
              {ficha.usos.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Todavía no ha usado ninguna acción con tarifa.</p>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
                  {ficha.usos.map((u) => (
                    <li key={u.accion} className="flex items-center justify-between gap-3 p-3">
                      <span className="text-slate-700">{etiquetaAccionUso(u.accion)}</span>
                      <span className="text-right text-xs text-slate-500">
                        {u.gratis} gratis · {u.pagados} de pago · <strong className="text-ink">{u.gastadas} 🪙</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mb-2 mt-5 text-lg font-black text-ink">Pagos</h3>
              {ficha.pagos.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No ha intentado comprar monedas.</p>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
                  {ficha.pagos.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                      <span>
                        <span className="font-semibold text-ink">{dolares(p.centavos)}</span> · {p.paquete} · {PASARELAS[p.pasarela as Pasarela]?.etiqueta ?? p.pasarela}
                        <span className="block text-xs text-slate-400">{fechaHora(p.created_at)}</span>
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ETIQUETA_ESTADO_PAGO[p.estado].clase}`}>{ETIQUETA_ESTADO_PAGO[p.estado].etiqueta}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="ficha-mov">
              <h3 id="ficha-mov" className="mb-2 text-lg font-black text-ink">
                Últimos movimientos
              </h3>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
                {ficha.movimientos.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 p-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{textoMovimiento(m.motivo)}</span>
                      <span className="block text-xs text-slate-400">{fechaHora(m.created_at)}</span>
                    </span>
                    <span className={`shrink-0 font-black tabular-nums ${m.delta > 0 ? "text-emerald-700" : "text-slate-600"}`}>
                      {m.delta > 0 ? "+" : ""}
                      {m.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
