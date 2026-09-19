"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TipoPost } from "@/types/social";
import { useSocial } from "@/context/SocialContext";
import { compatibilidad, ETIQUETA_POST } from "@/lib/social";
import PostCard from "@/components/PostCard";
import PostComposer from "@/components/PostComposer";
import Avatar from "@/components/Avatar";
import { VerificadoCheck } from "@/components/PerfilBadges";

type Filtro = "todo" | TipoPost;

export default function ComunidadPage() {
  const { estado, hidratado, usuarios, solicitarAmistad } = useSocial();
  const [filtro, setFiltro] = useState<Filtro>("todo");

  const posts = useMemo(
    () =>
      [...estado.posts]
        .filter((p) => filtro === "todo" || p.tipo === filtro)
        .sort((a, b) => b.ts - a.ts),
    [estado.posts, filtro],
  );

  const zonasTendencia = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const p of estado.posts) if (p.zona) cuenta.set(p.zona, (cuenta.get(p.zona) ?? 0) + 1);
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [estado.posts]);

  const sugeridos = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          !estado.amigos.includes(u.id) &&
          u.intereses.some((i) => i !== "anfitrion") &&
          !estado.solicitudes.some((s) => s.deId === "yo" && s.paraId === u.id && s.estado === "pendiente"),
      )
        .sort((a, b) => compatibilidad(estado.yo, b).puntaje - compatibilidad(estado.yo, a).puntaje)
        .slice(0, 4),
    [usuarios, estado.amigos, estado.solicitudes, estado.yo],
  );

  const filtros: { id: Filtro; label: string }[] = [
    { id: "todo", label: "Todo" },
    ...(Object.keys(ETIQUETA_POST) as TipoPost[]).map((t) => ({
      id: t,
      label: `${ETIQUETA_POST[t].emoji} ${ETIQUETA_POST[t].label}`,
    })),
  ];

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <PostComposer />

        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar publicaciones">
          {filtros.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                filtro === f.id ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:border-brand-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {!hidratado ? (
          [0, 1].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />)
        ) : posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            Aún no hay publicaciones de este tipo. ¡Sé el primero en compartir algo!
          </p>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold">Personas que quizás conozcas</h2>
          <ul className="mt-3 space-y-3">
            {sugeridos.map((u) => (
              <li key={u.id} className="flex items-center gap-3">
                <Link href={`/usuarios/${u.id}`}>
                  <Avatar nombre={u.nombre} tamano="sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/usuarios/${u.id}`} className="flex items-center gap-1 text-sm font-semibold hover:underline">
                    <span className="truncate">{u.nombre}</span>
                    {u.verificaciones.identidad && <VerificadoCheck className="h-3.5 w-3.5" />}
                  </Link>
                  <p className="truncate text-xs text-slate-500">{u.zonas.join(" · ")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => solicitarAmistad(u.id)}
                  className="rounded-full border border-brand-600 px-3 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                >
                  Agregar
                </button>
              </li>
            ))}
            {sugeridos.length === 0 && <li className="text-sm text-slate-500">Ya conectaste con todos 🎉</li>}
          </ul>
          <Link href="/citas" className="mt-4 block text-center text-sm font-medium text-brand-600 hover:underline">
            Descubrir más personas →
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold">Zonas en tendencia</h2>
          <ol className="mt-3 space-y-2">
            {zonasTendencia.map(([zona, n], i) => (
              <li key={zona} className="flex items-center justify-between text-sm">
                <span>
                  <span className="mr-2 text-slate-400">{i + 1}</span>📍 {zona}
                </span>
                <span className="text-xs text-slate-500">{n} {n === 1 ? "post" : "posts"}</span>
              </li>
            ))}
          </ol>
        </section>

        <Link
          href="/publicar"
          className="block rounded-2xl bg-gradient-to-br from-brand-600 to-emerald-500 p-5 text-white shadow-md transition hover:scale-[1.02]"
        >
          <p className="font-bold">¿Tienes una casa, villa o terreno?</p>
          <p className="mt-1 text-sm text-white/90">Publícala gratis y conecta con interesados de la comunidad.</p>
          <p className="mt-3 text-sm font-semibold">Publicar propiedad →</p>
        </Link>
      </aside>
    </div>
  );
}
