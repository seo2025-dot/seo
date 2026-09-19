/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import type { Post } from "@/types/social";
import { useSocial } from "@/context/SocialContext";
import { ETIQUETA_POST, tiempoRelativo } from "@/lib/social";
import Avatar from "@/components/Avatar";
import Icono from "@/components/Icono";
import { VerificadoCheck } from "@/components/PerfilBadges";

export default function PostCard({ post }: { post: Post }) {
  const { obtenerUsuario, enLinea, alternarLikePost, comentarPost, eliminarPost } = useSocial();
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState("");

  const autor = obtenerUsuario(post.autorId);
  if (!autor) return null;

  const meGusta = post.likes.includes("yo");
  const etiqueta = ETIQUETA_POST[post.tipo];
  const esMio = post.autorId === "yo";
  const perfilHref = esMio ? "/perfil" : `/usuarios/${autor.id}`;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 p-4">
        <Link href={perfilHref}>
          <Avatar nombre={autor.nombre} foto={autor.foto} enLinea={esMio ? undefined : enLinea(autor.id)} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={perfilHref} className="flex items-center gap-1.5 font-semibold hover:underline">
            <span className="truncate">{esMio ? `${autor.nombre} (tú)` : autor.nombre}</span>
            {autor.verificaciones.identidad && <VerificadoCheck />}
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

      <p className="whitespace-pre-wrap break-words px-4 pb-3 text-[15px] leading-relaxed">{post.texto}</p>

      {post.imagen && (
        <img src={post.imagen} alt="" loading="lazy" className="max-h-[28rem] w-full object-cover" />
      )}

      <div className="flex items-center gap-1 border-t border-slate-100 px-2 py-1 text-sm">
        <button
          type="button"
          onClick={() => alternarLikePost(post.id)}
          aria-pressed={meGusta}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-slate-50 ${
            meGusta ? "font-semibold text-rose-500" : "text-slate-600"
          }`}
        >
          <Icono nombre="match" className="h-4 w-4" relleno={meGusta} />
          {post.likes.length > 0 ? post.likes.length : ""} Me gusta
        </button>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-50"
        >
          <Icono nombre="mensajes" className="h-4 w-4" />
          {post.comentarios.length > 0 ? post.comentarios.length : ""} Comentar
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
                  <p className="break-words">{c.texto}</p>
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
