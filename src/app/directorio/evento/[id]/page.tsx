/* eslint-disable @next/next/no-img-element */
import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { rutaProveedor } from "@/data/directorio";
import { AvisoConfiguracion } from "@/features/directorio/Bloques";
import { BotonCompartir, BotonInteres } from "@/features/directorio/eventos/BotonesEvento";
import ReservaEntradas from "@/features/directorio/eventos/ReservaEntradas";
import TarjetaEvento from "@/features/directorio/eventos/TarjetaEvento";
import { InsigniaVerificado } from "@/features/directorio/Insignias";
import { categoriaEvento, faseEvento, jsonLdEvento, textoFechaLarga, textoHora, textoPrecioEvento, textoRango } from "@/lib/directorio/eventos";
import { jsonLdSeguro } from "@/lib/directorio/schema";
import { eventosDeOrganizador, obtenerEvento } from "@/lib/directorio/servidor";

export const revalidate = 60;

/** Sin páginas pregeneradas: cada evento se renderiza la primera vez que se pide y se guarda 60 s. */
export function generateStaticParams() {
  return [];
}

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "https://conectari.com";
type Params = Promise<{ id: string }>;
const cargar = cache((id: string) => obtenerEvento(id));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const { datos } = await cargar(id);
  if (!datos) return { title: "Evento no encontrado" };
  const { evento, organizador } = datos;
  const descripcion = (evento.descripcion || `${categoriaEvento(evento.categoria).etiqueta} en ${evento.lugar || evento.zona || "Cuenca"}. Organiza ${organizador.nombre}.`).slice(0, 160);
  const url = `${SITIO}/directorio/evento/${id}`;
  return {
    title: `${evento.titulo} · ${textoFechaLarga(evento.inicia).split(",")[0]}`,
    description: descripcion,
    alternates: { canonical: url },
    // Un evento cancelado no debe posicionarse.
    robots: evento.estado === "cancelled" ? { index: false, follow: true } : undefined,
    openGraph: { title: evento.titulo, description: descripcion, url, ...(evento.portadaUrl ? { images: [evento.portadaUrl] } : {}) },
  };
}

export default async function EventoPage({ params }: { params: Params }) {
  const { id } = await params;
  const { datos, error } = await cargar(id);
  if (!datos) {
    if (error) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-12">
          <AvisoConfiguracion mensaje={error} />
        </div>
      );
    }
    notFound();
  }
  const { evento, tipos, organizador } = datos;
  const cat = categoriaEvento(evento.categoria);
  const fase = faseEvento(evento);
  const ruta = `/directorio/evento/${evento.id}`;
  const rutaOrg = rutaProveedor("eventos", organizador.slug);
  const otros = (await eventosDeOrganizador(organizador.id, 4)).datos.filter((x) => x.evento.id !== evento.id).slice(0, 3);
  const consultaMapa = encodeURIComponent([evento.lugar, evento.direccion, "Cuenca, Ecuador"].filter(Boolean).join(", "));

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(jsonLdEvento(evento, organizador, tipos, `${SITIO}${ruta}`, `${SITIO}${rutaOrg}`)) }} />

      <header className="relative">
        <div className="h-48 bg-gradient-to-br from-[#7a3cff] to-[#ff4d9d] sm:h-72">
          {evento.portadaUrl ? (
            <img src={evento.portadaUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div aria-hidden className="flex h-full w-full items-center justify-center text-8xl opacity-90">
              {cat.emoji}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-5">
        <nav aria-label="Ruta" className="text-sm text-slate-500">
          <Link href="/directorio" className="hover:underline">
            Directorio
          </Link>{" "}
          <span aria-hidden>›</span>{" "}
          <Link href="/directorio/eventos" className="hover:underline">
            Eventos
          </Link>
        </nav>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-800">
            {cat.emoji} {cat.etiqueta}
          </span>
          {fase === "en_curso" && <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-black text-white">● En curso</span>}
          {fase === "cancelado" && <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-800">Cancelado</span>}
          {fase === "finalizado" && <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black text-slate-700">Finalizado</span>}
        </div>
        <h1 className="mt-2 text-3xl font-black leading-tight text-ink sm:text-4xl">{evento.titulo}</h1>
        <p className="mt-1 text-lg font-semibold text-brand-700">{textoRango(evento)}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <BotonInteres eventoId={evento.id} />
          <BotonCompartir titulo={evento.titulo} ruta={ruta} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-8">
            {evento.descripcion && (
              <section aria-labelledby="acerca-evento">
                <h2 id="acerca-evento" className="mb-2 text-2xl font-black text-ink">
                  Acerca del evento
                </h2>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{evento.descripcion}</p>
              </section>
            )}

            <section aria-labelledby="donde-evento" className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 id="donde-evento" className="mb-3 text-xl font-black text-ink">
                Cuándo y dónde
              </h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha</dt>
                  <dd className="text-ink">{textoFechaLarga(evento.inicia)}</dd>
                </div>
                {evento.termina && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Termina</dt>
                    <dd className="text-ink">{textoHora(evento.termina)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lugar</dt>
                  <dd className="text-ink">
                    📍 {evento.lugar || "Por confirmar"}
                    {evento.direccion && <span className="block text-slate-500">{evento.direccion}</span>}
                    {evento.zona && <span className="block text-slate-500">Zona: {evento.zona}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Entradas</dt>
                  <dd className="font-bold text-ink">{textoPrecioEvento(evento, tipos)}</dd>
                </div>
              </dl>
              {(evento.lugar || evento.direccion) && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${consultaMapa}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-bold text-brand-700 hover:underline">
                  Ver en el mapa ↗
                </a>
              )}
            </section>

            <section aria-labelledby="organiza-evento" className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 id="organiza-evento" className="mb-2 text-xl font-black text-ink">
                Organiza
              </h2>
              <p className="flex flex-wrap items-center gap-2">
                <Link href={rutaOrg} className="text-lg font-black text-ink hover:text-brand-700 hover:underline">
                  {organizador.nombre}
                </Link>
                {organizador.verificado && <InsigniaVerificado />}
              </p>
              <Link href={rutaOrg} className="mt-2 inline-block text-sm font-bold text-brand-700 hover:underline">
                Ver perfil y reseñas →
              </Link>
            </section>

            {otros.length > 0 && (
              <section aria-labelledby="otros-eventos">
                <h2 id="otros-eventos" className="mb-3 text-xl font-black text-ink">
                  Más de {organizador.nombre}
                </h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  {otros.map((x) => (
                    <TarjetaEvento key={x.evento.id} e={x} />
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside aria-label="Reservar entradas" className="lg:sticky lg:top-20 lg:self-start">
            <ReservaEntradas
              evento={{ id: evento.id, titulo: evento.titulo, inicia: evento.inicia, termina: evento.termina, estado: evento.estado, gratis: evento.gratis, enlaceEntradas: evento.enlaceEntradas }}
              tiposIniciales={tipos}
              duenoId={organizador.ownerId}
            />
          </aside>
        </div>
      </div>
    </article>
  );
}
