"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Anuncio } from "@/types/mercado";
import { useSocial } from "@/context/SocialContext";
import { ETIQUETA_TIPO_ANUNCIO, precioFinal } from "@/lib/anuncios";
import { formatearPrecio } from "@/lib/formato";
import Avatar from "@/components/Avatar";
import Icono from "@/components/Icono";
import { ConfianzaBadge, VerificadoCheck } from "@/components/PerfilBadges";

export default function AnuncioCard({ anuncio }: { anuncio: Anuncio }) {
  const { estado, hidratado, alternarGuardada, obtenerUsuario, enBoost, compradoresBuscando } = useSocial();
  const guardada = hidratado && estado.guardadas.includes(anuncio.id);
  const dueno = obtenerUsuario(anuncio.duenoId);
  const esMia = anuncio.duenoId === "yo";
  const destacado = hidratado && enBoost(anuncio.id);
  const buscando = hidratado ? compradoresBuscando(anuncio) : 0;
  const tipo = ETIQUETA_TIPO_ANUNCIO[anuncio.tipo];
  const final = precioFinal(anuncio);

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-lg ${
        destacado ? "border-sky-400 ring-2 ring-sky-200" : "border-slate-200"
      }`}
    >
      <Link href={anuncio.href} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
          <Image
            src={anuncio.imagen}
            alt={anuncio.titulo}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
              {tipo.emoji} {anuncio.operacion ? (anuncio.operacion === "venta" ? "Venta" : "Alquiler") : tipo.label}
            </span>
            {anuncio.relampago && (
              <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">⚡ −{anuncio.relampago}%</span>
            )}
            {destacado && <span className="rounded-full bg-sky-500 px-3 py-1 text-xs font-bold text-white">🚀 Destacado</span>}
          </div>
          {esMia && (
            <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-emerald-700">
              Tu publicación
            </span>
          )}
          {buscando > 0 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-rose-600/95 px-3 py-1 text-xs font-semibold text-white">
              🔥 {buscando} {buscando === 1 ? "busca" : "buscan"} esto
            </span>
          )}
        </div>
        <div className="space-y-2 p-4">
          <p className="flex items-baseline gap-2 text-lg font-bold text-brand-700">
            {formatearPrecio(final, anuncio.moneda)}
            {anuncio.relampago && (
              <span className="text-sm font-normal text-slate-400 line-through">{formatearPrecio(anuncio.precio, anuncio.moneda)}</span>
            )}
            {anuncio.operacion === "alquiler" && <span className="text-sm font-normal text-slate-500">/{anuncio.tipo === "vehiculo" ? "día o mes" : "mes"}</span>}
            {anuncio.tipo === "negocio" && <span className="text-sm font-normal text-slate-500">inversión</span>}
          </p>
          <h3 className="line-clamp-1 font-semibold">{anuncio.titulo}</h3>
          <p className="text-sm text-slate-500">📍 {anuncio.ubicacion}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
            {anuncio.chips.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          {dueno && (
            <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
              <Avatar nombre={dueno.nombre} foto={dueno.foto} tamano="xs" />
              <span className="truncate">{esMia ? "Tú" : dueno.nombre}</span>
              {dueno.verificaciones.identidad && <VerificadoCheck className="h-3.5 w-3.5" />}
              <span className="ml-auto">
                <ConfianzaBadge usuario={dueno} compacto />
              </span>
            </div>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => alternarGuardada(anuncio.id)}
        aria-pressed={guardada}
        aria-label={guardada ? "Quitar de guardadas" : "Guardar oferta"}
        className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition hover:scale-110 ${
          guardada ? "bg-rose-500 text-white" : "bg-white/95 text-slate-600"
        }`}
      >
        <Icono nombre="match" className="h-4 w-4" relleno={guardada} />
      </button>
    </motion.article>
  );
}
