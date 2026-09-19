import { SUPABASE_URL } from "@/lib/supabaseClient";

/** Driver de medios: "local" (desarrollo, carpeta .media) o "supabase" (por defecto). Misma variable en cliente y servidor. */
export const DRIVER_MEDIA = process.env.NEXT_PUBLIC_MEDIA_DRIVER === "local" ? "local" : "supabase";

/**
 * Ruta guardada en la base de datos → URL pública.
 * Admite URLs absolutas (datos de demostración) y rutas del bucket `media` (<user_id>/fotos/<uuid>.webp).
 */
export function urlMedia(ruta: string): string {
  if (/^https?:\/\//i.test(ruta) || ruta.startsWith("data:")) return ruta;
  if (DRIVER_MEDIA === "local") return `/api/media/${ruta}`;
  return `${SUPABASE_URL}/storage/v1/object/public/media/${ruta}`;
}
