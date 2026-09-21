import type { Metadata } from "next";
import Link from "next/link";
import { VERTICALES } from "@/data/directorio";
import { AvisoConfiguracion, InvitacionAlta, TarjetaSeccion } from "@/features/directorio/Bloques";
import CajaBusquedaUniversal from "@/features/directorio/CajaBusquedaUniversal";
import TarjetaProveedor from "@/features/directorio/TarjetaProveedor";
import { contarPorSeccion, proveedoresAbiertos, proveedoresDeTurno } from "@/lib/directorio/servidor";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Directorio: delivery, farmacias y más",
  description: "Encuentra restaurantes con entrega a domicilio, farmacias de turno y negocios de tu ciudad. Busca un plato o un medicamento y compara.",
};

/** Ideas de búsqueda: enlaces directos para descubrir el buscador sin escribir. */
const IDEAS = ["ceviche", "pizza", "café", "almuerzo", "paracetamol", "farmacia", "suero oral", "vitamina C"];

export default async function DirectorioPage() {
  const [conteos, turno, abiertos] = await Promise.all([contarPorSeccion(), proveedoresDeTurno("salud", 6), proveedoresAbiertos("delivery", 6)]);
  const error = conteos.error ?? turno.error ?? abiertos.error;
  const porSeccion = new Map(conteos.datos.map((c) => [c.vertical, c]));

  return (
    <div>
      <section className="hero-suave px-4 pb-10 pt-8 sm:pt-12">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-black leading-tight tracking-tight text-ink sm:text-5xl">
            Directorio <span className="texto-marca">de tu ciudad</span>
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-lg">Delivery, farmacias de turno y negocios locales publicados por la propia comunidad. Busca un plato, un medicamento o un negocio.</p>
          <div className="mt-6 max-w-4xl">
            <CajaBusquedaUniversal />
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href="/directorio/pedidos" className="rounded-full bg-ink px-3 py-1 font-semibold text-white transition hover:bg-brand-700">
              🧾 Mis pedidos
            </Link>
            <span className="font-semibold">Prueba con:</span>
            {IDEAS.map((i) => (
              <Link key={i} href={`/directorio/buscar?q=${encodeURIComponent(i)}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
                {i}
              </Link>
            ))}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 pb-16">
        {error && <AvisoConfiguracion mensaje={error} />}

        <section aria-labelledby="secciones-titulo">
          <h2 id="secciones-titulo" className="mb-4 text-2xl font-black text-ink">
            Secciones
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VERTICALES.map((v) => (
              <TarjetaSeccion key={v.id} v={v} negocios={porSeccion.get(v.id)?.negocios ?? (error ? undefined : 0)} verificados={porSeccion.get(v.id)?.verificados} />
            ))}
          </div>
        </section>

        {turno.datos.length > 0 && (
          <section aria-labelledby="turno-titulo">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 id="turno-titulo" className="text-2xl font-black text-ink">
                🚨 Farmacias de turno ahora
              </h2>
              <Link href="/directorio/salud?turno=1" className="text-sm font-bold text-brand-700 hover:underline">
                Ver todas →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {turno.datos.map((p) => (
                <TarjetaProveedor key={p.id} p={p} />
              ))}
            </div>
          </section>
        )}

        {abiertos.datos.length > 0 && (
          <section aria-labelledby="abiertos-titulo">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 id="abiertos-titulo" className="text-2xl font-black text-ink">
                🍔 Abiertos ahora para pedir
              </h2>
              <Link href="/directorio/delivery?abierto=1" className="text-sm font-bold text-brand-700 hover:underline">
                Ver todos →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {abiertos.datos.map((p) => (
                <TarjetaProveedor key={p.id} p={p} />
              ))}
            </div>
          </section>
        )}

        <InvitacionAlta />
      </div>
    </div>
  );
}
