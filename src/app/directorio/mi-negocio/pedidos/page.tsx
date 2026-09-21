import type { Metadata } from "next";
import BandejaNegocio from "@/features/directorio/pedidos/BandejaNegocio";

export const metadata: Metadata = { title: "Pedidos recibidos", robots: { index: false } };

export default function PedidosNegocioPage() {
  return <BandejaNegocio />;
}
