import type { Metadata } from "next";
import MisPedidos from "@/features/directorio/pedidos/MisPedidos";

export const metadata: Metadata = { title: "Mis pedidos", robots: { index: false } };

export default function PedidosPage() {
  return <MisPedidos />;
}
