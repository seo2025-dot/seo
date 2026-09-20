import type { Metadata } from "next";
import EditorNegocio from "@/features/directorio/panel/EditorNegocio";

export const metadata: Metadata = { title: "Editar mi negocio", robots: { index: false } };

export default async function EditarNegocioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorNegocio id={id} />;
}
