import type { Metadata } from "next";
import { Suspense } from "react";
import ResultadoPago from "@/features/monedas/ResultadoPago";

export const metadata: Metadata = { title: "Resultado del pago", robots: { index: false } };

export default function ResultadoPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-72 max-w-md animate-pulse px-4 py-10" />}>
      <ResultadoPago />
    </Suspense>
  );
}
