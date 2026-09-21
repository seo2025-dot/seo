"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSocial } from "@/context/SocialContext";
import Avatar from "@/components/Avatar";
import PruebaSocial from "@/components/PruebaSocial";
import { useReferidos } from "@/features/conexion/hooks";
import {
  BIENVENIDA_INVITADO,
  HITOS,
  META_CIRCULO,
  mensajeInvitacion,
  NIVELES,
  nivelDe,
  PREMIO_POR_INVITADO,
  progresoCirculo,
  siguienteHito,
  siguienteNivel,
  urlInvitacion,
} from "@/lib/referidos";
import IconoMoneda, { TextoConMonedas } from "@/components/IconoMoneda";

export default function InvitarPage() {
  const { estado, sesion, hidratado } = useSocial();
  const { stats, ranking, cargando } = useReferidos();
  const [copiado, setCopiado] = useState(false);
  const [puedeCompartir, setPuedeCompartir] = useState(false);

  useEffect(() => setPuedeCompartir(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  if (!hidratado) return <div className="mx-auto h-96 max-w-3xl animate-pulse px-4 py-8" />;
  if (!sesion.uid) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-5xl">🌱</p>
        <h1 className="mt-4 text-2xl font-black">Construye tu círculo</h1>
        <p className="mt-2 text-slate-500">Inicia sesión para obtener tu enlace de invitación personal.</p>
        <Link href="/login?next=/invitar" className="boton-marca mt-6 inline-block rounded-full px-8 py-3 font-bold text-white">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  const confirmados = stats?.confirmed ?? 0;
  const pendientes = Math.max(0, (stats?.invited ?? 0) - confirmados);
  const nivel = nivelDe(confirmados);
  const proximo = siguienteNivel(confirmados);
  const hito = siguienteHito(confirmados);
  const url = stats ? urlInvitacion(window.location.origin, stats.code) : "";
  const texto = mensajeInvitacion(estado.yo.nombre, url);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Copia tu enlace:", url);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
        <p className="text-sm font-semibold text-sun">Tu círculo de {META_CIRCULO}</p>
        <h1 className="mt-1 text-3xl font-black leading-tight sm:text-4xl">
          {nivel.emoji} Nivel {nivel.nombre}
        </h1>
        <p className="mt-1 text-white/70">{nivel.lema}</p>

        <div className="mt-6">
          <div className="flex items-end justify-between">
            <p className="text-5xl font-black tabular-nums">
              {confirmados}
              <span className="text-2xl text-white/50"> / {META_CIRCULO}</span>
            </p>
            <p className="text-right text-xs text-white/60">
              personas que ya completaron su perfil
              {pendientes > 0 && <span className="block">+{pendientes} por confirmar</span>}
            </p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={confirmados} aria-valuemin={0} aria-valuemax={META_CIRCULO} aria-label="Progreso hacia tu círculo de 20">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-sun via-mango to-flame" initial={{ width: 0 }} animate={{ width: `${progresoCirculo(confirmados)}%` }} transition={{ duration: 0.8 }} />
          </div>
          <p className="mt-3 text-sm text-white/80">
            <TextoConMonedas
              texto={
                proximo
                  ? `Te faltan ${proximo.min - confirmados} para ser ${proximo.nombre} ${proximo.emoji}${hito ? ` · próximo bono: +${hito.bonus} 🪙 al llegar a ${hito.n}` : ""}.`
                  : "¡Completaste tu círculo! Eres un Faro para esta comunidad. 🎉"
              }
            />
          </p>
        </div>
      </header>

      <section aria-labelledby="enlace" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="enlace" className="text-lg font-black text-ink">
          Tu enlace personal
        </h2>
        <p className="text-sm text-slate-500">Cada persona que entre con él y complete su perfil te suma {PREMIO_POR_INVITADO} <IconoMoneda /> y recibe {BIENVENIDA_INVITADO} <IconoMoneda /> de bienvenida.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={cargando ? "Generando tu enlace…" : url} aria-label="Tu enlace de invitación" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm" />
          <button type="button" onClick={() => void copiar()} disabled={!stats} className="boton-marca rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {copiado ? "¡Copiado! ✓" : "Copiar"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!stats}
            className={`rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 ${stats ? "" : "pointer-events-none opacity-50"}`}
          >
            Compartir por WhatsApp
          </a>
          {puedeCompartir && (
            <button type="button" disabled={!stats} onClick={() => void navigator.share({ title: "conectari.com", text: texto, url }).catch(() => {})} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-ink hover:border-brand-400 disabled:opacity-50">
              Más opciones…
            </button>
          )}
          <a href={`mailto:?subject=${encodeURIComponent("Te invito a conectari.com")}&body=${encodeURIComponent(texto)}`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-ink hover:border-brand-400">
            Correo
          </a>
        </div>
        {stats && <p className="mt-3 text-xs text-slate-500">Has ganado {stats.coins_earned} <IconoMoneda /> con tus invitaciones. Las monedas son virtuales y no tienen valor monetario.</p>}
      </section>

      <section aria-labelledby="hitos" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="hitos" className="text-lg font-black text-ink">
          Rangos y bonos del círculo
        </h2>
        <ol className="mt-3 space-y-2">
          {NIVELES.map((n) => {
            const alcanzado = confirmados >= n.min;
            const bono = HITOS.find((h) => h.n === n.min);
            return (
              <li key={n.nombre} className={`flex items-center gap-3 rounded-2xl p-3 ${alcanzado ? "bg-emerald-50" : "bg-slate-50"} ${n.nombre === nivel.nombre ? "ring-2 ring-brand-400" : ""}`}>
                <span className={`text-2xl ${alcanzado ? "" : "grayscale"}`} aria-hidden>
                  {n.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">
                    {n.nombre} <span className="text-xs font-medium text-slate-500">· {n.min === 0 ? "al registrarte" : `${n.min} ${n.min === 1 ? "persona" : "personas"}`}</span>
                  </p>
                  <p className="text-xs text-slate-600">{n.lema}</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-slate-500">{bono ? <>+{bono.bonus} <IconoMoneda /></> : alcanzado ? "✓" : ""}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="ranking" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="ranking" className="text-lg font-black text-ink">
          Quienes más han hecho crecer la comunidad
        </h2>
        {ranking.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aún no hay invitaciones confirmadas. Sé la primera persona en aparecer aquí.</p>
        ) : (
          <ol className="mt-3 divide-y divide-slate-100">
            {ranking.map((f, i) => (
              <li key={`${f.handle}-${i}`} className="flex items-center gap-3 py-2.5">
                <span className="w-6 text-center text-sm font-black text-slate-400">{i + 1}</span>
                <Avatar nombre={f.display_name} foto={f.avatar_url ?? undefined} tamano="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{f.display_name}</span>
                <span className="text-sm font-bold tabular-nums text-brand-700">
                  {nivelDe(f.confirmed).emoji} {f.confirmed}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <PruebaSocial />
    </div>
  );
}
