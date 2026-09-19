"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useSocial } from "@/context/SocialContext";
import { transitoDelDia } from "@/lib/astrologia";
import { POR_ID, PRINCIPALES } from "@/lib/marca";
import AnuncioCard from "@/components/AnuncioCard";
import SearchBar from "@/components/SearchBar";
import SeccionQueEs from "@/components/SeccionQueEs";
import { formatearCuentaAtras, useCuentaAtras } from "@/components/FomoBadges";

export default function Home() {
  const { estado, sesion, hidratado, anuncios, gigs, vacantes, noLeidosTotal } = useSocial();
  const restante = useCuentaAtras();

  const bonoDisponible = hidratado && !!sesion.uid && estado.ultimoCheckin !== new Date().toISOString().slice(0, 10);
  const transito = estado.yo.signo ? transitoDelDia(estado.yo.signo) : null;
  const relampago = anuncios.filter((a) => a.relampago);
  const destacados = anuncios.filter((a) => a.duenoId !== "yo").slice(0, 6);
  const buscando = estado.demandas.length;

  const cuenta = (tipo: string) => anuncios.filter((a) => a.tipo === tipo).length;
  const principales = [
    { ...PRINCIPALES[0], texto: "Casas, departamentos, terrenos y locales", chip: `${cuenta("propiedad")} activos` },
    { ...PRINCIPALES[1], texto: "Autos y motos entre particulares", chip: `${cuenta("vehiculo")} ofertas` },
    { ...PRINCIPALES[2], texto: "Comercios, productos y profesionales", chip: `${cuenta("negocio")} negocios` },
    { ...PRINCIPALES[3], texto: "Freelancers, gigs y bolsa de trabajo", chip: `${gigs.length} servicios · ${vacantes.length} vacantes` },
    { ...PRINCIPALES[4], texto: "Conoce gente, haz amigos, conecta", chip: "Únete" },
  ];
  const secundarias = [
    { ...POR_ID.busco, texto: "Publica tu presupuesto", chip: `${buscando} búsquedas` },
    { ...POR_ID.citas, texto: "Pareja, amistad o roomies", chip: "Match astral" },
    { ...POR_ID.astrologia, texto: "Carta del día", chip: estado.tarotDia ? "Carta lista" : "¡Saca tu carta!" },
    { ...POR_ID.mensajes, texto: "Negocia y conversa", chip: noLeidosTotal > 0 ? `${noLeidosTotal} sin leer` : "Al día" },
    { ...POR_ID.recompensas, texto: "Ruleta, misiones y canjes", chip: `💰 ${estado.monedas}` },
  ];

  return (
    <>
      <section className="hero-suave px-4 pb-14 pt-14 sm:pb-20 sm:pt-24">
        <div className="mx-auto max-w-5xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-ink sm:text-6xl"
          >
            Todo lo que necesitas en <span className="texto-marca">tu ciudad</span>, en una sola app.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-600"
          >
            Inmuebles, vehículos, negocios, empleos y comunidad. Trato directo entre personas, con perfiles y valoraciones verificadas.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-10 max-w-4xl text-left"
          >
            <SearchBar />
          </motion.div>

          {(bonoDisponible || transito?.favorable) && (
            <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
              {bonoDisponible && (
                <Link href="/recompensas" className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 font-semibold text-brand-800 transition hover:bg-brand-100">
                  🎁 Tienes un bono diario y una ruleta esperándote
                </Link>
              )}
              {transito?.favorable && (
                <Link href="/astrologia" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:border-slate-300">
                  🔮 Tránsito planetario favorable para tu signo hoy
                </Link>
              )}
            </div>
          )}

          <p className="mt-8 text-sm font-medium text-slate-500">
            Trato directo <span aria-hidden className="mx-2 text-brand-400">·</span> Perfiles verificados <span aria-hidden className="mx-2 text-brand-400">·</span> Hiperlocal
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4" aria-labelledby="explora">
        <h2 id="explora" className="mb-4 text-2xl font-black text-ink sm:text-3xl">
          Explora tu ciudad <span className="texto-marca">a un toque</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {principales.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: 0.06 * i, duration: 0.5 }}
              className={i === 4 ? "col-span-2 lg:col-span-1" : ""}
            >
              <Link
                href={m.href}
                className={`tarjeta-viva flex h-full min-h-44 flex-col rounded-3xl bg-gradient-to-br ${m.degradado} p-4 shadow-lg sm:p-5 ${m.oscuro ? "text-ink" : "text-white"}`}
              >
                <span className="emoji-vivo text-4xl sm:text-5xl">{m.emoji}</span>
                <span className="mt-auto pt-4 text-xl font-black leading-tight [font-family:var(--font-display)]">{m.etiqueta}</span>
                <span className={`mt-1 text-xs font-medium ${m.oscuro ? "text-ink/80" : "text-white/90"}`}>{m.texto}</span>
                <span className={`mt-3 self-start rounded-full px-2.5 py-0.5 text-[11px] font-bold ${m.oscuro ? "bg-ink/15" : "bg-white/25"}`}>{m.chip}</span>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {secundarias.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.05 * i }}>
              <Link href={m.href} className="tarjeta-viva flex h-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${m.degradado} text-xl shadow`}>
                  <span className="emoji-vivo">{m.emoji}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-ink">{m.etiqueta}</span>
                  <span className="block truncate text-[11px] text-slate-500">{m.texto}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-bold text-brand-700">{m.chip}</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {relampago.length > 0 && (
        <section className="mx-auto mt-12 max-w-6xl px-4" aria-labelledby="flash">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 id="flash" className="text-2xl font-black text-flame">⚡ Ofertas Relámpago</h2>
            {restante !== null && (
              <span className="animate-pulse rounded-full bg-flame px-3 py-1 text-sm font-bold tabular-nums text-white">Termina en {formatearCuentaAtras(restante)}</span>
            )}
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relampago.slice(0, 3).map((a) => (
              <AnuncioCard key={a.id} anuncio={a} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto mt-12 max-w-6xl px-4 pb-12" aria-labelledby="destacados">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="destacados" className="text-2xl font-black text-ink sm:text-3xl">Destacados de la comunidad</h2>
          <Link href="/match" className="text-sm font-bold text-brand-700 transition hover:translate-x-1 hover:underline">
            Hacer match →
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {destacados.map((a) => (
            <AnuncioCard key={a.id} anuncio={a} />
          ))}
        </div>
      </section>

      <SeccionQueEs />
    </>
  );
}
