import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VERTICAL_POR_ID, etiquetaSubtipo, type VerticalId } from "@/data/directorio";
import { AvisoConfiguracion, EstadoVacio, InvitacionAlta, InvitacionSolicitud } from "@/features/directorio/Bloques";
import FiltrosListado from "@/features/directorio/FiltrosLista";
import TarjetaProveedor from "@/features/directorio/TarjetaProveedor";
import { filtrosActivos, filtrosDesdeParams, hrefLista } from "@/lib/directorio/filtros";
import { buscarProveedores } from "@/lib/directorio/servidor";

type Params = Promise<{ vertical: string }>;
type Busqueda = Promise<Record<string, string | string[] | undefined>>;

const esVertical = (v: string): v is VerticalId => v in VERTICAL_POR_ID;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Busqueda }): Promise<Metadata> {
  const { vertical } = await params;
  if (!esVertical(vertical)) return { title: "Directorio" };
  const v = VERTICAL_POR_ID[vertical];
  const f = filtrosDesdeParams(await searchParams, vertical);
  const categoria = f.subtipo ? etiquetaSubtipo(vertical, f.subtipo) : v.etiqueta;
  return {
    title: `${categoria} en Cuenca`,
    description: `${v.lema}. Compara ${v.etiqueta.toLowerCase()} de tu ciudad, con horarios, valoraciones y contacto.`,
    // Las páginas con filtros o paginación no se indexan: evita miles de variantes duplicadas.
    robots: filtrosActivos(f) > 0 || f.pagina > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function ListadoPage({ params, searchParams }: { params: Params; searchParams: Busqueda }) {
  const { vertical } = await params;
  if (!esVertical(vertical)) notFound();
  const v = VERTICAL_POR_ID[vertical];

  if (!v.activa) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-6xl" aria-hidden>
          {v.emoji}
        </p>
        <h1 className="mt-4 text-3xl font-black text-ink">{v.etiqueta}: muy pronto</h1>
        <p className="mt-2 text-slate-600">{v.lema}. Esta sección llegará en una próxima fase.</p>
        <Link href="/directorio" className="boton-marca mt-6 inline-block rounded-full px-7 py-3 text-sm font-bold text-white">
          Ver el directorio
        </Link>
      </div>
    );
  }

  const filtros = filtrosDesdeParams(await searchParams, vertical);
  const { datos, error } = await buscarProveedores(vertical, filtros);
  const titulo = filtros.subtipo ? etiquetaSubtipo(vertical, filtros.subtipo) : v.etiqueta;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Ruta" className="mb-2 text-sm text-slate-500">
        <Link href="/directorio" className="hover:underline">
          Directorio
        </Link>{" "}
        <span aria-hidden>›</span> <span className="font-semibold text-slate-700">{v.etiqueta}</span>
      </nav>
      <header className="mb-6">
        <h1 className="text-3xl font-black text-ink sm:text-4xl">
          <span aria-hidden>{v.emoji}</span> {titulo} <span className="texto-marca">en tu ciudad</span>
        </h1>
        <p className="mt-1 max-w-2xl text-slate-600">{v.lema}.</p>
      </header>

      <InvitacionSolicitud vertical={vertical} className="mb-6" />

      <FiltrosListado vertical={vertical} filtros={filtros} />

      <div className="mt-6">
        {error && <AvisoConfiguracion mensaje={error} />}

        {!error && datos.items.length === 0 ? (
          filtrosActivos(filtros) > 0 ? (
            <EstadoVacio emoji="🔎" titulo="Ningún negocio coincide con estos filtros" texto="Prueba con menos filtros o busca en toda la ciudad." accion={{ href: `/directorio/${vertical}`, etiqueta: "Quitar filtros" }} />
          ) : (
            <EstadoVacio
              emoji={v.emoji}
              titulo={`Aún no hay ${v.etiqueta.toLowerCase()} publicados`}
              texto="Este directorio lo llena la comunidad. Si tienes un negocio, sé la primera persona en aparecer: es gratis y toma menos de 5 minutos."
              accion={{ href: `/directorio/mi-negocio/nuevo?seccion=${vertical}`, etiqueta: "Registrar mi negocio" }}
            />
          )
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500" aria-live="polite">
              {datos.items.length} {datos.items.length === 1 ? "resultado" : "resultados"}
              {filtros.pagina > 1 && <> · página {filtros.pagina}</>}
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {datos.items.map((p, i) => (
                <TarjetaProveedor key={p.id} p={p} prioridad={i < 3} />
              ))}
            </div>
            {(filtros.pagina > 1 || datos.hayMas) && (
              <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-3">
                {filtros.pagina > 1 && (
                  <Link href={hrefLista(vertical, filtros, { pagina: filtros.pagina - 1 })} rel="prev" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-ink hover:border-brand-400">
                    ← Anterior
                  </Link>
                )}
                {datos.hayMas && (
                  <Link href={hrefLista(vertical, filtros, { pagina: filtros.pagina + 1 })} rel="next" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-ink hover:border-brand-400">
                    Siguiente →
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>

      <InvitacionAlta vertical={vertical} className="mt-14" />
    </div>
  );
}
