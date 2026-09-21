import type { Metadata } from "next";
import PanelEventos from "@/features/directorio/eventos/PanelEventos";

export const metadata: Metadata = { title: "Mis eventos", robots: { index: false } };

export default function MisEventosPage() {
  return <PanelEventos />;
}
