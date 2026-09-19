"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import DetalleAnuncio from "@/components/DetalleAnuncio";

export default function MercadoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { hidratado, obtenerAnuncio, vehiculos, negocios } = useSocial();
  const anuncio = obtenerAnuncio(id);

  if (!hidratado) return <div className="mx-auto h-96 max-w-4xl animate-pulse px-4 py-10" />;

  if (!anuncio || anuncio.tipo === "propiedad") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-4xl">🔍</p>
        <h1 className="mt-3 text-xl font-bold">No encontramos esta oferta</h1>
        <Link href="/mercado" className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700">
          Ver mercado
        </Link>
      </div>
    );
  }

  if (anuncio.tipo === "vehiculo") {
    const v = vehiculos.find((x) => x.id === id);
    return (
      <DetalleAnuncio
        anuncio={anuncio}
        fotos={[anuncio.imagen]}
        extras={v?.extras ?? []}
        volver={{ href: "/mercado?cat=vehiculos", label: "Volver a vehículos" }}
        specs={[
          { label: "Marca y modelo", valor: v ? `${v.marca} ${v.modelo}` : anuncio.subtipo },
          { label: "Año", valor: String(v?.anio ?? "—") },
          { label: "Kilometraje", valor: v ? `${v.km.toLocaleString("es-ES")} km` : "—" },
          { label: "Operación", valor: anuncio.operacion ?? "" },
        ]}
      />
    );
  }

  const n = negocios.find((x) => x.id === id);
  return (
    <DetalleAnuncio
      anuncio={anuncio}
      fotos={[anuncio.imagen]}
      extras={[]}
      volver={{ href: "/mercado?cat=negocios", label: "Volver a negocios" }}
      specs={[
        { label: "Rubro", valor: n?.rubro ?? anuncio.subtipo },
        { label: "Inversión", valor: `${anuncio.precio.toLocaleString("es-ES")} ${anuncio.moneda}` },
        { label: "Retorno estimado", valor: n?.retorno ?? "—" },
        { label: "Ubicación", valor: anuncio.ubicacion },
      ]}
    />
  );
}
