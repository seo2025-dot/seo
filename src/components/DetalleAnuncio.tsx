"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Anuncio } from "@/types/mercado";
import { useSocial } from "@/context/SocialContext";
import { ETIQUETA_TIPO_ANUNCIO, precioFinal } from "@/lib/anuncios";
import { formatearPrecio } from "@/lib/formato";
import Avatar from "@/components/Avatar";
import FomoBadges from "@/components/FomoBadges";
import Icono from "@/components/Icono";
import { AstralBadge, BadgesFila, ConfianzaBadge, Reputacion, VerificadoCheck } from "@/components/PerfilBadges";

export default function DetalleAnuncio({
  anuncio,
  fotos,
  specs,
  extras,
  volver,
}: {
  anuncio: Anuncio;
  fotos: string[];
  specs: { label: string; valor: string }[];
  extras: string[];
  volver: { href: string; label: string };
}) {
  const router = useRouter();
  const { estado, obtenerUsuario, enLinea, alternarGuardada, conectarAnuncio, eliminarAnuncio, canjearBoost, enBoost } = useSocial();
  const [foto, setFoto] = useState(0);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [avisoBoost, setAvisoBoost] = useState<string | null>(null);

  const dueno = obtenerUsuario(anuncio.duenoId);
  const esMia = anuncio.duenoId === "yo";
  const guardada = estado.guardadas.includes(anuncio.id);
  const tipo = ETIQUETA_TIPO_ANUNCIO[anuncio.tipo];
  const final = precioFinal(anuncio);

  const contactar = async () => {
    const cid = await conectarAnuncio(anuncio.id);
    if (cid) router.push(`/mensajes/${cid}`);
  };

  const destacar = async () => {
    setAvisoBoost((await canjearBoost(anuncio.id)) ? "🚀 ¡Listo! Tu publicación aparecerá destacada durante 24 h." : "No se pudo destacar: necesitas 100 💰. Consíguelas en Recompensas.");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href={volver.href} className="text-sm text-brand-600 hover:underline">
        ← {volver.label}
      </Link>

      <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl bg-slate-100">
        <Image src={fotos[foto] ?? anuncio.imagen} alt={anuncio.titulo} fill priority sizes="896px" className="object-cover" />
        <span className="absolute left-4 top-4 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
          {tipo.emoji} {anuncio.operacion ? (anuncio.operacion === "venta" ? "Venta" : "Alquiler") : tipo.label}
        </span>
        <div className="absolute bottom-4 left-4">
          <FomoBadges anuncio={anuncio} max={4} />
        </div>
      </div>
      {fotos.length > 1 && (
        <div className="mt-3 flex gap-2">
          {fotos.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setFoto(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-pressed={foto === i}
              className={`relative h-16 w-24 overflow-hidden rounded-lg ring-2 transition ${foto === i ? "ring-brand-600" : "opacity-70 ring-transparent hover:opacity-100"}`}
            >
              <Image src={f} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{anuncio.titulo}</h1>
          <p className="mt-1 text-slate-500">
            📍 {anuncio.ubicacion} · <span className="capitalize">{anuncio.subtipo}</span>
          </p>
        </div>
        <p className="text-right text-3xl font-bold text-brand-700">
          {formatearPrecio(final, anuncio.moneda)}
          {anuncio.operacion === "alquiler" && <span className="text-base font-normal text-slate-500"> /período</span>}
          {anuncio.relampago && (
            <span className="block text-sm font-normal text-slate-400 line-through">{formatearPrecio(anuncio.precio, anuncio.moneda)}</span>
          )}
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-center sm:grid-cols-4">
        {specs.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-slate-500">{s.label}</dt>
            <dd className="font-semibold capitalize">{s.valor}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 whitespace-pre-wrap leading-relaxed text-slate-700">{anuncio.descripcion}</p>

      {extras.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {extras.map((c) => (
            <li key={c} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {c}
            </li>
          ))}
        </ul>
      )}

      {dueno && (
        <section className="mt-8 rounded-2xl border border-slate-200 p-5" aria-label="Vendedor">
          <div className="flex items-start gap-4">
            <Link href={esMia ? "/perfil" : `/usuarios/${dueno.id}`}>
              <Avatar nombre={dueno.nombre} foto={dueno.foto} tamano="lg" enLinea={esMia ? undefined : enLinea(dueno.id)} />
            </Link>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Vendedor</p>
                <Link href={esMia ? "/perfil" : `/usuarios/${dueno.id}`} className="flex items-center gap-2 text-lg font-bold hover:underline">
                  {esMia ? `${dueno.nombre} (tú)` : dueno.nombre}
                  {dueno.verificaciones.identidad && <VerificadoCheck className="h-5 w-5" />}
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Reputacion rating={dueno.rating} resenas={dueno.resenas} respuesta={dueno.respuesta} />
                <ConfianzaBadge usuario={dueno} />
                {!esMia && <AstralBadge yo={estado.yo} otro={dueno} contexto="socios" />}
              </div>
              <BadgesFila badges={dueno.badges} />
            </div>
          </div>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {esMia ? (
          <>
            <p className="w-full text-sm text-slate-500">Esta es tu publicación: los interesados te escribirán desde Mensajes.</p>
            <button
              type="button"
              onClick={destacar}
              disabled={enBoost(anuncio.id)}
              className="rounded-xl boton-marca px-6 py-3 font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
            >
              {enBoost(anuncio.id) ? "🚀 Destacada ahora" : "🚀 Destacar (100 💰)"}
            </button>
            {confirmarBorrado ? (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    await eliminarAnuncio(anuncio.id);
                    router.push("/perfil");
                  }}
                  className="rounded-xl bg-rose-600 px-6 py-3 font-semibold text-white hover:bg-rose-700"
                >
                  Sí, eliminar publicación
                </button>
                <button type="button" onClick={() => setConfirmarBorrado(false)} className="rounded-xl px-6 py-3 font-medium text-slate-600 hover:bg-slate-100">
                  Cancelar
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmarBorrado(true)} className="rounded-xl border border-rose-300 px-6 py-3 font-semibold text-rose-600 hover:bg-rose-50">
                Eliminar publicación
              </button>
            )}
            {avisoBoost && (
              <p role="status" className="w-full text-sm text-slate-600">
                {avisoBoost}
              </p>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={contactar} className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">
              Guardar y negociar con {dueno?.nombre.split(" ")[0] ?? "el vendedor"}
            </button>
            <button
              type="button"
              onClick={() => alternarGuardada(anuncio.id)}
              aria-pressed={guardada}
              className={`flex items-center gap-2 rounded-xl border px-6 py-3 font-semibold transition ${
                guardada ? "border-rose-500 bg-rose-50 text-rose-600" : "border-slate-300 text-slate-700 hover:border-rose-300"
              }`}
            >
              <Icono nombre="match" className="h-4 w-4" relleno={guardada} />
              {guardada ? "Guardada" : "Solo guardar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
