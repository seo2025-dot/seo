import { Suspense } from "react";
import type { Metadata } from "next";
import AsistenteAlta from "@/features/directorio/alta/AsistenteAlta";

export const metadata: Metadata = { title: "Registrar mi negocio", robots: { index: false } };

export default function NuevoNegocioPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />}>
      <AsistenteAlta />
    </Suspense>
  );
}
