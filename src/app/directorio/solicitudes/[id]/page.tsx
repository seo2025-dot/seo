import type { Metadata } from "next";
import { Suspense } from "react";
import DetalleSolicitud from "@/features/directorio/solicitudes/DetalleSolicitud";

export const metadata: Metadata = { title: "Solicitud", robots: { index: false } };

export default async function SolicitudPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />}>
      <DetalleSolicitud id={id} />
    </Suspense>
  );
}
