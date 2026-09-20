"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import { useReferidos } from "@/features/conexion/hooks";
import { formatearCuentaAtras, useCuentaAtras } from "@/components/FomoBadges";
import { BIENVENIDA_INVITADO, mensajeInvitacion, nivelDe, PREMIO_POR_INVITADO, progresoCirculo, siguienteHito, urlInvitacion } from "@/lib/referidos";
import { msHastaReinicio, RETOS } from "@/lib/retos";

const PREMIO_RETO = RETOS.find((r) => r.id === "invitar")?.premio ?? 30;

/**
 * Llamada a invitar amistades a cambio de monedas virtuales. Todo el incentivo es real y lo paga el servidor:
 * +50 por cada invitación que completa su perfil, +25 de bienvenida para quien entra con tu enlace, bonos por hito y el reto
 * diario «Trae a alguien». La urgencia sale de la cuenta atrás verdadera de ese reto (medianoche UTC), no de cifras inventadas.
 */
export default function InvitarCTA({ className = "" }: { className?: string }) {
  const { estado, sesion, hidratado } = useSocial();
  const { stats, cargando } = useReferidos();
  const reinicio = useMemo(() => Date.now() + msHastaReinicio(), []);
  const restante = useCuentaAtras(reinicio);
  const [copiado, setCopiado] = useState(false);

  if (!hidratado) return null;

  const cabecera = (
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-sun">🎁 Invita y gana monedas</p>
      <h2 className="mt-1 text-xl font-black leading-tight">
        +{PREMIO_POR_INVITADO} 🪙 por cada amistad que se une contigo
      </h2>
      <p className="mt-1 text-sm text-white/75">
        Tu invitada o invitado recibe {BIENVENIDA_INVITADO} 🪙 de bienvenida al completar su perfil, y tu estatus en la comunidad crece.
      </p>
    </>
  );

  if (!sesion.uid) {
    return (
      <section aria-label="Invita y gana monedas" className={`overflow-hidden rounded-2xl bg-ink p-5 text-white shadow-lg ${className}`}>
        {cabecera}
        <Link href="/registro?next=/invitar" className="boton-marca mt-4 inline-block rounded-full px-6 py-2.5 text-sm font-bold text-white">
          Crea tu cuenta y consigue tu enlace
        </Link>
        <p className="mt-3 text-[11px] text-white/50">Las monedas son virtuales y no tienen valor monetario.</p>
      </section>
    );
  }

  const confirmadas = stats?.confirmed ?? 0;
  const invitadas = stats?.invited ?? 0;
  const hito = siguienteHito(confirmadas);
  const nivel = nivelDe(confirmadas);
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
    <section aria-label="Invita y gana monedas" className={`overflow-hidden rounded-2xl bg-ink p-5 text-white shadow-lg ${className}`}>
      {cabecera}

      {restante !== null && (
        <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/85">
          ⏳ Reto de hoy: si alguien entra con tu enlace y completa su perfil, ganas <strong className="text-sun">+{PREMIO_RETO} 🪙 más</strong>. Termina en{" "}
          <span className="font-bold tabular-nums text-white">{formatearCuentaAtras(restante)}</span>.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={cargando ? "Generando tu enlace…" : url}
          aria-label="Tu enlace de invitación"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40"
        />
        <button type="button" onClick={() => void copiar()} disabled={!stats} className="boton-marca rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {copiado ? "¡Copiado! ✓" : "Copiar"}
        </button>
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!stats}
        className={`mt-2 inline-block rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 ${stats ? "" : "pointer-events-none opacity-50"}`}
      >
        Compartir por WhatsApp
      </a>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center" aria-label="Tus bonificaciones">
        <div className="rounded-xl bg-white/10 p-2">
          <dd className="text-xl font-black tabular-nums">{invitadas}</dd>
          <dt className="text-[10px] text-white/60">Invitadas</dt>
        </div>
        <div className="rounded-xl bg-white/10 p-2">
          <dd className="text-xl font-black tabular-nums">{confirmadas}</dd>
          <dt className="text-[10px] text-white/60">Con perfil completo</dt>
        </div>
        <div className="rounded-xl bg-white/10 p-2">
          <dd className="text-xl font-black tabular-nums text-sun">{stats?.coins_earned ?? 0} 🪙</dd>
          <dt className="text-[10px] text-white/60">Ganadas</dt>
        </div>
      </dl>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-white/80">
          <span>
            {nivel.emoji} Nivel {nivel.nombre}
          </span>
          {hito && (
            <span>
              Próximo bono: <strong className="text-sun">+{hito.bonus} 🪙</strong> a las {hito.n}
            </span>
          )}
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Progreso hacia tu círculo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresoCirculo(confirmadas)}>
          <div className="h-full rounded-full bg-gradient-to-r from-sun via-mango to-flame transition-all duration-700" style={{ width: `${progresoCirculo(confirmadas)}%` }} />
        </div>
        {hito && (
          <p className="mt-1.5 text-[11px] text-white/60">
            Te {hito.n - confirmadas === 1 ? "falta 1 persona" : `faltan ${hito.n - confirmadas} personas`} para el bono.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-white/50">
        <span>Las monedas son virtuales y no tienen valor monetario.</span>
        <Link href="/invitar" className="font-bold text-white/80 hover:underline">
          Ver mi círculo →
        </Link>
      </div>
    </section>
  );
}
