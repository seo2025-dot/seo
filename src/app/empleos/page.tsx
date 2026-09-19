"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CategoriaServicio, Gig, Vacante } from "@/types/mercado";
import { ETIQUETA_SERVICIO } from "@/data/catalogos";
import { useSocial } from "@/context/SocialContext";
import { formatearPrecio } from "@/lib/formato";
import { tiempoRelativo } from "@/lib/social";
import Avatar from "@/components/Avatar";
import { BadgesFila, ConfianzaBadge, Reputacion, VerificadoCheck } from "@/components/PerfilBadges";

const campo =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

const TIPO_VACANTE = { "tiempo-completo": "Tiempo completo", contrato: "Contrato", proyecto: "Proyecto" } as const;
const MODALIDAD = { remoto: "🏠 Remoto", presencial: "🏢 Presencial", hibrido: "🔀 Híbrido" } as const;

function GigCard({ gig }: { gig: Gig }) {
  const router = useRouter();
  const { obtenerUsuario, contratarServicio, estado } = useSocial();
  const autor = obtenerUsuario(gig.autorId);
  if (!autor) return null;
  const esMio = gig.autorId === "yo";
  const contratado = estado.contratados.includes(gig.id);
  const cat = ETIQUETA_SERVICIO[gig.categoria];

  const contratar = async () => {
    const cid = await contratarServicio(gig.id);
    if (cid) router.push(`/mensajes/${cid}`);
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg">
      <div className="relative aspect-[16/10] bg-slate-100">
        <Image src={gig.imagen} alt={gig.titulo} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-700">
          {cat.emoji} {cat.label}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Link href={esMio ? "/perfil" : `/usuarios/${autor.id}`} className="flex items-center gap-2">
          <Avatar nombre={autor.nombre} foto={autor.foto} tamano="sm" />
          <span className="flex min-w-0 items-center gap-1 text-sm font-medium">
            <span className="truncate">{esMio ? "Tú" : autor.nombre}</span>
            {autor.verificaciones.identidad && <VerificadoCheck className="h-3.5 w-3.5" />}
          </span>
          <span className="ml-auto">
            <ConfianzaBadge usuario={autor} compacto />
          </span>
        </Link>
        <h3 className="line-clamp-2 font-semibold">{gig.titulo}</h3>
        <p className="line-clamp-2 text-sm text-slate-500">{gig.descripcion}</p>
        <Reputacion rating={autor.rating} resenas={autor.resenas} />
        <div className="mt-auto flex items-end justify-between border-t border-slate-100 pt-3">
          <div>
            <p className="text-xs text-slate-500">Desde</p>
            <p className="text-lg font-bold text-brand-700">{formatearPrecio(gig.precioDesde, gig.moneda)}</p>
            <p className="text-xs text-slate-400">
              Entrega en {gig.entregaDias} d · {gig.ventas} ventas
            </p>
          </div>
          {esMio ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Tu servicio</span>
          ) : (
            <button type="button" onClick={contratar} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {contratado ? "Contratado ✓" : "Pedir cotización"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function VacanteCard({ vacante }: { vacante: Vacante }) {
  const router = useRouter();
  const { obtenerUsuario, postularVacante, estado, cidDe } = useSocial();
  const autor = obtenerUsuario(vacante.autorId);
  if (!autor) return null;
  const esMia = vacante.autorId === "yo";
  const postulado = estado.postulaciones.includes(vacante.id);

  const postular = async () => {
    const cid = await postularVacante(vacante.id);
    if (cid) router.push(`/mensajes/${cid}`);
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{vacante.titulo}</h3>
          <Link href={esMia ? "/perfil" : `/usuarios/${autor.id}`} className="mt-1 flex items-center gap-2 text-sm text-slate-600 hover:underline">
            <Avatar nombre={autor.nombre} foto={autor.foto} tamano="xs" />
            {esMia ? "Tú" : autor.nombre}
            {autor.verificaciones.identidad && <VerificadoCheck className="h-3.5 w-3.5" />}
            <ConfianzaBadge usuario={autor} compacto />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">{TIPO_VACANTE[vacante.tipo]}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{MODALIDAD[vacante.modalidad]}</span>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{vacante.descripcion}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {vacante.skills.map((s) => (
          <li key={s} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            {s}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-sm">
          <span className="font-semibold">{vacante.presupuesto}</span>
          <span className="text-slate-400"> · 📍 {vacante.ubicacion} · {tiempoRelativo(vacante.ts)}</span>
        </p>
        {esMia ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Tu vacante</span>
        ) : postulado ? (
          <Link href={`/mensajes/${cidDe("empleo", vacante.id) ?? ""}`} className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            Postulado ✓ Ver chat
          </Link>
        ) : (
          <button type="button" onClick={postular} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Postularme
          </button>
        )}
      </div>
    </article>
  );
}

export default function EmpleosPage() {
  const { gigs, vacantes, hidratado, estado, usuarios } = useSocial();
  const [tab, setTab] = useState<"servicios" | "empleos">("servicios");
  const [categoria, setCategoria] = useState<CategoriaServicio | "">("");
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [modalidad, setModalidad] = useState("");

  const gigsFiltrados = useMemo(
    () =>
      gigs.filter(
        (g) =>
          (!categoria || g.categoria === categoria) &&
          (!texto || `${g.titulo} ${g.descripcion}`.toLowerCase().includes(texto.toLowerCase())),
      ),
    [gigs, categoria, texto],
  );

  const vacantesFiltradas = useMemo(
    () =>
      vacantes.filter(
        (v) =>
          (!tipo || v.tipo === tipo) &&
          (!modalidad || v.modalidad === modalidad) &&
          (!texto || `${v.titulo} ${v.skills.join(" ")}`.toLowerCase().includes(texto.toLowerCase())),
      ),
    [vacantes, tipo, modalidad, texto],
  );

  const yo = estado.yo;
  const profesionales = useMemo(
    () => usuarios.filter((u) => u.profesional && (u.profesional.titular || u.profesional.portafolio.length > 0)).slice(0, 6),
    [usuarios],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Empleos y servicios</h1>
          <p className="mt-1 text-slate-500">Contrata talento de la comunidad o encuentra tu próximo proyecto.</p>
        </div>
        <Link href="/empleos/publicar" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          + Publicar servicio o vacante
        </Link>
      </div>

      {!yo.profesional && hidratado && (
        <p className="mt-4 rounded-xl bg-violet-50 p-3 text-sm text-violet-800">
          Completa tu <Link href="/perfil" className="font-semibold underline">perfil profesional</Link> (titular, habilidades y portafolio) para destacar al postularte.
        </p>
      )}

      <div role="tablist" className="mt-6 flex gap-1 border-b border-slate-200">
        {(
          [
            ["servicios", "🛠️ Servicios (gigs)"],
            ["empleos", "💼 Bolsa de trabajo"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input aria-label="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar servicio, habilidad…" className={`${campo} ${tab === "servicios" ? "sm:col-span-2" : ""}`} />
        {tab === "servicios" ? (
          <select aria-label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaServicio | "")} className={campo}>
            <option value="">Todas las categorías</option>
            {(Object.keys(ETIQUETA_SERVICIO) as CategoriaServicio[]).map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_SERVICIO[c].emoji} {ETIQUETA_SERVICIO[c].label}
              </option>
            ))}
          </select>
        ) : (
          <>
            <select aria-label="Tipo de contrato" value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
              <option value="">Todos los tipos</option>
              {Object.entries(TIPO_VACANTE).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select aria-label="Modalidad" value={modalidad} onChange={(e) => setModalidad(e.target.value)} className={campo}>
              <option value="">Cualquier modalidad</option>
              {Object.entries(MODALIDAD).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {!hidratado ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : tab === "servicios" ? (
        <>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gigsFiltrados.map((g) => (
              <GigCard key={g.id} gig={g} />
            ))}
          </div>
          {gigsFiltrados.length === 0 && <p className="py-12 text-center text-slate-500">No hay servicios con esos criterios.</p>}

          <section className="mt-12" aria-label="Profesionales destacados">
            <h2 className="mb-4 text-xl font-bold">Profesionales destacados y sus portafolios</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {profesionales.map((u) =>
                u && u.profesional ? (
                  <Link key={u.id} href={`/usuarios/${u.id}`} className="min-w-0 rounded-2xl border border-slate-200 p-4 transition hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <Avatar nombre={u.nombre} tamano="md" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 font-semibold">
                          {u.nombre}
                          {u.verificaciones.identidad && <VerificadoCheck className="h-3.5 w-3.5" />}
                        </p>
                        <p className="truncate text-sm text-slate-500">{u.profesional.titular}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {u.profesional.portafolio.slice(0, 3).map((src) => (
                        <div key={src} className="relative h-16 flex-1 overflow-hidden rounded-lg bg-slate-100">
                          <Image src={src} alt="" fill sizes="120px" className="object-cover" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <BadgesFila badges={u.badges} />
                    </div>
                  </Link>
                ) : null,
              )}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="mt-6 space-y-4">
            {vacantesFiltradas.map((v) => (
              <VacanteCard key={v.id} vacante={v} />
            ))}
          </div>
          {vacantesFiltradas.length === 0 && <p className="py-12 text-center text-slate-500">No hay vacantes con esos criterios.</p>}
        </>
      )}
    </div>
  );
}
