/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Post, ReaccionId } from "@/types/social";
import { useSocial } from "@/context/SocialContext";
import { usePuestoTop } from "@/features/comunidad/hooks";
import { partirEnlaces, REACCION_POR_ID, REACCIONES, resumenReacciones } from "@/lib/comunidad";
import { ETIQUETA_POST, tiempoRelativo } from "@/lib/social";
import Avatar from "@/components/Avatar";
import Icono from "@/components/Icono";
import { VerificadoCheck } from "@/components/PerfilBadges";
import TopConectorBadge from "@/components/TopConectorBadge";

/** Texto de una publicación con sus enlaces http(s) clicables (se abren en otra pestaña, sin pasar la página de origen). */
function TextoConEnlaces({ texto }: { texto: string }) {
  return (
    <>
      {partirEnlaces(texto).map((t, i) =>
        t.tipo === "enlace" ? (
          <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all font-medium text-brand-700 underline hover:text-brand-800">
            {t.valor}
          </a>
        ) : (
          <span key={i}>{t.valor}</span>
        ),
      )}
    </>
  );
}

export default function PostCard({ post }: { post: Post }) {
  const { obtenerUsuario, enLinea, reaccionarPost, alternarLikePost, comentarPost, eliminarPost } = useSocial();
  const puestoTop = usePuestoTop();
  const [abierto, setAbierto] = useState(false);
  const [selector, setSelector] = useState(false);
  const [borrador, setBorrador] = useState("");
  const zonaReacciones = useRef<HTMLDivElement>(null);

  // El selector de reacciones se cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!selector) return;
    const fuera = (e: MouseEvent) => !zonaReacciones.current?.contains(e.target as Node) && setSelector(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setSelector(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [selector]);

  const autor = obtenerUsuario(post.autorId);
  if (!autor) return null;

  const miReaccion: ReaccionId | undefined = post.reacciones["yo"];
  const resumen = resumenReacciones(post.reacciones);
  const etiqueta = ETIQUETA_POST[post.tipo];
  const esMio = post.autorId === "yo";
  const perfilHref = esMio ? "/perfil" : `/usuarios/${autor.id}`;
  const puesto = puestoTop(post.autorId);

  const elegir = (r: ReaccionId) => {
    setSelector(false);
    void reaccionarPost(post.id, miReaccion === r ? null : r);
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 p-4">
        <Link href={perfilHref}>
          <Avatar nombre={autor.nombre} foto={autor.foto} enLinea={esMio ? undefined : enLinea(autor.id)} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={perfilHref} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold hover:underline">
            <span className="truncate">{esMio ? `${autor.nombre} (tú)` : autor.nombre}</span>
            {autor.verificaciones.identidad && <VerificadoCheck />}
            {puesto !== null && <TopConectorBadge puesto={puesto} />}
          </Link>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span>{tiempoRelativo(post.ts)}</span>
            {post.zona && <span>· 📍 {post.zona}</span>}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${etiqueta.clases}`}>
          {etiqueta.emoji} {etiqueta.label}
        </span>
      </header>

      <p className="whitespace-pre-wrap break-words px-4 pb-3 text-[15px] leading-relaxed">
        <TextoConEnlaces texto={post.texto} />
      </p>

      {post.imagen && <img src={post.imagen} alt="" loading="lazy" className="max-h-[28rem] w-full object-cover" />}

      {(resumen.total > 0 || post.comentarios.length > 0) && (
        <div className="flex items-center justify-between px-4 pt-2 text-xs text-slate-500">
          {resumen.total > 0 ? (
            <span className="flex items-center gap-1.5" aria-label={`${resumen.total} ${resumen.total === 1 ? "reacción" : "reacciones"}`}>
              <span className="flex -space-x-1" aria-hidden>
                {resumen.top.slice(0, 3).map((r) => (
                  <span key={r.id} className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-slate-100 text-[11px]">
                    {REACCION_POR_ID[r.id].emoji}
                  </span>
                ))}
              </span>
              <span className="tabular-nums">{resumen.total}</span>
            </span>
          ) : (
            <span />
          )}
          {post.comentarios.length > 0 && (
            <button type="button" onClick={() => setAbierto(true)} className="hover:underline">
              {post.comentarios.length} {post.comentarios.length === 1 ? "comentario" : "comentarios"}
            </button>
          )}
        </div>
      )}

      <div className="mt-1 flex items-center gap-1 border-t border-slate-100 px-2 py-1 text-sm">
        <div ref={zonaReacciones} className="relative" onMouseLeave={() => setSelector(false)}>
          {selector && (
            <div role="group" aria-label="Elige una reacción" className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-xl">
              {REACCIONES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => elegir(r.id)}
                  aria-label={r.etiqueta}
                  aria-pressed={miReaccion === r.id}
                  title={r.etiqueta}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:-translate-y-1 hover:scale-125 ${miReaccion === r.id ? "bg-brand-100" : ""}`}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => void alternarLikePost(post.id)}
            onMouseEnter={() => setSelector(true)}
            aria-pressed={miReaccion !== undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-slate-50 ${miReaccion ? "font-semibold text-brand-700" : "text-slate-600"}`}
          >
            {miReaccion ? (
              <span aria-hidden className="text-base leading-none">
                {REACCION_POR_ID[miReaccion].emoji}
              </span>
            ) : (
              <Icono nombre="match" className="h-4 w-4" />
            )}
            {miReaccion ? REACCION_POR_ID[miReaccion].etiqueta : "Me gusta"}
          </button>
          <button
            type="button"
            onClick={() => setSelector((v) => !v)}
            aria-expanded={selector}
            aria-label="Más reacciones"
            title="Más reacciones"
            className="ml-0.5 rounded-lg px-2 py-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <span aria-hidden>☺︎</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-50"
        >
          <Icono nombre="mensajes" className="h-4 w-4" />
          Comentar
        </button>
        {esMio && (
          <button
            type="button"
            onClick={() => eliminarPost(post.id)}
            className="ml-auto rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            Eliminar
          </button>
        )}
      </div>

      {abierto && (
        <div className="space-y-3 border-t border-slate-100 p-4">
          {post.comentarios.map((c) => {
            const a = obtenerUsuario(c.autorId);
            if (!a) return null;
            return (
              <div key={c.id} className="flex gap-2">
                <Avatar nombre={a.nombre} foto={a.foto} tamano="sm" />
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm">
                  <p className="font-semibold">
                    {c.autorId === "yo" ? "Tú" : a.nombre}{" "}
                    <span className="text-xs font-normal text-slate-400">{tiempoRelativo(c.ts)}</span>
                  </p>
                  <p className="break-words">
                    <TextoConEnlaces texto={c.texto} />
                  </p>
                </div>
              </div>
            );
          })}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              comentarPost(post.id, borrador);
              setBorrador("");
            }}
            className="flex gap-2"
          >
            <input
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              placeholder="Escribe un comentario…"
              aria-label="Comentario"
              maxLength={500}
              className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="submit"
              disabled={!borrador.trim()}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
