"use client";

import type { Propiedad } from "@/types/propiedad";
import { propiedadAAnuncio } from "@/lib/anuncios";
import AnuncioCard from "@/components/AnuncioCard";

export default function PropertyCard({ propiedad }: { propiedad: Propiedad }) {
  return <AnuncioCard anuncio={propiedadAAnuncio(propiedad)} />;
}
