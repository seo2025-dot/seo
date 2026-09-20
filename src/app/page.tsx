"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSocial } from "@/context/SocialContext";
import { transitoDelDia } from "@/lib/astrologia";
import { POR_ID, PRINCIPALES } from "@/lib/marca";
import AvisoVivo from "@/components/AvisoVivo";
import ConectoresDestacados from "@/components/ConectoresDestacados";
import InvitarCTA from "@/components/InvitarCTA";
import MiembrosRecientes from "@/components/MiembrosRecientes";
import MuroHome from "@/components/MuroHome";
import PanelHoy from "@/components/PanelHoy";
import PruebaSocial from "@/components/PruebaSocial";
import SearchBar from "@/components/SearchBar";
import SeccionQueEs from "@/components/SeccionQueEs";
import TendenciasSemana from "@/components/TendenciasSemana";
import { useEscritorio } from "@/features/comunidad/hooks";

export default function Home() {
  const { estado, sesion, hidratado, anuncios, gigs, vacantes, noLeidosTotal } = useSocial();
  const escritorio = useEscritorio();

  const bonoDisponible = hidratado && !!sesion.uid && estado.ultimoCheckin !== new Date().toISOString().slice(0, 10);
  const transito = estado.yo.signo ? transitoDelDia(estado.yo.signo) : null;
  const buscando = estado.demandas.length;

  // Ofertas del carrusel del muro: las relámpago primero y luego los destacados de otras personas.
  const ofertas = useMemo(() => {
    const relampago = anuncios.filter((a) => a.relampago);
    const destacados = anuncios.filter((a) => a.duenoId !== "yo" && !a.relampago);
    return [...relampago, ...destacados].slice(0, 8);
  }, [anuncios]);

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
    { ...POR_ID.explorar, texto: "Personas afines, con filtros", chip: "Motor de afinidad" },
    { ...POR_ID.citas, texto: "Pareja, amistad o roomies", chip: "Match astral" },
    { ...POR_ID.retos, texto: "Gana monedas cada día", chip: "Retos diarios" },
    { ...POR_ID.invitar, texto: "Tu círculo de 20", chip: "Sube de rango" },
    { ...POR_ID.astrologia, texto: "Carta del día", chip: estado.tarotDia ? "Carta lista" : "¡Saca tu carta!" },
    { ...POR_ID.mensajes, texto: "Negocia y conversa", chip: noLeidosTotal > 0 ? `${noLeidosTotal} sin leer` : "Al día" },
    { ...POR_ID.recompensas, texto: "Ruleta, misiones y canjes", chip: `💰 ${estado.monedas}` },
  ];

  return (
    <>
      {/* 1 · Las categorías, lo primero que se ve al entrar */}
      <section className="hero-suave px-4 pb-8 pt-6 sm:pb-10 sm:pt-10" aria-labelledby="explora">
        <div className="mx-auto max-w-6xl">
          <motion.h1
            id="explora"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-3xl font-black leading-tight tracking-tight text-ink sm:text-5xl"
          >
            Explora tu ciudad <span className="texto-marca">a un toque</span>
          </motion.h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-lg">
            Todo lo que necesitas en tu ciudad, en una sola app: trato directo entre personas, con perfiles y valoraciones verificadas.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            {principales.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.45 }}
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

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {secundarias.map((m, i) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + 0.04 * i }}>
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

          {(bonoDisponible || transito?.favorable) && (
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
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

          <div className="mt-6 max-w-4xl">
            <SearchBar />
          </div>
          <PruebaSocial className="mt-5 justify-start" />
        </div>
      </section>

      {/* 2 · Prueba social real: quién se acaba de unir */}
      <MiembrosRecientes />

      {/* En pantallas estrechas, «Hoy depende de ti» va antes del muro; en escritorio vive en la columna lateral */}
      {escritorio === false && <PanelHoy />}

      {/* 3 · Muro de la comunidad con carga infinita + columna lateral en escritorio */}
      <div className="mx-auto mt-6 grid max-w-6xl gap-6 px-4 pb-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <MuroHome ofertas={ofertas} escritorio={escritorio} />
        <aside aria-label="Comunidad" className="hidden lg:block">
          {escritorio === true && (
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-4 overflow-y-auto pb-2 pr-1">
              <PanelHoy compacto />
              <InvitarCTA />
              <ConectoresDestacados />
              <TendenciasSemana />
            </div>
          )}
        </aside>
      </div>

      <AvisoVivo />
      <SeccionQueEs />
    </>
  );
}
