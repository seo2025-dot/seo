"use client";

import { useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import { RetosComunidad } from "@/features/monedas/Piezas";
import { usePrecios, useTienda, useUsos } from "@/features/monedas/hooks";
import { BONO_PRIMERA_COMPRA_PCT, PASARELAS, ahorroFrente, bonoPrimeraCompra, dolares, estadoUso, textoCoste, textoMonedas, textoMovimiento, type PaqueteMonedas, type Pasarela } from "@/lib/monedas";

const MENSAJES_ERROR: Record<string, string> = {
  sin_sesion: "Inicia sesión para recargar monedas.",
  pasarela_no_disponible: "Esta forma de pago todavía no está disponible.",
  demasiados_pendientes: "Tienes varios pagos sin completar. Espera unos minutos.",
  pasarela_error: "No se pudo conectar con la pasarela. Inténtalo de nuevo en un momento.",
};

const FMT_FECHA = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" });

/** «Monedas»: saldo, usos gratis, tienda de recargas ($0.50, $1.50 y $3.50), retos para ganar gratis y movimientos. */
export default function PaginaMonedas() {
  const { estado, sesion, hidratado } = useSocial();
  const { paquetes, pasarelas, movimientos, primeraCompra } = useTienda();
  const precios = usePrecios();
  const { usos } = useUsos();
  const [pagando, setPagando] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  if (!hidratado) return <div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-8" />;
  if (!sesion.uid) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-5xl" aria-hidden>
          🪙
        </p>
        <h1 className="mt-4 text-2xl font-black text-ink">Tus monedas</h1>
        <p className="mt-2 text-slate-500">Inicia sesión para ver tu saldo, recargar o ganar monedas con retos.</p>
        <Link href="/login?next=/monedas" className="boton-marca mt-6 inline-block rounded-full px-8 py-3 font-bold text-white">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  const pagar = async (p: PaqueteMonedas, pasarela: Pasarela) => {
    setFallo(null);
    setPagando(`${p.id}:${pasarela}`);
    try {
      const r = await fetch("/api/pagos/crear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paquete: p.id, pasarela }) });
      const d = (await r.json()) as { url?: string; error?: string; mensaje?: string };
      if (!r.ok || !d.url) {
        setFallo(d.mensaje ?? MENSAJES_ERROR[d.error ?? ""] ?? "No se pudo iniciar el pago.");
        setPagando(null);
        return;
      }
      window.location.href = d.url; // la pasarela devuelve a la persona a /monedas/resultado
    } catch {
      setFallo("No se pudo conectar. Revisa tu conexión e inténtalo otra vez.");
      setPagando(null);
    }
  };

  const base = paquetes[0];
  const conTarifa = precios.filter((p) => p.accion !== "provider_boost");
  const boost = precios.find((p) => p.accion === "provider_boost");
  const hayPasarela = pasarelas ? Object.values(pasarelas).some(Boolean) : false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="rounded-3xl bg-ink p-6 text-white">
        <p className="text-sm text-white/70">Tu saldo</p>
        <p className="text-5xl font-black tabular-nums text-sun">🪙 {estado.monedas}</p>
        <p className="mt-2 max-w-xl text-sm text-white/70">
          Tus primeros 3 usos de cada cosa son gratis. Después, las monedas mantienen la plataforma viva: las compras desde <strong className="text-white">$0.50</strong> o las ganas con retos, sin gastar dinero.
        </p>
      </header>

      <section aria-labelledby="gratis-titulo" className="mt-8">
        <h2 id="gratis-titulo" className="text-2xl font-black text-ink">
          Tus usos gratis
        </h2>
        <p className="text-sm text-slate-600">Cada acción tiene 3 usos gratis por persona. Esto es lo que te queda y lo que cuesta después.</p>
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {conTarifa.map((p) => {
            const e = estadoUso(p, usos?.find((u) => u.accion === p.accion));
            const usados = Math.min(p.gratis, usos?.find((u) => u.accion === p.accion)?.gratisUsados ?? 0);
            return (
              <li key={p.accion} className="flex flex-wrap items-center justify-between gap-2 p-3.5">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{p.etiqueta}</p>
                  <p className="text-xs text-slate-500">{p.quien}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1" aria-hidden>
                    {Array.from({ length: p.gratis }, (_, i) => (
                      <span key={i} className={`h-2.5 w-6 rounded-full ${i < usados ? "bg-slate-200" : "bg-emerald-400"}`} />
                    ))}
                  </div>
                  <p className={`mt-1 text-xs font-bold ${e.gratisRestantes > 0 ? "text-emerald-700" : "text-slate-600"}`}>
                    {usos === null ? "…" : e.gratisRestantes > 0 ? textoCoste(e) : `Después: ${textoMonedas(p.coste)}${p.accion === "chat_message" ? " cada 5" : ""}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        {boost && (
          <p className="mt-2 text-xs text-slate-500">
            Y para destacar tu negocio 24 h arriba en los listados: {textoMonedas(boost.coste)}. Los mensajes de citas: 3 gratis por conversación y luego 1 moneda cada 5.
          </p>
        )}
      </section>

      <section aria-labelledby="tienda-titulo" className="mt-10">
        <h2 id="tienda-titulo" className="text-2xl font-black text-ink">
          Recargar monedas
        </h2>
        <p className="text-sm text-slate-600">
          Pago seguro con PayPhone (Ecuador) o PayPal. Las monedas llegan a tu cuenta en cuanto se confirma el pago.
          {primeraCompra && <strong className="text-brand-700"> Tu primera recarga trae +{BONO_PRIMERA_COMPRA_PCT} % de monedas extra.</strong>}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {paquetes.map((p) => {
            const extra = primeraCompra ? bonoPrimeraCompra(p.monedas) : 0;
            const ahorro = base ? ahorroFrente(p, base) : 0;
            const destacado = Boolean(p.insignia);
            return (
              <div key={p.id} className={`relative flex flex-col rounded-3xl border-2 bg-white p-5 shadow-sm ${destacado ? "border-brand-500" : "border-slate-200"}`}>
                {p.insignia && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-600 px-3 py-1 text-xs font-black text-white">{p.insignia}</span>}
                <p className="text-sm font-bold text-slate-500">{p.etiqueta}</p>
                <p className="mt-1 text-4xl font-black tabular-nums text-ink">{dolares(p.centavos)}</p>
                <p className="mt-2 text-lg font-black text-brand-700">🪙 {p.monedas}</p>
                {extra > 0 && <p className="text-sm font-bold text-emerald-700">+{extra} de regalo → {p.monedas + extra} en total</p>}
                {ahorro > 0 && <p className="text-xs text-slate-500">Cada moneda sale {ahorro} % más barata</p>}
                <div className="mt-4 space-y-2">
                  {(["payphone", "paypal", ...(pasarelas?.prueba ? (["prueba"] as const) : [])] as Pasarela[]).map((k) => {
                    const disponible = pasarelas?.[k] ?? false;
                    return (
                      <button
                        key={k}
                        type="button"
                        disabled={!disponible || pagando !== null}
                        onClick={() => void pagar(p, k)}
                        title={disponible ? PASARELAS[k].ayuda : "Próximamente"}
                        className={`w-full rounded-full px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed ${disponible ? (k === "prueba" ? "border border-dashed border-slate-400 text-slate-700 hover:bg-slate-50" : "boton-marca text-white") : "bg-slate-100 text-slate-400"}`}
                      >
                        {pagando === `${p.id}:${k}` ? "Abriendo…" : disponible ? `Pagar con ${PASARELAS[k].etiqueta}` : `${PASARELAS[k].etiqueta} · Próximamente`}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {pasarelas !== null && !hayPasarela && (
          <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Los pagos con tarjeta se activarán muy pronto. Mientras tanto puedes ganar monedas con los retos de abajo.
          </p>
        )}
        {fallo && (
          <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {fallo}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Las monedas se usan solo dentro de conectari.com y no se pueden retirar ni cambiar por dinero. Las devolvemos si el negocio rechaza tu pedido, no responde a tiempo o cancelan el evento.
        </p>
      </section>

      <div className="mt-10">
        <RetosComunidad />
      </div>

      <section aria-labelledby="mov-titulo" className="mt-10">
        <h2 id="mov-titulo" className="text-2xl font-black text-ink">
          Movimientos
        </h2>
        {movimientos.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Aquí verás lo que ganas y gastas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {movimientos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 p-3.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{textoMovimiento(m.motivo)}</p>
                  <p className="text-xs text-slate-400">{FMT_FECHA.format(m.creado)}</p>
                </div>
                <span className={`shrink-0 font-black tabular-nums ${m.delta > 0 ? "text-emerald-700" : "text-slate-600"}`}>
                  {m.delta > 0 ? "+" : ""}
                  {m.delta} 🪙
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Más formas de usar tus monedas:{" "}
          <Link href="/recompensas" className="font-semibold text-brand-700 hover:underline">
            Recompensas (boost, super likes y lecturas)
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
