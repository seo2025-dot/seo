/* eslint-disable @next/next/no-img-element */
import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VERTICAL_POR_ID, etiquetaSubtipo, rutaProveedor, type VerticalId } from "@/data/directorio";
import { AccionesDueno, BotonDenunciar, FormResena } from "@/features/directorio/AccionesFicha";
import { AvisoConfiguracion } from "@/features/directorio/Bloques";
import ContactoProveedor from "@/features/directorio/ContactoProveedor";
import { HorarioSemanal, InfoEntrega, ListaResenas, MenuProveedor, TurnosProveedor } from "@/features/directorio/FichaPartes";
import { InsigniaAbierto, InsigniaTurno, InsigniaVerificado, Valoracion } from "@/features/directorio/Insignias";
import { textoEstadoAbierto } from "@/lib/directorio/horarios";
import { agruparCatalogo, estaDeTurno, turnosVigentes } from "@/lib/directorio/mapeo";
import { jsonLdProveedor, jsonLdSeguro } from "@/lib/directorio/schema";
import { obtenerFicha } from "@/lib/directorio/servidor";

export const revalidate = 60;

/** Sin fichas pregeneradas: cada una se renderiza la primera vez que se pide y se guarda 60 s (así la base de datos no recibe una consulta por visita). */
export function generateStaticParams() {
  return [];
}

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "https://conectari.com";
type Params = Promise<{ vertical: string; slug: string }>;

const esVertical = (v: string): v is VerticalId => v in VERTICAL_POR_ID;
/** Una sola consulta por petición aunque la use la página y sus metadatos. */
const ficha = cache((vertical: VerticalId, slug: string) => obtenerFicha(vertical, slug));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { vertical, slug } = await params;
  if (!esVertical(vertical)) return { title: "Directorio" };
  const { datos } = await ficha(vertical, slug);
  if (!datos) return { title: "Negocio no encontrado" };
  const p = datos.proveedor;
  const ruta = rutaProveedor(vertical, slug);
  const descripcion = p.descripcion || `${etiquetaSubtipo(vertical, p.subtipo)} en ${p.zona || p.ciudad}. Horario, carta y contacto en conectari.com.`;
  return {
    title: `${p.nombre} · ${etiquetaSubtipo(vertical, p.subtipo)} en ${p.ciudad}`,
    description: descripcion.slice(0, 160),
    alternates: { canonical: `${SITIO}${ruta}` },
    openGraph: { title: p.nombre, description: descripcion.slice(0, 160), url: `${SITIO}${ruta}`, ...(p.portadaUrl || p.logoUrl ? { images: [p.portadaUrl ?? p.logoUrl!] } : {}) },
  };
}

export default async function FichaPage({ params }: { params: Params }) {
  const { vertical, slug } = await params;
  if (!esVertical(vertical)) notFound();
  const v = VERTICAL_POR_ID[vertical];
  const { datos, error } = await ficha(vertical, slug);

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

  const { proveedor: p, items, turnos, resenas } = datos;
  const ruta = rutaProveedor(vertical, slug);
  const estado = textoEstadoAbierto(p.horario, p.abierto24h);
  const vigentes = turnosVigentes(turnos);
  const deTurno = estaDeTurno(turnos);
  const grupos = agruparCatalogo(items, "Otros");
  const emoji = v.subtipos.find((s) => s.id === p.subtipo)?.emoji ?? v.emoji;
  const tituloCatalogo = vertical === "delivery" ? "Menú" : vertical === "salud" ? "Productos y servicios" : "Servicios";

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(jsonLdProveedor(p, `${SITIO}${ruta}`)) }} />

      <header className="relative">
        <div className="h-44 bg-gradient-to-br from-slate-200 to-slate-300 sm:h-64">
          {p.portadaUrl ? (
            <img src={p.portadaUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div aria-hidden className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${v.degradado} text-7xl opacity-90`}>
              {emoji}
            </div>
          )}
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <div className="-mt-10 flex flex-wrap items-end gap-4 sm:-mt-12">
            {p.logoUrl ? (
              <img src={p.logoUrl} alt={`Logo de ${p.nombre}`} className="h-20 w-20 rounded-2xl border-4 border-white bg-white object-cover shadow-lg sm:h-24 sm:w-24" />
            ) : (
              <span aria-hidden className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-white text-4xl shadow-lg sm:h-24 sm:w-24">
                {emoji}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-4">
        <nav aria-label="Ruta" className="text-sm text-slate-500">
          <Link href="/directorio" className="hover:underline">
            Directorio
          </Link>{" "}
          <span aria-hidden>›</span>{" "}
          <Link href={`/directorio/${vertical}`} className="hover:underline">
            {v.etiqueta}
          </Link>
        </nav>

        <div className="mt-2">
          <h1 className="text-3xl font-black leading-tight text-ink sm:text-4xl">{p.nombre}</h1>
          <p className="mt-1 text-slate-600">
            {etiquetaSubtipo(vertical, p.subtipo)}
            {p.zona && <> · 📍 {p.zona}</>}
            <> · {p.ciudad}</>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <InsigniaAbierto abierto={estado.abierto} texto={estado.texto} />
            {deTurno && <InsigniaTurno verificado={p.verificado} />}
            {p.verificado && <InsigniaVerificado />}
            <Valoracion rating={p.rating} resenas={p.resenas} />
            {p.pedidos > 0 && <span className="text-xs font-semibold text-slate-500">{p.pedidos} {p.pedidos === 1 ? "pedido entregado" : "pedidos entregados"}</span>}
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-10">
            {p.descripcion && (
              <section aria-labelledby="acerca-titulo">
                <h2 id="acerca-titulo" className="sr-only">
                  Acerca de {p.nombre}
                </h2>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{p.descripcion}</p>
              </section>
            )}

            <section aria-labelledby="catalogo-titulo">
              <h2 id="catalogo-titulo" className="mb-3 text-2xl font-black text-ink">
                {tituloCatalogo}
              </h2>
              {v.plantilla.aviso && <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">ℹ️ Los medicamentos con receta médica no se venden por conectari.com: aquí se muestran solo como información. Consulta siempre a tu médico o farmacéutico.</p>}
              <MenuProveedor grupos={grupos} plural={v.plantilla.item.plural} />
            </section>

            <section aria-labelledby="resenas-titulo" className="space-y-4">
              <h2 id="resenas-titulo" className="text-2xl font-black text-ink">
                Reseñas
              </h2>
              <ListaResenas resenas={resenas} />
              <FormResena proveedorId={p.id} ruta={ruta} />
            </section>
          </div>

          <aside aria-label="Información del negocio" className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <AccionesDueno proveedorId={p.id} ownerId={p.ownerId} />
            <ContactoProveedor proveedorId={p.id} nombre={p.nombre} ruta={ruta} />
            <section aria-labelledby="horario-titulo" className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 id="horario-titulo" className="mb-2 text-sm font-black text-ink">
                Horario
              </h2>
              <HorarioSemanal horario={p.horario} abierto24h={p.abierto24h} />
            </section>
            <section aria-labelledby="atencion-titulo" className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 id="atencion-titulo" className="mb-2 text-sm font-black text-ink">
                Cómo atiende
              </h2>
              <InfoEntrega p={p} />
            </section>
            {v.capacidades.turnos && <TurnosProveedor turnos={vigentes} verificado={p.verificado} />}
            <BotonDenunciar proveedorId={p.id} />
          </aside>
        </div>
      </div>
    </article>
  );
}
