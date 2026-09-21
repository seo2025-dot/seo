"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSocial } from "@/context/SocialContext";
import { formatearCuentaAtras, useCuentaAtras } from "@/components/FomoBadges";
import HistoriasBar from "@/components/HistoriasBar";
import { formatearPrecio } from "@/lib/formato";
import { precioFinal } from "@/lib/anuncios";
import { BONUS_CHECKIN_BASE, BONUS_POR_DIA_RACHA, COSTES, MISIONES, SEGMENTOS_RULETA, SUPER_LIKES_POR_PACK } from "@/lib/recompensas";

const COLORES = ["#f97316", "#ec4899", "#8b5cf6", "#0ea5e9", "#10b981", "#eab308", "#ef4444", "#6366f1"];
const N = SEGMENTOS_RULETA.length;
const ANGULO = 360 / N;

function punto(r: number, grados: number) {
  const rad = ((grados - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(rad), 100 + r * Math.sin(rad)];
}

function Ruleta({ rotacion, alTerminar }: { rotacion: number; alTerminar: () => void }) {
  return (
    <div className="relative mx-auto h-64 w-64">
      <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 text-3xl drop-shadow" aria-hidden>
        ▼
      </div>
      <motion.svg
        viewBox="0 0 200 200"
        className="h-full w-full rounded-full shadow-2xl ring-4 ring-white/70"
        animate={{ rotate: rotacion }}
        transition={{ duration: 4.5, ease: [0.17, 0.67, 0.2, 1] }}
        onAnimationComplete={alTerminar}
        role="img"
        aria-label="Ruleta de premios"
      >
        {SEGMENTOS_RULETA.map((valor, i) => {
          const [x1, y1] = punto(98, i * ANGULO);
          const [x2, y2] = punto(98, (i + 1) * ANGULO);
          const [tx, ty] = punto(68, i * ANGULO + ANGULO / 2);
          return (
            <g key={i}>
              <path d={`M100 100 L${x1} ${y1} A98 98 0 0 1 ${x2} ${y2} Z`} fill={COLORES[i % COLORES.length]} stroke="#fff" strokeWidth="1.5" />
              <text x={tx} y={ty} fill="#fff" fontSize="16" fontWeight="800" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${i * ANGULO + ANGULO / 2} ${tx} ${ty})`}>
                {valor}
              </text>
            </g>
          );
        })}
        <circle cx="100" cy="100" r="14" fill="#fff" />
        <text x="100" y="101" fontSize="14" textAnchor="middle" dominantBaseline="middle">💰</text>
      </motion.svg>
    </div>
  );
}

function OfertaRelampago() {
  const { anuncios } = useSocial();
  const restante = useCuentaAtras();
  const ofertas = anuncios.filter((a) => a.relampago).slice(0, 4);
  if (ofertas.length === 0) return null;
  return (
    <section className="glass-claro col-span-full rounded-3xl p-5" aria-labelledby="titulo-flash">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-flash" className="text-lg font-extrabold text-rose-600">⚡ Ofertas Relámpago</h2>
        {restante !== null && (
          <span className="rounded-full bg-rose-600 px-3 py-1 text-sm font-bold tabular-nums text-white">Termina en {formatearCuentaAtras(restante)}</span>
        )}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ofertas.map((a) => (
          <Link key={a.id} href={a.href} className="group overflow-hidden rounded-2xl bg-white shadow transition hover:shadow-lg">
            <div className="relative aspect-[4/3]">
              <Image src={a.imagen} alt={a.titulo} fill sizes="25vw" className="object-cover transition group-hover:scale-105" />
              <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">−{a.relampago}%</span>
            </div>
            <div className="p-3">
              <p className="line-clamp-1 text-sm font-semibold">{a.titulo}</p>
              <p className="text-sm font-bold text-rose-600">
                {formatearPrecio(precioFinal(a), a.moneda)} <span className="text-xs font-normal text-slate-400 line-through">{formatearPrecio(a.precio, a.moneda)}</span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function RecompensasPage() {
  const {
    estado,
    anuncios,
    misionesCumplidas,
    checkin,
    girarRuleta,
    canjearBoost,
    canjearSuperLikes,
    canjearTirada,
    reclamarMision,
    enBoost,
  } = useSocial();

  const [rotacion, setRotacion] = useState(0);
  const [girando, setGirando] = useState(false);
  const [premio, setPremio] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [boostId, setBoostId] = useState("");

  const hoy = new Date().toISOString().slice(0, 10); // el servidor usa la fecha UTC
  const checkinHecho = estado.ultimoCheckin === hoy;
  const ruletaUsada = estado.ultimaRuleta === hoy;
  const proximoBonus = BONUS_CHECKIN_BASE + BONUS_POR_DIA_RACHA * Math.min(estado.racha, 6);

  const misAnuncios = useMemo(() => anuncios.filter((a) => a.duenoId === "yo"), [anuncios]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const [premioPendiente, setPremioPendiente] = useState<number | null>(null);

  const reclamarCheckin = async () => {
    const monto = await checkin();
    if (monto) setAviso(`🎁 +${monto} monedas. ¡Racha de ${Math.min(estado.racha + 1, 7)} día(s)!`);
  };

  const girar = async () => {
    if (girando) return;
    const r = await girarRuleta(); // el servidor sortea y acredita el premio
    if (!r) return;
    setPremio(null);
    setPremioPendiente(r.monto);
    setGirando(true);
    const destino = 360 * 5 + (360 - (r.indice * ANGULO + ANGULO / 2));
    setRotacion((prev) => prev - (prev % 360) + destino);
  };

  const terminarGiro = () => {
    if (!girando) return;
    setGirando(false);
    setPremio(premioPendiente);
  };

  const canjear = async (fn: () => Promise<boolean>, ok: string) => setAviso((await fn()) ? ok : "No se pudo canjear: comprueba que tengas suficientes monedas 💰");
  return (
    <div className="bg-gradient-to-b from-orange-500 via-rose-500 to-fuchsia-600 pb-16">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="glass rounded-3xl p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/80">Tu saldo</p>
              <p className="text-5xl font-extrabold tabular-nums">💰 {estado.monedas}</p>
              <Link href="/monedas" className="mt-1 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white transition hover:bg-white/30">
                + Recargar desde $0.50
              </Link>
              <p className="mt-1 text-sm text-white/80">🔥 Racha: {estado.racha} {estado.racha === 1 ? "día" : "días"} · ❤️ Super Likes: {estado.superLikes} · 🔮 Tiradas premium: {estado.tiradasPremium}</p>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={reclamarCheckin}
              disabled={checkinHecho}
              className="rounded-2xl bg-white px-6 py-4 text-lg font-extrabold text-rose-600 shadow-xl transition hover:scale-105 disabled:opacity-60"
            >
              {checkinHecho ? "✅ Bono de hoy reclamado" : `🎁 Reclamar bono diario (+${proximoBonus})`}
            </motion.button>
          </div>
          <div className="mt-4">
            <HistoriasBar claro />
          </div>
        </header>

        {aviso && (
          <div role="status" className="glass rounded-2xl px-5 py-3 text-center font-semibold text-white">
            {aviso}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Ruleta */}
          <section className="glass-claro rounded-3xl p-6 text-center" aria-labelledby="titulo-ruleta">
            <h2 id="titulo-ruleta" className="text-xl font-extrabold">🎡 Ruleta diaria</h2>
            <p className="mb-4 text-sm text-slate-600">Un giro gratis al día. ¡Los premios grandes son raros!</p>
            <Ruleta rotacion={rotacion} alTerminar={terminarGiro} />
            <button
              type="button"
              onClick={girar}
              disabled={girando || ruletaUsada}
              className="mt-6 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3 text-lg font-extrabold text-white shadow-lg transition hover:scale-105 disabled:opacity-60"
            >
              {girando ? "Girando…" : ruletaUsada ? "Vuelve mañana" : "¡Girar!"}
            </button>
            {premio !== null && !girando && (
              <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-4 text-2xl font-extrabold text-emerald-600" role="status">
                🎉 ¡Ganaste {premio} monedas!
              </motion.p>
            )}
          </section>

          {/* Misiones */}
          <section className="glass-claro rounded-3xl p-6" aria-labelledby="titulo-misiones">
            <h2 id="titulo-misiones" className="text-xl font-extrabold">🎯 Misiones</h2>
            <ul className="mt-4 space-y-3">
              {MISIONES.map((m) => {
                const cumplida = misionesCumplidas.includes(m.id);
                const reclamada = estado.misiones.includes(m.id);
                return (
                  <li key={m.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                    <span className="text-2xl" aria-hidden>{m.emoji}</span>
                    <span className="flex-1 text-sm font-medium">{m.titulo}</span>
                    {reclamada ? (
                      <span className="text-xs font-semibold text-emerald-600">✓ Reclamada</span>
                    ) : cumplida ? (
                      <button type="button" onClick={() => { reclamarMision(m.id); setAviso(`🎉 +${m.premio} monedas`); }} className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600">
                        Reclamar +{m.premio} 💰
                      </button>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">+{m.premio} 💰</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              <Link href="/perfil" className="underline">Completa tu perfil</Link> ·{" "}
              <Link href="/verificacion" className="underline">Verifica tu identidad</Link>
            </p>
          </section>

          <OfertaRelampago />

          {/* Canje */}
          <section className="glass-claro col-span-full rounded-3xl p-6" aria-labelledby="titulo-canje">
            <h2 id="titulo-canje" className="text-xl font-extrabold">🛍️ Canjear monedas</h2>
            <p className="text-sm text-slate-600">Las monedas son virtuales y no tienen valor monetario.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-3xl">🚀</p>
                <h3 className="font-bold">Boost 24 h</h3>
                <p className="mb-3 text-sm text-slate-500">Destaca un inmueble, vehículo o negocio tuyo en las primeras posiciones.</p>
                {misAnuncios.length === 0 ? (
                  <Link href="/publicar" className="mt-auto rounded-xl bg-slate-100 px-4 py-2 text-center text-sm font-semibold text-slate-600">
                    Publica algo primero
                  </Link>
                ) : (
                  <>
                    <select aria-label="Anuncio a destacar" value={boostId} onChange={(e) => setBoostId(e.target.value)} className="mb-2 rounded-lg border border-slate-300 px-2 py-2 text-sm">
                      <option value="">Elige un anuncio…</option>
                      {misAnuncios.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.titulo}{enBoost(a.id) ? " (destacado)" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!boostId}
                      onClick={() => canjear(() => canjearBoost(boostId), "🚀 ¡Anuncio destacado durante 24 h!")}
                      className="mt-auto rounded-xl boton-marca px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Canjear · {COSTES.boost} 💰
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-3xl">💘</p>
                <h3 className="font-bold">Pack de {SUPER_LIKES_POR_PACK} Super Likes</h3>
                <p className="mb-3 text-sm text-slate-500">Destaca tu perfil y avisa al instante a la otra persona. Te quedan {estado.superLikes}.</p>
                <button type="button" onClick={() => canjear(canjearSuperLikes, `💘 +${SUPER_LIKES_POR_PACK} Super Likes`)} className="mt-auto rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-bold text-white">
                  Canjear · {COSTES.superLikes} 💰
                </button>
              </div>

              <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-3xl">🔮</p>
                <h3 className="font-bold">Tirada Premium de Tarot</h3>
                <p className="mb-3 text-sm text-slate-500">Lectura de 3 cartas: pasado, presente y futuro. Tienes {estado.tiradasPremium}.</p>
                <button type="button" onClick={() => canjear(canjearTirada, "🔮 Tirada premium añadida. ¡Úsala en Astrología!")} className="mt-auto rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white">
                  Canjear · {COSTES.tiradaPremium} 💰
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
