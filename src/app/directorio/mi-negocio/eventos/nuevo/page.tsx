import type { Metadata } from "next";
import { Suspense } from "react";
import EditorEvento from "@/features/directorio/eventos/EditorEvento";

export const metadata: Metadata = { title: "Publicar un evento", robots: { index: false } };

export default function NuevoEventoPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />}>
      <EditorEvento />
    </Suspense>
  );
}
