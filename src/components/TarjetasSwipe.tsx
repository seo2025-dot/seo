import Image from "next/image";
import type { Anuncio } from "@/types/mercado";
import type { TipoRelacion, Usuario } from "@/types/social";
import { ETIQUETA_TIPO_ANUNCIO, precioFinal } from "@/lib/anuncios";
import { infoSigno } from "@/lib/astrologia";
import { formatearPrecio } from "@/lib/formato";
import { compatibilidad, ETIQUETA_INTERES, ETIQUETA_RELACION } from "@/lib/social";
import Avatar, { degradadoDe } from "@/components/Avatar";
import FomoBadges from "@/components/FomoBadges";
import { AstralBadge, ConfianzaBadge, VerificadoCheck } from "@/components/PerfilBadges";

export function ContenidoAnuncio({
  anuncio,
  dueno,
  esTop,
}: {
  anuncio: Anuncio;
  dueno?: Usuario;
  esTop: boolean;
}) {
  const tipo = ETIQUETA_TIPO_ANUNCIO[anuncio.tipo];
  return (
    <>
      <Image
        src={anuncio.imagen}
        alt={anuncio.titulo}
        fill
        priority={esTop}
        draggable={false}
        sizes="(min-width: 640px) 384px, 100vw"
        className="pointer-events-none object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />

      <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
        <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-brand-700">
          {tipo.emoji} {anuncio.operacion ? (anuncio.operacion === "venta" ? "Venta" : "Alquiler") : tipo.label}
        </span>
        {esTop && <FomoBadges anuncio={anuncio} />}
      </div>

      <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 text-white">
        <p className="text-3xl font-extrabold">
          {formatearPrecio(precioFinal(anuncio), anuncio.moneda)}
          {anuncio.relampago && (
            <span className="ml-2 text-base font-medium text-white/60 line-through">
              {formatearPrecio(anuncio.precio, anuncio.moneda)}
            </span>
          )}
          {anuncio.operacion === "alquiler" && <span className="text-base font-medium text-white/80"> /período</span>}
        </p>
        <h2 className="text-lg font-semibold leading-tight">{anuncio.titulo}</h2>
        <p className="text-sm text-white/80">📍 {anuncio.ubicacion}</p>
        <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium">
          {anuncio.chips.map((c) => (
            <span key={c} className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">
              {c}
            </span>
          ))}
        </div>
        {dueno && (
          <div className="flex items-center gap-2 border-t border-white/20 pt-3 text-sm">
            <Avatar nombre={dueno.nombre} foto={dueno.foto} tamano="sm" />
            <span className="font-medium">{dueno.nombre}</span>
            {dueno.verificaciones.identidad && <VerificadoCheck />}
            <span className="ml-auto">
              <ConfianzaBadge usuario={dueno} compacto />
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export function ContenidoPersona({
  persona,
  yo,
  contexto = "pareja",
  modoCita = false,
}: {
  persona: Usuario;
  yo: Usuario;
  contexto?: TipoRelacion;
  modoCita?: boolean;
}) {
  const { puntaje, zonasComunes, interesesComunes } = compatibilidad(yo, persona);
  const comunes = new Set(zonasComunes.map((z) => z.toLowerCase()));
  const signo = persona.signo ? infoSigno(persona.signo) : undefined;

  return (
    <div className={`flex h-full flex-col bg-gradient-to-br ${degradadoDe(persona.nombre)} p-6 text-white`}>
      <div className="mt-4 flex flex-col items-center text-center">
        <Avatar nombre={persona.nombre} foto={persona.foto} tamano="xl" className="ring-4 ring-white/70" />
        <h2 className="mt-3 flex items-center gap-2 text-2xl font-extrabold">
          <span>
            {persona.nombre}
            {persona.edad ? <span className="font-medium">, {persona.edad}</span> : null}
          </span>
          {persona.verificaciones.identidad && <VerificadoCheck className="h-5 w-5" />}
        </h2>
        <p className="text-sm text-white/80">
          {persona.usuario} · {persona.ubicacion}
          {signo && (
            <>
              {" "}
              · {signo.simbolo} {signo.nombre}
            </>
          )}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <AstralBadge yo={yo} otro={persona} contexto={contexto} />
          <ConfianzaBadge usuario={persona} compacto />
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-black/20 p-3 backdrop-blur">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Afinidad de zonas e intereses</span>
          <span className="text-xl font-extrabold">{puntaje}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${puntaje}%` }} />
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/95">{persona.bio}</p>

      <div className="mt-auto space-y-2 pt-3">
        {modoCita && persona.relaciones && (
          <p className="text-xs font-semibold text-white/90">
            Busca: {persona.relaciones.map((r) => ETIQUETA_RELACION[r]).join(" · ")}
          </p>
        )}
        <ul className="flex flex-wrap gap-1.5 text-xs font-semibold">
          {persona.estilo?.slice(0, 3).map((e) => (
            <li key={e} className="rounded-full bg-white/25 px-2.5 py-1">
              {e}
            </li>
          ))}
          {persona.intereses.map((i) => (
            <li
              key={i}
              className={`rounded-full px-2.5 py-1 ${interesesComunes.includes(i) ? "bg-white text-slate-800" : "bg-white/20"}`}
            >
              {ETIQUETA_INTERES[i]}
            </li>
          ))}
          {persona.zonas.map((z) => (
            <li key={z} className={`rounded-full px-2.5 py-1 ${comunes.has(z.toLowerCase()) ? "bg-white text-slate-800" : "bg-white/20"}`}>
              📍 {z}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
