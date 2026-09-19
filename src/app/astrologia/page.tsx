"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Signo, TipoRelacion } from "@/types/social";
import { useSocial } from "@/context/SocialContext";
import { claveDia, ETIQUETA_ELEMENTO, infoSigno, SIGNOS, signoDeFecha, sinastria, transitoDelDia } from "@/lib/astrologia";
import { COSTES } from "@/lib/recompensas";
import { ARCANOS, POSICIONES_PREMIUM, type Arcano } from "@/lib/tarot";
import { ETIQUETA_RELACION, hash } from "@/lib/social";
import Avatar from "@/components/Avatar";
import { AstralBadge } from "@/components/PerfilBadges";

const selectCls =
  "w-full rounded-lg border border-white/30 bg-white/90 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-fuchsia-300";

function Medidor({ etiqueta, valor, color }: { etiqueta: string; valor: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-medium text-white/85">
        <span>{etiqueta}</span>
        <span className="tabular-nums">{valor}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/20">
        <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${valor}%` }} transition={{ duration: 0.9, delay: 0.3 }} />
      </div>
    </div>
  );
}

function CartaGirable({ arcano, revelada, onClick, posicion }: { arcano?: Arcano; revelada: boolean; onClick?: () => void; posicion?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={revelada || !onClick}
        aria-label={revelada && arcano ? `Carta ${arcano.nombre}` : "Girar carta"}
        className="relative h-56 w-36 [perspective:900px] disabled:cursor-default"
      >
        <motion.div
          className="relative h-full w-full [transform-style:preserve-3d]"
          animate={{ rotateY: revelada ? 180 : 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 70, damping: 14 }}
        >
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-amber-300/70 bg-gradient-to-br from-indigo-900 via-violet-800 to-fuchsia-800 shadow-xl [backface-visibility:hidden]">
            <span className="text-5xl text-amber-200">✦</span>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-fuchsia-100 p-3 text-center shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {arcano && (
              <>
                <span className="text-5xl">{arcano.simbolo}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-violet-700">
                  {arcano.n} · {arcano.nombre}
                </span>
                <span className="text-[11px] text-slate-600">{arcano.clave}</span>
              </>
            )}
          </div>
        </motion.div>
      </button>
      {posicion && <span className="text-xs font-semibold text-white/80">{posicion}</span>}
    </div>
  );
}

export default function AstrologiaPage() {
  const { estado, hidratado, usuarios, editarPerfil, sacarCartaDelDia, hacerTiradaPremium, canjearTirada } = useSocial();
  const yo = estado.yo;

  const [nacimiento, setNacimiento] = useState("");
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ahora, setAhora] = useState<number | null>(null);

  // Compatibilidad
  const [contexto, setContexto] = useState<TipoRelacion>("pareja");
  const [signoA, setSignoA] = useState<Signo | "">("");
  const [signoB, setSignoB] = useState<Signo | "">("");

  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (hidratado && yo.nacimiento) setNacimiento(yo.nacimiento);
  }, [hidratado, yo.nacimiento]);

  const guardarFecha = async (e: React.FormEvent) => {
    e.preventDefault();
    const signo = signoDeFecha(nacimiento);
    const hoy = claveDia();
    if (!signo || nacimiento > hoy || nacimiento < "1900-01-01") {
      setErrorFecha("Indica una fecha de nacimiento válida.");
      return;
    }
    setErrorFecha(null);
    // La fecha completa es privada (user_private); el perfil público solo muestra el signo.
    if (!(await editarPerfil({ nacimiento, signo }))) setErrorFecha("No se pudo guardar. Comprueba que tengas 18 años o más.");
  };

  const info = yo.signo ? infoSigno(yo.signo) : null;
  const transito = yo.signo ? transitoDelDia(yo.signo) : null;

  const tirada = estado.tarotDia;
  const proxima = tirada ? tirada.ts + 24 * 3_600_000 : 0;
  const puedeSacar = !tirada || (ahora !== null && ahora >= proxima);
  const restanteH = ahora !== null && tirada ? Math.max(0, proxima - ahora) : 0;
  const arcanoDia = tirada && !puedeSacar ? ARCANOS[tirada.cartas[0]] : undefined;

  const [girando, setGirando] = useState<number | null>(null);
  const cartaActual = girando !== null ? ARCANOS[girando] : arcanoDia;

  const sacar = async () => {
    const n = await sacarCartaDelDia(); // el servidor elige la carta y aplica el límite de 24 h
    if (n === null) return;
    setGirando(n);
  };

  const valoresDia = useMemo(() => {
    if (!cartaActual) return null;
    const base = `${claveDia()}-${yo.signo ?? "x"}-${cartaActual.n}`;
    return { amor: 55 + (hash(`${base}-a`) % 45), dinero: 55 + (hash(`${base}-d`) % 45), suerte: 55 + (hash(`${base}-s`) % 45) };
  }, [cartaActual, yo.signo]);

  const premium = estado.tarotPremium;

  const tirarPremium = async () => {
    setAviso(null);
    if (estado.tiradasPremium <= 0) {
      if (!(await canjearTirada())) {
        setAviso(`Necesitas ${COSTES.tiradaPremium} 💰. Consíguelas en Recompensas.`);
        return;
      }
    }
    if (!(await hacerTiradaPremium())) setAviso("No se pudo iniciar la tirada. Inténtalo de nuevo.");
  };

  const a = signoA || yo.signo || "";
  const sin = a && signoB ? sinastria(a as Signo, signoB as Signo, contexto) : null;

  const ranking = useMemo(() => {
    if (!yo.signo) return [];
    return usuarios
      .filter((u) => u.signo)
      .map((u) => ({ u, s: sinastria(yo.signo as Signo, u.signo as Signo, contexto) }))
      .sort((x, y) => y.s.puntaje - x.s.puntaje)
      .slice(0, 5);
  }, [usuarios, yo.signo, contexto]);

  return (
    <div className="bg-gradient-to-b from-indigo-950 via-violet-900 to-fuchsia-900 pb-16 text-white">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <header className="text-center">
          <h1 className="text-4xl font-extrabold">🔮 Astrología y Tarot</h1>
          <p className="mt-2 text-white/80">Tu carta del día, tu tránsito y la compatibilidad astral con quien quieras.</p>
        </header>

        {/* Signo y tránsito */}
        <section className="glass rounded-3xl p-6" aria-labelledby="titulo-signo">
          <h2 id="titulo-signo" className="text-xl font-bold">Tu signo solar</h2>
          {info && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="text-6xl">{info.simbolo}</span>
              <div>
                <p className="text-2xl font-bold">{info.nombre}</p>
                <p className="text-sm text-white/75">
                  {ETIQUETA_ELEMENTO[info.elemento]} · {info.modalidad} · {info.fechas}
                </p>
              </div>
            </div>
          )}
          {transito && (
            <p className={`mt-4 rounded-xl p-3 text-sm ${transito.favorable ? "bg-emerald-500/25" : "bg-amber-500/25"}`}>
              <strong>{transito.favorable ? "🔮 " : "🌙 "}{transito.titulo}:</strong> {transito.texto}
            </p>
          )}
          <form onSubmit={guardarFecha} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="nacimiento" className="mb-1 block text-xs font-medium text-white/80">
                Fecha de nacimiento (solo se comparte tu signo)
              </label>
              <input id="nacimiento" type="date" value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} max={claveDia()} className={selectCls} />
            </div>
            <button type="submit" className="rounded-lg bg-fuchsia-500 px-5 py-2 text-sm font-semibold hover:bg-fuchsia-400">
              {info ? "Actualizar" : "Calcular mi signo"}
            </button>
          </form>
          {errorFecha && <p role="alert" className="mt-2 text-sm text-rose-300">{errorFecha}</p>}
        </section>

        {/* Carta del día */}
        <section className="glass rounded-3xl p-6" aria-labelledby="titulo-carta">
          <h2 id="titulo-carta" className="text-xl font-bold">Carta del día</h2>
          <div className="mt-4 grid items-center gap-6 md:grid-cols-[auto_1fr]">
            <div className="mx-auto">
              <CartaGirable arcano={cartaActual} revelada={!!cartaActual} onClick={puedeSacar && ahora !== null ? sacar : undefined} />
            </div>
            <div>
              {cartaActual && valoresDia ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="space-y-4">
                  <p className="text-2xl font-bold">
                    {cartaActual.simbolo} {cartaActual.nombre} — <span className="text-amber-200">{cartaActual.clave}</span>
                  </p>
                  <div className="space-y-3 text-sm">
                    <div>
                      <Medidor etiqueta="💞 Amor" valor={valoresDia.amor} color="bg-pink-400" />
                      <p className="mt-1 text-white/90">{cartaActual.amor}</p>
                    </div>
                    <div>
                      <Medidor etiqueta="💰 Dinero y negocios" valor={valoresDia.dinero} color="bg-emerald-400" />
                      <p className="mt-1 text-white/90">{cartaActual.dinero}</p>
                    </div>
                    <div>
                      <Medidor etiqueta="🍀 Suerte" valor={valoresDia.suerte} color="bg-amber-300" />
                      <p className="mt-1 text-white/90">{cartaActual.suerte}</p>
                    </div>
                  </div>
                  {!puedeSacar && ahora !== null && (
                    <p className="text-xs text-white/70">
                      Podrás sacar otra carta en {Math.floor(restanteH / 3_600_000)} h {Math.floor((restanteH % 3_600_000) / 60_000)} min.
                    </p>
                  )}
                </motion.div>
              ) : (
                <div>
                  <p className="text-lg">Concéntrate en tu pregunta y toca la carta para revelar tu mensaje de hoy.</p>
                  <p className="mt-2 text-sm text-white/70">Puedes sacar una carta gratis cada 24 horas.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Tirada premium */}
        <section className="glass rounded-3xl p-6" aria-labelledby="titulo-premium">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="titulo-premium" className="text-xl font-bold">✨ Tirada Premium: pasado, presente y futuro</h2>
              <p className="text-sm text-white/75">
                Tres cartas para una lectura más profunda. Tienes {estado.tiradasPremium} {estado.tiradasPremium === 1 ? "tirada" : "tiradas"} · Cuesta {COSTES.tiradaPremium} 💰.
              </p>
            </div>
            <button type="button" onClick={tirarPremium} className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-slate-900 shadow hover:scale-105">
              {estado.tiradasPremium > 0 ? "Hacer tirada" : `Canjear y tirar (${COSTES.tiradaPremium} 💰)`}
            </button>
          </div>
          {aviso && (
            <p role="status" className="mt-3 text-sm text-amber-200">
              {aviso}{" "}
              <Link href="/recompensas" className="underline">
                Ir a Recompensas
              </Link>
            </p>
          )}
          {premium && (
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {premium.cartas.map((n, i) => {
                const c = ARCANOS[n];
                return (
                  <div key={n} className="flex flex-col items-center gap-3 text-center">
                    <CartaGirable arcano={c} revelada posicion={POSICIONES_PREMIUM[i]} />
                    <p className="text-sm font-semibold text-amber-200">{c.nombre}</p>
                    <p className="text-xs text-white/85">{i === 0 ? c.amor : i === 1 ? c.dinero : c.suerte}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Sinastría */}
        <section className="glass rounded-3xl p-6" aria-labelledby="titulo-sinastria">
          <h2 id="titulo-sinastria" className="text-xl font-bold">Compatibilidad astral (sinastría)</h2>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Tipo de relación">
            {(Object.keys(ETIQUETA_RELACION) as TipoRelacion[]).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={contexto === r}
                onClick={() => setContexto(r)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${contexto === r ? "border-fuchsia-300 bg-fuchsia-500" : "border-white/30 hover:bg-white/10"}`}
              >
                {ETIQUETA_RELACION[r]}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="signo-a" className="mb-1 block text-xs text-white/80">Tu signo</label>
              <select id="signo-a" value={a} onChange={(e) => setSignoA(e.target.value as Signo)} className={selectCls}>
                <option value="">Elige un signo</option>
                {SIGNOS.map((s) => (
                  <option key={s.id} value={s.id}>{s.simbolo} {s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="signo-b" className="mb-1 block text-xs text-white/80">Signo de la otra persona</label>
              <select id="signo-b" value={signoB} onChange={(e) => setSignoB(e.target.value as Signo)} className={selectCls}>
                <option value="">Elige un signo</option>
                {SIGNOS.map((s) => (
                  <option key={s.id} value={s.id}>{s.simbolo} {s.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {sin && (
            <motion.div key={`${a}-${signoB}-${contexto}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 rounded-2xl bg-black/20 p-6 text-center">
              <p className="text-5xl font-extrabold">{sin.puntaje}%</p>
              <p className="mt-1 text-xl font-bold text-amber-200">{sin.titulo}</p>
              <p className="text-sm text-white/80">{sin.resumen}</p>
              <p className="mx-auto mt-3 max-w-md text-sm text-white/90">{sin.detalle}</p>
            </motion.div>
          )}

          {yo.signo && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-white/90">Mayor afinidad contigo ({ETIQUETA_RELACION[contexto]})</h3>
              <ul className="space-y-2">
                {ranking.map(({ u }) => (
                  <li key={u.id}>
                    <Link href={`/usuarios/${u.id}`} className="flex items-center gap-3 rounded-xl bg-white/10 p-3 transition hover:bg-white/20">
                      <Avatar nombre={u.nombre} foto={u.foto} tamano="sm" />
                      <span className="flex-1 truncate text-sm font-medium">{u.nombre}</span>
                      <AstralBadge yo={yo} otro={u} contexto={contexto} compacto />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <p className="text-center text-xs text-white/60">
          La astrología y el tarot se ofrecen únicamente con fines de entretenimiento y no sustituyen asesoría médica, legal ni financiera.
        </p>
      </div>
    </div>
  );
}
