/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { InsigniaVerificado } from "@/features/directorio/Insignias";
import type { EventoPublico } from "@/lib/directorio/servidor";
import { categoriaEvento, faseEvento, textoFechaCorta, textoPrecioEvento } from "@/lib/directorio/eventos";

/** Tarjeta de un evento en la cartelera. Se renderiza en el servidor (sin JavaScript). */
export default function TarjetaEvento({ e, prioridad = false }: { e: EventoPublico; prioridad?: boolean }) {
  const { evento, tipos, organizador } = e;
  const cat = categoriaEvento(evento.categoria);
  const fase = faseEvento(evento);
  const precio = textoPrecioEvento(evento, tipos);
  const agotado = precio === "Agotado";
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/directorio/evento/${evento.id}`} className="relative block h-36 bg-gradient-to-br from-[#7a3cff] to-[#ff4d9d]" aria-label={`Ver ${evento.titulo}`}>
        {evento.portadaUrl ? (
          <img src={evento.portadaUrl} alt="" loading={prioridad ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <span aria-hidden className="flex h-full w-full items-center justify-center text-5xl opacity-90">
            {cat.emoji}
          </span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-black text-ink shadow">
          {cat.emoji} {cat.etiqueta}
        </span>
        {fase === "en_curso" && <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-black text-white shadow">● En curso</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{textoFechaCorta(evento.inicia)}</p>
        <h3 className="text-base font-black leading-tight text-ink">
          <Link href={`/directorio/evento/${evento.id}`} className="hover:underline">
            {evento.titulo}
          </Link>
        </h3>
        <p className="truncate text-sm text-slate-600">
          📍 {evento.lugar || organizador.nombre}
          {evento.zona && <span className="text-slate-400"> · {evento.zona}</span>}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
          <span className="truncate">{organizador.nombre}</span>
          {organizador.verificado && <InsigniaVerificado />}
        </p>
        <p className={`mt-auto pt-2 text-sm font-black ${agotado ? "text-rose-600" : "text-ink"}`}>{precio}</p>
      </div>
    </article>
  );
}
