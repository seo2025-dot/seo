import { manejadoresFotos } from "@/lib/media/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (await manejadoresFotos()).borrar(id);
}
