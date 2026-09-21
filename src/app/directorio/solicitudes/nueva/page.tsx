import type { Metadata } from "next";
import { Suspense } from "react";
import NuevaSolicitud from "@/features/directorio/solicitudes/NuevaSolicitud";

export const metadata: Metadata = { title: "Pedir ofertas", robots: { index: false } };

export default function NuevaSolicitudPage() {
  // useSearchParams (?seccion=hogar&tipo=plomero) exige Suspense para no desactivar el prerenderizado de toda la página.
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />}>
      <NuevaSolicitud />
    </Suspense>
  );
}
