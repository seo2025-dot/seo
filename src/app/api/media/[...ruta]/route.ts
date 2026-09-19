import { leerLocal } from "@/lib/media/almacenamiento";
import { DIRECTORIO_LOCAL } from "@/lib/media/servidor";
import { DRIVER_MEDIA } from "@/lib/media/urls";

export const runtime = "nodejs";

const TIPOS: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

/** Sirve los archivos del driver "local" (solo desarrollo). Con el driver "supabase" esta ruta no existe (404). */
export async function GET(_req: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  if (DRIVER_MEDIA !== "local") return new Response("No encontrado", { status: 404 });
  const { ruta } = await params;
  const relativa = ruta.join("/");
  const tipo = TIPOS[relativa.split(".").pop()?.toLowerCase() ?? ""];
  if (!tipo) return new Response("No encontrado", { status: 404 });
  let datos: Buffer | null = null;
  try {
    datos = await leerLocal(DIRECTORIO_LOCAL, relativa);
  } catch {
    return new Response("Ruta no válida", { status: 400 });
  }
  if (!datos) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(datos), {
    headers: { "Content-Type": tipo, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
