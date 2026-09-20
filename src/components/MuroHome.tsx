"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Anuncio } from "@/types/mercado";
import { useSocial } from "@/context/SocialContext";
import { bloquesTrasPublicacion, LOTES_AUTOMATICOS, TAM_LOTE_VISIBLE, type BloqueMuro } from "@/lib/comunidad";
import ConectoresDestacados from "@/components/ConectoresDestacados";
import InvitarCTA from "@/components/InvitarCTA";
import OfertasCarrusel from "@/components/OfertasCarrusel";
import PostCard from "@/components/PostCard";
import PostComposer from "@/components/PostComposer";
import SugerenciasAmistad from "@/components/SugerenciasAmistad";

/**
 * Muro de la comunidad de la portada, con carga infinita: al acercarte al final se revelan más publicaciones y, cuando se
 * agotan las ya descargadas, se piden al servidor por lotes (más antiguas primero). Tras LOTES_AUTOMATICOS cargas seguidas pide
 * un toque, para que el pie de página siga siendo alcanzable. Entre publicaciones se intercalan sugerencias de amistad, la
 * invitación con monedas, el ranking y las ofertas (en escritorio, invitación y ranking viven en la columna lateral).
 */
export default function MuroHome({ ofertas, escritorio }: { ofertas: Anuncio[]; escritorio: boolean | null }) {
  const { estado, sesion, hidratado, hayMasPosts, cargarMasPosts } = useSocial();
  const posts = useMemo(() => [...estado.posts].sort((a, b) => b.ts - a.ts), [estado.posts]);
  const [visibles, setVisibles] = useState(TAM_LOTE_VISIBLE);
  const [lotes, setLotes] = useState(0);
  const [cargando, setCargando] = useState(false);
  const centinela = useRef<HTMLDivElement>(null);

  const hayMas = visibles < posts.length || hayMasPosts;
  const automatico = lotes < LOTES_AUTOMATICOS;

  const revelarMas = useCallback(async () => {
    if (cargando) return;
    if (visibles < posts.length) {
      setVisibles((v) => v + TAM_LOTE_VISIBLE);
      return;
    }
    if (hayMasPosts) {
      setCargando(true);
      await cargarMasPosts();
      setVisibles((v) => v + TAM_LOTE_VISIBLE);
      setCargando(false);
    }
  }, [cargando, visibles, posts.length, hayMasPosts, cargarMasPosts]);

  // El observador se recrea tras cada carga: si el final sigue a la vista, dispara de nuevo enseguida.
  useEffect(() => {
    const el = centinela.current;
    if (!el || !hidratado || !hayMas || !automatico || cargando) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) {
          setLotes((l) => l + 1);
          void revelarMas();
        }
      },
      { rootMargin: "600px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hidratado, hayMas, automatico, cargando, revelarMas]);

  const mostradas = posts.slice(0, visibles);

  const bloque = (b: BloqueMuro) => {
    switch (b) {
      case "sugerencias":
        return <SugerenciasAmistad key={b} />;
      case "invitar":
        return escritorio === false ? <InvitarCTA key={b} /> : null;
      case "conectores":
        return escritorio === false ? <ConectoresDestacados key={b} /> : null;
      case "ofertas":
        return <OfertasCarrusel key={b} anuncios={ofertas} />;
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      {sesion.uid ? (
        <div id="publicar-muro" className="scroll-mt-24">
          <PostComposer />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            <strong className="text-ink">Únete a la conversación.</strong> Comparte una historia, una foto o un enlace con tu ciudad.
          </p>
          <Link href="/registro" className="boton-marca rounded-full px-5 py-2 text-sm font-bold text-white">
            Crear mi cuenta
          </Link>
        </div>
      )}

      {!hidratado ? (
        [0, 1].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />)
      ) : mostradas.length === 0 ? (
        <>
          <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Aún no hay publicaciones. ¡Sé la primera persona en compartir algo!</p>
          {(["sugerencias", "ofertas"] as BloqueMuro[]).map(bloque)}
        </>
      ) : (
        mostradas.map((p, i) => (
          <Fragment key={p.id}>
            <PostCard post={p} />
            {bloquesTrasPublicacion(i, mostradas.length).map(bloque)}
          </Fragment>
        ))
      )}

      {hidratado && hayMas && (
        <div ref={centinela} className="py-2 text-center" aria-live="polite">
          {cargando ? (
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" aria-label="Cargando más publicaciones" />
          ) : !automatico ? (
            <button
              type="button"
              onClick={() => {
                setLotes(0);
                void revelarMas();
              }}
              className="rounded-full border border-slate-300 px-8 py-3 font-semibold text-ink transition hover:border-brand-400"
            >
              Ver más publicaciones
            </button>
          ) : null}
        </div>
      )}

      {hidratado && !hayMas && mostradas.length > 0 && (
        <p className="py-4 text-center text-sm text-slate-500">
          Estás al día con la comunidad. <a href="#publicar-muro" className="font-bold text-brand-700 hover:underline">Comparte algo</a> y anima la conversación.
        </p>
      )}
    </div>
  );
}
