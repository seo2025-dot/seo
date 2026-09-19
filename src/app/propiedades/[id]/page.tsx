"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import { propiedadAAnuncio } from "@/lib/anuncios";
import DetalleAnuncio from "@/components/DetalleAnuncio";

export default function PropiedadPage() {
  const { id } = useParams<{ id: string }>();
  const { hidratado, obtenerPropiedad } = useSocial();
  const p = obtenerPropiedad(id);

  if (!hidratado) return <div className="mx-auto h-96 max-w-4xl animate-pulse px-4 py-10" />;

  if (!p) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-4xl">🔍</p>
        <h1 className="mt-3 text-xl font-bold">No encontramos esta propiedad</h1>
        <p className="mt-1 text-sm text-slate-500">Puede que el anfitrión la haya retirado.</p>
        <Link href="/propiedades" className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700">
          Ver propiedades
        </Link>
      </div>
    );
  }

  return (
    <DetalleAnuncio
      anuncio={propiedadAAnuncio(p)}
      fotos={[p.imagen, ...(p.galeria ?? [])]}
      extras={p.comodidades}
      volver={{ href: "/propiedades", label: "Volver a inmuebles" }}
      specs={[
        { label: "Dormitorios", valor: String(p.dormitorios) },
        { label: "Baños", valor: String(p.banos) },
        { label: "Superficie", valor: `${p.superficie} m²` },
        { label: "Operación", valor: p.operacion },
      ]}
    />
  );
}
