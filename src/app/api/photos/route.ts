import { manejadoresFotos } from "@/lib/media/servidor";

export const runtime = "nodejs"; // sharp necesita Node (no Edge)
export const dynamic = "force-dynamic";

/** Sube UNA foto por petición (campo `file`). El cliente las envía de una en una: progreso y reintentos individuales. */
export async function POST(req: Request) {
  return (await manejadoresFotos()).subir(req);
}

/** Reordena las fotos del usuario. Body: { ids: string[] } */
export async function PATCH(req: Request) {
  return (await manejadoresFotos()).reordenar(req);
}
