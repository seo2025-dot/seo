"use client";

import { useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import { useCosteAccion, usePrecios, useRetosComunidad, type RetoComunidad } from "@/features/monedas/hooks";
import { costeMensaje, esMensajeDeMonedas, mensajesHastaCobro, textoCoste, textoMonedas, type AccionUso } from "@/lib/monedas";

/**
 * Etiqueta con lo que costará la acción para esta persona: «🪙 Gratis · te quedan 2» o «🪙 1 moneda». Si el saldo no alcanza,
 * ofrece recargar ahí mismo. Se coloca junto al botón que ejecuta la acción.
 */
export function CosteAccion({ accion, className = "" }: { accion: AccionUso; className?: string }) {
  const { estado: e } = useCosteAccion(accion);
  const { estado, sesion } = useSocial();
  if (!e || !sesion.uid) return null;
  const faltan = !e.gratis && estado.monedas < e.cuesta;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 text-xs font-semibold ${faltan ? "text-rose-700" : e.gratis ? "text-emerald-700" : "text-slate-600"} ${className}`}>
      <span>🪙 {textoCoste(e)}</span>
      {faltan && (
        <Link href="/monedas" className="underline hover:text-rose-900">
          Te faltan monedas · Recargar
        </Link>
      )}
    </span>
  );
}

/** En las citas: cuántos mensajes puede escribir aún gratis (3 por conversación y luego 1 moneda cada 5). */
export function AvisoMensajesCita({ escritos }: { escritos: number }) {
  const precio = usePrecios().find((p) => p.accion === "chat_message");
  const { estado } = useSocial();
  if (!precio || precio.coste === 0) return null;
  const proximo = costeMensaje(precio, escritos);
  const hasta = mensajesHastaCobro(precio, escritos);
  const sinSaldo = proximo > 0 && estado.monedas < proximo;
  const texto =
    escritos < precio.gratis
      ? `💬 Te quedan ${precio.gratis - escritos} ${precio.gratis - escritos === 1 ? "mensaje gratis" : "mensajes gratis"} en esta cita`
      : proximo > 0
        ? `💬 Tu próximo mensaje cuesta ${textoMonedas(proximo)} (te da ${4} más)`
        : `💬 ${hasta} ${hasta === 1 ? "mensaje" : "mensajes"} más antes del próximo cobro (${textoMonedas(precio.coste)} cada 5)`;
  return (
    <p className={`mb-1.5 flex flex-wrap items-center gap-x-2 px-1 text-xs font-medium ${sinSaldo ? "text-rose-700" : "text-slate-500"}`}>
      <span>{texto}</span>
      {sinSaldo && (
        <Link href="/monedas" className="font-bold underline">
          Recargar
        </Link>
      )}
    </p>
  );
}

/** Mensaje de error de una operación. Si es por falta de monedas, ofrece las dos salidas: recargar o ganarlas con retos. */
export function FalloOperacion({ texto, className = "" }: { texto: string; className?: string }) {
  const monedas = esMensajeDeMonedas(texto);
  return (
    <div role="alert" className={`rounded-xl border p-3 text-sm font-medium ${monedas ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-800"} ${className}`}>
      <p>{texto}</p>
      {monedas && (
        <p className="mt-2 flex flex-wrap gap-2">
          <Link href="/monedas" className="boton-marca rounded-full px-4 py-1.5 text-xs font-bold text-white">
            Recargar monedas
          </Link>
          <Link href="/monedas#retos" className="rounded-full border border-amber-300 bg-white px-4 py-1.5 text-xs font-bold text-amber-900 hover:border-amber-500">
            Ganar monedas gratis
          </Link>
        </p>
      )}
    </div>
  );
}

const FMT_FIN = new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Guayaquil" });
function textoReinicio(finISO: string | null, ahora: number): string {
  if (!finISO) return "Se cobra una sola vez";
  const dias = Math.ceil((new Date(finISO).getTime() - ahora) / 86_400_000);
  return dias <= 1 ? "Termina hoy" : `Termina el ${FMT_FIN.format(new Date(finISO)).replace(/,/g, "")}`;
}

function TarjetaReto({ r, onCobrar, cobrando, ahora }: { r: RetoComunidad; onCobrar: (r: RetoComunidad) => void; cobrando: boolean; ahora: number }) {
  const listo = r.progress >= r.target && !r.claimed;
  const pct = Math.round((r.progress / r.target) * 100);
  return (
    <li className={`rounded-2xl border p-4 transition ${r.claimed ? "border-emerald-200 bg-emerald-50/60" : listo ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden>
          {r.claimed ? "✅" : r.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{r.title}</p>
          <p className="text-sm text-slate-600">{r.description}</p>
          {!r.claimed && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="tabular-nums">
                  {r.progress}/{r.target}
                </span>
                <span>{textoReinicio(r.ends_at, ahora)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={r.target} aria-valuenow={r.progress} aria-label={r.title}>
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          {r.claimed ? (
            <span className="text-xs font-bold text-emerald-700">Cobrado</span>
          ) : listo ? (
            <button type="button" disabled={cobrando} onClick={() => onCobrar(r)} className="boton-marca rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              Cobrar +{r.prize} 🪙
            </button>
          ) : r.href ? (
            <Link href={r.href} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-ink hover:border-brand-400">
              Ir · +{r.prize} 🪙
            </Link>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">+{r.prize} 🪙</span>
          )}
        </div>
      </div>
    </li>
  );
}

/** Retos semanales y únicos: ganar monedas sin gastar dinero. Se usa en «Monedas» y en «Retos». */
export function RetosComunidad({ titulo = "Gana monedas gratis" }: { titulo?: string }) {
  const { retos, error, cobrar } = useRetosComunidad();
  const { refrescarMonedero } = useSocial();
  const [aviso, setAviso] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState<string | null>(null);
  const [ahora] = useState(() => Date.now());

  const alCobrar = async (r: RetoComunidad) => {
    setCobrando(r.id);
    const res = await cobrar(r.id);
    setCobrando(null);
    setAviso("monedas" in res ? `🎉 ${r.title}: +${textoMonedas(res.monedas)}` : res.error);
    await refrescarMonedero();
  };

  const semanales = (retos ?? []).filter((r) => r.period === "weekly");
  const unicos = (retos ?? []).filter((r) => r.period === "once");

  return (
    <section id="retos" aria-labelledby="retos-comunidad-titulo" className="scroll-mt-24">
      <h2 id="retos-comunidad-titulo" className="text-2xl font-black text-ink">
        {titulo}
      </h2>
      <p className="text-sm text-slate-600">Completa retos con lo que ya haces en la plataforma: pedir, calificar, reservar, invitar. Las monedas que ganas sirven igual que las que compras.</p>

      {aviso && (
        <p role="status" className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-900">
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {retos === null ? (
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <>
          <Link href="/invitar" className="mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sun/30 to-flame/20 p-4 transition hover:shadow-md">
            <span className="text-3xl" aria-hidden>
              🌱
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black text-ink">Invita amigos: hasta +2 000 🪙 con 20</p>
              <p className="text-sm text-slate-700">+50 por cada amigo que se une, y bonos extra al llegar a 3, 5, 10 y 20 invitados (+600 🪙 con el reto de los 20).</p>
            </div>
            <span className="shrink-0 text-sm font-bold text-brand-700">Invitar →</span>
          </Link>

          {semanales.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Esta semana</h3>
              <ul className="space-y-3">
                {semanales.map((r) => (
                  <TarjetaReto key={r.id} r={r} onCobrar={(x) => void alCobrar(x)} cobrando={cobrando === r.id} ahora={ahora} />
                ))}
              </ul>
            </div>
          )}
          {unicos.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Retos de una sola vez</h3>
              <ul className="space-y-3">
                {unicos.map((r) => (
                  <TarjetaReto key={r.id} r={r} onCobrar={(x) => void alCobrar(x)} cobrando={cobrando === r.id} ahora={ahora} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <p className="mt-4 text-xs text-slate-500">
        ¿Retos de cada día? Están en{" "}
        <Link href="/retos" className="font-semibold text-brand-700 hover:underline">
          Retos diarios
        </Link>
        .
      </p>
    </section>
  );
}
