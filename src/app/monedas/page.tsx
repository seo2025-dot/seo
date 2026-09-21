import type { Metadata } from "next";
import PaginaMonedas from "@/features/monedas/PaginaMonedas";

export const metadata: Metadata = { title: "Monedas", robots: { index: false } };

export default function MonedasPage() {
  return <PaginaMonedas />;
}
