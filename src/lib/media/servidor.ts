import { randomUUID } from "node:crypto";
import { almacenamientoLocal, almacenamientoSupabase } from "@/lib/media/almacenamiento";
import { crearManejadores } from "@/lib/media/manejadores";
import { DRIVER_MEDIA, urlMedia } from "@/lib/media/urls";
import { supabaseServidor } from "@/lib/supabase/server";

export const DIRECTORIO_LOCAL = process.env.MEDIA_LOCAL_DIR ?? ".media";

/**
 * Cablea los manejadores con Supabase (sesión por cookies: todas las operaciones se ejecutan CON los permisos del
 * usuario, así que las políticas RLS y de Storage siguen protegiendo los datos; no se usa ninguna clave de servicio).
 */
export async function manejadoresFotos() {
  const sb = await supabaseServidor();
  return crearManejadores({
    async usuario() {
      const { data } = await sb.auth.getUser();
      return data.user ? { id: data.user.id } : null;
    },
    rpc: async (nombre, args) => {
      const r = await sb.rpc(nombre, args);
      return { data: r.data, error: r.error ? { message: r.error.message, code: r.error.code } : null };
    },
    almacenamiento: DRIVER_MEDIA === "local" ? almacenamientoLocal(DIRECTORIO_LOCAL) : almacenamientoSupabase(sb),
    async primeraMiniatura(uid) {
      const { data } = await sb.from("profile_photos").select("thumb_path").eq("user_id", uid).eq("sort_order", 0).maybeSingle();
      return (data as { thumb_path: string } | null)?.thumb_path ?? null;
    },
    async actualizarAvatar(uid, url) {
      const { error } = await sb.from("profiles").update({ avatar_url: url }).eq("id", uid);
      if (error) throw new Error(error.message);
    },
    urlMedia,
    nuevoId: randomUUID,
  });
}
