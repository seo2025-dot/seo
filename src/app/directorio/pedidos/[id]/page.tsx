import type { Metadata } from "next";
import { Suspense } from "react";
import DetallePedido from "@/features/directorio/pedidos/DetallePedido";

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false } };

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // useSearchParams (aviso «¡Pedido enviado!») exige Suspense para no desactivar el prerenderizado de toda la página.
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />}>
      <DetallePedido id={id} />
    </Suspense>
  );
}
