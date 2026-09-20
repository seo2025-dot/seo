import type { Metadata } from "next";
import Link from "next/link";
import { VERTICAL_POR_ID, etiquetaSubtipo, rutaProveedor } from "@/data/directorio";
import { AvisoConfiguracion, EstadoVacio } from "@/features/directorio/Bloques";
import CajaBusquedaUniversal from "@/features/directorio/CajaBusquedaUniversal";
import { InsigniaAbierto, InsigniaTurno, InsigniaVerificado } from "@/features/directorio/Insignias";
import { consultaUniversal } from "@/lib/directorio/filtros";
import { textoDinero } from "@/lib/directorio/mapeo";
import { buscarEnDirectorio } from "@/lib/directorio/servidor";
import type { HitBusqueda } from "@/types/directorio";

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: Busqueda }): Promise<Metadata> {
  const q = consultaUniversal((await searchParams).q);
  return { title: q ? `${q}: resultados en el directorio` : "Buscar en el directorio", robots: { index: false, follow: true } };
}

function FilaNegocio({ h }: { h: HitBusqueda }) {
  const v = VERTICAL_POR_ID[h.vertical];
  return (
    <li>
      <Link href={rutaProveedor(h.vertical, h.slug)} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:border-brand-300 hover:shadow-sm">
        <span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${v.degradado} text-2xl`}>
          {v.subtipos.find((s) => s.id === h.subtipo)?.emoji ?? v.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-black text-ink">{h.nombre}</span>
          <span className="block truncate text-xs text-slate-500">
            {etiquetaSubtipo(h.vertical, h.subtipo)}
            {h.zona && <> · 📍 {h.zona}</>}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <InsigniaAbierto abierto={h.abierto} />
            {h.deTurno && <InsigniaTurno verificado={h.verificado} />}
            {h.verificado && <InsigniaVerificado />}
          </span>
        </span>
        {h.rating > 0 && (
          <span className="shrink-0 text-xs font-bold text-ink" aria-label={`Valoración ${h.rating.toFixed(1)} de 5`}>
            <span aria-hidden className="text-amber-400">★</span> {h.rating.toFixed(1)}
          </span>
        )}
      </Link>
    </li>
  );
}

function FilaProducto({ h }: { h: HitBusqueda }) {
  const v = VERTICAL_POR_ID[h.vertical];
  return (
    <li>
      <Link href={rutaProveedor(h.vertical, h.slug)} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:border-brand-300 hover:shadow-sm">
        <span aria-hidden className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${v.degradado} text-2xl`}>
          {v.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-ink">{h.item?.nombre}</span>
          <span className="block truncate text-xs text-slate-500">
            en <strong className="text-slate-700">{h.nombre}</strong>
            {h.zona && <> · 📍 {h.zona}</>}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <InsigniaAbierto abierto={h.abierto} />
            {h.deTurno && <InsigniaTurno verificado={h.verificado} />}
            {h.item?.receta && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">℞ Con receta médica</span>}
          </span>
        </span>
        <span className="shrink-0 text-right font-black tabular-nums text-ink">{h.item?.precio === null || h.item?.precio === undefined ? "A convenir" : textoDinero(h.item.precio)}</span>
      </Link>
    </li>
  );
}

export default async function BuscarPage({ searchParams }: { searchParams: Busqueda }) {
  const sp = await searchParams;
  const q = consultaUniversal(sp.q);
  const zona = (Array.isArray(sp.zona) ? sp.zona[0] : sp.zona)?.slice(0, 80) ?? "";
  const { datos, error } = q ? await buscarEnDirectorio(q, zona || undefined) : { datos: [], error: null };
  const negocios = datos.filter((h) => h.tipo === "negocio");
  const productos = datos.filter((h) => h.tipo === "producto");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Ruta" className="mb-2 text-sm text-slate-500">
        <Link href="/directorio" className="hover:underline">
          Directorio
        </Link>{" "}
        <span aria-hidden>›</span> <span className="font-semibold text-slate-700">Buscar</span>
      </nav>
      <h1 className="mb-4 text-3xl font-black text-ink">{q ? <>Resultados para «{q}»</> : "Buscar en el directorio"}</h1>
      <CajaBusquedaUniversal q={q} zona={zona} autoFoco={!q} />

      <div className="mt-8 space-y-8">
        {error && <AvisoConfiguracion mensaje={error} />}
        {!q ? (
          <EstadoVacio emoji="🔎" titulo="Escribe qué buscas" texto="Puedes buscar un plato («ceviche»), un medicamento («paracetamol») o un negocio («farmacia», «cafetería»). Escribe al menos 2 letras." />
        ) : !error && datos.length === 0 ? (
          <EstadoVacio
            emoji="🤷"
            titulo="No encontramos nada con eso"
            texto="Prueba con otra palabra, sin tildes o más corta. Si tienes un negocio que lo ofrezca, publícalo gratis y aparecerá aquí."
            accion={{ href: "/directorio/mi-negocio/nuevo", etiqueta: "Registrar mi negocio" }}
          />
        ) : (
          <>
            {productos.length > 0 && (
              <section aria-labelledby="productos-titulo">
                <h2 id="productos-titulo" className="mb-3 text-xl font-black text-ink">
                  Platos y productos <span className="text-sm font-semibold text-slate-400">({productos.length})</span>
                </h2>
                <ul className="space-y-2">
                  {productos.map((h, i) => (
                    <FilaProducto key={`${h.proveedorId}-${h.item?.nombre}-${i}`} h={h} />
                  ))}
                </ul>
              </section>
            )}
            {negocios.length > 0 && (
              <section aria-labelledby="negocios-titulo">
                <h2 id="negocios-titulo" className="mb-3 text-xl font-black text-ink">
                  Negocios <span className="text-sm font-semibold text-slate-400">({negocios.length})</span>
                </h2>
                <ul className="space-y-2">
                  {negocios.map((h) => (
                    <FilaNegocio key={h.proveedorId} h={h} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
