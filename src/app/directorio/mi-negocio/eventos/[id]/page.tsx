import type { Metadata } from "next";
import { Suspense } from "react";
import EditorEvento from "@/features/directorio/eventos/EditorEvento";

export const metadata: Metadata = { title: "Editar evento", robots: { index: false } };

export default async function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse px-4 py-10" />}>
      <EditorEvento id={id} />
    </Suspense>
  );
}
