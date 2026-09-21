import type { Metadata } from "next";
import SolicitudesHome from "@/features/directorio/solicitudes/SolicitudesHome";

export const metadata: Metadata = { title: "Solicitudes y ofertas", robots: { index: false } };

export default function SolicitudesPage() {
  return <SolicitudesHome />;
}
