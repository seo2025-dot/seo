import type { Metadata } from "next";
import MisEntradas from "@/features/directorio/eventos/MisEntradas";

export const metadata: Metadata = { title: "Mis entradas", robots: { index: false } };

export default function EntradasPage() {
  return <MisEntradas />;
}
