import type { Metadata } from "next";
import PanelMisNegocios from "@/features/directorio/panel/PanelMisNegocios";

export const metadata: Metadata = { title: "Mi negocio", robots: { index: false } };

export default function MiNegocioPage() {
  return <PanelMisNegocios />;
}
